package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.PaymentMethod

/** Un encaissement rattaché à un devis (et éventuellement à un chantier). */
@Entity(
    tableName = "payments",
    foreignKeys = [
        ForeignKey(
            entity = QuoteEntity::class,
            parentColumns = ["id"],
            childColumns = ["quoteId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = SiteEntity::class,
            parentColumns = ["id"],
            childColumns = ["siteId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("quoteId"), Index("siteId")]
)
data class PaymentEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val quoteId: Long = 0L,
    val siteId: Long? = null,
    val amount: Double = 0.0,
    val dateMillis: Long = System.currentTimeMillis(),
    val method: String = PaymentMethod.CASH.name,
    val note: String = ""
)
