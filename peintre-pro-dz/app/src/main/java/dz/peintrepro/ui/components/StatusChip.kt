package dz.peintrepro.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import dz.peintrepro.domain.model.QuoteStatus
import dz.peintrepro.ui.theme.StatusAccepted
import dz.peintrepro.ui.theme.StatusCancelled
import dz.peintrepro.ui.theme.StatusDraft
import dz.peintrepro.ui.theme.StatusRefused
import dz.peintrepro.ui.theme.StatusSent

fun statusColor(status: QuoteStatus): Color = when (status) {
    QuoteStatus.DRAFT -> StatusDraft
    QuoteStatus.SENT -> StatusSent
    QuoteStatus.ACCEPTED -> StatusAccepted
    QuoteStatus.REFUSED -> StatusRefused
    QuoteStatus.CANCELLED -> StatusCancelled
}

/** Pastille de statut d'un devis, lisible d'un coup d'œil. */
@Composable
fun StatusChip(status: QuoteStatus, modifier: Modifier = Modifier) {
    Text(
        text = stringResource(status.labelRes),
        style = MaterialTheme.typography.bodyMedium,
        color = Color.White,
        modifier = modifier
            .background(color = statusColor(status), shape = RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}
