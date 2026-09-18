package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.SiteEntity
import dz.peintrepro.data.local.relation.SiteListRow
import kotlinx.coroutines.flow.Flow

@Dao
interface SiteDao {

    @Query("SELECT * FROM sites ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<SiteEntity>>

    @Query("SELECT * FROM sites WHERE clientId = :clientId ORDER BY createdAt DESC")
    fun observeByClient(clientId: Long): Flow<List<SiteEntity>>

    @Query("SELECT * FROM sites WHERE id = :id")
    fun observeById(id: Long): Flow<SiteEntity?>

    @Query("SELECT * FROM sites WHERE quoteId = :quoteId LIMIT 1")
    suspend fun getByQuote(quoteId: Long): SiteEntity?

    @Query("SELECT COUNT(*) FROM sites WHERE status = :status")
    fun observeCountByStatus(status: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM sites WHERE status = :status AND IFNULL(endDateMillis, createdAt) >= :from")
    fun observeCountByStatusSince(status: String, from: Long): Flow<Int>

    @Query(
        """
        SELECT s.id AS id, s.clientId AS clientId, c.name AS clientName,
               s.quoteId AS quoteId, q.number AS quoteNumber, s.address AS address,
               s.startDateMillis AS startDateMillis, s.endDateMillis AS endDateMillis,
               s.status AS status, s.progress AS progress
        FROM sites s
        INNER JOIN clients c ON c.id = s.clientId
        LEFT JOIN quotes q ON q.id = s.quoteId
        ORDER BY s.createdAt DESC, s.id DESC
        """
    )
    fun observeAllRows(): Flow<List<SiteListRow>>

    @Query("SELECT * FROM sites WHERE id = :id")
    suspend fun getById(id: Long): SiteEntity?

    @Query("DELETE FROM sites WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Insert
    suspend fun insert(site: SiteEntity): Long

    @Update
    suspend fun update(site: SiteEntity)

    @Delete
    suspend fun delete(site: SiteEntity)
}
