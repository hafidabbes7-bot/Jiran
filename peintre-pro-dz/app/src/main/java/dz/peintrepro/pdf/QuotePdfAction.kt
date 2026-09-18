package dz.peintrepro.pdf

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Issue de la génération d'un PDF. */
sealed interface ResultatPdf {
    data class Ok(val fichier: File) : ResultatPdf
    data object Echec : ResultatPdf
}

/**
 * Génère le PDF hors du fil principal. L'écran décide ensuite d'ouvrir
 * le fichier ou de le partager.
 */
suspend fun genererPdf(context: Context, data: QuotePdfData): ResultatPdf =
    withContext(Dispatchers.IO) {
        try {
            ResultatPdf.Ok(QuotePdfGenerator(context).generate(data))
        } catch (erreur: Exception) {
            ResultatPdf.Echec
        }
    }
