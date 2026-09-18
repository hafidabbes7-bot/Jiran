package dz.peintrepro.data.repository

import dz.peintrepro.core.Formats
import dz.peintrepro.core.QuoteNumbering
import dz.peintrepro.data.local.dao.PaymentDao
import dz.peintrepro.data.local.dao.QuoteDao
import dz.peintrepro.data.local.dao.QuoteLineDao
import dz.peintrepro.data.local.dao.RoomItemDao
import dz.peintrepro.data.local.entity.QuoteEntity
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.RoomItemEntity
import dz.peintrepro.data.local.relation.QuoteListRow
import dz.peintrepro.domain.calc.LineAmount
import dz.peintrepro.domain.calc.QuoteTotals
import dz.peintrepro.domain.calc.TotalsCalculator
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlin.math.max

/**
 * Point d'entrée unique pour tout ce qui touche aux devis : devis, pièces et lignes.
 * Chaque écriture met à jour le total stocké du devis, afin que les listes et le
 * tableau de bord restent justes sans recalcul coûteux.
 */
class QuoteRepository(
    private val quoteDao: QuoteDao,
    private val roomItemDao: RoomItemDao,
    private val quoteLineDao: QuoteLineDao,
    private val paymentDao: PaymentDao,
    private val settingsRepository: SettingsRepository
) {

    fun observeRows(): Flow<List<QuoteListRow>> = quoteDao.observeAllRows()

    fun observeRowsForClient(clientId: Long): Flow<List<QuoteListRow>> =
        quoteDao.observeRowsForClient(clientId)

    fun observeQuote(id: Long): Flow<QuoteEntity?> = quoteDao.observeById(id)

    suspend fun getQuote(id: Long): QuoteEntity? = quoteDao.getById(id)

    fun observeRooms(quoteId: Long): Flow<List<RoomItemEntity>> = roomItemDao.observeByQuote(quoteId)

    fun observeRoom(roomId: Long): Flow<RoomItemEntity?> = roomItemDao.observeById(roomId)

    suspend fun getRoom(roomId: Long): RoomItemEntity? = roomItemDao.getById(roomId)

    suspend fun getRooms(quoteId: Long): List<RoomItemEntity> = roomItemDao.getByQuote(quoteId)

    fun observeLines(quoteId: Long): Flow<List<QuoteLineEntity>> = quoteLineDao.observeByQuote(quoteId)

    fun observeLinesForRoom(roomId: Long): Flow<List<QuoteLineEntity>> =
        quoteLineDao.observeByRoom(roomId)

    fun observePaid(quoteId: Long): Flow<Double> = paymentDao.observeSumForQuote(quoteId)

    /** Reste à encaisser pour un client : devis acceptés - acomptes - paiements. */
    fun observeClientOutstanding(clientId: Long): Flow<Double> {
        val accepted = QuoteStatus.ACCEPTED.name
        return combine(
            quoteDao.observeClientTotalByStatus(clientId, accepted),
            quoteDao.observeClientDepositByStatus(clientId, accepted),
            paymentDao.observeSumForClient(clientId, accepted)
        ) { total, deposits, payments -> max(0.0, total - deposits - payments) }
    }

    // ---------------------------------------------------------------- Devis

    /** Crée un devis vide pour un client et retourne son identifiant. */
    suspend fun createQuote(clientId: Long): Long {
        val settings = settingsRepository.get()
        val number = QuoteNumbering.next(
            prefix = settings.quotePrefix,
            year = Formats.currentYear(),
            existingNumbers = quoteDao.allNumbers()
        )
        val now = System.currentTimeMillis()
        return quoteDao.insert(
            QuoteEntity(
                number = number,
                clientId = clientId,
                dateMillis = now,
                vatEnabled = settings.vatEnabled,
                vatRate = settings.vatRate,
                validityDays = settings.defaultValidityDays,
                paymentTerms = settings.conditions,
                createdAt = now,
                updatedAt = now
            )
        )
    }

    suspend fun updateQuote(quote: QuoteEntity) {
        quoteDao.update(quote.copy(updatedAt = System.currentTimeMillis()))
        recomputeTotal(quote.id)
    }

    suspend fun setStatus(quoteId: Long, status: QuoteStatus) {
        quoteDao.updateStatus(quoteId, status.name, System.currentTimeMillis())
    }

    suspend fun deleteQuote(quoteId: Long) {
        quoteDao.deleteById(quoteId)
    }

    /** Duplique un devis complet (pièces et lignes) sous un nouveau numéro, en brouillon. */
    suspend fun duplicateQuote(quoteId: Long): Long? {
        val source = quoteDao.getById(quoteId) ?: return null
        val settings = settingsRepository.get()
        val now = System.currentTimeMillis()
        val newId = quoteDao.insert(
            source.copy(
                id = 0L,
                number = QuoteNumbering.next(
                    prefix = settings.quotePrefix,
                    year = Formats.currentYear(),
                    existingNumbers = quoteDao.allNumbers()
                ),
                status = QuoteStatus.DRAFT.name,
                depositAmount = 0.0,
                dateMillis = now,
                createdAt = now,
                updatedAt = now
            )
        )
        val roomIdMap = HashMap<Long, Long>()
        for (room in roomItemDao.getByQuote(quoteId)) {
            val copiedId = roomItemDao.insert(room.copy(id = 0L, quoteId = newId))
            roomIdMap[room.id] = copiedId
        }
        val copiedLines = quoteLineDao.getByQuote(quoteId).map { line ->
            line.copy(
                id = 0L,
                quoteId = newId,
                roomId = line.roomId?.let { roomIdMap[it] }
            )
        }
        if (copiedLines.isNotEmpty()) quoteLineDao.insertAll(copiedLines)
        recomputeTotal(newId)
        return newId
    }

    // --------------------------------------------------------------- Pièces

    suspend fun addRoom(room: RoomItemEntity): Long {
        val position = roomItemDao.nextPosition(room.quoteId)
        return roomItemDao.insert(room.copy(id = 0L, position = position))
    }

    suspend fun updateRoom(room: RoomItemEntity) {
        roomItemDao.update(room)
    }

    /** Supprime une pièce : ses lignes sont supprimées en cascade. */
    suspend fun deleteRoom(room: RoomItemEntity) {
        roomItemDao.delete(room)
        recomputeTotal(room.quoteId)
    }

    // --------------------------------------------------------------- Lignes

    suspend fun addLine(line: QuoteLineEntity): Long {
        val position = quoteLineDao.nextPosition(line.quoteId)
        val id = quoteLineDao.insert(line.copy(id = 0L, position = position))
        recomputeTotal(line.quoteId)
        return id
    }

    suspend fun updateLine(line: QuoteLineEntity) {
        quoteLineDao.update(line)
        recomputeTotal(line.quoteId)
    }

    suspend fun deleteLine(line: QuoteLineEntity) {
        quoteLineDao.delete(line)
        recomputeTotal(line.quoteId)
    }

    // --------------------------------------------------------------- Totaux

    /** Recalcule et enregistre le total du devis. */
    suspend fun recomputeTotal(quoteId: Long) {
        val totals = totals(quoteId) ?: return
        quoteDao.updateTotal(quoteId, totals.total, System.currentTimeMillis())
    }

    suspend fun totals(quoteId: Long): QuoteTotals? {
        val quote = quoteDao.getById(quoteId) ?: return null
        val lines = quoteLineDao.getByQuote(quoteId)
        val paid = paymentDao.sumForQuote(quoteId)
        return computeTotals(quote, lines, paid)
    }

    companion object {
        /** Calcul des totaux à partir d'un devis et de ses lignes (sans accès base). */
        fun computeTotals(
            quote: QuoteEntity,
            lines: List<QuoteLineEntity>,
            paid: Double
        ): QuoteTotals = TotalsCalculator.compute(
            lines = lines.map {
                LineAmount(LineCategory.from(it.category), it.quantity * it.unitPrice)
            },
            discount = quote.discount,
            vatEnabled = quote.vatEnabled,
            vatRate = quote.vatRate,
            deposit = quote.depositAmount,
            paid = paid
        )
    }
}
