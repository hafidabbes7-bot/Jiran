package dz.peintrepro.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import dz.peintrepro.data.local.dao.ClientDao
import dz.peintrepro.data.local.dao.PaymentDao
import dz.peintrepro.data.local.dao.QuoteDao
import dz.peintrepro.data.local.dao.QuoteLineDao
import dz.peintrepro.data.local.dao.RoomItemDao
import dz.peintrepro.data.local.dao.SettingsDao
import dz.peintrepro.data.local.dao.SiteDao
import dz.peintrepro.data.local.dao.SitePhotoDao
import dz.peintrepro.data.local.dao.TariffDao
import dz.peintrepro.data.local.entity.ClientEntity
import dz.peintrepro.data.local.entity.PaymentEntity
import dz.peintrepro.data.local.entity.QuoteEntity
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.RoomItemEntity
import dz.peintrepro.data.local.entity.SettingsEntity
import dz.peintrepro.data.local.entity.SiteEntity
import dz.peintrepro.data.local.entity.SitePhotoEntity
import dz.peintrepro.data.local.entity.TariffEntity

/**
 * Base de données locale (SQLite via Room). Tout est enregistré sur le téléphone :
 * les données survivent à la fermeture de l'application et au redémarrage.
 *
 * MIGRATIONS : ne JAMAIS activer fallbackToDestructiveMigration(), cela effacerait
 * les devis de l'utilisateur. Pour faire évoluer le schéma, incrémenter [VERSION]
 * et ajouter une Migration dans [MIGRATIONS]. Les schémas sont exportés dans
 * app/schemas pour pouvoir écrire ces migrations sereinement.
 */
@Database(
    entities = [
        ClientEntity::class,
        QuoteEntity::class,
        RoomItemEntity::class,
        QuoteLineEntity::class,
        TariffEntity::class,
        SettingsEntity::class,
        SiteEntity::class,
        PaymentEntity::class,
        SitePhotoEntity::class
    ],
    version = AppDatabase.VERSION,
    exportSchema = true
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun clientDao(): ClientDao
    abstract fun quoteDao(): QuoteDao
    abstract fun roomItemDao(): RoomItemDao
    abstract fun quoteLineDao(): QuoteLineDao
    abstract fun tariffDao(): TariffDao
    abstract fun settingsDao(): SettingsDao
    abstract fun siteDao(): SiteDao
    abstract fun paymentDao(): PaymentDao
    abstract fun sitePhotoDao(): SitePhotoDao

    companion object {
        const val VERSION = 1
        const val NAME = "peintre_pro_dz.db"

        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, NAME)
                .addCallback(SeedCallback)
                .build()

        /**
         * Insertion des données de départ à la création de la base uniquement.
         * On passe par du SQL brut car les DAO ne sont pas encore disponibles ici.
         */
        private object SeedCallback : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                db.execSQL(
                    "INSERT OR IGNORE INTO settings " +
                        "(id, companyName, phone, address, email, logoUri, vatEnabled, vatRate, " +
                        "currency, conditions, defaultCoverage, defaultCoats, defaultValidityDays, quotePrefix) " +
                        "VALUES (1, '', '', '', '', NULL, 0, 19.0, 'DA', '${escape(DefaultData.defaultConditions)}', " +
                        "10.0, 2, 30, 'DEV')"
                )
                for (tariff in DefaultData.defaultTariffs()) {
                    db.execSQL(
                        "INSERT INTO tariffs (label, unit, price, level, category, position) VALUES (" +
                            "'${escape(tariff.label)}', '${tariff.unit}', ${tariff.price}, " +
                            "'${tariff.level}', '${tariff.category}', ${tariff.position})"
                    )
                }
            }
        }
    }
}

/** Échappe les apostrophes pour les insertions SQL de données de départ. */
private fun escape(value: String): String = value.replace("'", "''")
