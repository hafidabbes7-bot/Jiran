package dz.peintrepro.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PriceChange
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton
import dz.peintrepro.ui.components.DecimalField
import dz.peintrepro.ui.components.InfoBanner
import dz.peintrepro.ui.components.IntField
import dz.peintrepro.ui.components.SecondaryButton
import dz.peintrepro.ui.components.SectionCard

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onTariffs: () -> Unit,
    viewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory)
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(form.saved) {
        if (form.saved) {
            snackbarHostState.showSnackbar(context.getString(R.string.settings_saved))
        }
    }

    Scaffold(
        topBar = { AppTopBar(title = stringResource(R.string.settings_title), onBack = onBack) },
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
            SectionCard(title = stringResource(R.string.settings_company)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppTextField(
                        label = stringResource(R.string.settings_company_name),
                        value = form.companyName,
                        onValueChange = { value -> viewModel.update { it.copy(companyName = value) } }
                    )
                    AppTextField(
                        label = stringResource(R.string.settings_phone),
                        value = form.phone,
                        onValueChange = { value -> viewModel.update { it.copy(phone = value) } },
                        keyboardType = KeyboardType.Phone
                    )
                    AppTextField(
                        label = stringResource(R.string.settings_address),
                        value = form.address,
                        onValueChange = { value -> viewModel.update { it.copy(address = value) } },
                        singleLine = false,
                        minLines = 2
                    )
                    AppTextField(
                        label = stringResource(R.string.settings_email),
                        value = form.email,
                        onValueChange = { value -> viewModel.update { it.copy(email = value) } },
                        keyboardType = KeyboardType.Email
                    )
                    InfoBanner(text = stringResource(R.string.settings_logo_hint))
                }
            }

            SectionCard(title = stringResource(R.string.settings_quote_defaults)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    AppTextField(
                        label = stringResource(R.string.settings_currency),
                        value = form.currency,
                        onValueChange = { value -> viewModel.update { it.copy(currency = value) } }
                    )
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
                            checked = form.vatEnabled,
                            onCheckedChange = { checked ->
                                viewModel.update { it.copy(vatEnabled = checked) }
                            }
                        )
                    }
                    if (form.vatEnabled) {
                        DecimalField(
                            label = stringResource(R.string.total_vat_rate),
                            value = form.vatRate,
                            onValueChange = { value -> viewModel.update { it.copy(vatRate = value) } }
                        )
                    }
                    IntField(
                        label = stringResource(R.string.settings_validity_days),
                        value = form.validityDays,
                        onValueChange = { value -> viewModel.update { it.copy(validityDays = value) } }
                    )
                    DecimalField(
                        label = stringResource(R.string.settings_coverage),
                        value = form.coverage,
                        onValueChange = { value -> viewModel.update { it.copy(coverage = value) } }
                    )
                    IntField(
                        label = stringResource(R.string.settings_coats),
                        value = form.coats,
                        onValueChange = { value -> viewModel.update { it.copy(coats = value) } }
                    )
                    AppTextField(
                        label = stringResource(R.string.settings_conditions),
                        value = form.conditions,
                        onValueChange = { value -> viewModel.update { it.copy(conditions = value) } },
                        singleLine = false,
                        minLines = 4
                    )
                }
            }

            SectionCard(title = stringResource(R.string.settings_data)) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SecondaryButton(
                        text = stringResource(R.string.settings_tariffs),
                        icon = Icons.Default.PriceChange,
                        onClick = onTariffs
                    )
                    InfoBanner(text = stringResource(R.string.settings_backup_hint))
                }
            }

            BigActionButton(
                text = stringResource(R.string.action_save),
                icon = Icons.Default.Save,
                onClick = viewModel::save
            )
        }
    }
}
