package dz.peintrepro.ui.screens.sites

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.data.local.entity.SiteEntity
import dz.peintrepro.di.AppContainer
import dz.peintrepro.domain.model.SiteStatus
import dz.peintrepro.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SiteFormState(
    val id: Long = 0L,
    val clientId: Long = 0L,
    val clientName: String = "",
    val quoteId: Long? = null,
    val quoteNumber: String = "",
    val address: String = "",
    val startDateMillis: Long? = null,
    val endDateMillis: Long? = null,
    val status: SiteStatus = SiteStatus.PREPARATION,
    val progress: Int = 0,
    val notes: String = "",
    val charge: Boolean = false,
    val enregistre: Boolean = false,
    val supprime: Boolean = false
)

class SiteDetailViewModel(
    private val container: AppContainer,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val siteId: Long = savedStateHandle[Routes.ARG_SITE_ID] ?: Routes.NEW_ID

    private val _form = MutableStateFlow(SiteFormState())
    val form: StateFlow<SiteFormState> = _form.asStateFlow()

    init {
        viewModelScope.launch {
            val site = container.siteRepository.getById(siteId) ?: return@launch
            val client = container.clientRepository.getById(site.clientId)
            val devis = site.quoteId?.let { container.quoteRepository.getQuote(it) }
            _form.value = SiteFormState(
                id = site.id,
                clientId = site.clientId,
                clientName = client?.name.orEmpty(),
                quoteId = site.quoteId,
                quoteNumber = devis?.number.orEmpty(),
                address = site.address,
                startDateMillis = site.startDateMillis,
                endDateMillis = site.endDateMillis,
                status = SiteStatus.from(site.status),
                progress = site.progress,
                notes = site.notes,
                charge = true
            )
        }
    }

    fun update(transform: (SiteFormState) -> SiteFormState) {
        _form.value = transform(_form.value).copy(enregistre = false)
    }

    /** Terminer un chantier met naturellement l'avancement à 100 %. */
    fun setStatus(statut: SiteStatus) {
        val courant = _form.value
        _form.value = courant.copy(
            status = statut,
            progress = if (statut == SiteStatus.DONE) 100 else courant.progress,
            enregistre = false
        )
    }

    fun save() {
        val etat = _form.value
        if (!etat.charge) return
        viewModelScope.launch {
            container.siteRepository.save(
                SiteEntity(
                    id = etat.id,
                    clientId = etat.clientId,
                    quoteId = etat.quoteId,
                    address = etat.address,
                    startDateMillis = etat.startDateMillis,
                    endDateMillis = etat.endDateMillis,
                    status = etat.status.name,
                    progress = etat.progress,
                    notes = etat.notes
                )
            )
            _form.value = _form.value.copy(enregistre = true)
        }
    }

    fun delete() {
        viewModelScope.launch {
            container.siteRepository.deleteById(siteId)
            _form.value = _form.value.copy(supprime = true)
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                SiteDetailViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}
