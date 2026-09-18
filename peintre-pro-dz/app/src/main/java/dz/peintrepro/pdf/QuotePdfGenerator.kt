package dz.peintrepro.pdf

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.domain.model.SiteType
import dz.peintrepro.domain.model.UnitType
import java.io.File
import java.io.FileOutputStream

/**
 * Génère le devis en PDF avec les seules API d'Android (android.graphics.pdf) :
 * aucune librairie externe, aucune connexion. Le fichier est écrit dans le
 * cache de l'application, d'où il est partagé via un FileProvider.
 *
 * Format A4 à 72 points par pouce : 595 x 842 points.
 */
class QuotePdfGenerator(private val context: Context) {

    private companion object {
        const val LARGEUR = 595
        const val HAUTEUR = 842
        const val MARGE = 40f
        const val BAS_CONTENU = 782f
        const val DROITE = 555f

        // Colonnes du tableau.
        const val COL_DESIGNATION = 40f
        const val COL_QTE_DROITE = 330f
        const val COL_UNITE = 340f
        const val COL_PU_DROITE = 470f
        const val COL_TOTAL_DROITE = 555f
        const val LARGEUR_DESIGNATION = 280f

        val VERT = Color.parseColor("#1B5E5A")
        val NOIR = Color.parseColor("#16201F")
        val GRIS = Color.parseColor("#5E6C6A")
        val TRAIT = Color.parseColor("#DFDCD2")
    }

    private val titre = paint(22f, gras = true, couleur = VERT)
    private val sousTitre = paint(13f, gras = true, couleur = NOIR)
    private val etiquette = paint(8.5f, gras = true, couleur = GRIS)
    private val normal = paint(10f, couleur = NOIR)
    private val normalGras = paint(10f, gras = true, couleur = NOIR)
    private val petit = paint(9f, couleur = GRIS)
    private val grandTotal = paint(14f, gras = true, couleur = VERT)
    private val filet = Paint().apply {
        isAntiAlias = true
        color = TRAIT
        strokeWidth = 0.8f
    }
    private val filetFort = Paint().apply {
        isAntiAlias = true
        color = VERT
        strokeWidth = 2f
    }

    private fun paint(taille: Float, gras: Boolean = false, couleur: Int = NOIR) = Paint().apply {
        isAntiAlias = true
        textSize = taille
        color = couleur
        typeface = if (gras) Typeface.create(Typeface.DEFAULT, Typeface.BOLD) else Typeface.DEFAULT
    }

    /**
     * Écrit le PDF et retourne le fichier créé.
     * Le document est dessiné deux fois : une première passe compte les pages,
     * la seconde imprime « Page 1 / 3 » avec le bon total.
     */
    fun generate(data: QuotePdfData): File {
        val brouillon = PdfDocument()
        val pages = try {
            dessiner(brouillon, data, null)
        } finally {
            brouillon.close()
        }

        val document = PdfDocument()
        try {
            dessiner(document, data, pages)
            val dossier = File(context.cacheDir, "devis").apply { mkdirs() }
            val fichier = File(dossier, nomFichier(data))
            FileOutputStream(fichier).use { document.writeTo(it) }
            return fichier
        } finally {
            document.close()
        }
    }

    private fun nomFichier(data: QuotePdfData): String {
        val base = data.quote.number.ifBlank { "devis" }.replace(Regex("[^A-Za-z0-9_-]"), "_")
        return "$base.pdf"
    }

    // ------------------------------------------------------------------ dessin

    private class Etat(var page: PdfDocument.Page, var canvas: Canvas, var y: Float, var numero: Int)

    private fun dessiner(document: PdfDocument, data: QuotePdfData, totalPages: Int?): Int {
        val etat = nouvellePage(document, 1)
        var e = etat
        e.y = enTete(e.canvas, data)
        e.y = blocsClient(e.canvas, e.y, data)
        e.y = enTeteTableau(e.canvas, e.y)

        val devise = data.settings.currency
        for (ligne in data.lines) {
            val nomPiece = ligne.roomId?.let { data.roomNames[it] }
            val designation = if (nomPiece.isNullOrBlank()) ligne.designation
            else "${ligne.designation} — $nomPiece"
            val morceaux = couper(designation, normal, LARGEUR_DESIGNATION)
            val hauteurLigne = morceaux.size * 12f + 8f

            if (e.y + hauteurLigne > BAS_CONTENU - 40f) {
                e = pageSuivante(document, e, data, totalPages)
                e.y = enTeteTableau(e.canvas, e.y)
            }

            morceaux.forEachIndexed { index, morceau ->
                e.canvas.drawText(morceau, COL_DESIGNATION, e.y + 10f + index * 12f, normal)
            }
            val ligneBase = e.y + 10f
            texteDroite(e.canvas, Formats.decimal(ligne.quantity), COL_QTE_DROITE, ligneBase, normal)
            e.canvas.drawText(uniteLisible(ligne.unit), COL_UNITE, ligneBase, normal)
            texteDroite(e.canvas, Formats.money(ligne.unitPrice, devise), COL_PU_DROITE, ligneBase, normal)
            texteDroite(e.canvas, Formats.money(ligne.total, devise), COL_TOTAL_DROITE, ligneBase, normalGras)

            e.y += hauteurLigne
            e.canvas.drawLine(MARGE, e.y - 4f, DROITE, e.y - 4f, filet)
        }

        // Totaux : on garde le bloc entier sur une seule page.
        val hauteurTotaux = 24f * (5 + (if (data.totals.discount > 0) 1 else 0) +
            (if (data.quote.vatEnabled) 1 else 0))
        if (e.y + hauteurTotaux > BAS_CONTENU - 40f) {
            e = pageSuivante(document, e, data, totalPages)
        }
        e.y = totaux(e.canvas, e.y + 8f, data)

        val hauteurConditions = 150f
        if (e.y + hauteurConditions > BAS_CONTENU - 40f) {
            e = pageSuivante(document, e, data, totalPages)
        }
        e.y = conditions(e.canvas, e.y + 14f, data)
        signature(e.canvas, e.y + 18f)

        piedDePage(e.canvas, e.numero, totalPages)
        document.finishPage(e.page)
        return e.numero
    }

    private fun nouvellePage(document: PdfDocument, numero: Int): Etat {
        val info = PdfDocument.PageInfo.Builder(LARGEUR, HAUTEUR, numero).create()
        val page = document.startPage(info)
        return Etat(page, page.canvas, MARGE, numero)
    }

    private fun pageSuivante(
        document: PdfDocument,
        courant: Etat,
        data: QuotePdfData,
        totalPages: Int?
    ): Etat {
        piedDePage(courant.canvas, courant.numero, totalPages)
        document.finishPage(courant.page)
        val suivant = nouvellePage(document, courant.numero + 1)
        suivant.y = enTeteCourt(suivant.canvas, data)
        return suivant
    }

    private fun enTete(canvas: Canvas, data: QuotePdfData): Float {
        val p = data.settings
        var y = MARGE + 16f

        val logo = chargerLogo(p.logoUri)
        if (logo != null) {
            val ratio = logo.width.toFloat() / logo.height.toFloat()
            val hauteur = 54f
            val largeur = (hauteur * ratio).coerceAtMost(150f)
            val destination = android.graphics.RectF(
                DROITE - largeur, MARGE, DROITE, MARGE + hauteur
            )
            canvas.drawBitmap(logo, null, destination, null)
        }

        canvas.drawText(
            p.companyName.ifBlank { context.getString(R.string.app_title) },
            MARGE, y, titre
        )
        y += 16f
        listOf(p.phone, p.address, p.email).filter { it.isNotBlank() }.forEach { ligne ->
            canvas.drawText(ligne, MARGE, y, petit)
            y += 12f
        }

        y += 10f
        canvas.drawLine(MARGE, y, DROITE, y, filetFort)
        y += 24f

        canvas.drawText(
            "${context.getString(R.string.pdf_quote)} N° ${data.quote.number}",
            MARGE, y, sousTitre
        )
        texteDroite(canvas, Formats.date(data.quote.dateMillis), DROITE, y, normal)
        return y + 18f
    }

    /** En-tête allégé pour les pages suivantes. */
    private fun enTeteCourt(canvas: Canvas, data: QuotePdfData): Float {
        val y = MARGE + 12f
        canvas.drawText(
            data.settings.companyName.ifBlank { context.getString(R.string.app_title) },
            MARGE, y, normalGras
        )
        texteDroite(
            canvas,
            "${context.getString(R.string.pdf_quote)} N° ${data.quote.number}",
            DROITE, y, petit
        )
        canvas.drawLine(MARGE, y + 8f, DROITE, y + 8f, filet)
        return y + 26f
    }

    private fun blocsClient(canvas: Canvas, depart: Float, data: QuotePdfData): Float {
        var y = depart
        canvas.drawText(context.getString(R.string.pdf_client).uppercase(), MARGE, y, etiquette)
        canvas.drawText(context.getString(R.string.pdf_site).uppercase(), 310f, y, etiquette)
        y += 14f

        val client = data.client
        val gauche = listOfNotNull(
            client?.name,
            client?.phone?.takeIf { it.isNotBlank() },
            client?.address?.takeIf { it.isNotBlank() }
        )
        val type = SiteType.from(data.quote.siteType)
        val droite = listOfNotNull(
            context.getString(type.labelRes),
            data.quote.siteAddress.takeIf { it.isNotBlank() }
        )

        val lignesGauche = gauche.flatMap { couper(it, normal, 250f) }
        val lignesDroite = droite.flatMap { couper(it, normal, 240f) }
        val hauteur = maxOf(lignesGauche.size, lignesDroite.size)
        for (index in 0 until hauteur) {
            lignesGauche.getOrNull(index)?.let { canvas.drawText(it, MARGE, y, normal) }
            lignesDroite.getOrNull(index)?.let { canvas.drawText(it, 310f, y, normal) }
            y += 12f
        }
        return y + 14f
    }

    private fun enTeteTableau(canvas: Canvas, depart: Float): Float {
        val y = depart + 10f
        canvas.drawText(context.getString(R.string.line_designation).uppercase(), COL_DESIGNATION, y, etiquette)
        texteDroite(canvas, context.getString(R.string.line_quantity).uppercase(), COL_QTE_DROITE, y, etiquette)
        canvas.drawText(context.getString(R.string.line_unit).uppercase(), COL_UNITE, y, etiquette)
        texteDroite(canvas, context.getString(R.string.line_unit_price).uppercase(), COL_PU_DROITE, y, etiquette)
        texteDroite(canvas, context.getString(R.string.line_total).uppercase(), COL_TOTAL_DROITE, y, etiquette)
        canvas.drawLine(MARGE, y + 6f, DROITE, y + 6f, filetFort)
        return y + 14f
    }

    private fun totaux(canvas: Canvas, depart: Float, data: QuotePdfData): Float {
        val t = data.totals
        val devise = data.settings.currency
        var y = depart
        val etiquetteX = 320f

        fun rangee(libelle: String, valeur: String, gras: Boolean = false) {
            canvas.drawText(libelle, etiquetteX, y, if (gras) normalGras else petit)
            texteDroite(canvas, valeur, COL_TOTAL_DROITE, y, if (gras) normalGras else normal)
            y += 16f
        }

        rangee(context.getString(R.string.total_subtotal), Formats.money(t.subtotal, devise), true)
        if (t.discount > 0) {
            rangee(context.getString(R.string.total_discount), "- " + Formats.money(t.discount, devise))
            rangee(context.getString(R.string.total_after_discount), Formats.money(t.afterDiscount, devise))
        }
        if (data.quote.vatEnabled) {
            rangee(
                "${context.getString(R.string.total_vat)} ${Formats.decimal(t.vatRate)} %",
                Formats.money(t.vatAmount, devise)
            )
        }

        canvas.drawLine(etiquetteX, y - 8f, DROITE, y - 8f, filetFort)
        y += 8f
        canvas.drawText(context.getString(R.string.total_grand), etiquetteX, y, grandTotal)
        texteDroite(canvas, Formats.money(t.total, devise), COL_TOTAL_DROITE, y, grandTotal)
        y += 20f

        if (t.deposit > 0) rangee(context.getString(R.string.total_deposit), Formats.money(t.deposit, devise))
        if (t.paid > 0) rangee(context.getString(R.string.total_paid), Formats.money(t.paid, devise))
        rangee(context.getString(R.string.total_remaining), Formats.money(t.remaining, devise), true)

        return y
    }

    private fun conditions(canvas: Canvas, depart: Float, data: QuotePdfData): Float {
        var y = depart
        canvas.drawText(context.getString(R.string.pdf_conditions).uppercase(), MARGE, y, etiquette)
        y += 14f

        val textes = mutableListOf<String>()
        textes += context.getString(R.string.pdf_validity, data.quote.validityDays)
        data.quote.paymentTerms.takeIf { it.isNotBlank() }?.lines()?.forEach { textes += it }
        data.quote.observations.takeIf { it.isNotBlank() }?.let { observations ->
            textes += context.getString(R.string.pdf_observations) + " : " + observations
        }
        data.quote.notes.takeIf { it.isNotBlank() }?.let { notes ->
            textes += context.getString(R.string.pdf_duration) + " : " + notes
        }
        textes += context.getString(R.string.pdf_estimate_note)

        textes.flatMap { couper(it, petit, DROITE - MARGE) }.forEach { ligne ->
            canvas.drawText(ligne, MARGE, y, petit)
            y += 12f
        }
        return y
    }

    private fun signature(canvas: Canvas, depart: Float) {
        val y = depart + 40f
        canvas.drawLine(MARGE, y, 260f, y, filet)
        canvas.drawLine(335f, y, DROITE, y, filet)
        canvas.drawText(context.getString(R.string.pdf_signature_client), MARGE, y + 12f, petit)
        canvas.drawText(context.getString(R.string.pdf_signature_company), 335f, y + 12f, petit)
    }

    private fun piedDePage(canvas: Canvas, numero: Int, total: Int?) {
        val y = HAUTEUR - 28f
        canvas.drawLine(MARGE, y - 12f, DROITE, y - 12f, filet)
        if (total != null) {
            texteDroite(canvas, context.getString(R.string.pdf_page, numero, total), DROITE, y, petit)
        }
        canvas.drawText(context.getString(R.string.app_title), MARGE, y, petit)
    }

    // ------------------------------------------------------------------ outils

    private fun texteDroite(canvas: Canvas, texte: String, x: Float, y: Float, peinture: Paint) {
        val alignement = peinture.textAlign
        peinture.textAlign = Paint.Align.RIGHT
        canvas.drawText(texte, x, y, peinture)
        peinture.textAlign = alignement
    }

    /** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
    private fun couper(texte: String, peinture: Paint, largeurMax: Float): List<String> {
        if (texte.isBlank()) return listOf("")
        val mots = texte.trim().split(" ")
        val lignes = mutableListOf<String>()
        var courante = StringBuilder()
        for (mot in mots) {
            val essai = if (courante.isEmpty()) mot else "$courante $mot"
            if (peinture.measureText(essai) <= largeurMax || courante.isEmpty()) {
                courante = StringBuilder(essai)
            } else {
                lignes += courante.toString()
                courante = StringBuilder(mot)
            }
        }
        if (courante.isNotEmpty()) lignes += courante.toString()
        return lignes
    }

    private fun uniteLisible(unite: String): String =
        context.getString(UnitType.from(unite).labelRes)

    private fun chargerLogo(uri: String?): Bitmap? {
        if (uri.isNullOrBlank()) return null
        return try {
            context.contentResolver.openInputStream(Uri.parse(uri))?.use { flux ->
                BitmapFactory.decodeStream(flux)
            }
        } catch (erreur: Exception) {
            null
        }
    }
}
