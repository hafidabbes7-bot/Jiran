package dz.peintrepro.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.SettingsEntity
import dz.peintrepro.di.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SettingsForm(
    val companyName: String = "",
    val phone: String = "",
    val address: String = "",
    val email: String = "",
    val currency: String = "DA",
    val vatEnabled: Boolean = false,
    val vatRate: String = "19",
    val validityDays: String = "30",
    val coverage: String = "10",
    val coats: String = "2",
    val conditions: String = "",
    val saved: Boolean = false
)

class SettingsViewModel(private val container: AppContainer) : ViewModel() {

    private val _form = MutableStateFlow(SettingsForm())
    val form: StateFlow<SettingsForm> = _form.asStateFlow()

    init {
        viewModelScope.launch {
            val settings = container.settingsRepository.get()
            _form.value = SettingsForm(
                companyName = settings.companyName,
                phone = settings.phone,
                address = settings.address,
                email = settings.email,
                currency = settings.currency,
                vatEnabled = settings.vatEnabled,
                vatRate = Formats.input(settings.vatRate),
                validityDays = settings.defaultValidityDays.toString(),
                coverage = Formats.input(settings.defaultCoverage),
                coats = settings.defaultCoats.toString(),
                conditions = settings.conditions
            )
        }
    }

    fun update(transform: (SettingsForm) -> SettingsForm) {
        _form.value = transform(_form.value).copy(saved = false)
    }

    fun save() {
        val form = _form.value
        viewModelScope.launch {
            val current = container.settingsRepository.get()
            container.settingsRepository.save(
                current.copy(
                    id = SettingsEntity.SINGLETON_ID,
                    companyName = form.companyName.trim(),
                    phone = form.phone.trim(),
                    address = form.address.trim(),
                    email = form.email.trim(),
                    currency = form.currency.trim().ifBlank { "DA" },
                    vatEnabled = form.vatEnabled,
                    vatRate = Formats.parseDecimalOrZero(form.vatRate).coerceAtLeast(0.0),
                    defaultValidityDays = Formats.parseIntOrZero(form.validityDays)
                        .coerceAtLeast(0),
                    defaultCoverage = Formats.parseDecimalOrZero(form.coverage)
                        .coerceAtLeast(0.1),
                    defaultCoats = Formats.parseIntOrZero(form.coats).coerceIn(1, 5),
                    conditions = form.conditions
                )
            )
            _form.value = _form.value.copy(saved = true)
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                SettingsViewModel(app.container)
            }
        }
    }
}
