package dz.peintrepro.data.repository

import dz.peintrepro.data.local.dao.SiteDao
import dz.peintrepro.data.local.entity.SiteEntity
import kotlinx.coroutines.flow.Flow

class SiteRepository(private val siteDao: SiteDao) {

    fun observeAll(): Flow<List<SiteEntity>> = siteDao.observeAll()

    fun observeByClient(clientId: Long): Flow<List<SiteEntity>> = siteDao.observeByClient(clientId)

    fun observeById(id: Long): Flow<SiteEntity?> = siteDao.observeById(id)

    suspend fun getByQuote(quoteId: Long): SiteEntity? = siteDao.getByQuote(quoteId)

    suspend fun save(site: SiteEntity): Long =
        if (site.id == 0L) siteDao.insert(site) else {
            siteDao.update(site); site.id
        }

    suspend fun delete(site: SiteEntity) = siteDao.delete(site)
}
