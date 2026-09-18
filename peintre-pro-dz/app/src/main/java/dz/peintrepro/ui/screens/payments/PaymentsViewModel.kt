package dz.peintrepro.ui.screens.payments

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import dz.peintrepro.PeintreProApp
import dz.peintrepro.R
import dz.peintrepro.data.local.entity.PaymentEntity
import dz.peintrepro.data.local.relation.PaymentListRow
import dz.peintrepro.data.local.relation.QuoteListRow
import dz.peintrepro.di.AppContainer
import dz.peintrepro.ui.navigation.Routes
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlin.math.max

/** Un paiement dépasse le reste à payer : on demande confirmation (règle §29). */
data class DepassementPaiement(val reste: Double, val paiement: PaymentEntity)

class PaymentsViewModel(
    private val container: AppContainer,
    savedStateHandle: SavedStateHandle
) : ViewModel() {

    /** 0 : tous les paiements. Sinon, les paiements d'un devis précis. */
    val quoteId: Long = savedStateHandle[Routes.ARG_QUOTE_ID] ?: Routes.NEW_ID

    val paiements: StateFlow<List<PaymentListRow>> =
        (if (quoteId == Routes.NEW_ID) {
            container.paymentRepository.observeRows()
        } else {
            container.paymentRepository.observeRowsForQuote(quoteId)
        }).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val devis: StateFlow<List<QuoteListRow>> = container.quoteRepository.observeRows()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val currency: StateFlow<String> = container.settingsRepository.observe()
        .map { it.currency }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), "DA")

    val encaisse: StateFlow<Double> = paiements
        .map { liste -> liste.sumOf { it.amount } }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    /** Reste à encaisser : sur le devis choisi, ou sur tous les devis acceptés. */
    val reste: StateFlow<Double> =
        (if (quoteId == Routes.NEW_ID) {
            container.statsRepository.observeDashboard().map { it.outstanding }
        } else {
            combine(
                container.quoteRepository.observeQuote(quoteId),
                container.paymentRepository.observeSumForQuote(quoteId)
            ) { devis, paye ->
                if (devis == null) 0.0
                else max(0.0, devis.totalAmount - devis.depositAmount - paye)
            }
        }).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0.0)

    private val _message = MutableStateFlow<Int?>(null)
    val message: StateFlow<Int?> = _message.asStateFlow()

    private val _depassement = MutableStateFlow<DepassementPaiement?>(null)
    val depassement: StateFlow<DepassementPaiement?> = _depassement.asStateFlow()

    private val _formulaireOuvert = MutableStateFlow(false)
    val formulaireOuvert: StateFlow<Boolean> = _formulaireOuvert.asStateFlow()

    private val _paiementEnEdition = MutableStateFlow<PaymentEntity?>(null)
    val paiementEnEdition: StateFlow<PaymentEntity?> = _paiementEnEdition.asStateFlow()

    fun nouveauPaiement() {
        _paiementEnEdition.value = PaymentEntity(
            quoteId = if (quoteId == Routes.NEW_ID) 0L else quoteId
        )
        _formulaireOuvert.value = true
    }

    fun modifierPaiement(paymentId: Long) {
        viewModelScope.launch {
            val paiement = container.paymentRepository.getById(paymentId) ?: return@launch
            _paiementEnEdition.value = paiement
            _formulaireOuvert.value = true
        }
    }

    fun fermerFormulaire() {
        _formulaireOuvert.value = false
        _paiementEnEdition.value = null
        _depassement.value = null
    }

    /**
     * Enregistre un paiement. Au-delà du reste à payer, on ne bloque pas :
     * on demande confirmation, car un client peut régler d'avance.
     */
    fun enregistrer(paiement: PaymentEntity, forcer: Boolean) {
        if (paiement.amount <= 0.0) {
            _message.value = R.string.payment_error_amount
            return
        }
        if (paiement.quoteId == 0L) {
            _message.value = R.string.payment_error_quote
            return
        }
        viewModelScope.launch {
            val resteDevis = resteDuDevis(paiement.quoteId, paiement.id)
            if (!forcer && paiement.amount > resteDevis + 0.01) {
                _depassement.value = DepassementPaiement(resteDevis, paiement)
                return@launch
            }
            container.paymentRepository.save(paiement)
            fermerFormulaire()
        }
    }

    fun annulerDepassement() {
        _depassement.value = null
    }

    fun supprimer(paymentId: Long) {
        viewModelScope.launch {
            container.paymentRepository.getById(paymentId)?.let {
                container.paymentRepository.delete(it)
            }
        }
    }

    fun effacerMessage() {
        _message.value = null
    }

    /** Reste à payer du devis, sans compter le paiement en cours de modification. */
    private suspend fun resteDuDevis(devisId: Long, paiementExclu: Long): Double {
        val devis = container.quoteRepository.getQuote(devisId) ?: return 0.0
        val paye = container.paymentRepository.sumForQuote(devisId)
        val ancien = if (paiementExclu != 0L) {
            container.paymentRepository.getById(paiementExclu)?.amount ?: 0.0
        } else {
            0.0
        }
        return max(0.0, devis.totalAmount - devis.depositAmount - (paye - ancien))
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                val app = this[APPLICATION_KEY] as PeintreProApp
                PaymentsViewModel(app.container, createSavedStateHandle())
            }
        }
    }
}
