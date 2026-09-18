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
import dz.peintrepro.di.AppContainer
import dz.peintrepro.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ClientEditUiState(
    val id: Long = 0L,
    val name: String = "",
    val phone: String = "",
    val address: String = "",
    val notes: String = "",
    val nameError: Boolean = false,
    val saved: Boolean = false
)

class ClientEditViewModel(
    container: AppContainer,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val repository = container.clientRepository
    private val clientId: Long = savedStateHandle[Routes.ARG_CLIENT_ID] ?: Routes.NEW_ID

    private val _uiState = MutableStateFlow(ClientEditUiState(id = clientId))
    val uiState: StateFlow<ClientEditUiState> = _uiState.asStateFlow()

    val isNew: Boolean get() = clientId == Routes.NEW_ID

    init {
        if (clientId != Routes.NEW_ID) {
            viewModelScope.launch {
                repository.getById(clientId)?.let { client ->
                    _uiState.value = ClientEditUiState(
                        id = client.id,
                        name = client.name,
                        phone = client.phone,
                        address = client.address,
                        notes = client.notes
                    )
                }
            }
        }
    }

    fun setName(value: String) {
        _uiState.value = _uiState.value.copy(name = value, nameError = false)
    }

    fun setPhone(value: String) {
        _uiState.value = _uiState.value.copy(phone = value)
    }

    fun setAddress(value: String) {
        _uiState.value = _uiState.value.copy(address = value)
    }

    fun setNotes(value: String) {
        _uiState.value = _uiState.value.copy(notes = value)
    }

    /** Le nom est obligatoire : sans lui, un devis n'est pas exploitable. */
    fun save() {
        val state = _uiState.value
        if (state.name.isBlank()) {
            _uiState.value = state.copy(nameError = true)
            return
        }
        viewModelScope.launch {
            repository.save(
                ClientEntity(
                    id = state.id,
                    name = state.name,
                    phone = state.phone,
                    address = state.address,
                    notes = state.notes
                )
            )
            _uiState.value = _uiState.value.copy(saved = true)
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                ClientEditViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}
