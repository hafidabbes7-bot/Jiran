package dz.peintrepro.ui.screens.quickcalc

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.InfoBanner
import dz.peintrepro.ui.components.IntField
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.SectionCard

@Composable
fun QuickCalcScreen(
    onBack: () -> Unit,
    onCreateQuote: () -> Unit,
    viewModel: QuickCalcViewModel = viewModel(factory = QuickCalcViewModel.Factory)
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val result by viewModel.result.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { AppTopBar(title = stringResource(R.string.quick_title), onBack = onBack) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SectionCard(title = stringResource(R.string.room_dimensions)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    DecimalField(
                        label = stringResource(R.string.room_length),
                        value = form.length,
                        onValueChange = { value -> viewModel.update { it.copy(length = value) } }
                    )
                    DecimalField(
                        label = stringResource(R.string.room_width),
                        value = form.width,
                        onValueChange = { value -> viewModel.update { it.copy(width = value) } }
                    )
                    DecimalField(
                        label = stringResource(R.string.room_height),
                        value = form.height,
                        onValueChange = { value -> viewModel.update { it.copy(height = value) } }
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        IntField(
                            label = stringResource(R.string.room_doors),
                            value = form.doorCount,
                            onValueChange = { value -> viewModel.update { it.copy(doorCount = value) } },
                            modifier = Modifier.weight(1f)
                        )
                        IntField(
                            label = stringResource(R.string.room_windows),
                            value = form.windowCount,
                            onValueChange = { value -> viewModel.update { it.copy(windowCount = value) } },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        IntField(
                            label = stringResource(R.string.quick_coats),
                            value = form.coats,
                            onValueChange = { value -> viewModel.update { it.copy(coats = value) } },
                            modifier = Modifier.weight(1f)
                        )
                        DecimalField(
                            label = stringResource(R.string.quick_coverage),
                            value = form.coverage,
                            onValueChange = { value -> viewModel.update { it.copy(coverage = value) } },
                            modifier = Modifier.weight(1f)
                        )
                    }
                    DecimalField(
                        label = stringResource(R.string.quick_price_per_sqm),
                        value = form.pricePerSqm,
                        onValueChange = { value -> viewModel.update { it.copy(pricePerSqm = value) } }
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = stringResource(R.string.quick_include_ceiling),
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.bodyLarge
                        )
                        Switch(
                            checked = form.includeCeiling,
                            onCheckedChange = { checked ->
                                viewModel.update { it.copy(includeCeiling = checked) }
                            }
                        )
                    }
                }
            }

            SectionCard(title = stringResource(R.string.quick_results)) {
                Column {
                    LabeledValueRow(
                        label = stringResource(R.string.room_wall_area),
                        value = Formats.area(result.surfaces.grossWallArea)
                    )
                    LabeledValueRow(
                        label = stringResource(R.string.room_openings_area),
                        value = Formats.area(result.surfaces.openingsArea)
                    )
                    LabeledValueRow(
                        label = stringResource(R.string.room_net_wall_area),
                        value = Formats.area(result.surfaces.netWallArea),
                        emphasize = true
                    )
                    LabeledValueRow(
                        label = stringResource(R.string.room_ceiling_area),
                        value = Formats.area(result.surfaces.ceilingArea)
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    LabeledValueRow(
                        label = stringResource(R.string.quick_paint_quantity),
                        value = Formats.liters(result.paint.liters),
                        emphasize = true
                    )
                    if (result.paint.pots.isNotEmpty()) {
                        LabeledValueRow(
                            label = stringResource(R.string.quick_pots),
                            value = result.paint.pots.joinToString(" + ") { pot ->
                                "${pot.count} × ${Formats.decimal(pot.size.liters)} L"
                            }
                        )
                    }
                    LabeledValueRow(
                        label = stringResource(R.string.quick_estimated_price),
                        value = Formats.money(result.estimatedPrice, currency)
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                    LabeledValueRow(
                        label = stringResource(R.string.quick_total),
                        value = Formats.money(result.estimatedPrice, currency),
                        emphasize = true
                    )
                }
            }

            InfoBanner(text = stringResource(R.string.quick_estimate_warning))

            BigActionButton(
                text = stringResource(R.string.quick_create_quote),
                icon = Icons.Default.Description,
                onClick = {
                    viewModel.handOffToQuote()
                    onCreateQuote()
                }
            )
        }
    }
}
