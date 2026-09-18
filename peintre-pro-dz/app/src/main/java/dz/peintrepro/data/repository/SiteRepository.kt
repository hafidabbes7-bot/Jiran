package dz.peintrepro.data.repository

import dz.peintrepro.data.local.dao.QuoteDao
import dz.peintrepro.data.local.dao.SiteDao
import dz.peintrepro.data.local.entity.SiteEntity
import dz.peintrepro.data.local.relation.SiteListRow
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteStatus
import kotlinx.coroutines.flow.Flow

/** Résultat de la conversion d'un devis en chantier. */
sealed interface ConversionChantier {
    /** Le chantier vient d'être créé. */
    data class Cree(val siteId: Long) : ConversionChantier

    /** Un chantier existait déjà pour ce devis : on y renvoie l'utilisateur. */
    data class DejaExistant(val siteId: Long) : ConversionChantier

    /** Le devis n'est pas accepté : la conversion est refusée. */
    data object DevisNonAccepte : ConversionChantier

    data object Introuvable : ConversionChantier
}

class SiteRepository(
    private val siteDao: SiteDao,
    private val quoteDao: QuoteDao
) {

    fun observeAll(): Flow<List<SiteEntity>> = siteDao.observeAll()

    fun observeRows(): Flow<List<SiteListRow>> = siteDao.observeAllRows()

    fun observeByClient(clientId: Long): Flow<List<SiteEntity>> = siteDao.observeByClient(clientId)

    fun observeById(id: Long): Flow<SiteEntity?> = siteDao.observeById(id)

    suspend fun getById(id: Long): SiteEntity? = siteDao.getById(id)

    suspend fun getByQuote(quoteId: Long): SiteEntity? = siteDao.getByQuote(quoteId)

    suspend fun save(site: SiteEntity): Long {
        val propre = site.copy(
            progress = site.progress.coerceIn(0, 100),
            address = site.address.trim(),
            notes = site.notes.trim()
        )
        return if (propre.id == 0L) siteDao.insert(propre) else {
            siteDao.update(propre); propre.id
        }
    }

    suspend fun deleteById(id: Long) = siteDao.deleteById(id)

    /**
     * Transforme un devis accepté en chantier. Un devis ne donne qu'un seul
     * chantier : si la conversion a déjà eu lieu, on rouvre le chantier existant.
     */
    suspend fun convertirDepuisDevis(quoteId: Long): ConversionChantier {
        val quote = quoteDao.getById(quoteId) ?: return ConversionChantier.Introuvable
        if (QuoteStatus.from(quote.status) != QuoteStatus.ACCEPTED) {
            return ConversionChantier.DevisNonAccepte
        }
        siteDao.getByQuote(quoteId)?.let { return ConversionChantier.DejaExistant(it.id) }

        val id = siteDao.insert(
            SiteEntity(
                clientId = quote.clientId,
                quoteId = quote.id,
                address = quote.siteAddress,
                startDateMillis = System.currentTimeMillis(),
                status = SiteStatus.PREPARATION.name,
                progress = 0,
                notes = quote.notes
            )
        )
        return ConversionChantier.Cree(id)
    }
}
