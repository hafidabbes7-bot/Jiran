package dz.peintrepro.ui.screens.sites

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.data.local.relation.SiteListRow
import dz.peintrepro.di.AppContainer
import dz.peintrepro.domain.model.SiteStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn

class SiteListViewModel(container: AppContainer) : ViewModel() {

    private val _statut = MutableStateFlow<SiteStatus?>(null)
    val statut: StateFlow<SiteStatus?> = _statut.asStateFlow()

    val chantiers: StateFlow<List<SiteListRow>> = combine(
        container.siteRepository.observeRows(),
        _statut
    ) { lignes, statut ->
        if (statut == null) lignes else lignes.filter { it.status == statut.name }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setStatut(valeur: SiteStatus?) {
        _statut.value = valeur
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                SiteListViewModel(app.container)
            }
        }
    }
}
