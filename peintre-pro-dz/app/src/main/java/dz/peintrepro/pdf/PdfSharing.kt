package dz.peintrepro.pdf

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.File

/**
 * Partage et ouverture du PDF par le système Android : l'utilisateur choisit
 * lui-même WhatsApp, l'email, Bluetooth, Drive… Aucune application n'est
 * intégrée en dur (règle de la V1).
 */
object PdfSharing {

    private fun uriPour(context: Context, fichier: File): Uri =
        FileProvider.getUriForFile(context, context.packageName + ".fileprovider", fichier)

    fun partager(context: Context, fichier: File, sujet: String, titre: String): Boolean {
        val uri = uriPour(context, fichier)
        val envoi = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, sujet)
            putExtra(Intent.EXTRA_TEXT, sujet)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val selecteur = Intent.createChooser(envoi, titre).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return demarrer(context, selecteur)
    }

    fun ouvrir(context: Context, fichier: File): Boolean {
        val uri = uriPour(context, fichier)
        val vue = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/pdf")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        return demarrer(context, vue)
    }

    private fun demarrer(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent)
        true
    } catch (erreur: ActivityNotFoundException) {
        false
    }
}
