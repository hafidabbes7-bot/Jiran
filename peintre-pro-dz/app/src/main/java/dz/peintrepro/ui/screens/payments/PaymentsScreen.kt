package dz.peintrepro.ui.screens.payments

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.PaymentEntity
import dz.peintrepro.domain.model.PaymentMethod
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.DateField
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.DropdownField
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.SectionCard

@Composable
fun PaymentsScreen(
    onBack: () -> Unit,
    onOpenQuote: (Long) -> Unit,
    viewModel: PaymentsViewModel = viewModel(factory = PaymentsViewModel.Factory)
) {
    val paiements by viewModel.paiements.collectAsStateWithLifecycle()
    val devisDisponibles by viewModel.devis.collectAsStateWithLifecycle()
    val devise by viewModel.currency.collectAsStateWithLifecycle()
    val encaisse by viewModel.encaisse.collectAsStateWithLifecycle()
    val reste by viewModel.reste.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val formulaireOuvert by viewModel.formulaireOuvert.collectAsStateWithLifecycle()
    val paiementEnEdition by viewModel.paiementEnEdition.collectAsStateWithLifecycle()
    val depassement by viewModel.depassement.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    var suppressionEnAttente by remember { mutableStateOf<Long?>(null) }

    LaunchedEffect(message) {
        val resId = message
        if (resId != null) {
            snackbarHostState.showSnackbar(context.getString(resId))
            viewModel.effacerMessage()
        }
    }

    suppressionEnAttente?.let { paiementId ->
        ConfirmDialog(
            title = stringResource(R.string.payment_delete_title),
            message = stringResource(R.string.payment_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                suppressionEnAttente = null
                viewModel.supprimer(paiementId)
            },
            onDismiss = { suppressionEnAttente = null }
        )
    }

    depassement?.let { info ->
        AlertDialog(
            onDismissRequest = viewModel::annulerDepassement,
            title = { Text(stringResource(R.string.payment_exceeds_title)) },
            text = {
                Text(
                    stringResource(
                        R.string.payment_exceeds_message,
                        Formats.money(info.reste, devise),
                        Formats.money(info.paiement.amount, devise)
                    )
                )
            },
            confirmButton = {
                TextButton(onClick = { viewModel.enregistrer(info.paiement, forcer = true) }) {
                    Text(stringResource(R.string.action_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = viewModel::annulerDepassement) {
                    Text(stringResource(R.string.action_cancel))
                }
            }
        )
    }

    if (formulaireOuvert && paiementEnEdition != null) {
        PaymentDialog(
            initial = paiementEnEdition!!,
            devis = devisDisponibles,
            devise = devise,
            quoteFixe = viewModel.quoteId != 0L,
            onDismiss = viewModel::fermerFormulaire,
            onConfirm = { paiement -> viewModel.enregistrer(paiement, forcer = false) }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(
                    if (viewModel.quoteId == 0L) R.string.payments_title
                    else R.string.payments_quote_title
                ),
                onBack = onBack
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            FloatingActionButton(onClick = viewModel::nouveauPaiement) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.payment_new))
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                SectionCard {
                    Column {
                        LabeledValueRow(
                            label = stringResource(R.string.payments_collected),
                            value = Formats.money(encaisse, devise)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.payments_remaining),
                            value = Formats.money(reste, devise),
                            emphasize = true
                        )
                    }
                }
            }

            if (paiements.isEmpty()) {
                item {
                    EmptyState(
                        text = stringResource(
                            if (viewModel.quoteId == 0L) R.string.payments_empty
                            else R.string.payments_none_for_quote
                        )
                    )
                }
            }

            items(items = paiements, key = { it.id }) { paiement ->
                SectionCard(
                    modifier = Modifier.clickable { viewModel.modifierPaiement(paiement.id) }
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = Formats.money(paiement.amount, devise),
                                style = MaterialTheme.typography.titleMedium
                            )
                            Text(
                                text = Formats.date(paiement.dateMillis) + " · " +
                                    stringResource(PaymentMethod.from(paiement.method).labelRes),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = paiement.quoteNumber + " · " + paiement.clientName,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.clickable { onOpenQuote(paiement.quoteId) }
                            )
                            if (paiement.note.isNotBlank()) {
                                Text(
                                    text = paiement.note,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                            }
                        }
                        IconButton(onClick = { suppressionEnAttente = paiement.id }) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = stringResource(R.string.action_delete)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PaymentDialog(
    initial: PaymentEntity,
    devis: List<dz.peintrepro.data.local.relation.QuoteListRow>,
    devise: String,
    quoteFixe: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (PaymentEntity) -> Unit
) {
    var montant by remember {
        mutableStateOf(if (initial.amount == 0.0) "" else Formats.input(initial.amount))
    }
    var date by remember { mutableStateOf(initial.dateMillis) }
    var mode by remember { mutableStateOf(PaymentMethod.from(initial.method)) }
    var note by remember { mutableStateOf(initial.note) }
    var devisChoisi by remember { mutableStateOf(initial.quoteId) }

    val montantValeur = Formats.parseDecimal(montant) ?: -1.0
    val montantInvalide = montant.isNotEmpty() && montantValeur <= 0.0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                stringResource(
                    if (initial.id == 0L) R.string.payment_new else R.string.payment_edit
                )
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (!quoteFixe) {
                    DropdownField(
                        label = stringResource(R.string.payment_quote),
                        options = devis,
                        selected = devis.firstOrNull { it.id == devisChoisi },
                        optionLabel = { "${it.number} — ${it.clientName}" },
                        onSelected = { devisChoisi = it.id }
                    )
                }
                DecimalField(
                    label = stringResource(R.string.payment_amount) + " ($devise)",
                    value = montant,
                    onValueChange = { montant = it },
                    isError = montantInvalide,
                    supportingText = if (montantInvalide) {
                        stringResource(R.string.payment_error_amount)
                    } else {
                        null
                    }
                )
                DateField(
                    label = stringResource(R.string.payment_date),
                    millis = date,
                    onDateSelected = { date = it }
                )
                DropdownField(
                    label = stringResource(R.string.payment_method),
                    options = PaymentMethod.entries.toList(),
                    selected = mode,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { mode = it }
                )
                AppTextField(
                    label = stringResource(R.string.payment_note),
                    value = note,
                    onValueChange = { note = it },
                    singleLine = false,
                    minLines = 2
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onConfirm(
                        initial.copy(
                            quoteId = devisChoisi,
                            amount = montantValeur.coerceAtLeast(0.0),
                            dateMillis = date,
                            method = mode.name,
                            note = note
                        )
                    )
                }
            ) { Text(stringResource(R.string.action_save)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }
        }
    )
}
