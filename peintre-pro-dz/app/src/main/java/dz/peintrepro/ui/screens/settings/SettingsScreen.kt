package dz.peintrepro.ui.screens.settings

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onTariffs: () -> Unit,
    viewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory)
) {
    val form by viewModel.form.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    var erreurLogo by remember { mutableStateOf(false) }

    // Le logo est choisi dans les fichiers du téléphone ; l'autorisation de
    // lecture est rendue permanente pour que le PDF puisse le relire plus tard.
    val selecteurLogo = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            val accorde = runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }.isSuccess
            if (accorde) viewModel.setLogo(uri.toString()) else erreurLogo = true
        }
    }

    val apercuLogo by produceState<ImageBitmap?>(initialValue = null, key1 = form.logoUri) {
        val uri = form.logoUri
        value = if (uri.isNullOrBlank()) {
            null
        } else {
            withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(Uri.parse(uri))?.use { flux ->
                        BitmapFactory.decodeStream(flux)?.asImageBitmap()
                    }
                }.getOrNull()
            }
        }
    }

    LaunchedEffect(erreurLogo) {
        if (erreurLogo) {
            snackbarHostState.showSnackbar(context.getString(R.string.settings_logo_error))
            erreurLogo = false
        }
    }

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
                    Text(
                        text = stringResource(R.string.settings_logo),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    val bitmapLogo = apercuLogo
                    if (bitmapLogo != null) {
                        Image(
                            bitmap = bitmapLogo,
                            contentDescription = stringResource(R.string.settings_logo),
                            modifier = Modifier.height(64.dp)
                        )
                    } else {
                        Text(
                            text = stringResource(R.string.settings_logo_none),
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                    SecondaryButton(
                        text = stringResource(R.string.settings_logo_choose),
                        icon = Icons.Default.Image,
                        onClick = { selecteurLogo.launch(arrayOf("image/*")) }
                    )
                    if (form.logoUri != null) {
                        SecondaryButton(
                            text = stringResource(R.string.settings_logo_remove),
                            onClick = { viewModel.setLogo(null) }
                        )
                    }
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
