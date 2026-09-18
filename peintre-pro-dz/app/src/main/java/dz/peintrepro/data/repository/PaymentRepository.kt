package dz.peintrepro.data.repository

import dz.peintrepro.data.local.dao.PaymentDao
import dz.peintrepro.data.local.entity.PaymentEntity
import dz.peintrepro.data.local.relation.PaymentListRow
import kotlinx.coroutines.flow.Flow

class PaymentRepository(private val paymentDao: PaymentDao) {

    fun observeAll(): Flow<List<PaymentEntity>> = paymentDao.observeAll()

    fun observeRows(): Flow<List<PaymentListRow>> = paymentDao.observeAllRows()

    fun observeRowsForQuote(quoteId: Long): Flow<List<PaymentListRow>> =
        paymentDao.observeRowsForQuote(quoteId)

    fun observeByQuote(quoteId: Long): Flow<List<PaymentEntity>> = paymentDao.observeByQuote(quoteId)

    fun observeSumForQuote(quoteId: Long): Flow<Double> = paymentDao.observeSumForQuote(quoteId)

    suspend fun sumForQuote(quoteId: Long): Double = paymentDao.sumForQuote(quoteId)

    suspend fun getById(id: Long): PaymentEntity? = paymentDao.getById(id)

    suspend fun save(payment: PaymentEntity): Long {
        val propre = payment.copy(
            amount = payment.amount.coerceAtLeast(0.0),
            note = payment.note.trim()
        )
        return if (propre.id == 0L) paymentDao.insert(propre) else {
            paymentDao.update(propre); propre.id
        }
    }

    suspend fun delete(payment: PaymentEntity) = paymentDao.delete(payment)
}
