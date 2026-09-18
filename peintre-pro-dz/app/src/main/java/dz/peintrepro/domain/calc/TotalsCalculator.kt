package dz.peintrepro.domain.calc

import dz.peintrepro.domain.model.LineCategory
import kotlin.math.max
import kotlin.math.round

/** Montant d'une ligne de devis, indépendant de la couche de données. */
data class LineAmount(val category: LineCategory, val amount: Double)

/** Détail complet des totaux d'un devis. */
data class QuoteTotals(
    val works: Double = 0.0,
    val materials: Double = 0.0,
    val labor: Double = 0.0,
    val other: Double = 0.0,
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val afterDiscount: Double = 0.0,
    val vatEnabled: Boolean = false,
    val vatRate: Double = 0.0,
    val vatAmount: Double = 0.0,
    val total: Double = 0.0,
    val deposit: Double = 0.0,
    val paid: Double = 0.0,
    val remaining: Double = 0.0
)

object TotalsCalculator {

    fun round2(value: Double): Double = round(value * 100.0) / 100.0

    fun compute(
        lines: List<LineAmount>,
        discount: Double = 0.0,
        vatEnabled: Boolean = false,
        vatRate: Double = 0.0,
        deposit: Double = 0.0,
        paid: Double = 0.0
    ): QuoteTotals {
        val works = lines.filter { it.category == LineCategory.WORK }.sumOf { it.amount }
        val materials = lines.filter { it.category == LineCategory.MATERIAL }.sumOf { it.amount }
        val labor = lines.filter { it.category == LineCategory.LABOR }.sumOf { it.amount }
        val other = lines.filter { it.category == LineCategory.OTHER }.sumOf { it.amount }

        val subtotal = works + materials + labor + other
        val safeDiscount = discount.coerceIn(0.0, max(0.0, subtotal))
        val afterDiscount = max(0.0, subtotal - safeDiscount)
        val safeRate = if (vatEnabled) vatRate.coerceAtLeast(0.0) else 0.0
        val vatAmount = afterDiscount * safeRate / 100.0
        val total = afterDiscount + vatAmount
        val alreadyPaid = deposit.coerceAtLeast(0.0) + paid.coerceAtLeast(0.0)

        return QuoteTotals(
            works = round2(works),
            materials = round2(materials),
            labor = round2(labor),
            other = round2(other),
            subtotal = round2(subtotal),
            discount = round2(safeDiscount),
            afterDiscount = round2(afterDiscount),
            vatEnabled = vatEnabled,
            vatRate = safeRate,
            vatAmount = round2(vatAmount),
            total = round2(total),
            deposit = round2(deposit.coerceAtLeast(0.0)),
            paid = round2(paid.coerceAtLeast(0.0)),
            remaining = round2(max(0.0, total - alreadyPaid))
        )
    }
}
