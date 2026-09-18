package dz.peintrepro.data.local

import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.UnitType

/**
 * Tarifs livrés avec l'application.
 *
 * ATTENTION : ce sont uniquement des EXEMPLES. L'utilisateur modifie, ajoute
 * et supprime librement ses tarifs depuis l'écran « Mes tarifs ».
 */
object DefaultData {

    private data class Seed(
        val label: String,
        val unit: UnitType,
        val price: Double,
        val category: LineCategory = LineCategory.WORK
    )

    private val standardWorks = listOf(
        Seed("Nettoyage", UnitType.M2, 80.0),
        Seed("Rebouchage", UnitType.M2, 120.0),
        Seed("Enduit", UnitType.M2, 250.0),
        Seed("Ponçage", UnitType.M2, 150.0),
        Seed("Sous-couche", UnitType.M2, 180.0),
        Seed("Peinture 1 couche", UnitType.M2, 300.0),
        Seed("Peinture 2 couches", UnitType.M2, 450.0),
        Seed("Peinture 3 couches", UnitType.M2, 600.0),
        Seed("Plafond", UnitType.M2, 400.0),
        Seed("Façade", UnitType.M2, 500.0),
        Seed("Porte (peinture)", UnitType.PIECE, 1500.0),
        Seed("Fenêtre (peinture)", UnitType.PIECE, 1200.0),
        Seed("Main-d'œuvre au m²", UnitType.M2, 450.0, LineCategory.LABOR),
        Seed("Main-d'œuvre au forfait", UnitType.LUMP_SUM, 15000.0, LineCategory.LABOR),
        Seed("Peinture (pot)", UnitType.LITER, 600.0, LineCategory.MATERIAL),
        Seed("Sous-couche (pot)", UnitType.LITER, 450.0, LineCategory.MATERIAL),
        Seed("Enduit (sac)", UnitType.KG, 90.0, LineCategory.MATERIAL),
        Seed("Diluant", UnitType.LITER, 350.0, LineCategory.MATERIAL),
        Seed("Rouleau", UnitType.PIECE, 800.0, LineCategory.MATERIAL),
        Seed("Pinceau", UnitType.PIECE, 400.0, LineCategory.MATERIAL),
        Seed("Papier abrasif", UnitType.PIECE, 100.0, LineCategory.MATERIAL),
        Seed("Ruban adhésif", UnitType.PIECE, 250.0, LineCategory.MATERIAL),
        Seed("Bâche de protection", UnitType.PIECE, 500.0, LineCategory.MATERIAL)
    )

    /** Coefficient appliqué aux prix standard pour proposer les trois niveaux. */
    private fun coefficient(level: QuoteLevel): Double = when (level) {
        QuoteLevel.ECONOMIQUE -> 0.8
        QuoteLevel.STANDARD -> 1.0
        QuoteLevel.PREMIUM -> 1.3
    }

    fun defaultTariffs(): List<TariffEntity> {
        val result = mutableListOf<TariffEntity>()
        var position = 0
        for (level in QuoteLevel.entries) {
            val factor = coefficient(level)
            for (seed in standardWorks) {
                result += TariffEntity(
                    label = seed.label,
                    unit = seed.unit.name,
                    price = Math.round(seed.price * factor).toDouble(),
                    level = level.name,
                    category = seed.category.name,
                    position = position++
                )
            }
        }
        return result
    }

    val defaultConditions: String = """
        Devis valable 30 jours.
        Acompte de 40 % à la commande, solde à la fin des travaux.
        Les surfaces et quantités de peinture sont des estimations.
        Le support doit être accessible et dégagé avant le début du chantier.
    """.trimIndent()
}
