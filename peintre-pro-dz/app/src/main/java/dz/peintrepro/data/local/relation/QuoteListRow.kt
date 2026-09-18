package dz.peintrepro.data.local.relation

/** Ligne affichée dans « Mes devis » : le devis + le nom du client. */
data class QuoteListRow(
    val id: Long,
    val number: String,
    val clientId: Long,
    val clientName: String,
    val siteAddress: String,
    val totalAmount: Double,
    val status: String,
    val level: String,
    val dateMillis: Long
)
