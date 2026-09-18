package dz.peintrepro.pdf

import dz.peintrepro.data.local.entity.ClientEntity
import dz.peintrepro.data.local.entity.QuoteEntity
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.SettingsEntity
import dz.peintrepro.domain.calc.QuoteTotals

/** Tout ce qu'il faut pour imprimer un devis, rassemblé avant le dessin. */
data class QuotePdfData(
    val quote: QuoteEntity,
    val client: ClientEntity?,
    val lines: List<QuoteLineEntity>,
    /** Nom de la pièce pour chaque identifiant, afin de situer chaque ligne. */
    val roomNames: Map<Long, String>,
    val settings: SettingsEntity,
    val totals: QuoteTotals
)
