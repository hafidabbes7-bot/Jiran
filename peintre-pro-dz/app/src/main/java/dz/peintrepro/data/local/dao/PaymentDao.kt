package dz.peintrepro.data.local.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import dz.peintrepro.data.local.entity.PaymentEntity
import dz.peintrepro.data.local.relation.PaymentListRow
import kotlinx.coroutines.flow.Flow

@Dao
interface PaymentDao {

    @Query("SELECT * FROM payments ORDER BY dateMillis DESC, id DESC")
    fun observeAll(): Flow<List<PaymentEntity>>

    @Query("SELECT * FROM payments WHERE quoteId = :quoteId ORDER BY dateMillis ASC, id ASC")
    fun observeByQuote(quoteId: Long): Flow<List<PaymentEntity>>

    @Query("SELECT IFNULL(SUM(amount), 0) FROM payments WHERE quoteId = :quoteId")
    fun observeSumForQuote(quoteId: Long): Flow<Double>

    @Query("SELECT IFNULL(SUM(amount), 0) FROM payments WHERE quoteId = :quoteId")
    suspend fun sumForQuote(quoteId: Long): Double

    @Query(
        """
        SELECT IFNULL(SUM(p.amount), 0) FROM payments p
        INNER JOIN quotes q ON q.id = p.quoteId
        WHERE q.status = :status
        """
    )
    fun observeSumForQuoteStatus(status: String): Flow<Double>

    @Query(
        """
        SELECT IFNULL(SUM(p.amount), 0) FROM payments p
        INNER JOIN quotes q ON q.id = p.quoteId
        WHERE q.clientId = :clientId AND q.status = :status
        """
    )
    fun observeSumForClient(clientId: Long, status: String): Flow<Double>

    @Query("SELECT IFNULL(SUM(amount), 0) FROM payments WHERE dateMillis >= :from")
    fun observeSumSince(from: Long): Flow<Double>

    @Query(
        """
        SELECT p.id AS id, p.quoteId AS quoteId, q.number AS quoteNumber,
               c.name AS clientName, p.amount AS amount, p.dateMillis AS dateMillis,
               p.method AS method, p.note AS note
        FROM payments p
        INNER JOIN quotes q ON q.id = p.quoteId
        INNER JOIN clients c ON c.id = q.clientId
        ORDER BY p.dateMillis DESC, p.id DESC
        """
    )
    fun observeAllRows(): Flow<List<PaymentListRow>>

    @Query(
        """
        SELECT p.id AS id, p.quoteId AS quoteId, q.number AS quoteNumber,
               c.name AS clientName, p.amount AS amount, p.dateMillis AS dateMillis,
               p.method AS method, p.note AS note
        FROM payments p
        INNER JOIN quotes q ON q.id = p.quoteId
        INNER JOIN clients c ON c.id = q.clientId
        WHERE p.quoteId = :quoteId
        ORDER BY p.dateMillis DESC, p.id DESC
        """
    )
    fun observeRowsForQuote(quoteId: Long): Flow<List<PaymentListRow>>

    @Query("SELECT * FROM payments WHERE id = :id")
    suspend fun getById(id: Long): PaymentEntity?

    @Insert
    suspend fun insert(payment: PaymentEntity): Long

    @Update
    suspend fun update(payment: PaymentEntity)

    @Delete
    suspend fun delete(payment: PaymentEntity)
}
