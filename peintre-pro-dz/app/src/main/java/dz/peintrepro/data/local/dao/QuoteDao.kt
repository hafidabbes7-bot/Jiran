package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.QuoteEntity
import dz.peintrepro.data.local.relation.QuoteListRow
import kotlinx.coroutines.flow.Flow

@Dao
interface QuoteDao {

    @Query(
        """
        SELECT q.id AS id, q.number AS number, q.clientId AS clientId,
               c.name AS clientName, q.siteAddress AS siteAddress,
               q.totalAmount AS totalAmount, q.status AS status,
               q.level AS level, q.dateMillis AS dateMillis
        FROM quotes q
        INNER JOIN clients c ON c.id = q.clientId
        ORDER BY q.dateMillis DESC, q.id DESC
        """
    )
    fun observeAllRows(): Flow<List<QuoteListRow>>

    @Query(
        """
        SELECT q.id AS id, q.number AS number, q.clientId AS clientId,
               c.name AS clientName, q.siteAddress AS siteAddress,
               q.totalAmount AS totalAmount, q.status AS status,
               q.level AS level, q.dateMillis AS dateMillis
        FROM quotes q
        INNER JOIN clients c ON c.id = q.clientId
        WHERE q.clientId = :clientId
        ORDER BY q.dateMillis DESC, q.id DESC
        """
    )
    fun observeRowsForClient(clientId: Long): Flow<List<QuoteListRow>>

    @Query("SELECT * FROM quotes WHERE id = :id")
    fun observeById(id: Long): Flow<QuoteEntity?>

    @Query("SELECT * FROM quotes WHERE id = :id")
    suspend fun getById(id: Long): QuoteEntity?

    @Query("SELECT number FROM quotes")
    suspend fun allNumbers(): List<String>

    @Query("SELECT COUNT(*) FROM quotes")
    fun observeCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM quotes WHERE status = :status")
    fun observeCountByStatus(status: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM quotes WHERE createdAt >= :from")
    fun observeCountSince(from: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM quotes WHERE status = :status AND createdAt >= :from")
    fun observeCountByStatusSince(status: String, from: Long): Flow<Int>

    @Query("SELECT IFNULL(SUM(totalAmount), 0) FROM quotes WHERE status = :status")
    fun observeTotalByStatus(status: String): Flow<Double>

    @Query("SELECT IFNULL(SUM(depositAmount), 0) FROM quotes WHERE status = :status")
    fun observeDepositByStatus(status: String): Flow<Double>

    @Query("SELECT IFNULL(SUM(totalAmount), 0) FROM quotes WHERE createdAt >= :from")
    fun observeTotalSince(from: Long): Flow<Double>

    @Query("SELECT IFNULL(SUM(totalAmount), 0) FROM quotes WHERE clientId = :clientId AND status = :status")
    fun observeClientTotalByStatus(clientId: Long, status: String): Flow<Double>

    @Query("SELECT IFNULL(SUM(depositAmount), 0) FROM quotes WHERE clientId = :clientId AND status = :status")
    fun observeClientDepositByStatus(clientId: Long, status: String): Flow<Double>

    @Query("UPDATE quotes SET totalAmount = :total, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateTotal(id: Long, total: Double, updatedAt: Long)

    @Query("UPDATE quotes SET status = :status, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateStatus(id: Long, status: String, updatedAt: Long)

    @Query("DELETE FROM quotes WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Insert
    suspend fun insert(quote: QuoteEntity): Long

    @Update
    suspend fun update(quote: QuoteEntity)
}
