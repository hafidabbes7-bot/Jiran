package dz.peintrepro.core

import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Formatage et lecture des nombres saisis par l'utilisateur.
 * La virgule est acceptée comme séparateur décimal (habitude locale).
 */
object Formats {

    private val symbols: DecimalFormatSymbols = DecimalFormatSymbols(Locale.FRANCE).apply {
        groupingSeparator = ' '
        decimalSeparator = ','
    }

    private val moneyFormat = DecimalFormat("#,##0.##", symbols)
    private val decimalFormat = DecimalFormat("#,##0.##", symbols)
    private val plainFormat = DecimalFormat("0.##", symbols)

    fun money(value: Double, currency: String): String =
        "${moneyFormat.format(safe(value))} $currency"

    fun decimal(value: Double): String = decimalFormat.format(safe(value))

    /** Sans séparateur de milliers : utilisé pour pré-remplir les champs de saisie. */
    fun input(value: Double): String = plainFormat.format(safe(value))

    fun area(value: Double): String = "${decimalFormat.format(safe(value))} m²"

    fun liters(value: Double): String = "${decimalFormat.format(safe(value))} L"

    fun percent(value: Double): String = "${decimalFormat.format(safe(value))} %"

    fun date(millis: Long): String =
        SimpleDateFormat("dd/MM/yyyy", Locale.getDefault()).format(Date(millis))

    /** Lit un nombre saisi ("12,5", "12.5", "1 200"). Retourne null si invalide. */
    fun parseDecimal(text: String): Double? {
        val cleaned = text.trim()
            .replace(" ", "")
            .replace(" ", "")
            .replace(" ", "")
            .replace(',', '.')
        if (cleaned.isEmpty()) return null
        return cleaned.toDoubleOrNull()
    }

    /** Lit un nombre saisi, 0 si le champ est vide ou invalide. */
    fun parseDecimalOrZero(text: String): Double = parseDecimal(text) ?: 0.0

    fun parseInt(text: String): Int? = text.trim().replace(" ", "").toIntOrNull()

    fun parseIntOrZero(text: String): Int = parseInt(text) ?: 0

    private fun safe(value: Double): Double =
        if (value.isNaN() || value.isInfinite()) 0.0 else value

    fun currentYear(): Int = Calendar.getInstance().get(Calendar.YEAR)

    /** Début du mois courant, en millisecondes. */
    fun startOfCurrentMonth(): Long = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_MONTH, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis

    /** Début de l'année courante, en millisecondes. */
    fun startOfCurrentYear(): Long = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_YEAR, 1)
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }.timeInMillis
}
