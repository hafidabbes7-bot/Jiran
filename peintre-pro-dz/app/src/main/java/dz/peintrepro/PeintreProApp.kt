package dz.peintrepro

import android.app.Application
import dz.peintrepro.di.AppContainer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class PeintreProApp : Application() {

    lateinit var container: AppContainer
        private set

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)

        // Filet de sécurité : garantit paramètres et tarifs présents,
        // y compris pour une base créée par une version antérieure.
        applicationScope.launch {
            container.settingsRepository.ensureExists()
            container.tariffRepository.ensureNotEmpty()
        }
    }
}
