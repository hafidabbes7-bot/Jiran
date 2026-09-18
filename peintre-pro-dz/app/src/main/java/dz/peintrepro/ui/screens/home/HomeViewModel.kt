package dz.peintrepro.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.data.repository.DashboardStats
import dz.peintrepro.di.AppContainer
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

data class HomeUiState(
    val stats: DashboardStats = DashboardStats(),
    val currency: String = "DA",
    val companyName: String = ""
)

class HomeViewModel(container: AppContainer) : ViewModel() {

    val uiState: StateFlow<HomeUiState> = combine(
        container.statsRepository.observeDashboard(),
        container.settingsRepository.observe()
    ) { stats, settings ->
        HomeUiState(
            stats = stats,
            currency = settings.currency,
            companyName = settings.companyName
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = HomeUiState()
    )

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                HomeViewModel(app.container)
            }
        }
    }
}
