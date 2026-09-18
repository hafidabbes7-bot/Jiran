package dz.peintrepro.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = BrandGreen,
    onPrimary = SurfaceCard,
    primaryContainer = BrandGreenLight,
    onPrimaryContainer = BrandGreenDark,
    secondary = BrandAmberDark,
    onSecondary = SurfaceCard,
    secondaryContainer = BrandAmberLight,
    onSecondaryContainer = BrandAmberDark,
    tertiary = BrandAmber,
    background = SurfaceCream,
    onBackground = TextDark,
    surface = SurfaceCard,
    onSurface = TextDark,
    surfaceVariant = BrandGreenLight,
    onSurfaceVariant = TextMuted,
    error = DangerRed,
    onError = SurfaceCard
)

private val DarkColors = darkColorScheme(
    primary = BrandGreenLight,
    onPrimary = BrandGreenDark,
    primaryContainer = BrandGreenDark,
    onPrimaryContainer = BrandGreenLight,
    secondary = BrandAmber,
    onSecondary = BrandAmberDark,
    tertiary = BrandAmber,
    error = DangerRedDark,
    onError = TextDark
)

@Composable
fun PeintreProTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content
    )
}
