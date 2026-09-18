package dz.peintrepro.data.local.relation

/** Ligne affichée dans « Paiements » : le paiement, son devis et son client. */
data class PaymentListRow(
    val id: Long,
    val quoteId: Long,
    val quoteNumber: String,
    val clientName: String,
    val amount: Double,
    val dateMillis: Long,
    val method: String,
    val note: String
)
