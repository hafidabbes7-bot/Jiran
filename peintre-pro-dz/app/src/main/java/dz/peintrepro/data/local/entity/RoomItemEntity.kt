package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Une pièce du chantier (salon, chambre 1, cuisine…).
 * Nommée RoomItemEntity pour ne pas être confondue avec la librairie Room.
 */
@Entity(
    tableName = "quote_rooms",
    foreignKeys = [
        ForeignKey(
            entity = QuoteEntity::class,
            parentColumns = ["id"],
            childColumns = ["quoteId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("quoteId")]
)
data class RoomItemEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val quoteId: Long = 0L,
    val name: String = "",
    val length: Double = 0.0,
    val width: Double = 0.0,
    val height: Double = 0.0,
    val doorCount: Int = 0,
    val doorWidth: Double = 0.8,
    val doorHeight: Double = 2.1,
    val windowCount: Int = 0,
    val windowWidth: Double = 1.2,
    val windowHeight: Double = 1.2,
    /** Surfaces corrigées à la main (null = surface calculée automatiquement). */
    val manualWallArea: Double? = null,
    val manualCeilingArea: Double? = null,
    val position: Int = 0
)
