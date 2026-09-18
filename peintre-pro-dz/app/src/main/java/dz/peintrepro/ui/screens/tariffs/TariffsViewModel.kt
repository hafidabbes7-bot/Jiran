package dz.peintrepro.ui.screens.tariffs

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.di.AppContainer
import dz.peintrepro.domain.model.QuoteLevel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class TariffsViewModel(private val container: AppContainer) : ViewModel() {

    private val _level = MutableStateFlow(QuoteLevel.STANDARD)
    val level: StateFlow<QuoteLevel> = _level.asStateFlow()

    val tariffs: StateFlow<List<TariffEntity>> = _level
        .flatMapLatest { container.tariffRepository.observeByLevel(it.name) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    fun setLevel(value: QuoteLevel) {
        _level.value = value
    }

    fun save(tariff: TariffEntity) {
        viewModelScope.launch { container.tariffRepository.save(tariff) }
    }

    fun delete(tariff: TariffEntity) {
        viewModelScope.launch { container.tariffRepository.delete(tariff) }
    }

    fun resetToDefaults() {
        viewModelScope.launch { container.tariffRepository.resetToDefaults() }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                TariffsViewModel(app.container)
            }
        }
    }
}
