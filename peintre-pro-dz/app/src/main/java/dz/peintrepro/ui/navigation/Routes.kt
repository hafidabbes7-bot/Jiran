package dz.peintrepro.ui.navigation

/** Toutes les routes de navigation de l'application. */
object Routes {

    const val ARG_CLIENT_ID = "clientId"
    const val ARG_QUOTE_ID = "quoteId"
    const val ARG_ROOM_ID = "roomId"

    /** Valeur utilisée pour « nouvel élément » (identifiant encore inexistant). */
    const val NEW_ID = 0L

    const val HOME = "home"
    const val CLIENTS = "clients"
    const val CLIENT_EDIT = "client_edit/{$ARG_CLIENT_ID}"
    const val CLIENT_DETAIL = "client_detail/{$ARG_CLIENT_ID}"
    const val QUOTES = "quotes"
    const val QUOTE_EDITOR = "quote_editor/{$ARG_QUOTE_ID}"
    const val ROOM_EDITOR = "room_editor/{$ARG_QUOTE_ID}/{$ARG_ROOM_ID}"
    const val TARIFFS = "tariffs"
    const val QUICK_CALC = "quick_calc"
    const val SETTINGS = "settings"
    const val SITES = "sites"
    const val PAYMENTS = "payments"

    fun clientEdit(clientId: Long = NEW_ID) = "client_edit/$clientId"
    fun clientDetail(clientId: Long) = "client_detail/$clientId"
    fun quoteEditor(quoteId: Long = NEW_ID) = "quote_editor/$quoteId"
    fun roomEditor(quoteId: Long, roomId: Long = NEW_ID) = "room_editor/$quoteId/$roomId"
}
