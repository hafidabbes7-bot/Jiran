package dz.peintrepro.ui.screens.room

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.RoomItemEntity
import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.di.AppContainer
import dz.peintrepro.domain.calc.RoomDimensions
import dz.peintrepro.domain.calc.SurfaceCalculator
import dz.peintrepro.domain.calc.SurfaceResult
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.ui.navigation.Routes
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/** Saisie d'une pièce : tout est conservé en texte pour respecter la frappe. */
data class RoomFormState(
    val name: String = "",
    val length: String = "",
    val width: String = "",
    val height: String = "2,80",
    val doorCount: String = "0",
    val doorWidth: String = "0,8",
    val doorHeight: String = "2,1",
    val windowCount: String = "0",
    val windowWidth: String = "1,2",
    val windowHeight: String = "1,2",
    val manualEnabled: Boolean = false,
    val manualWallArea: String = "",
    val manualCeilingArea: String = "",
    val nameError: Boolean = false,
    val dimensionsError: Boolean = false
)

@OptIn(ExperimentalCoroutinesApi::class)
class RoomEditorViewModel(
    private val container: AppContainer,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val repository = container.quoteRepository

    val quoteId: Long = savedStateHandle[Routes.ARG_QUOTE_ID] ?: Routes.NEW_ID

    private val _roomId = MutableStateFlow(
        savedStateHandle[Routes.ARG_ROOM_ID] ?: Routes.NEW_ID
    )
    val roomId: StateFlow<Long> = _roomId.asStateFlow()

    private val _form = MutableStateFlow(RoomFormState())
    val form: StateFlow<RoomFormState> = _form.asStateFlow()

    private val _closed = MutableStateFlow(false)
    val closed: StateFlow<Boolean> = _closed.asStateFlow()

    private val _showLineDialog = MutableStateFlow(false)
    val showLineDialog: StateFlow<Boolean> = _showLineDialog.asStateFlow()

    val isNew: Boolean get() = _roomId.value == Routes.NEW_ID

    val surfaces: StateFlow<SurfaceResult> = _form
        .map { SurfaceCalculator.compute(it.toDimensions()) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            SurfaceCalculator.compute(RoomDimensions())
        )

    val lines: StateFlow<List<QuoteLineEntity>> = _roomId
        .flatMapLatest { id ->
            if (id == Routes.NEW_ID) flowOf(emptyList()) else repository.observeLinesForRoom(id)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val tariffs: StateFlow<List<TariffEntity>> = repository.observeQuote(quoteId)
        .flatMapLatest { quote ->
            container.tariffRepository.observeByLevel(quote?.level ?: QuoteLevel.STANDARD.name)
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    init {
        val existingId = _roomId.value
        if (existingId != Routes.NEW_ID) {
            viewModelScope.launch {
                repository.getRoom(existingId)?.let { room -> _form.value = room.toForm() }
            }
        } else {
            viewModelScope.launch {
                val existingRooms = repository.getRooms(quoteId).size
                _form.value = _form.value.copy(name = defaultRoomName(existingRooms))
            }
        }
    }

    private fun defaultRoomName(index: Int): String = "Pièce ${index + 1}"

    fun update(transform: (RoomFormState) -> RoomFormState) {
        _form.value = transform(_form.value)
    }

    fun setManualEnabled(enabled: Boolean) {
        val surface = surfaces.value
        _form.value = _form.value.copy(
            manualEnabled = enabled,
            manualWallArea = if (enabled && _form.value.manualWallArea.isBlank()) {
                Formats.input(surface.netWallArea)
            } else {
                _form.value.manualWallArea
            },
            manualCeilingArea = if (enabled && _form.value.manualCeilingArea.isBlank()) {
                Formats.input(surface.ceilingArea)
            } else {
                _form.value.manualCeilingArea
            }
        )
    }

    /**
     * Enregistre la pièce. Retourne false si la saisie est invalide :
     * nom obligatoire, dimensions strictement positives (sauf surfaces manuelles).
     */
    private fun validate(): Boolean {
        val state = _form.value
        val nameError = state.name.isBlank()
        val dimensions = state.toDimensions()
        val dimensionsMissing = dimensions.length <= 0.0 ||
            dimensions.width <= 0.0 ||
            dimensions.height <= 0.0
        val dimensionsError = dimensionsMissing && !state.manualEnabled
        _form.value = state.copy(nameError = nameError, dimensionsError = dimensionsError)
        return !nameError && !dimensionsError
    }

    fun save(closeAfter: Boolean) {
        if (!validate()) return
        viewModelScope.launch {
            persist()
            if (closeAfter) _closed.value = true
        }
    }

    private suspend fun persist(): Long {
        val state = _form.value
        val entity = state.toEntity(quoteId = quoteId, roomId = _roomId.value)
        return if (_roomId.value == Routes.NEW_ID) {
            val newId = repository.addRoom(entity)
            savedStateHandle[Routes.ARG_ROOM_ID] = newId
            _roomId.value = newId
            newId
        } else {
            repository.updateRoom(entity)
            _roomId.value
        }
    }

    /** Ajouter un travail : la pièce est enregistrée d'abord, sans friction. */
    fun requestAddLine() {
        if (!validate()) return
        viewModelScope.launch {
            persist()
            _showLineDialog.value = true
        }
    }

    fun dismissLineDialog() {
        _showLineDialog.value = false
    }

    fun addLine(line: QuoteLineEntity) {
        val roomId = _roomId.value
        if (roomId == Routes.NEW_ID) return
        viewModelScope.launch {
            repository.addLine(line.copy(quoteId = quoteId, roomId = roomId))
        }
    }

    fun updateLine(line: QuoteLineEntity) {
        viewModelScope.launch { repository.updateLine(line) }
    }

    fun deleteLine(line: QuoteLineEntity) {
        viewModelScope.launch { repository.deleteLine(line) }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                RoomEditorViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}

// --------------------------------------------------------------- Conversions

fun RoomFormState.toDimensions(): RoomDimensions = RoomDimensions(
    length = Formats.parseDecimalOrZero(length),
    width = Formats.parseDecimalOrZero(width),
    height = Formats.parseDecimalOrZero(height),
    doorCount = Formats.parseIntOrZero(doorCount),
    doorWidth = Formats.parseDecimalOrZero(doorWidth),
    doorHeight = Formats.parseDecimalOrZero(doorHeight),
    windowCount = Formats.parseIntOrZero(windowCount),
    windowWidth = Formats.parseDecimalOrZero(windowWidth),
    windowHeight = Formats.parseDecimalOrZero(windowHeight),
    manualWallArea = if (manualEnabled) Formats.parseDecimal(manualWallArea) else null,
    manualCeilingArea = if (manualEnabled) Formats.parseDecimal(manualCeilingArea) else null
)

fun RoomFormState.toEntity(quoteId: Long, roomId: Long): RoomItemEntity {
    val dimensions = toDimensions()
    return RoomItemEntity(
        id = roomId,
        quoteId = quoteId,
        name = name.trim(),
        length = dimensions.length,
        width = dimensions.width,
        height = dimensions.height,
        doorCount = dimensions.doorCount,
        doorWidth = dimensions.doorWidth,
        doorHeight = dimensions.doorHeight,
        windowCount = dimensions.windowCount,
        windowWidth = dimensions.windowWidth,
        windowHeight = dimensions.windowHeight,
        manualWallArea = dimensions.manualWallArea,
        manualCeilingArea = dimensions.manualCeilingArea
    )
}

fun RoomItemEntity.toForm(): RoomFormState = RoomFormState(
    name = name,
    length = Formats.input(length),
    width = Formats.input(width),
    height = Formats.input(height),
    doorCount = doorCount.toString(),
    doorWidth = Formats.input(doorWidth),
    doorHeight = Formats.input(doorHeight),
    windowCount = windowCount.toString(),
    windowWidth = Formats.input(windowWidth),
    windowHeight = Formats.input(windowHeight),
    manualEnabled = manualWallArea != null || manualCeilingArea != null,
    manualWallArea = manualWallArea?.let { Formats.input(it) } ?: "",
    manualCeilingArea = manualCeilingArea?.let { Formats.input(it) } ?: ""
)
