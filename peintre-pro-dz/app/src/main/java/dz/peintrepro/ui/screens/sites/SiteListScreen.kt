package dz.peintrepro.ui.screens.sites

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.FilterChip
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import dz.peintrepro.domain.model.SiteStatus
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.EmptyState
import dz.peintrepro.ui.components.SectionCard

@Composable
fun SiteListScreen(
    onBack: () -> Unit,
    onOpenSite: (Long) -> Unit,
    viewModel: SiteListViewModel = viewModel(factory = SiteListViewModel.Factory)
) {
    val chantiers by viewModel.chantiers.collectAsStateWithLifecycle()
    val statut by viewModel.statut.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { AppTopBar(title = stringResource(R.string.sites_title), onBack = onBack) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = statut == null,
                        onClick = { viewModel.setStatut(null) },
                        label = { Text(stringResource(R.string.quotes_filter_all)) }
                    )
                    SiteStatus.entries.forEach { entry ->
                        FilterChip(
                            selected = statut == entry,
                            onClick = { viewModel.setStatut(entry) },
                            label = { Text(stringResource(entry.labelRes)) }
                        )
                    }
                }
            }

            if (chantiers.isEmpty()) {
                item { EmptyState(text = stringResource(R.string.sites_empty)) }
            }

            items(items = chantiers, key = { it.id }) { chantier ->
                SectionCard(modifier = Modifier.clickable { onOpenSite(chantier.id) }) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = chantier.clientName,
                                    style = MaterialTheme.typography.titleMedium
                                )
                                Text(
                                    text = chantier.address.ifBlank { stringResource(R.string.value_none) },
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                if (!chantier.quoteNumber.isNullOrBlank()) {
                                    Text(
                                        text = chantier.quoteNumber,
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                            Text(
                                text = stringResource(SiteStatus.from(chantier.status).labelRes),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        Row(
                            modifier = Modifier.padding(top = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            LinearProgressIndicator(
                                progress = { chantier.progress / 100f },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(10.dp)
                            )
                            Text(
                                text = "${chantier.progress} %",
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                        if (chantier.startDateMillis != null) {
                            Text(
                                text = stringResource(R.string.site_start_date) + " : " +
                                    Formats.date(chantier.startDateMillis),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 6.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
