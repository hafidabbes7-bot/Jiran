package dz.peintrepro.di

import android.content.Context
import dz.peintrepro.data.local.AppDatabase
import dz.peintrepro.data.repository.ClientRepository
import dz.peintrepro.data.repository.PaymentRepository
import dz.peintrepro.data.repository.QuoteRepository
import dz.peintrepro.data.repository.SettingsRepository
import dz.peintrepro.data.repository.SiteRepository
import dz.peintrepro.data.repository.StatsRepository
import dz.peintrepro.data.repository.TariffRepository

/**
 * Injection de dépendances « à la main » : simple, lisible, sans librairie.
 * Un seul conteneur créé par l'Application et partagé par tous les ViewModels.
 */
class AppContainer(context: Context) {

    private val database: AppDatabase = AppDatabase.get(context)

    val settingsRepository = SettingsRepository(database.settingsDao())
    val clientRepository = ClientRepository(database.clientDao())
    val tariffRepository = TariffRepository(database.tariffDao())
    val paymentRepository = PaymentRepository(database.paymentDao())
    val siteRepository = SiteRepository(database.siteDao(), database.quoteDao())

    val quoteRepository = QuoteRepository(
        quoteDao = database.quoteDao(),
        roomItemDao = database.roomItemDao(),
        quoteLineDao = database.quoteLineDao(),
        paymentDao = database.paymentDao(),
        settingsRepository = settingsRepository
    )

    val statsRepository = StatsRepository(
        quoteDao = database.quoteDao(),
        siteDao = database.siteDao(),
        paymentDao = database.paymentDao()
    )
}
