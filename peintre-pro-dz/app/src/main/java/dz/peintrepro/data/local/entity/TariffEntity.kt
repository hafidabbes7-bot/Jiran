package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.UnitType

/** Un prix du catalogue « Mes tarifs », modifiable par l'utilisateur. */
@Entity(tableName = "tariffs")
data class TariffEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val label: String = "",
    val unit: String = UnitType.M2.name,
    val price: Double = 0.0,
    val level: String = QuoteLevel.STANDARD.name,
    val category: String = LineCategory.WORK.name,
    val position: Int = 0
)
