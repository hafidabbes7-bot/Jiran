package dz.peintrepro.ui.screens.quote

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.data.local.entity.QuoteLineEntity
import dz.peintrepro.data.local.entity.RoomItemEntity
import dz.peintrepro.data.local.entity.surfaces
import dz.peintrepro.domain.model.LineCategory
import dz.peintrepro.domain.model.QuoteLevel
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteType
import dz.peintrepro.domain.model.UnitType
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.DateField
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.DropdownField
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.LineEditorDialog
import dz.peintrepro.ui.components.QuantitySuggestion
import dz.peintrepro.ui.components.SecondaryButton
import dz.peintrepro.ui.components.SectionCard

@Composable
fun QuoteEditorScreen(
    onBack: () -> Unit,
    onOpenRoom: (Long, Long) -> Unit,
    onCreateClient: () -> Unit,
    viewModel: QuoteEditorViewModel = viewModel(factory = QuoteEditorViewModel.Factory)
) {
    val context = LocalContext.current
    val quoteId by viewModel.quoteId.collectAsStateWithLifecycle()
    val quote by viewModel.quote.collectAsStateWithLifecycle()
    val client by viewModel.client.collectAsStateWithLifecycle()
    val clients by viewModel.clients.collectAsStateWithLifecycle()
    val rooms by viewModel.rooms.collectAsStateWithLifecycle()
    val lines by viewModel.lines.collectAsStateWithLifecycle()
    val totals by viewModel.totals.collectAsStateWithLifecycle()
    val tariffs by viewModel.tariffs.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()
    val netWallArea by viewModel.totalNetWallArea.collectAsStateWithLifecycle()
    val ceilingArea by viewModel.totalCeilingArea.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }

    var editedLine by remember { mutableStateOf<QuoteLineEntity?>(null) }
    var newLine by remember { mutableStateOf(false) }
    var pendingRoomDelete by remember { mutableStateOf<RoomItemEntity?>(null) }

    // Champs numériques tenus localement pour ne pas gêner la saisie.
    var discountText by remember(quoteId) { mutableStateOf("") }
    var depositText by remember(quoteId) { mutableStateOf("") }
    var vatRateText by remember(quoteId) { mutableStateOf("") }
    var fieldsInitialised by remember(quoteId) { mutableStateOf(false) }

    LaunchedEffect(quote?.id) {
        val current = quote
        if (current != null && !fieldsInitialised) {
            discountText = if (current.discount == 0.0) "" else Formats.input(current.discount)
            depositText = if (current.depositAmount == 0.0) "" else Formats.input(current.depositAmount)
            vatRateText = Formats.input(current.vatRate)
            fieldsInitialised = true
        }
    }

    LaunchedEffect(message) {
        val resId = message
        if (resId != null) {
            snackbarHostState.showSnackbar(context.getString(resId))
            viewModel.clearMessage()
        }
    }

    pendingRoomDelete?.let { room ->
        ConfirmDialog(
            title = stringResource(R.string.room_delete_title),
            message = stringResource(R.string.room_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                pendingRoomDelete = null
                viewModel.deleteRoom(room)
            },
            onDismiss = { pendingRoomDelete = null }
        )
    }

    val suggestions = listOf(
        QuantitySuggestion(stringResource(R.string.line_base_net_walls), netWallArea),
        QuantitySuggestion(stringResource(R.string.line_base_ceiling), ceilingArea),
        QuantitySuggestion(
            stringResource(R.string.line_base_walls_ceiling),
            netWallArea + ceilingArea
        )
    )

    if (newLine) {
        LineEditorDialog(
            initial = QuoteLineEntity(
                quoteId = quoteId,
                category = LineCategory.WORK.name,
                unit = UnitType.M2.name
            ),
            tariffs = tariffs,
            suggestions = suggestions,
            currency = currency,
            isNew = true,
            onDismiss = { newLine = false },
            onConfirm = { line ->
                newLine = false
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
                title = quote?.number ?: stringResource(R.string.quote_new_title),
                onBack = onBack
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {

            // ------------------------------------------------ 1. Client
            item {
                SectionCard(title = stringResource(R.string.quote_section_client)) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(
                            text = client?.name ?: stringResource(R.string.quote_no_client),
                            style = MaterialTheme.typography.titleMedium
                        )
                        if (client?.phone?.isNotBlank() == true) {
                            Text(
                                text = client?.phone.orEmpty(),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        DropdownField(
                            label = stringResource(
                                if (client == null) R.string.quote_select_client
                                else R.string.quote_change_client
                            ),
                            options = clients,
                            selected = client,
                            optionLabel = { it.name },
                            onSelected = { viewModel.selectClient(it.id) }
                        )
                        SecondaryButton(
                            text = stringResource(R.string.quote_create_client),
                            onClick = onCreateClient,
                            icon = Icons.Default.Add
                        )
                    }
                }
            }

            // ------------------------------------------------ 2. Chantier
            item {
                SectionCard(title = stringResource(R.string.quote_section_site)) {
                    val current = quote
                    if (current == null) {
                        Text(
                            text = stringResource(R.string.quote_error_client),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            LabeledValueRow(
                                label = stringResource(R.string.quote_number),
                                value = current.number,
                                emphasize = true
                            )
                            DateField(
                                label = stringResource(R.string.quote_date),
                                millis = current.dateMillis,
                                onDateSelected = viewModel::setDate
                            )
                            DropdownField(
                                label = stringResource(R.string.quote_site_type),
                                options = SiteType.entries.toList(),
                                selected = SiteType.from(current.siteType),
                                optionLabel = { stringResource(it.labelRes) },
                                onSelected = viewModel::setSiteType
                            )
                            AppTextField(
                                label = stringResource(R.string.quote_site_address),
                                value = current.siteAddress,
                                onValueChange = viewModel::setSiteAddress,
                                singleLine = false,
                                minLines = 2
                            )
                            DropdownField(
                                label = stringResource(R.string.quote_level),
                                options = QuoteLevel.entries.toList(),
                                selected = QuoteLevel.from(current.level),
                                optionLabel = { stringResource(it.labelRes) },
                                onSelected = viewModel::setLevel
                            )
                            DropdownField(
                                label = stringResource(R.string.quote_status),
                                options = QuoteStatus.entries.toList(),
                                selected = QuoteStatus.from(current.status),
                                optionLabel = { stringResource(it.labelRes) },
                                onSelected = viewModel::setStatus
                            )
                            AppTextField(
                                label = stringResource(R.string.quote_notes),
                                value = current.notes,
                                onValueChange = viewModel::setNotes,
                                singleLine = false,
                                minLines = 2
                            )
                        }
                    }
                }
            }

            // ------------------------------------------------ 3. Pièces
            item {
                Text(
                    text = stringResource(R.string.quote_section_rooms),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (rooms.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.quote_no_rooms)) }
            }

            items(items = rooms, key = { it.id }) { room ->
                val surfaces = room.surfaces()
                SectionCard(
                    modifier = Modifier.clickable {
                        if (quoteId != 0L) onOpenRoom(quoteId, room.id)
                    }
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(room.name, style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = "${Formats.decimal(room.length)} × " +
                                    "${Formats.decimal(room.width)} × " +
                                    Formats.decimal(room.height),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = stringResource(R.string.room_net_wall_area) +
                                    " : " + Formats.area(surfaces.netWallArea),
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                text = stringResource(R.string.room_ceiling_area) +
                                    " : " + Formats.area(surfaces.ceilingArea),
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        IconButton(onClick = { pendingRoomDelete = room }) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = stringResource(R.string.action_delete)
                            )
                        }
                    }
                }
            }

            item {
                SecondaryButton(
                    text = stringResource(R.string.quote_add_room),
                    icon = Icons.Default.Add,
                    onClick = {
                        if (quoteId == 0L) {
                            viewModel.showMessage(R.string.quote_error_client)
                        } else {
                            onOpenRoom(quoteId, 0L)
                        }
                    }
                )
            }

            // ------------------------------------------------ 4. Lignes
            item {
                Text(
                    text = stringResource(R.string.quote_section_lines),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (lines.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.quote_no_lines)) }
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
                            Text(
                                text = stringResource(LineCategory.from(line.category).labelRes),
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
                    text = stringResource(R.string.quote_add_line),
                    icon = Icons.Default.Add,
                    onClick = {
                        if (quoteId == 0L) {
                            viewModel.showMessage(R.string.quote_error_client)
                        } else {
                            newLine = true
                        }
                    }
                )
            }

            // ------------------------------------------------ 5. Totaux
            item {
                SectionCard(title = stringResource(R.string.quote_section_totals)) {
                    Column {
                        LabeledValueRow(
                            label = stringResource(R.string.total_works),
                            value = Formats.money(totals.works, currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_materials),
                            value = Formats.money(totals.materials, currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_labor),
                            value = Formats.money(totals.labor, currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_other),
                            value = Formats.money(totals.other, currency)
                        )
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        LabeledValueRow(
                            label = stringResource(R.string.total_subtotal),
                            value = Formats.money(totals.subtotal, currency),
                            emphasize = true
                        )
                        Spacer(Modifier.height(8.dp))
                        DecimalField(
                            label = stringResource(R.string.total_discount),
                            value = discountText,
                            onValueChange = {
                                discountText = it
                                viewModel.setDiscount(Formats.parseDecimalOrZero(it))
                            },
                            isError = totals.subtotal > 0 &&
                                Formats.parseDecimalOrZero(discountText) > totals.subtotal,
                            supportingText = if (
                                totals.subtotal > 0 &&
                                Formats.parseDecimalOrZero(discountText) > totals.subtotal
                            ) {
                                stringResource(R.string.total_error_discount)
                            } else {
                                null
                            }
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_after_discount),
                            value = Formats.money(totals.afterDiscount, currency)
                        )
                        Spacer(Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = stringResource(R.string.total_vat_enabled),
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Switch(
                                checked = quote?.vatEnabled == true,
                                onCheckedChange = viewModel::setVatEnabled,
                                enabled = quote != null
                            )
                        }
                        if (quote?.vatEnabled == true) {
                            DecimalField(
                                label = stringResource(R.string.total_vat_rate),
                                value = vatRateText,
                                onValueChange = {
                                    vatRateText = it
                                    viewModel.setVatRate(Formats.parseDecimalOrZero(it))
                                }
                            )
                            LabeledValueRow(
                                label = stringResource(R.string.total_vat),
                                value = Formats.money(totals.vatAmount, currency)
                            )
                        }
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        LabeledValueRow(
                            label = stringResource(R.string.total_grand),
                            value = Formats.money(totals.total, currency),
                            emphasize = true
                        )
                        Spacer(Modifier.height(8.dp))
                        DecimalField(
                            label = stringResource(R.string.total_deposit),
                            value = depositText,
                            onValueChange = {
                                depositText = it
                                viewModel.setDeposit(Formats.parseDecimalOrZero(it))
                            }
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_paid),
                            value = Formats.money(totals.paid, currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.total_remaining),
                            value = Formats.money(totals.remaining, currency),
                            emphasize = true
                        )
                    }
                }
            }

            // ------------------------------------- Actions à venir (phase 2)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SecondaryButton(
                        text = stringResource(R.string.quote_pdf),
                        icon = Icons.Default.PictureAsPdf,
                        onClick = { viewModel.showMessage(R.string.quote_coming_phase2) }
                    )
                    SecondaryButton(
                        text = stringResource(R.string.quote_share),
                        icon = Icons.Default.Share,
                        onClick = { viewModel.showMessage(R.string.quote_coming_phase2) }
                    )
                    if (QuoteStatus.from(quote?.status) == QuoteStatus.ACCEPTED) {
                        SecondaryButton(
                            text = stringResource(R.string.quote_convert_site),
                            onClick = { viewModel.showMessage(R.string.quote_coming_phase2) }
                        )
                    }
                }
            }
        }
    }
}
