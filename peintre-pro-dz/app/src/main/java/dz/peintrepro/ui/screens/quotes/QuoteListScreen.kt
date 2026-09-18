package dz.peintrepro.ui.screens.quotes

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.ConfirmDialog
import dz.peintrepro.ui.components.DropdownField
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.SectionCard
import dz.peintrepro.ui.components.StatusChip

@Composable
fun QuoteListScreen(
    onBack: () -> Unit,
    onOpenQuote: (Long) -> Unit,
    onNewQuote: () -> Unit,
    viewModel: QuoteListViewModel = viewModel(factory = QuoteListViewModel.Factory)
) {
    val quotes by viewModel.quotes.collectAsStateWithLifecycle()
    val query by viewModel.query.collectAsStateWithLifecycle()
    val status by viewModel.status.collectAsStateWithLifecycle()
    val period by viewModel.period.collectAsStateWithLifecycle()
    val currency by viewModel.currency.collectAsStateWithLifecycle()

    var pendingDelete by remember { mutableStateOf<Long?>(null) }

    pendingDelete?.let { quoteId ->
        ConfirmDialog(
            title = stringResource(R.string.quote_delete_title),
            message = stringResource(R.string.quote_delete_message),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = {
                pendingDelete = null
                viewModel.delete(quoteId)
            },
            onDismiss = { pendingDelete = null }
        )
    }

    Scaffold(
        topBar = { AppTopBar(title = stringResource(R.string.quotes_title), onBack = onBack) },
        floatingActionButton = {
            FloatingActionButton(onClick = onNewQuote) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.home_new_quote))
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
                AppTextField(
                    label = stringResource(R.string.quotes_search_hint),
                    value = query,
                    onValueChange = viewModel::setQuery
                )
            }

            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = status == null,
                        onClick = { viewModel.setStatus(null) },
                        label = { Text(stringResource(R.string.quotes_filter_all)) }
                    )
                    QuoteStatus.entries.forEach { entry ->
                        FilterChip(
                            selected = status == entry,
                            onClick = { viewModel.setStatus(entry) },
                            label = { Text(stringResource(entry.labelRes)) }
                        )
                    }
                }
            }

            item {
                DropdownField(
                    label = stringResource(R.string.quotes_filter_period),
                    options = QuotePeriod.entries.toList(),
                    selected = period,
                    optionLabel = { stringResource(it.labelRes) },
                    onSelected = viewModel::setPeriod
                )
            }

            if (quotes.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.quotes_empty)) }
            }

            items(items = quotes, key = { it.id }) { quote ->
                SectionCard(modifier = Modifier.clickable { onOpenQuote(quote.id) }) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(quote.number, style = MaterialTheme.typography.titleMedium)
                            Text(
                                text = quote.clientName,
                                style = MaterialTheme.typography.bodyLarge
                            )
                            Text(
                                text = Formats.money(quote.totalAmount, currency),
                                style = MaterialTheme.typography.bodyLarge,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                text = Formats.date(quote.dateMillis),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            StatusChip(status = QuoteStatus.from(quote.status))
                            Row {
                                IconButton(onClick = { viewModel.duplicate(quote.id) }) {
                                    Icon(
                                        Icons.Default.ContentCopy,
                                        contentDescription = stringResource(R.string.action_duplicate)
                                    )
                                }
                                IconButton(onClick = { pendingDelete = quote.id }) {
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
    }
}
