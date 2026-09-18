package dz.peintrepro.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import dz.peintrepro.R
import dz.peintrepro.ui.screens.clients.ClientDetailScreen
import dz.peintrepro.ui.screens.clients.ClientEditScreen
import dz.peintrepro.ui.screens.clients.ClientListScreen
import dz.peintrepro.ui.screens.common.ComingSoonScreen
import dz.peintrepro.ui.screens.home.HomeScreen
import dz.peintrepro.ui.screens.quickcalc.QuickCalcScreen
import dz.peintrepro.ui.screens.quote.QuoteEditorScreen
import dz.peintrepro.ui.screens.quotes.QuoteListScreen
import dz.peintrepro.ui.screens.room.RoomEditorScreen
import dz.peintrepro.ui.screens.settings.SettingsScreen
import dz.peintrepro.ui.screens.tariffs.TariffsScreen

@Composable
fun AppNavHost(navController: NavHostController = rememberNavController()) {

    NavHost(navController = navController, startDestination = Routes.HOME) {

        composable(Routes.HOME) {
            HomeScreen(
                onNewQuote = { navController.navigate(Routes.quoteEditor()) },
                onQuotes = { navController.navigate(Routes.QUOTES) },
                onSites = { navController.navigate(Routes.SITES) },
                onClients = { navController.navigate(Routes.CLIENTS) },
                onPayments = { navController.navigate(Routes.PAYMENTS) },
                onSettings = { navController.navigate(Routes.SETTINGS) },
                onQuickCalc = { navController.navigate(Routes.QUICK_CALC) }
            )
        }

        composable(Routes.CLIENTS) {
            ClientListScreen(
                onBack = { navController.popBackStack() },
                onAddClient = { navController.navigate(Routes.clientEdit()) },
                onOpenClient = { clientId -> navController.navigate(Routes.clientDetail(clientId)) }
            )
        }

        composable(
            route = Routes.CLIENT_EDIT,
            arguments = listOf(navArgument(Routes.ARG_CLIENT_ID) { type = NavType.LongType })
        ) {
            ClientEditScreen(onBack = { navController.popBackStack() })
        }

        composable(
            route = Routes.CLIENT_DETAIL,
            arguments = listOf(navArgument(Routes.ARG_CLIENT_ID) { type = NavType.LongType })
        ) {
            ClientDetailScreen(
                onBack = { navController.popBackStack() },
                onEdit = { clientId -> navController.navigate(Routes.clientEdit(clientId)) },
                onOpenQuote = { quoteId -> navController.navigate(Routes.quoteEditor(quoteId)) }
            )
        }

        composable(Routes.QUOTES) {
            QuoteListScreen(
                onBack = { navController.popBackStack() },
                onOpenQuote = { quoteId -> navController.navigate(Routes.quoteEditor(quoteId)) },
                onNewQuote = { navController.navigate(Routes.quoteEditor()) }
            )
        }

        composable(
            route = Routes.QUOTE_EDITOR,
            arguments = listOf(navArgument(Routes.ARG_QUOTE_ID) { type = NavType.LongType })
        ) {
            QuoteEditorScreen(
                onBack = { navController.popBackStack() },
                onOpenRoom = { quoteId, roomId ->
                    navController.navigate(Routes.roomEditor(quoteId, roomId))
                },
                onCreateClient = { navController.navigate(Routes.clientEdit()) }
            )
        }

        composable(
            route = Routes.ROOM_EDITOR,
            arguments = listOf(
                navArgument(Routes.ARG_QUOTE_ID) { type = NavType.LongType },
                navArgument(Routes.ARG_ROOM_ID) { type = NavType.LongType }
            )
        ) {
            RoomEditorScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.TARIFFS) {
            TariffsScreen(onBack = { navController.popBackStack() })
        }

        composable(Routes.QUICK_CALC) {
            QuickCalcScreen(
                onBack = { navController.popBackStack() },
                onCreateQuote = { navController.navigate(Routes.quoteEditor()) }
            )
        }

        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { navController.popBackStack() },
                onTariffs = { navController.navigate(Routes.TARIFFS) }
            )
        }

        composable(Routes.SITES) {
            ComingSoonScreen(
                titleRes = R.string.home_sites,
                messageRes = R.string.soon_sites,
                onBack = { navController.popBackStack() }
            )
        }

        composable(Routes.PAYMENTS) {
            ComingSoonScreen(
                titleRes = R.string.home_payments,
                messageRes = R.string.soon_payments,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
