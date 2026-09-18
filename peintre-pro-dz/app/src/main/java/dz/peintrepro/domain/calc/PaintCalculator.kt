package dz.peintrepro.domain.calc

import kotlin.math.floor

/** Un conditionnement (pot) disponible, en litres. */
data class PotSize(val liters: Double)

/** Nombre de pots d'une taille donnée. */
data class PotCount(val size: PotSize, val count: Int) {
    val totalLiters: Double get() = size.liters * count
}

/** Estimation de peinture pour une surface donnée. */
data class PaintEstimate(
    val area: Double,
    val coats: Int,
    val coverage: Double,
    val liters: Double,
    val pots: List<PotCount>
) {
    val potsLiters: Double get() = pots.sumOf { it.totalLiters }
}

/**
 * Estimation des quantités de peinture.
 *
 * Litres nécessaires = surface x nombre de couches / rendement (m²/L)
 *
 * ATTENTION : il s'agit d'une ESTIMATION. Le rendement réel dépend du produit,
 * du support et de la méthode d'application. L'interface doit toujours l'indiquer.
 */
object PaintCalculator {

    val DEFAULT_POT_SIZES: List<PotSize> = listOf(
        PotSize(20.0), PotSize(10.0), PotSize(5.0), PotSize(2.5), PotSize(1.0)
    )

    const val DEFAULT_COVERAGE = 10.0

    fun liters(area: Double, coats: Int, coverage: Double): Double {
        if (area <= 0.0 || coats <= 0 || coverage <= 0.0) return 0.0
        return area * coats / coverage
    }

    /**
     * Propose une combinaison pratique de pots couvrant [liters].
     * On part des plus grands pots, puis on complète avec le plus petit pot
     * capable de couvrir le reste (on ne descend jamais en dessous du besoin).
     */
    fun packaging(liters: Double, sizes: List<PotSize> = DEFAULT_POT_SIZES): List<PotCount> {
        if (liters <= 0.0 || sizes.isEmpty()) return emptyList()
        val sorted = sizes.sortedByDescending { it.liters }.filter { it.liters > 0.0 }
        if (sorted.isEmpty()) return emptyList()

        val counts = LinkedHashMap<Double, Int>()
        var remaining = liters
        for (size in sorted) {
            if (remaining < size.liters) continue
            val count = floor(remaining / size.liters).toInt()
            if (count > 0) {
                counts[size.liters] = (counts[size.liters] ?: 0) + count
                remaining -= count * size.liters
            }
        }
        if (remaining > 0.001) {
            val complement = sorted.lastOrNull { it.liters >= remaining } ?: sorted.last()
            counts[complement.liters] = (counts[complement.liters] ?: 0) + 1
        }
        return counts.entries
            .sortedByDescending { it.key }
            .map { PotCount(PotSize(it.key), it.value) }
    }

    fun estimate(
        area: Double,
        coats: Int,
        coverage: Double,
        sizes: List<PotSize> = DEFAULT_POT_SIZES
    ): PaintEstimate {
        val neededLiters = liters(area, coats, coverage)
        return PaintEstimate(
            area = area,
            coats = coats,
            coverage = coverage,
            liters = neededLiters,
            pots = packaging(neededLiters, sizes)
        )
    }
}
