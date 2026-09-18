package dz.peintrepro.data.repository

import dz.peintrepro.data.local.DefaultData
import dz.peintrepro.data.local.dao.SettingsDao
import dz.peintrepro.data.local.entity.SettingsEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class SettingsRepository(private val settingsDao: SettingsDao) {

    fun observe(): Flow<SettingsEntity> =
        settingsDao.observe(SettingsEntity.SINGLETON_ID).map { it ?: defaultSettings() }

    suspend fun get(): SettingsEntity =
        settingsDao.get(SettingsEntity.SINGLETON_ID) ?: defaultSettings().also { save(it) }

    suspend fun save(settings: SettingsEntity) {
        settingsDao.upsert(settings.copy(id = SettingsEntity.SINGLETON_ID))
    }

    /** Garantit la présence de la ligne unique de paramètres (bases anciennes). */
    suspend fun ensureExists() {
        settingsDao.insertIfAbsent(defaultSettings())
    }

    private fun defaultSettings() = SettingsEntity(conditions = DefaultData.defaultConditions)
}
