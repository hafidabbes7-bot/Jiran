package dz.peintrepro.domain.calc

import kotlin.math.max

/** Données saisies pour une pièce. Toutes les longueurs sont en mètres. */
data class RoomDimensions(
    val length: Double = 0.0,
    val width: Double = 0.0,
    val height: Double = 0.0,
    val doorCount: Int = 0,
    val doorWidth: Double = 0.8,
    val doorHeight: Double = 2.1,
    val windowCount: Int = 0,
    val windowWidth: Double = 1.2,
    val windowHeight: Double = 1.2,
    /** Surface des murs saisie manuellement par l'utilisateur (prioritaire). */
    val manualWallArea: Double? = null,
    /** Surface du plafond saisie manuellement par l'utilisateur (prioritaire). */
    val manualCeilingArea: Double? = null
)

/** Résultat complet du calcul de surfaces d'une pièce. */
data class SurfaceResult(
    val grossWallArea: Double,
    val doorsArea: Double,
    val windowsArea: Double,
    val openingsArea: Double,
    val netWallArea: Double,
    val ceilingArea: Double,
    val wallAreaIsManual: Boolean,
    val ceilingAreaIsManual: Boolean,
    /** Vrai si les ouvertures saisies dépassent la surface des murs. */
    val openingsExceedWalls: Boolean
) {
    val wallsAndCeilingArea: Double get() = netWallArea + ceilingArea
}

/**
 * Calculateur de surfaces.
 *
 * Surface des murs   = 2 x (Longueur + Largeur) x Hauteur
 * Surface du plafond = Longueur x Largeur
 * Surface nette      = surface des murs - portes - fenêtres (jamais négative)
 */
object SurfaceCalculator {

    fun compute(dimensions: RoomDimensions): SurfaceResult {
        val length = dimensions.length.coerceAtLeast(0.0)
        val width = dimensions.width.coerceAtLeast(0.0)
        val height = dimensions.height.coerceAtLeast(0.0)

        val grossWalls = 2.0 * (length + width) * height
        val doorsArea = dimensions.doorCount.coerceAtLeast(0) *
            dimensions.doorWidth.coerceAtLeast(0.0) * dimensions.doorHeight.coerceAtLeast(0.0)
        val windowsArea = dimensions.windowCount.coerceAtLeast(0) *
            dimensions.windowWidth.coerceAtLeast(0.0) * dimensions.windowHeight.coerceAtLeast(0.0)
        val openings = doorsArea + windowsArea

        val computedNet = max(0.0, grossWalls - openings)
        val manualWall = dimensions.manualWallArea?.takeIf { it >= 0.0 }
        val manualCeiling = dimensions.manualCeilingArea?.takeIf { it >= 0.0 }

        return SurfaceResult(
            grossWallArea = grossWalls,
            doorsArea = doorsArea,
            windowsArea = windowsArea,
            openingsArea = openings,
            netWallArea = manualWall ?: computedNet,
            ceilingArea = manualCeiling ?: (length * width),
            wallAreaIsManual = manualWall != null,
            ceilingAreaIsManual = manualCeiling != null,
            openingsExceedWalls = manualWall == null && openings > grossWalls && grossWalls > 0.0
        )
    }
}
