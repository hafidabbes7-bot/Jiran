package dz.peintrepro.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import dz.peintrepro.core.QuoteNumbering

/** Paramètres de l'application : une seule ligne, d'identifiant [SINGLETON_ID]. */
@Entity(tableName = "settings")
data class SettingsEntity(
    @PrimaryKey val id: Long = SINGLETON_ID,
    val companyName: String = "",
    val phone: String = "",
    val address: String = "",
    val email: String = "",
    val logoUri: String? = null,
    val vatEnabled: Boolean = false,
    val vatRate: Double = 19.0,
    val currency: String = "DA",
    val conditions: String = "",
    val defaultCoverage: Double = 10.0,
    val defaultCoats: Int = 2,
    val defaultValidityDays: Int = 30,
    val quotePrefix: String = QuoteNumbering.DEFAULT_PREFIX
) {
    companion object {
        const val SINGLETON_ID = 1L
    }
}
