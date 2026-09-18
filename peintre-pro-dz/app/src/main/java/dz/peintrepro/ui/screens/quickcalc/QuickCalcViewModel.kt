package dz.peintrepro.ui.screens.quickcalc

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.core.Formats
import dz.peintrepro.di.AppContainer
import dz.peintrepro.di.QuickCalcHandoff
import dz.peintrepro.domain.calc.PaintCalculator
import dz.peintrepro.domain.calc.PaintEstimate
import dz.peintrepro.domain.calc.RoomDimensions
import dz.peintrepro.domain.calc.SurfaceCalculator
import dz.peintrepro.domain.calc.SurfaceResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class QuickCalcForm(
    val length: String = "",
    val width: String = "",
    val height: String = "2,80",
    val doorCount: String = "1",
    val windowCount: String = "2",
    val coats: String = "2",
    val pricePerSqm: String = "450",
    val coverage: String = "10",
    val includeCeiling: Boolean = false
)

data class QuickCalcResult(
    val surfaces: SurfaceResult,
    val paintedArea: Double,
    val estimatedPrice: Double,
    val paint: PaintEstimate
)

class QuickCalcViewModel(private val container: AppContainer) : ViewModel() {

    private val _form = MutableStateFlow(QuickCalcForm())
    val form: StateFlow<QuickCalcForm> = _form.asStateFlow()

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    val result: StateFlow<QuickCalcResult> = _form
        .map { compute(it) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            compute(QuickCalcForm())
        )

    init {
        // Le rendement et le nombre de couches viennent des paramètres de l'utilisateur.
        viewModelScope.launch {
            val settings = container.settingsRepository.get()
            _form.value = _form.value.copy(
                coverage = Formats.input(settings.defaultCoverage),
                coats = settings.defaultCoats.toString()
            )
        }
    }

    fun update(transform: (QuickCalcForm) -> QuickCalcForm) {
        _form.value = transform(_form.value)
    }

    private fun compute(form: QuickCalcForm): QuickCalcResult {
        val dimensions = RoomDimensions(
            length = Formats.parseDecimalOrZero(form.length),
            width = Formats.parseDecimalOrZero(form.width),
            height = Formats.parseDecimalOrZero(form.height),
            doorCount = Formats.parseIntOrZero(form.doorCount),
            windowCount = Formats.parseIntOrZero(form.windowCount)
        )
        val surfaces = SurfaceCalculator.compute(dimensions)
        val paintedArea =
            if (form.includeCeiling) surfaces.wallsAndCeilingArea else surfaces.netWallArea
        val coats = Formats.parseIntOrZero(form.coats)
        val coverage = Formats.parseDecimalOrZero(form.coverage)
        return QuickCalcResult(
            surfaces = surfaces,
            paintedArea = paintedArea,
            estimatedPrice = paintedArea * Formats.parseDecimalOrZero(form.pricePerSqm),
            paint = PaintCalculator.estimate(paintedArea, coats, coverage)
        )
    }

    /** Transmet la saisie à l'écran de devis (la pièce y sera créée automatiquement). */
    fun handOffToQuote() {
        val form = _form.value
        QuickCalcHandoff.put(
            QuickCalcHandoff.Draft(
                roomName = "Pièce 1",
                length = Formats.parseDecimalOrZero(form.length),
                width = Formats.parseDecimalOrZero(form.width),
                height = Formats.parseDecimalOrZero(form.height),
                doorCount = Formats.parseIntOrZero(form.doorCount),
                windowCount = Formats.parseIntOrZero(form.windowCount),
                coats = Formats.parseIntOrZero(form.coats),
                pricePerSqm = Formats.parseDecimalOrZero(form.pricePerSqm),
                includeCeiling = form.includeCeiling
            )
        )
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                QuickCalcViewModel(app.container)
            }
        }
    }
}
