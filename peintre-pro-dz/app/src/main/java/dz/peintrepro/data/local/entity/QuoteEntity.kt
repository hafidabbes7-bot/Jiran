package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteType

/**
 * Un devis. [totalAmount] est recalculé et stocké à chaque modification :
 * cela permet d'afficher instantanément les listes et le tableau de bord
 * sans recharger toutes les lignes.
 */
@Entity(
    tableName = "quotes",
    foreignKeys = [
        ForeignKey(
            entity = ClientEntity::class,
            parentColumns = ["id"],
            childColumns = ["clientId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [Index("clientId"), Index(value = ["number"], unique = true)]
)
data class QuoteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val number: String = "",
    val clientId: Long = 0L,
    val siteType: String = SiteType.APARTMENT.name,
    val siteAddress: String = "",
    val dateMillis: Long = System.currentTimeMillis(),
    val notes: String = "",
    val level: String = QuoteLevel.STANDARD.name,
    val status: String = QuoteStatus.DRAFT.name,
    val discount: Double = 0.0,
    val vatEnabled: Boolean = false,
    val vatRate: Double = 0.0,
    val depositAmount: Double = 0.0,
    val validityDays: Int = 30,
    val paymentTerms: String = "",
    val observations: String = "",
    val totalAmount: Double = 0.0,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
