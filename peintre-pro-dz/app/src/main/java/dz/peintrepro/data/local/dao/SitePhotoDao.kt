package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import dz.peintrepro.data.local.entity.SitePhotoEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SitePhotoDao {

    @Query("SELECT * FROM site_photos WHERE siteId = :siteId ORDER BY createdAt ASC")
    fun observeBySite(siteId: Long): Flow<List<SitePhotoEntity>>

    @Insert
    suspend fun insert(photo: SitePhotoEntity): Long

    @Delete
    suspend fun delete(photo: SitePhotoEntity)
}
