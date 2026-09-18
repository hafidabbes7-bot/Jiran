package dz.peintrepro.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Construction
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FolderOpen
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.core.Formats
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton
import dz.peintrepro.ui.components.LabeledValueRow
import dz.peintrepro.ui.components.SectionCard
import dz.peintrepro.ui.components.StatCard

@Composable
fun HomeScreen(
    onNewQuote: () -> Unit,
    onQuotes: () -> Unit,
    onSites: () -> Unit,
    onClients: () -> Unit,
    onPayments: () -> Unit,
    onSettings: () -> Unit,
    onQuickCalc: () -> Unit,
    viewModel: HomeViewModel = viewModel(factory = HomeViewModel.Factory)
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val stats = state.stats

    Scaffold(
        topBar = { AppTopBar(title = stringResource(R.string.app_title)) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = state.companyName.ifBlank { stringResource(R.string.home_subtitle) },
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(
                        label = stringResource(R.string.home_stat_quotes),
                        value = stats.quoteCount.toString(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = stringResource(R.string.home_stat_accepted),
                        value = stats.acceptedCount.toString(),
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    StatCard(
                        label = stringResource(R.string.home_stat_sites),
                        value = stats.sitesInProgress.toString(),
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        label = stringResource(R.string.home_stat_outstanding),
                        value = Formats.money(stats.outstanding, state.currency),
                        modifier = Modifier.weight(1f),
                        highlight = true
                    )
                }
            }

            item {
                BigActionButton(
                    text = stringResource(R.string.home_quick_calc),
                    icon = Icons.Default.Bolt,
                    onClick = onQuickCalc,
                    modifier = Modifier.heightIn(min = 72.dp),
                    container = MaterialTheme.colorScheme.secondaryContainer,
                    content = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }

            item {
                BigActionButton(
                    text = stringResource(R.string.home_new_quote),
                    icon = Icons.Default.Description,
                    onClick = onNewQuote
                )
            }
            item {
                BigActionButton(
                    text = stringResource(R.string.home_quotes),
                    icon = Icons.Default.FolderOpen,
                    onClick = onQuotes
                )
            }
            item {
                BigActionButton(
                    text = stringResource(R.string.home_sites),
                    icon = Icons.Default.Construction,
                    onClick = onSites
                )
            }
            item {
                BigActionButton(
                    text = stringResource(R.string.home_clients),
                    icon = Icons.Default.Groups,
                    onClick = onClients
                )
            }
            item {
                BigActionButton(
                    text = stringResource(R.string.home_payments),
                    icon = Icons.Default.Payments,
                    onClick = onPayments
                )
            }
            item {
                BigActionButton(
                    text = stringResource(R.string.home_settings),
                    icon = Icons.Default.Settings,
                    onClick = onSettings
                )
            }

            item {
                SectionCard(title = stringResource(R.string.home_month_title)) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_created),
                            value = stats.monthQuotes.toString()
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_accepted),
                            value = stats.monthAccepted.toString()
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_sites_done),
                            value = stats.monthSitesDone.toString()
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_quoted),
                            value = Formats.money(stats.monthQuotedAmount, state.currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_collected),
                            value = Formats.money(stats.monthCollected, state.currency)
                        )
                        LabeledValueRow(
                            label = stringResource(R.string.home_month_remaining),
                            value = Formats.money(stats.outstanding, state.currency),
                            emphasize = true
                        )
                    }
                }
            }
        }
    }
}
