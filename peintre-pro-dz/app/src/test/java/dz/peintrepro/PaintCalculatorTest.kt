package dz.peintrepro

import dz.peintrepro.domain.calc.PaintCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaintCalculatorTest {

    @Test
    fun `45 m2 en 2 couches avec un rendement de 10`() {
        val estimate = PaintCalculator.estimate(area = 45.0, coats = 2, coverage = 10.0)
        assertEquals(9.0, estimate.liters, 0.001)
        assertTrue(estimate.potsLiters >= estimate.liters)
    }

    @Test
    fun `les conditionnements couvrent toujours le besoin`() {
        for (area in listOf(5.0, 12.5, 33.0, 120.0, 480.0)) {
            val estimate = PaintCalculator.estimate(area, coats = 2, coverage = 10.0)
            assertTrue(
                "Conditionnement insuffisant pour $area m²",
                estimate.potsLiters + 0.0001 >= estimate.liters
            )
        }
    }

    @Test
    fun `aucune peinture pour une surface nulle`() {
        val estimate = PaintCalculator.estimate(area = 0.0, coats = 2, coverage = 10.0)
        assertEquals(0.0, estimate.liters, 0.001)
        assertTrue(estimate.pots.isEmpty())
    }
}
