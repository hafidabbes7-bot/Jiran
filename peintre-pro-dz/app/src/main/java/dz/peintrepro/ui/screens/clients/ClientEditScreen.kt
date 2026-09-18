package dz.peintrepro.ui.screens.clients

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import dz.peintrepro.R
import dz.peintrepro.ui.components.AppTextField
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.BigActionButton

@Composable
fun ClientEditScreen(
    onBack: () -> Unit,
    viewModel: ClientEditViewModel = viewModel(factory = ClientEditViewModel.Factory)
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(state.saved) {
        if (state.saved) onBack()
    }

    Scaffold(
        topBar = {
            AppTopBar(
                title = stringResource(
                    if (viewModel.isNew) R.string.client_new else R.string.client_edit
                ),
                onBack = onBack
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AppTextField(
                label = stringResource(R.string.client_name),
                value = state.name,
                onValueChange = viewModel::setName,
                isError = state.nameError,
                supportingText = if (state.nameError) stringResource(R.string.client_error_name) else null
            )
            AppTextField(
                label = stringResource(R.string.client_phone),
                value = state.phone,
                onValueChange = viewModel::setPhone,
                keyboardType = KeyboardType.Phone
            )
            AppTextField(
                label = stringResource(R.string.client_address),
                value = state.address,
                onValueChange = viewModel::setAddress,
                singleLine = false,
                minLines = 2
            )
            AppTextField(
                label = stringResource(R.string.client_notes),
                value = state.notes,
                onValueChange = viewModel::setNotes,
                singleLine = false,
                minLines = 3
            )
            BigActionButton(
                text = stringResource(R.string.action_save),
                icon = Icons.Default.Save,
                onClick = viewModel::save
            )
        }
    }
}
