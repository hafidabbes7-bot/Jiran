package dz.peintrepro.core

/**
 * Numérotation des devis : DEV-2026-0001
 * La séquence repart à 1 chaque année.
 */
object QuoteNumbering {

    const val DEFAULT_PREFIX = "DEV"

    fun format(prefix: String, year: Int, sequence: Int): String =
        "%s-%d-%04d".format(prefix.ifBlank { DEFAULT_PREFIX }, year, sequence)

    /**
     * Calcule le prochain numéro à partir des numéros déjà utilisés cette année.
     * Les numéros non conformes sont simplement ignorés.
     */
    fun next(prefix: String, year: Int, existingNumbers: List<String>): String {
        val head = "${prefix.ifBlank { DEFAULT_PREFIX }}-$year-"
        val lastSequence = existingNumbers
            .filter { it.startsWith(head) }
            .mapNotNull { it.removePrefix(head).toIntOrNull() }
            .maxOrNull() ?: 0
        return format(prefix, year, lastSequence + 1)
    }
}
