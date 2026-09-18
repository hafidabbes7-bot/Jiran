package dz.peintrepro.data.repository

import dz.peintrepro.data.local.dao.PaymentDao
import dz.peintrepro.data.local.entity.PaymentEntity
import kotlinx.coroutines.flow.Flow

class PaymentRepository(private val paymentDao: PaymentDao) {

    fun observeAll(): Flow<List<PaymentEntity>> = paymentDao.observeAll()

    fun observeByQuote(quoteId: Long): Flow<List<PaymentEntity>> = paymentDao.observeByQuote(quoteId)

    fun observeSumForQuote(quoteId: Long): Flow<Double> = paymentDao.observeSumForQuote(quoteId)

    suspend fun sumForQuote(quoteId: Long): Double = paymentDao.sumForQuote(quoteId)

    suspend fun save(payment: PaymentEntity): Long =
        if (payment.id == 0L) paymentDao.insert(payment) else {
            paymentDao.update(payment); payment.id
        }

    suspend fun delete(payment: PaymentEntity) = paymentDao.delete(payment)
}
