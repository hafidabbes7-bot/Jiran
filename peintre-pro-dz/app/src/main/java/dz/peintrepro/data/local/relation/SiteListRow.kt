package dz.peintrepro.data.local.relation

/** Ligne affichée dans « Mes chantiers » : le chantier, son client et son devis. */
data class SiteListRow(
    val id: Long,
    val clientId: Long,
    val clientName: String,
    val quoteId: Long?,
    val quoteNumber: String?,
    val address: String,
    val startDateMillis: Long?,
    val endDateMillis: Long?,
    val status: String,
    val progress: Int
)
