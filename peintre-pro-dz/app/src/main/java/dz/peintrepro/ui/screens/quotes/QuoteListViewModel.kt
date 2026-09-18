package dz.peintrepro.ui.screens.quotes

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.relation.QuoteListRow
import dz.peintrepro.di.AppContainer
import dz.peintrepro.domain.model.QuoteStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class QuotePeriod(@StringRes val labelRes: Int) {
    ALL(R.string.quotes_period_all),
    MONTH(R.string.quotes_period_month),
    YEAR(R.string.quotes_period_year)
}

class QuoteListViewModel(private val container: AppContainer) : ViewModel() {

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _status = MutableStateFlow<QuoteStatus?>(null)
    val status: StateFlow<QuoteStatus?> = _status.asStateFlow()

    private val _period = MutableStateFlow(QuotePeriod.ALL)
    val period: StateFlow<QuotePeriod> = _period.asStateFlow()

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    val quotes: StateFlow<List<QuoteListRow>> = combine(
        container.quoteRepository.observeRows(),
        _query,
        _status,
        _period
    ) { rows, query, status, period ->
        val from = when (period) {
            QuotePeriod.ALL -> Long.MIN_VALUE
            QuotePeriod.MONTH -> Formats.startOfCurrentMonth()
            QuotePeriod.YEAR -> Formats.startOfCurrentYear()
        }
        val needle = query.trim().lowercase()
        rows.filter { row ->
            (status == null || row.status == status.name) &&
                row.dateMillis >= from &&
                (
                    needle.isEmpty() ||
                        row.number.lowercase().contains(needle) ||
                        row.clientName.lowercase().contains(needle) ||
                        row.siteAddress.lowercase().contains(needle)
                    )
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun setQuery(value: String) {
        _query.value = value
    }

    fun setStatus(value: QuoteStatus?) {
        _status.value = value
    }

    fun setPeriod(value: QuotePeriod) {
        _period.value = value
    }

    fun duplicate(quoteId: Long) {
        viewModelScope.launch { container.quoteRepository.duplicateQuote(quoteId) }
    }

    fun delete(quoteId: Long) {
        viewModelScope.launch { container.quoteRepository.deleteQuote(quoteId) }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                QuoteListViewModel(app.container)
            }
        }
    }
}
