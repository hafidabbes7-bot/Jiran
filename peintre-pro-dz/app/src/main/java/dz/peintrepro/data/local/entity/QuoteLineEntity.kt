package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.UnitType

/**
 * Une ligne du devis : travail, matériau, main-d'œuvre ou autre frais.
 * [roomId] est renseigné lorsque la ligne appartient à une pièce précise.
 */
@Entity(
    tableName = "quote_lines",
    foreignKeys = [
        ForeignKey(
            entity = QuoteEntity::class,
            parentColumns = ["id"],
            childColumns = ["quoteId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = RoomItemEntity::class,
            parentColumns = ["id"],
            childColumns = ["roomId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("quoteId"), Index("roomId")]
)
data class QuoteLineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val quoteId: Long = 0L,
    val roomId: Long? = null,
    val category: String = LineCategory.WORK.name,
    val designation: String = "",
    val unit: String = UnitType.M2.name,
    val quantity: Double = 0.0,
    val unitPrice: Double = 0.0,
    val position: Int = 0
) {
    val total: Double get() = quantity * unitPrice
}
