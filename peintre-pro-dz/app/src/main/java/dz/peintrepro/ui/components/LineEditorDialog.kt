package dz.peintrepro.ui.components

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.TariffEntity
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.UnitType

/** Quantité proposée en un tap (surface nette des murs, plafond…). */
data class QuantitySuggestion(val label: String, val value: Double)

/**
 * Dialogue unique de création / modification d'une ligne de devis.
 * Utilisé à la fois depuis le devis et depuis une pièce.
 */
@Composable
fun LineEditorDialog(
    initial: QuoteLineEntity,
    tariffs: List<TariffEntity>,
    suggestions: List<QuantitySuggestion>,
    currency: String,
    isNew: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (QuoteLineEntity) -> Unit
) {
    var designation by remember { mutableStateOf(initial.designation) }
    var category by remember { mutableStateOf(LineCategory.from(initial.category)) }
    var unit by remember { mutableStateOf(UnitType.from(initial.unit)) }
    var quantity by remember { mutableStateOf(if (initial.quantity == 0.0) "" else Formats.input(initial.quantity)) }
    var price by remember { mutableStateOf(if (initial.unitPrice == 0.0) "" else Formats.input(initial.unitPrice)) }
    var designationError by remember { mutableStateOf(false) }

    val quantityValue = Formats.parseDecimal(quantity) ?: -1.0
    val priceValue = Formats.parseDecimal(price) ?: -1.0
    val quantityError = quantity.isNotEmpty() && quantityValue < 0.0
    val priceError = price.isNotEmpty() && priceValue < 0.0
    val total = (quantityValue.coerceAtLeast(0.0)) * (priceValue.coerceAtLeast(0.0))

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                stringResource(if (isNew) R.string.line_add_title else R.string.line_edit_title)
            )
        },
        text = {
            Column(
                modifier = Modifier.verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (tariffs.isNotEmpty()) {
                    DropdownField(
                        label = stringResource(R.string.line_from_tariff),
                        options = tariffs,
                        selected = null,
                        optionLabel = { tariff ->
                            "${tariff.label} — ${Formats.money(tariff.price, currency)}"
                        },
                        onSelected = { tariff ->
                            designation = tariff.label
                            unit = UnitType.from(tariff.unit)
                            category = LineCategory.from(tariff.category)
                            price = Formats.input(tariff.price)
                            designationError = false
                        }
                    )
                }

                AppTextField(
                    label = stringResource(R.string.line_designation),
                    value = designation,
                    onValueChange = {
                        designation = it
                        designationError = false
                    },
                    isError = designationError,
                    supportingText = if (designationError) {
                        stringResource(R.string.line_error_designation)
                    } else {
                        null
                    }
                )

                DropdownField(
                    label = stringResource(R.string.line_category),
                    options = LineCategory.entries.toList(),
                    selected = category,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { category = it }
                )

                DropdownField(
                    label = stringResource(R.string.line_unit),
                    options = UnitType.entries.toList(),
                    selected = unit,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = { unit = it }
                )

                if (suggestions.isNotEmpty()) {
                    Text(
                        text = stringResource(R.string.line_base_quantity),
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        suggestions.forEach { suggestion ->
                            AssistChip(
                                onClick = { quantity = Formats.input(suggestion.value) },
                                label = { Text(suggestion.label) }
                            )
                        }
                    }
                }

                DecimalField(
                    label = stringResource(R.string.line_quantity),
                    value = quantity,
                    onValueChange = { quantity = it },
                    isError = quantityError,
                    supportingText = if (quantityError) stringResource(R.string.line_error_quantity) else null
                )

                DecimalField(
                    label = stringResource(R.string.line_unit_price),
                    value = price,
                    onValueChange = { price = it },
                    isError = priceError,
                    supportingText = if (priceError) stringResource(R.string.line_error_price) else null
                )

                LabeledValueRow(
                    label = stringResource(R.string.line_total),
                    value = Formats.money(total, currency),
                    emphasize = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (designation.isBlank()) {
                        designationError = true
                        return@TextButton
                    }
                    if (quantityError || priceError) return@TextButton
                    onConfirm(
                        initial.copy(
                            designation = designation.trim(),
                            category = category.name,
                            unit = unit.name,
                            quantity = quantityValue.coerceAtLeast(0.0),
                            unitPrice = priceValue.coerceAtLeast(0.0)
                        )
                    )
                }
            ) {
                Text(stringResource(R.string.action_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) }
        }
    )
}
