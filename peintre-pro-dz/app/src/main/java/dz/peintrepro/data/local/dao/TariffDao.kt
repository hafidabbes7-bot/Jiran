package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.TariffEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TariffDao {

    @Query("SELECT * FROM tariffs ORDER BY position ASC, id ASC")
    fun observeAll(): Flow<List<TariffEntity>>

    @Query("SELECT * FROM tariffs WHERE level = :level ORDER BY position ASC, id ASC")
    fun observeByLevel(level: String): Flow<List<TariffEntity>>

    @Query("SELECT * FROM tariffs WHERE level = :level ORDER BY position ASC, id ASC")
    suspend fun getByLevel(level: String): List<TariffEntity>

    @Query("SELECT COUNT(*) FROM tariffs")
    suspend fun count(): Int

    @Query("SELECT IFNULL(MAX(position), -1) + 1 FROM tariffs")
    suspend fun nextPosition(): Int

    @Insert
    suspend fun insert(tariff: TariffEntity): Long

    @Insert
    suspend fun insertAll(tariffs: List<TariffEntity>)

    @Update
    suspend fun update(tariff: TariffEntity)

    @Delete
    suspend fun delete(tariff: TariffEntity)

    @Query("DELETE FROM tariffs")
    suspend fun deleteAll()
}
