package dz.peintrepro

import dz.peintrepro.domain.calc.RoomDimensions
import dz.peintrepro.domain.calc.SurfaceCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SurfaceCalculatorTest {

    @Test
    fun `surfaces d'une piece standard`() {
        val result = SurfaceCalculator.compute(
            RoomDimensions(
                length = 5.0,
                width = 4.0,
                height = 2.8,
                doorCount = 1,
                doorWidth = 0.8,
                doorHeight = 2.1,
                windowCount = 2,
                windowWidth = 1.2,
                windowHeight = 1.2
            )
        )
        // 2 x (5 + 4) x 2,80 = 50,4 m²
        assertEquals(50.4, result.grossWallArea, 0.001)
        assertEquals(20.0, result.ceilingArea, 0.001)
        assertEquals(1.68, result.doorsArea, 0.001)
        assertEquals(2.88, result.windowsArea, 0.001)
        assertEquals(45.84, result.netWallArea, 0.001)
    }

    @Test
    fun `la surface nette ne devient jamais negative`() {
        val result = SurfaceCalculator.compute(
            RoomDimensions(
                length = 2.0,
                width = 2.0,
                height = 1.0,
                doorCount = 10,
                doorWidth = 1.0,
                doorHeight = 2.0
            )
        )
        assertEquals(0.0, result.netWallArea, 0.001)
        assertTrue(result.openingsExceedWalls)
    }

    @Test
    fun `la surface saisie manuellement remplace le calcul`() {
        val result = SurfaceCalculator.compute(
            RoomDimensions(length = 5.0, width = 4.0, height = 2.8, manualWallArea = 40.0)
        )
        assertEquals(40.0, result.netWallArea, 0.001)
        assertTrue(result.wallAreaIsManual)
    }
}
