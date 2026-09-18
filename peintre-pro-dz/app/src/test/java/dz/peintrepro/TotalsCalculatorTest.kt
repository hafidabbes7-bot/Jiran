package dz.peintrepro

import dz.peintrepro.domain.calc.LineAmount
import dz.peintrepro.domain.calc.TotalsCalculator
import dz.peintrepro.domain.model.LineCategory
import org.junit.Assert.assertEquals
import org.junit.Test

class TotalsCalculatorTest {

    private val lines = listOf(
        LineAmount(LineCategory.WORK, 100_000.0),
        LineAmount(LineCategory.MATERIAL, 40_000.0),
        LineAmount(LineCategory.LABOR, 60_000.0),
        LineAmount(LineCategory.OTHER, 10_000.0)
    )

    @Test
    fun `total sans TVA ni remise`() {
        val totals = TotalsCalculator.compute(lines)
        assertEquals(210_000.0, totals.subtotal, 0.001)
        assertEquals(210_000.0, totals.total, 0.001)
    }

    @Test
    fun `remise puis TVA`() {
        val totals = TotalsCalculator.compute(
            lines = lines,
            discount = 10_000.0,
            vatEnabled = true,
            vatRate = 19.0
        )
        assertEquals(200_000.0, totals.afterDiscount, 0.001)
        assertEquals(38_000.0, totals.vatAmount, 0.001)
        assertEquals(238_000.0, totals.total, 0.001)
    }

    @Test
    fun `reste a payer apres acompte et paiements`() {
        val totals = TotalsCalculator.compute(
            lines = lines,
            deposit = 100_000.0,
            paid = 50_000.0
        )
        assertEquals(60_000.0, totals.remaining, 0.001)
    }

    @Test
    fun `la remise ne depasse jamais le sous-total`() {
        val totals = TotalsCalculator.compute(lines = lines, discount = 999_999.0)
        assertEquals(210_000.0, totals.discount, 0.001)
        assertEquals(0.0, totals.total, 0.001)
    }
}
