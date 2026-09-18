package dz.peintrepro.data.repository

import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.dao.PaymentDao
import dz.peintrepro.data.local.dao.QuoteDao
import dz.peintrepro.data.local.dao.SiteDao
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteStatus
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlin.math.max

/** Chiffres affichés sur le tableau de bord. Libellés volontairement précis. */
data class DashboardStats(
    val quoteCount: Int = 0,
    val acceptedCount: Int = 0,
    val sitesInProgress: Int = 0,
    val outstanding: Double = 0.0,
    val monthQuotes: Int = 0,
    val monthAccepted: Int = 0,
    val monthSitesDone: Int = 0,
    val monthQuotedAmount: Double = 0.0,
    val monthCollected: Double = 0.0
)

class StatsRepository(
    private val quoteDao: QuoteDao,
    private val siteDao: SiteDao,
    private val paymentDao: PaymentDao
) {

    private data class Counts(val a: Int, val b: Int, val c: Int)
    private data class Amounts(
        val acceptedTotal: Double,
        val acceptedDeposits: Double,
        val acceptedPayments: Double,
        val monthQuoted: Double,
        val monthCollected: Double
    )

    fun observeDashboard(): Flow<DashboardStats> {
        val monthStart = Formats.startOfCurrentMonth()
        val accepted = QuoteStatus.ACCEPTED.name

        val globalCounts = combine(
            quoteDao.observeCount(),
            quoteDao.observeCountByStatus(accepted),
            siteDao.observeCountByStatus(SiteStatus.IN_PROGRESS.name)
        ) { total, acceptedCount, sites -> Counts(total, acceptedCount, sites) }

        val monthCounts = combine(
            quoteDao.observeCountSince(monthStart),
            quoteDao.observeCountByStatusSince(accepted, monthStart),
            siteDao.observeCountByStatusSince(SiteStatus.DONE.name, monthStart)
        ) { created, acceptedCount, done -> Counts(created, acceptedCount, done) }

        val amounts = combine(
            quoteDao.observeTotalByStatus(accepted),
            quoteDao.observeDepositByStatus(accepted),
            paymentDao.observeSumForQuoteStatus(accepted),
            quoteDao.observeTotalSince(monthStart),
            paymentDao.observeSumSince(monthStart)
        ) { total, deposits, payments, monthQuoted, monthCollected ->
            Amounts(total, deposits, payments, monthQuoted, monthCollected)
        }

        return combine(globalCounts, monthCounts, amounts) { global, month, money ->
            DashboardStats(
                quoteCount = global.a,
                acceptedCount = global.b,
                sitesInProgress = global.c,
                outstanding = max(
                    0.0,
                    money.acceptedTotal - money.acceptedDeposits - money.acceptedPayments
                ),
                monthQuotes = month.a,
                monthAccepted = month.b,
                monthSitesDone = month.c,
                monthQuotedAmount = money.monthQuoted,
                monthCollected = money.monthCollected
            )
        }
    }
}
