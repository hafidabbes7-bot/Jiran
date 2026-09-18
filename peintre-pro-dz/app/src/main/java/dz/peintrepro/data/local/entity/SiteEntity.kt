package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.SiteStatus

/**
 * Un chantier issu d'un devis accepté.
 * La table existe dès la V1 pour que la phase 2 n'impose aucune migration risquée.
 */
@Entity(
    tableName = "sites",
    foreignKeys = [
        ForeignKey(
            entity = ClientEntity::class,
            parentColumns = ["id"],
            childColumns = ["clientId"],
            onDelete = ForeignKey.RESTRICT
        ),
        ForeignKey(
            entity = QuoteEntity::class,
            parentColumns = ["id"],
            childColumns = ["quoteId"],
            onDelete = ForeignKey.SET_NULL
        )
    ],
    indices = [Index("clientId"), Index("quoteId")]
)
data class SiteEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val clientId: Long = 0L,
    val quoteId: Long? = null,
    val address: String = "",
    val startDateMillis: Long? = null,
    val endDateMillis: Long? = null,
    val status: String = SiteStatus.PREPARATION.name,
    val progress: Int = 0,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis()
)
