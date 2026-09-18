package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.PhotoPhase

/** Photo de chantier (avant / pendant / après), stockée localement via son URI. */
@Entity(
    tableName = "site_photos",
    foreignKeys = [
        ForeignKey(
            entity = SiteEntity::class,
            parentColumns = ["id"],
            childColumns = ["siteId"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [Index("siteId")]
)
data class SitePhotoEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val siteId: Long = 0L,
    val uri: String = "",
    val phase: String = PhotoPhase.BEFORE.name,
    val note: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
