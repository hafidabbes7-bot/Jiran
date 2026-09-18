package dz.peintrepro.ui.screens.clients

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.data.local.entity.ClientEntity
import dz.peintrepro.data.local.entity.SiteEntity
import dz.peintrepro.data.local.relation.QuoteListRow
import dz.peintrepro.di.AppContainer
import dz.peintrepro.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ClientDetailUiState(
    val client: ClientEntity? = null,
    val quotes: List<QuoteListRow> = emptyList(),
    val sites: List<SiteEntity> = emptyList(),
    val outstanding: Double = 0.0,
    val currency: String = "DA"
)

class ClientDetailViewModel(
    private val container: AppContainer,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val clientId: Long = savedStateHandle[Routes.ARG_CLIENT_ID] ?: Routes.NEW_ID

    val client: StateFlow<ClientEntity?> = container.clientRepository.observeById(clientId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val quotes: StateFlow<List<QuoteListRow>> =
        container.quoteRepository.observeRowsForClient(clientId)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val sites: StateFlow<List<SiteEntity>> = container.siteRepository.observeByClient(clientId)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val outstanding: StateFlow<Double> =
        container.quoteRepository.observeClientOutstanding(clientId)
            .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    private val _deleteBlocked = MutableStateFlow(false)
    val deleteBlocked: StateFlow<Boolean> = _deleteBlocked.asStateFlow()

    private val _deleted = MutableStateFlow(false)
    val deleted: StateFlow<Boolean> = _deleted.asStateFlow()

    fun delete() {
        val current = client.value ?: return
        viewModelScope.launch {
            val success = container.clientRepository.delete(current)
            if (success) _deleted.value = true else _deleteBlocked.value = true
        }
    }

    fun dismissDeleteBlocked() {
        _deleteBlocked.value = false
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                ClientDetailViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}
