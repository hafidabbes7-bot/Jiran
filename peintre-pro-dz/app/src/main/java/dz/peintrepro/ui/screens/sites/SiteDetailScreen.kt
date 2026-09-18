package dz.peintrepro.ui.screens.sites

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
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
import dz.peintrepro.domain.model.SiteStatus
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.DateField
import dz.peintrepro.ui.components.DropdownField
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.SecondaryButton
import dz.peintrepro.ui.components.SectionCard
import kotlin.math.roundToInt

@Composable
fun SiteDetailScreen(
    onBack: () -> Unit,
    onOpenQuote: (Long) -> Unit,
    onOpenPayments: (Long) -> Unit,
    viewModel: SiteDetailViewModel = viewModel(factory = SiteDetailViewModel.Factory)
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current
    var confirmerSuppression by remember { mutableStateOf(false) }

    LaunchedEffect(form.enregistre) {
        if (form.enregistre) {
            snackbarHostState.showSnackbar(context.getString(R.string.site_saved))
        }
    }
    LaunchedEffect(form.supprime) {
        if (form.supprime) onBack()
    }

    if (confirmerSuppression) {
        ConfirmDialog(
            title = stringResource(R.string.site_delete_title),
            message = stringResource(R.string.site_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                confirmerSuppression = false
                viewModel.delete()
            },
            onDismiss = { confirmerSuppression = false }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = form.clientName.ifBlank { stringResource(R.string.site_detail_title) },
                onBack = onBack,
                actions = {
                    IconButton(onClick = { confirmerSuppression = true }) {
                        Icon(
                            Icons.Default.Delete,
                            contentDescription = stringResource(R.string.action_delete)
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionCard(title = stringResource(R.string.site_detail_title)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    LabeledValueRow(
                        label = stringResource(R.string.site_client),
                        value = form.clientName.ifBlank { stringResource(R.string.value_none) }
                    )
                    LabeledValueRow(
                        label = stringResource(R.string.site_quote),
                        value = form.quoteNumber.ifBlank { stringResource(R.string.value_none) }
                    )
                    AppTextField(
                        label = stringResource(R.string.site_address),
                        value = form.address,
                        onValueChange = { valeur -> viewModel.update { it.copy(address = valeur) } },
                        singleLine = false,
                        minLines = 2
                    )
                    DropdownField(
                        label = stringResource(R.string.site_status),
                        options = SiteStatus.entries.toList(),
                        selected = form.status,
                        optionLabel = { stringResource(it.labelRes) },
                        onSelected = viewModel::setStatus
                    )
                }
            }

            SectionCard(title = stringResource(R.string.site_progress)) {
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        LinearProgressIndicator(
                            progress = { form.progress / 100f },
                            modifier = Modifier
                                .weight(1f)
                                .height(12.dp)
                        )
                        Text(
                            text = "${form.progress} %",
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                    Slider(
                        value = form.progress.toFloat(),
                        onValueChange = { valeur ->
                            viewModel.update { it.copy(progress = valeur.roundToInt()) }
                        },
                        valueRange = 0f..100f,
                        steps = 19
                    )
                }
            }

            SectionCard(title = stringResource(R.string.site_start_date)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    DateField(
                        label = stringResource(R.string.site_start_date),
                        millis = form.startDateMillis ?: System.currentTimeMillis(),
                        onDateSelected = { millis ->
                            viewModel.update { it.copy(startDateMillis = millis) }
                        }
                    )
                    DateField(
                        label = stringResource(R.string.site_end_date),
                        millis = form.endDateMillis ?: System.currentTimeMillis(),
                        onDateSelected = { millis ->
                            viewModel.update { it.copy(endDateMillis = millis) }
                        }
                    )
                    AppTextField(
                        label = stringResource(R.string.site_notes),
                        value = form.notes,
                        onValueChange = { valeur -> viewModel.update { it.copy(notes = valeur) } },
                        singleLine = false,
                        minLines = 3
                    )
                }
            }

            if (form.quoteId != null) {
                SecondaryButton(
                    text = stringResource(R.string.site_quote),
                    icon = Icons.Default.Description,
                    onClick = { form.quoteId?.let(onOpenQuote) }
                )
                SecondaryButton(
                    text = stringResource(R.string.quote_payments),
                    onClick = { form.quoteId?.let(onOpenPayments) }
                )
            }

            BigActionButton(
                text = stringResource(R.string.action_save),
                icon = Icons.Default.Save,
                onClick = viewModel::save
            )
        }
    }
}
