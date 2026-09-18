package dz.peintrepro.ui.screens.clients

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.domain.model.SiteStatus
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.SectionCard
import dz.peintrepro.ui.components.StatusChip

@Composable
fun ClientDetailScreen(
    onBack: () -> Unit,
    onEdit: (Long) -> Unit,
    onOpenQuote: (Long) -> Unit,
    viewModel: ClientDetailViewModel = viewModel(factory = ClientDetailViewModel.Factory)
) {
    val client by viewModel.client.collectAsStateWithLifecycle()
    val quotes by viewModel.quotes.collectAsStateWithLifecycle()
    val sites by viewModel.sites.collectAsStateWithLifecycle()
    val outstanding by viewModel.outstanding.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()
    val deleteBlocked by viewModel.deleteBlocked.collectAsStateWithLifecycle()
    val deleted by viewModel.deleted.collectAsStateWithLifecycle()

    var confirmDelete by remember { mutableStateOf(false) }

    LaunchedEffect(deleted) {
        if (deleted) onBack()
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = stringResource(R.string.client_delete_title),
            message = stringResource(R.string.client_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                confirmDelete = false
                viewModel.delete()
            },
            onDismiss = { confirmDelete = false }
        )
    }

    if (deleteBlocked) {
        AlertDialog(
            onDismissRequest = viewModel::dismissDeleteBlocked,
            title = { Text(stringResource(R.string.client_delete_title)) },
            text = { Text(stringResource(R.string.client_delete_blocked)) },
            confirmButton = {
                TextButton(onClick = viewModel::dismissDeleteBlocked) {
                    Text(stringResource(R.string.action_ok))
                }
            }
        )
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = client?.name ?: stringResource(R.string.client_detail_title),
                onBack = onBack,
                actions = {
                    IconButton(onClick = { client?.let { onEdit(it.id) } }) {
                        Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.action_edit))
                    }
                    IconButton(onClick = { confirmDelete = true }) {
                        Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.action_delete))
                    }
                }
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
                SectionCard(title = stringResource(R.string.client_detail_title)) {
                    Column {
                        LabeledValueRow(
                            label = stringResource(R.string.client_phone),
                            value = client?.phone?.ifBlank { stringResource(R.string.value_none) }
                                ?: stringResource(R.string.value_none)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.client_address),
                            value = client?.address?.ifBlank { stringResource(R.string.value_none) }
                                ?: stringResource(R.string.value_none)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.client_notes),
                            value = client?.notes?.ifBlank { stringResource(R.string.value_none) }
                                ?: stringResource(R.string.value_none)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.client_remaining),
                            value = Formats.money(outstanding, currency),
                            emphasize = true
                        )
                    }
                }
            }

            item {
                Text(
                    text = stringResource(R.string.client_quotes_history),
                    style = MaterialTheme.typography.titleMedium
                )
            }

            if (quotes.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.client_no_quotes)) }
            }

            items(count = quotes.size, key = { index -> quotes[index].id }) { index ->
                val quote = quotes[index]
                SectionCard(modifier = Modifier.clickable { onOpenQuote(quote.id) }) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(quote.number, style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = Formats.date(quote.dateMillis),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Text(
                                text = Formats.money(quote.totalAmount, currency),
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }
                        StatusChip(status = QuoteStatus.from(quote.status))
                    }
                }
            }

            item {
                Text(
                    text = stringResource(R.string.client_sites),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            if (sites.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.client_no_sites)) }
            }

            items(count = sites.size, key = { index -> sites[index].id }) { index ->
                val site = sites[index]
                SectionCard {
                    Column {
                        Text(
                            text = site.address.ifBlank { stringResource(R.string.value_none) },
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = stringResource(SiteStatus.from(site.status).labelRes),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
