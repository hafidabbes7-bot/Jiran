package dz.peintrepro.di

/**
 * Transporte le résultat du « calcul rapide » vers l'écran de création de devis.
 * Donnée volontairement temporaire (non persistée) : il ne s'agit pas d'une
 * donnée métier, seulement d'un passage de relais entre deux écrans.
 */
object QuickCalcHandoff {

    data class Draft(
        val roomName: String,
        val length: Double,
        val width: Double,
        val height: Double,
        val doorCount: Int,
        val windowCount: Int,
        val coats: Int,
        val pricePerSqm: Double,
        val includeCeiling: Boolean
    )

    @Volatile
    private var pending: Draft? = null

    fun put(draft: Draft) {
        pending = draft
    }

    fun consume(): Draft? {
        val draft = pending
        pending = null
        return draft
    }
}
