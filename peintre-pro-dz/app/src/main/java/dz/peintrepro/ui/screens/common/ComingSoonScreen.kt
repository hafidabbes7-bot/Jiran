package dz.peintrepro.ui.screens.common

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dz.peintrepro.R
import dz.peintrepro.ui.components.AppTopBar
import dz.peintrepro.ui.components.InfoBanner

/** Écran des fonctions prévues pour les phases suivantes. */
@Composable
fun ComingSoonScreen(
    @StringRes titleRes: Int,
    @StringRes messageRes: Int,
    onBack: () -> Unit
) {
    Scaffold(
        topBar = { AppTopBar(title = stringResource(titleRes), onBack = onBack) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = stringResource(R.string.soon_title),
                style = MaterialTheme.typography.titleLarge
            )
            InfoBanner(text = stringResource(messageRes))
        }
    }
}
