package dz.peintrepro.ui.screens.room

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.UnitType
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.InfoBanner
import dz.peintrepro.ui.components.IntField
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.LineEditorDialog
import dz.peintrepro.ui.components.QuantitySuggestion
import dz.peintrepro.ui.components.SecondaryButton
import dz.peintrepro.ui.components.SectionCard

@Composable
fun RoomEditorScreen(
    onBack: () -> Unit,
    viewModel: RoomEditorViewModel = viewModel(factory = RoomEditorViewModel.Factory)
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val surfaces by viewModel.surfaces.collectAsStateWithLifecycle()
    val lines by viewModel.lines.collectAsStateWithLifecycle()
    val tariffs by viewModel.tariffs.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()
    val closed by viewModel.closed.collectAsStateWithLifecycle()
    val showLineDialog by viewModel.showLineDialog.collectAsStateWithLifecycle()
    val roomId by viewModel.roomId.collectAsStateWithLifecycle()

    var editedLine by remember { mutableStateOf<QuoteLineEntity?>(null) }

    LaunchedEffect(closed) {
        if (closed) onBack()
    }

    val suggestions = listOf(
        QuantitySuggestion(stringResource(R.string.line_base_net_walls), surfaces.netWallArea),
        QuantitySuggestion(stringResource(R.string.line_base_ceiling), surfaces.ceilingArea),
        QuantitySuggestion(
            stringResource(R.string.line_base_walls_ceiling),
            surfaces.wallsAndCeilingArea
        ),
        QuantitySuggestion(
            stringResource(R.string.line_base_doors),
            Formats.parseIntOrZero(form.doorCount).toDouble()
        ),
        QuantitySuggestion(
            stringResource(R.string.line_base_windows),
            Formats.parseIntOrZero(form.windowCount).toDouble()
        )
    )

    if (showLineDialog) {
        LineEditorDialog(
            initial = QuoteLineEntity(
                roomId = roomId,
                category = LineCategory.WORK.name,
                unit = UnitType.M2.name,
                quantity = surfaces.netWallArea
            ),
            tariffs = tariffs,
            suggestions = suggestions,
            currency = currency,
            isNew = true,
            onDismiss = viewModel::dismissLineDialog,
            onConfirm = { line ->
                viewModel.dismissLineDialog()
                viewModel.addLine(line)
            }
        )
    }

    editedLine?.let { line ->
        LineEditorDialog(
            initial = line,
            tariffs = tariffs,
            suggestions = suggestions,
            currency = currency,
            isNew = false,
            onDismiss = { editedLine = null },
            onConfirm = { updated ->
                editedLine = null
                viewModel.updateLine(updated)
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(
                    if (viewModel.isNew) R.string.room_new_title else R.string.room_edit_title
                ),
                onBack = onBack
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {

            item {
                SectionCard(title = stringResource(R.string.room_dimensions)) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        AppTextField(
                            label = stringResource(R.string.room_name),
                            value = form.name,
                            onValueChange = { value ->
                                viewModel.update { it.copy(name = value, nameError = false) }
                            },
                            isError = form.nameError,
                            supportingText = if (form.nameError) {
                                stringResource(R.string.room_error_name)
                            } else {
                                null
                            }
                        )
                        DecimalField(
                            label = stringResource(R.string.room_length),
                            value = form.length,
                            onValueChange = { value ->
                                viewModel.update { it.copy(length = value, dimensionsError = false) }
                            },
                            isError = form.dimensionsError
                        )
                        DecimalField(
                            label = stringResource(R.string.room_width),
                            value = form.width,
                            onValueChange = { value ->
                                viewModel.update { it.copy(width = value, dimensionsError = false) }
                            },
                            isError = form.dimensionsError
                        )
                        DecimalField(
                            label = stringResource(R.string.room_height),
                            value = form.height,
                            onValueChange = { value ->
                                viewModel.update { it.copy(height = value, dimensionsError = false) }
                            },
                            isError = form.dimensionsError,
                            supportingText = if (form.dimensionsError) {
                                stringResource(R.string.room_error_dimensions)
                            } else {
                                null
                            }
                        )
                    }
                }
            }

            item {
                SectionCard(title = stringResource(R.string.room_openings)) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = stringResource(R.string.room_doors),
                            style = MaterialTheme.typography.titleMedium
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            IntField(
                                label = stringResource(R.string.room_count),
                                value = form.doorCount,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(doorCount = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                            DecimalField(
                                label = stringResource(R.string.room_opening_width),
                                value = form.doorWidth,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(doorWidth = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                            DecimalField(
                                label = stringResource(R.string.room_opening_height),
                                value = form.doorHeight,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(doorHeight = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        Text(
                            text = stringResource(R.string.room_windows),
                            style = MaterialTheme.typography.titleMedium
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            IntField(
                                label = stringResource(R.string.room_count),
                                value = form.windowCount,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(windowCount = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                            DecimalField(
                                label = stringResource(R.string.room_opening_width),
                                value = form.windowWidth,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(windowWidth = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                            DecimalField(
                                label = stringResource(R.string.room_opening_height),
                                value = form.windowHeight,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(windowHeight = value) }
                                },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item {
                SectionCard(title = stringResource(R.string.room_surfaces)) {
                    Column {
                        LabeledValueRow(
                            label = stringResource(R.string.room_wall_area),
                            value = Formats.area(surfaces.grossWallArea)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.room_openings_area),
                            value = Formats.area(surfaces.openingsArea)
                        )
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        LabeledValueRow(
                            label = stringResource(R.string.room_net_wall_area),
                            value = Formats.area(surfaces.netWallArea),
                            emphasize = true
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.room_ceiling_area),
                            value = Formats.area(surfaces.ceilingArea),
                            emphasize = true
                        )
                        if (surfaces.openingsExceedWalls) {
                            InfoBanner(text = stringResource(R.string.room_openings_warning))
                        }
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = stringResource(R.string.room_manual_override),
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Switch(
                                checked = form.manualEnabled,
                                onCheckedChange = viewModel::setManualEnabled
                            )
                        }
                        if (form.manualEnabled) {
                            DecimalField(
                                label = stringResource(R.string.room_manual_wall),
                                value = form.manualWallArea,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(manualWallArea = value) }
                                }
                            )
                            DecimalField(
                                label = stringResource(R.string.room_manual_ceiling),
                                value = form.manualCeilingArea,
                                onValueChange = { value ->
                                    viewModel.update { it.copy(manualCeilingArea = value) }
                                }
                            )
                        }
                    }
                }
            }

            item {
                Text(
                    text = stringResource(R.string.room_works),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (lines.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.room_no_works)) }
            }

            items(items = lines, key = { it.id }) { line ->
                SectionCard(modifier = Modifier.clickable { editedLine = line }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(line.designation, style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = "${Formats.decimal(line.quantity)} " +
                                    stringResource(UnitType.from(line.unit).labelRes) +
                                    " × ${Formats.money(line.unitPrice, currency)}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = Formats.money(line.total, currency),
                                style = MaterialTheme.typography.titleMedium
                            )
                            IconButton(onClick = { viewModel.deleteLine(line) }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.action_delete)
                                )
                            }
                        }
                    }
                }
            }

            item {
                SecondaryButton(
                    text = stringResource(R.string.room_add_work),
                    icon = Icons.Default.Add,
                    onClick = viewModel::requestAddLine
                )
            }

            item {
                BigActionButton(
                    text = stringResource(R.string.action_save),
                    icon = Icons.Default.Save,
                    onClick = { viewModel.save(closeAfter = true) }
                )
            }
        }
    }
}
