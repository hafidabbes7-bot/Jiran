package dz.peintrepro.data.repository

import dz.peintrepro.data.local.DefaultData
import dz.peintrepro.data.local.dao.TariffDao
import dz.peintrepro.data.local.entity.TariffEntity
import kotlinx.coroutines.flow.Flow

class TariffRepository(private val tariffDao: TariffDao) {

    fun observeAll(): Flow<List<TariffEntity>> = tariffDao.observeAll()

    fun observeByLevel(level: String): Flow<List<TariffEntity>> = tariffDao.observeByLevel(level)

    suspend fun getByLevel(level: String): List<TariffEntity> = tariffDao.getByLevel(level)

    suspend fun save(tariff: TariffEntity): Long {
        val cleaned = tariff.copy(
            label = tariff.label.trim(),
            price = tariff.price.coerceAtLeast(0.0)
        )
        return if (cleaned.id == 0L) {
            tariffDao.insert(cleaned.copy(position = tariffDao.nextPosition()))
        } else {
            tariffDao.update(cleaned)
            cleaned.id
        }
    }

    suspend fun delete(tariff: TariffEntity) = tariffDao.delete(tariff)

    /** Rétablit le catalogue d'exemple. Les devis déjà enregistrés ne changent pas. */
    suspend fun resetToDefaults() {
        tariffDao.deleteAll()
        tariffDao.insertAll(DefaultData.defaultTariffs())
    }

    suspend fun ensureNotEmpty() {
        if (tariffDao.count() == 0) {
            tariffDao.insertAll(DefaultData.defaultTariffs())
        }
    }
}
