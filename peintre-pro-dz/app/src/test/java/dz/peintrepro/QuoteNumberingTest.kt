package dz.peintrepro

import dz.peintrepro.core.QuoteNumbering
import org.junit.Assert.assertEquals
import org.junit.Test

class QuoteNumberingTest {

    @Test
    fun `premier numero de l'annee`() {
        assertEquals("DEV-2026-0001", QuoteNumbering.next("DEV", 2026, emptyList()))
    }

    @Test
    fun `numero suivant en ignorant les autres annees`() {
        val existing = listOf("DEV-2025-0009", "DEV-2026-0001", "DEV-2026-0007", "AUTRE")
        assertEquals("DEV-2026-0008", QuoteNumbering.next("DEV", 2026, existing))
    }
}
