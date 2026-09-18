package dz.peintrepro.ui.screens.quote

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
import dz.peintrepro.data.local.entity.QuoteEntity
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.RoomItemEntity
import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.R
import dz.peintrepro.data.repository.ConversionChantier
import dz.peintrepro.data.repository.QuoteRepository
import dz.peintrepro.di.AppContainer
import dz.peintrepro.di.QuickCalcHandoff
import dz.peintrepro.domain.calc.QuoteTotals
import dz.peintrepro.domain.calc.SurfaceCalculator
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteType
import dz.peintrepro.domain.model.UnitType
import dz.peintrepro.pdf.QuotePdfData
import dz.peintrepro.ui.navigation.Routes
import dz.peintrepro.data.local.entity.toDimensions
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

@OptIn(ExperimentalCoroutinesApi::class)
class QuoteEditorViewModel(
    private val container: AppContainer,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val repository = container.quoteRepository

    private val _quoteId = MutableStateFlow(
        savedStateHandle[Routes.ARG_QUOTE_ID] ?: Routes.NEW_ID
    )
    val quoteId: StateFlow<Long> = _quoteId.asStateFlow()

    /** Message ponctuel affiché en bas de l'écran (erreur ou confirmation). */
    private val _message = MutableStateFlow<Int?>(null)
    val message: StateFlow<Int?> = _message.asStateFlow()

    val quote: StateFlow<QuoteEntity?> = _quoteId
        .flatMapLatest { id -> if (id == Routes.NEW_ID) flowOf(null) else repository.observeQuote(id) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val rooms: StateFlow<List<RoomItemEntity>> = _quoteId
        .flatMapLatest { id ->
            if (id == Routes.NEW_ID) flowOf(emptyList()) else repository.observeRooms(id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val lines: StateFlow<List<QuoteLineEntity>> = _quoteId
        .flatMapLatest { id ->
            if (id == Routes.NEW_ID) flowOf(emptyList()) else repository.observeLines(id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    private val paid: StateFlow<Double> = _quoteId
        .flatMapLatest { id ->
            if (id == Routes.NEW_ID) flowOf(0.0) else repository.observePaid(id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    val clients: StateFlow<List<ClientEntity>> = container.clientRepository.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val client: StateFlow<ClientEntity?> = combine(quote, clients) { quote, clients ->
        clients.firstOrNull { it.id == quote?.clientId }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    val totals: StateFlow<QuoteTotals> = combine(quote, lines, paid) { quote, lines, paid ->
        if (quote == null) QuoteTotals() else QuoteRepository.computeTotals(quote, lines, paid)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), QuoteTotals())

    /** Tarifs du niveau sélectionné, proposés lors de l'ajout d'une ligne. */
    val tariffs: StateFlow<List<TariffEntity>> = quote
        .flatMapLatest { quote ->
            container.tariffRepository.observeByLevel(
                (quote?.level ?: QuoteLevel.STANDARD.name)
            )
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    /** Surface nette totale des murs, pratique pour pré-remplir les quantités. */
    val totalNetWallArea: StateFlow<Double> = rooms
        .map { list -> list.sumOf { SurfaceCalculator.compute(it.toDimensions()).netWallArea } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    val totalCeilingArea: StateFlow<Double> = rooms
        .map { list -> list.sumOf { SurfaceCalculator.compute(it.toDimensions()).ceilingArea } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    // ------------------------------------------------------------- Actions

    /**
     * Sélection du client. C'est cette étape qui crée réellement le devis :
     * un devis sans client n'a pas de sens (règle de validation demandée).
     */
    fun selectClient(clientId: Long) {
        viewModelScope.launch {
            val current = quote.value
            if (current == null) {
                val newId = repository.createQuote(clientId)
                // Mémorisé aussi dans l'état sauvegardé : si Android détruit le
                // processus, on retrouve le devis créé au lieu d'en créer un autre.
                savedStateHandle[Routes.ARG_QUOTE_ID] = newId
                _quoteId.value = newId
                applyQuickCalcDraft(newId)
            } else {
                repository.updateQuote(current.copy(clientId = clientId))
            }
        }
    }

    /** Reprend le résultat du calcul rapide, s'il y en a un en attente. */
    private suspend fun applyQuickCalcDraft(quoteId: Long) {
        val draft = QuickCalcHandoff.consume() ?: return
        val roomId = repository.addRoom(
            RoomItemEntity(
                quoteId = quoteId,
                name = draft.roomName,
                length = draft.length,
                width = draft.width,
                height = draft.height,
                doorCount = draft.doorCount,
                windowCount = draft.windowCount
            )
        )
        val room = repository.getRoom(roomId) ?: return
        val surfaces = SurfaceCalculator.compute(room.toDimensions())
        val quantity =
            if (draft.includeCeiling) surfaces.wallsAndCeilingArea else surfaces.netWallArea
        repository.addLine(
            QuoteLineEntity(
                quoteId = quoteId,
                roomId = roomId,
                category = LineCategory.WORK.name,
                designation = "Peinture ${draft.coats} couche(s)",
                unit = UnitType.M2.name,
                quantity = quantity,
                unitPrice = draft.pricePerSqm
            )
        )
    }

    private fun updateQuote(transform: (QuoteEntity) -> QuoteEntity) {
        val current = quote.value ?: return
        viewModelScope.launch { repository.updateQuote(transform(current)) }
    }

    fun setSiteType(value: SiteType) = updateQuote { it.copy(siteType = value.name) }

    fun setSiteAddress(value: String) = updateQuote { it.copy(siteAddress = value) }

    fun setNotes(value: String) = updateQuote { it.copy(notes = value) }

    fun setDate(millis: Long) = updateQuote { it.copy(dateMillis = millis) }

    fun setLevel(value: QuoteLevel) = updateQuote { it.copy(level = value.name) }

    fun setStatus(value: QuoteStatus) = updateQuote { it.copy(status = value.name) }

    fun setDiscount(value: Double) = updateQuote { it.copy(discount = value.coerceAtLeast(0.0)) }

    fun setDeposit(value: Double) = updateQuote { it.copy(depositAmount = value.coerceAtLeast(0.0)) }

    fun setVatEnabled(value: Boolean) = updateQuote { it.copy(vatEnabled = value) }

    fun setVatRate(value: Double) = updateQuote { it.copy(vatRate = value.coerceAtLeast(0.0)) }

    fun addLine(line: QuoteLineEntity) {
        val id = _quoteId.value
        if (id == Routes.NEW_ID) {
            _message.value = R.string.quote_error_client
            return
        }
        viewModelScope.launch { repository.addLine(line.copy(quoteId = id)) }
    }

    fun updateLine(line: QuoteLineEntity) {
        viewModelScope.launch { repository.updateLine(line) }
    }

    fun deleteLine(line: QuoteLineEntity) {
        viewModelScope.launch { repository.deleteLine(line) }
    }

    fun deleteRoom(room: RoomItemEntity) {
        viewModelScope.launch { repository.deleteRoom(room) }
    }

    /** Chantier ouvert après une conversion réussie (null : rien à ouvrir). */
    private val _chantierOuvert = MutableStateFlow<Long?>(null)
    val chantierOuvert: StateFlow<Long?> = _chantierOuvert.asStateFlow()

    /**
     * Rassemble tout ce qu'il faut pour imprimer le devis. Les données sont
     * relues en base pour être sûr d'imprimer l'état enregistré, pas un écran
     * à moitié saisi.
     */
    suspend fun donneesPdf(): QuotePdfData? {
        val id = _quoteId.value
        if (id == Routes.NEW_ID) return null
        val quote = repository.getQuote(id) ?: return null
        val lignes = repository.getLines(id)
        if (lignes.isEmpty()) return null
        val pieces = repository.getRooms(id)
        val paye = container.paymentRepository.sumForQuote(id)
        return QuotePdfData(
            quote = quote,
            client = container.clientRepository.getById(quote.clientId),
            lines = lignes.sortedWith(compareBy({ it.position }, { it.id })),
            roomNames = pieces.associate { it.id to it.name },
            settings = container.settingsRepository.get(),
            totals = QuoteRepository.computeTotals(quote, lignes, paye)
        )
    }

    /** Convertit le devis accepté en chantier (un seul chantier par devis). */
    fun convertirEnChantier() {
        val id = _quoteId.value
        if (id == Routes.NEW_ID) {
            _message.value = R.string.quote_error_client
            return
        }
        viewModelScope.launch {
            when (val resultat = container.siteRepository.convertirDepuisDevis(id)) {
                is ConversionChantier.Cree -> {
                    _message.value = R.string.site_created
                    _chantierOuvert.value = resultat.siteId
                }
                is ConversionChantier.DejaExistant -> {
                    _message.value = R.string.site_exists
                    _chantierOuvert.value = resultat.siteId
                }
                ConversionChantier.DevisNonAccepte ->
                    _message.value = R.string.site_quote_only_accepted
                ConversionChantier.Introuvable ->
                    _message.value = R.string.quote_error_client
            }
        }
    }

    fun chantierAffiche() {
        _chantierOuvert.value = null
    }

    fun showMessage(resId: Int) {
        _message.value = resId
    }

    fun clearMessage() {
        _message.value = null
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                QuoteEditorViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}
