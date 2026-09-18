package dz.peintrepro.ui.screens.tariffs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.UnitType
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.DropdownField
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.InfoBanner
import dz.peintrepro.ui.components.SectionCard

@Composable
fun TariffsScreen(
    onBack: () -> Unit,
    viewModel: TariffsViewModel = viewModel(factory = TariffsViewModel.Factory)
) {
    val tariffs by viewModel.tariffs.collectAsStateWithLifecycle()
    val level by viewModel.level.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()

    var edited by remember { mutableStateOf<TariffEntity?>(null) }
    var pendingDelete by remember { mutableStateOf<TariffEntity?>(null) }
    var confirmReset by remember { mutableStateOf(false) }

    edited?.let { tariff ->
        TariffDialog(
            initial = tariff,
            currency = currency,
            onDismiss = { edited = null },
            onConfirm = { updated ->
                edited = null
                viewModel.save(updated)
            }
        )
    }

    pendingDelete?.let { tariff ->
        ConfirmDialog(
            title = stringResource(R.string.tariff_delete_title),
            message = stringResource(R.string.tariff_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                pendingDelete = null
                viewModel.delete(tariff)
            },
            onDismiss = { pendingDelete = null }
        )
    }

    if (confirmReset) {
        ConfirmDialog(
            title = stringResource(R.string.tariff_reset_title),
            message = stringResource(R.string.tariff_reset_message),
            confirmLabel = stringResource(R.string.action_reset),
            onConfirm = {
                confirmReset = false
                viewModel.resetToDefaults()
            },
            onDismiss = { confirmReset = false }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(R.string.tariffs_title),
                onBack = onBack,
                actions = {
                    IconButton(onClick = { confirmReset = true }) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = stringResource(R.string.action_reset)
                        )
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { edited = TariffEntity(level = level.name) }
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.tariff_new))
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
            item { InfoBanner(text = stringResource(R.string.tariff_hint_prices)) }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    QuoteLevel.entries.forEach { entry ->
                        FilterChip(
                            selected = level == entry,
                            onClick = { viewModel.setLevel(entry) },
                            label = { Text(stringResource(entry.labelRes)) }
                        )
                    }
                }
            }

            if (tariffs.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.tariffs_empty)) }
            }

            items(items = tariffs, key = { it.id }) { tariff ->
                SectionCard(modifier = Modifier.clickable { edited = tariff }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(tariff.label, style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = stringResource(LineCategory.from(tariff.category).labelRes) +
                                    " • " + stringResource(UnitType.from(tariff.unit).labelRes),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Text(
                            text = Formats.money(tariff.price, currency),
                            style = MaterialTheme.typography.titleMedium
                        )
                        IconButton(onClick = { pendingDelete = tariff }) {
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
private fun TariffDialog(
    initial: TariffEntity,
    currency: String,
    onDismiss: () -> Unit,
    onConfirm: (TariffEntity) -> Unit
) {
    var label by remember { mutableStateOf(initial.label) }
    var price by remember { mutableStateOf(if (initial.price == 0.0) "" else Formats.input(initial.price)) }
    var unit by remember { mutableStateOf(UnitType.from(initial.unit)) }
    var category by remember { mutableStateOf(LineCategory.from(initial.category)) }
    var level by remember { mutableStateOf(QuoteLevel.from(initial.level)) }
    var labelError by remember { mutableStateOf(false) }

    val priceValue = Formats.parseDecimal(price) ?: -1.0
    val priceError = price.isNotEmpty() && priceValue < 0.0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(stringResource(if (initial.id == 0L) R.string.tariff_new else R.string.tariff_edit))
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                AppTextField(
                    label = stringResource(R.string.tariff_label),
                    value = label,
                    onValueChange = {
                        label = it
                        labelError = false
                    },
                    isError = labelError,
                    supportingText = if (labelError) stringResource(R.string.required_field) else null
                )
                DecimalField(
                    label = stringResource(R.string.tariff_price) + " ($currency)",
                    value = price,
                    onValueChange = { price = it },
                    isError = priceError,
                    supportingText = if (priceError) stringResource(R.string.error_negative) else null
                )
                DropdownField(
                    label = stringResource(R.string.line_unit),
                    options = UnitType.entries.toList(),
                    selected = unit,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { unit = it }
                )
                DropdownField(
                    label = stringResource(R.string.line_category),
                    options = LineCategory.entries.toList(),
                    selected = category,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { category = it }
                )
                DropdownField(
                    label = stringResource(R.string.tariff_level),
                    options = QuoteLevel.entries.toList(),
                    selected = level,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { level = it }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (label.isBlank()) {
                        labelError = true
                        return@TextButton
                    }
                    if (priceError) return@TextButton
                    onConfirm(
                        initial.copy(
                            label = label.trim(),
                            price = priceValue.coerceAtLeast(0.0),
                            unit = unit.name,
                            category = category.name,
                            level = level.name
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
