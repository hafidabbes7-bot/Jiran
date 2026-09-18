package dz.peintrepro.domain.model

import androidx.annotation.StringRes
import dz.peintrepro.R

/**
 * Les énumérations portent directement l'identifiant de leur libellé traduit.
 * Elles sont stockées en base sous forme de texte (leur `name`), jamais sous
 * forme d'index : ajouter une valeur plus tard ne casse donc pas les données.
 */

enum class QuoteStatus(@StringRes val labelRes: Int) {
    DRAFT(R.string.status_draft),
    SENT(R.string.status_sent),
    ACCEPTED(R.string.status_accepted),
    REFUSED(R.string.status_refused),
    CANCELLED(R.string.status_cancelled);

    companion object {
        fun from(value: String?): QuoteStatus =
            entries.firstOrNull { it.name == value } ?: DRAFT
    }
}

enum class QuoteLevel(@StringRes val labelRes: Int) {
    ECONOMIQUE(R.string.level_economique),
    STANDARD(R.string.level_standard),
    PREMIUM(R.string.level_premium);

    companion object {
        fun from(value: String?): QuoteLevel =
            entries.firstOrNull { it.name == value } ?: STANDARD
    }
}

enum class SiteType(@StringRes val labelRes: Int) {
    APARTMENT(R.string.site_type_apartment),
    VILLA(R.string.site_type_villa),
    SHOP(R.string.site_type_shop),
    OFFICE(R.string.site_type_office),
    FACADE(R.string.site_type_facade),
    OTHER(R.string.site_type_other);

    companion object {
        fun from(value: String?): SiteType =
            entries.firstOrNull { it.name == value } ?: APARTMENT
    }
}

enum class SiteStatus(@StringRes val labelRes: Int) {
    PREPARATION(R.string.site_status_preparation),
    IN_PROGRESS(R.string.site_status_in_progress),
    DONE(R.string.site_status_done),
    PAUSED(R.string.site_status_paused),
    CANCELLED(R.string.site_status_cancelled);

    companion object {
        fun from(value: String?): SiteStatus =
            entries.firstOrNull { it.name == value } ?: PREPARATION
    }
}

enum class UnitType(@StringRes val labelRes: Int, val isSurface: Boolean = false) {
    M2(R.string.unit_m2, isSurface = true),
    ML(R.string.unit_ml),
    PIECE(R.string.unit_piece),
    LUMP_SUM(R.string.unit_lump),
    LITER(R.string.unit_liter),
    KG(R.string.unit_kg);

    companion object {
        fun from(value: String?): UnitType =
            entries.firstOrNull { it.name == value } ?: M2
    }
}

enum class LineCategory(@StringRes val labelRes: Int) {
    WORK(R.string.category_work),
    MATERIAL(R.string.category_material),
    LABOR(R.string.category_labor),
    OTHER(R.string.category_other);

    companion object {
        fun from(value: String?): LineCategory =
            entries.firstOrNull { it.name == value } ?: WORK
    }
}

enum class PaymentMethod(@StringRes val labelRes: Int) {
    CASH(R.string.payment_cash),
    TRANSFER(R.string.payment_transfer),
    CHECK(R.string.payment_check),
    OTHER(R.string.payment_other);

    companion object {
        fun from(value: String?): PaymentMethod =
            entries.firstOrNull { it.name == value } ?: CASH
    }
}

enum class PhotoPhase(@StringRes val labelRes: Int) {
    BEFORE(R.string.photo_before),
    DURING(R.string.photo_during),
    AFTER(R.string.photo_after);

    companion object {
        fun from(value: String?): PhotoPhase =
            entries.firstOrNull { it.name == value } ?: BEFORE
    }
}
