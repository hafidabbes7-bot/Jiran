import type { Db } from '../db/client.js';
import { isValidEmail, normalizeEmail } from '../identity.js';
import { hacherMotDePasse, motDePasseCorrespond, refuserMotDePasse } from './password.js';
import {
  creerJeton,
  empreinteDeJeton,
  DUREE_CONFIRMATION_MS,
  DUREE_REINITIALISATION_MS,
} from './tokens.js';

export type But = 'confirmation' | 'reset';

export type EchecInscription =
  | 'adresse_invalide'
  | 'mot_de_passe_trop_court'
  | 'mot_de_passe_trop_long'
  | 'mot_de_passe_trop_courant';

export type EchecConnexion =
  | 'identifiants_refuses'
  | 'adresse_non_confirmee'
  | 'compte_bloque';

export type EchecJeton = 'jeton_inconnu' | 'jeton_expire' | 'jeton_deja_utilise';

/** Ce qu'il faut envoyer par e-mail. Le service n'envoie rien lui-même. */
export interface LienAEnvoyer {
  identifier: string;
  but: But;
  /** Jeton en clair — il n'existe qu'ici et dans le message. */
  jeton: string;
  expireLe: Date;
}

/**
 * Comptes par adresse e-mail et mot de passe.
 *
 * Le parcours par téléphone garde le sien : un code reçu par SMS ou WhatsApp,
 * sans mot de passe à retenir. Les deux aboutissent au même endroit — un
 * identifiant vérifié, qui possède le compte et son historique en base.
 *
 * Ce service décide et enregistre ; il n'envoie aucun message et ne délivre
 * aucun jeton de session. C'est ce qui le rend testable sans boîte aux lettres,
 * et ce qui laisse à l'appelant le soin de choisir le canal.
 */
export class AccountService {
  constructor(private readonly db: Db) {}

  /**
   * Inscrit une adresse, ou renvoie un lien à celle qui existe déjà sans être
   * confirmée.
   *
   * Le résultat ne dit jamais si l'adresse était connue : sinon, n'importe qui
   * pourrait essayer des adresses jusqu'à savoir lesquelles ont un compte chez
   * Jiran — et donc qui habite le quartier.
   */
  async inscrire(
    adresse: string,
    motDePasse: string,
    maintenant: Date = new Date()
  ): Promise<{ ok: true; lien?: LienAEnvoyer } | { ok: false; raison: EchecInscription }> {
    const identifiant = normalizeEmail(adresse);
    if (!isValidEmail(identifiant)) return { ok: false, raison: 'adresse_invalide' };

    const refus = refuserMotDePasse(motDePasse);
    if (refus) {
      const raisons = {
        trop_court: 'mot_de_passe_trop_court',
        trop_long: 'mot_de_passe_trop_long',
        trop_courant: 'mot_de_passe_trop_courant',
      } as const;
      return { ok: false, raison: raisons[refus] };
    }

    const existant = await this.credential(identifiant);

    // Adresse déjà confirmée : on n'écrase pas le mot de passe de quelqu'un qui
    // a un compte — ce serait le moyen le plus simple de le lui voler. On
    // répond « c'est bon » sans rien envoyer ni rien changer.
    if (existant?.verified_at) return { ok: true };

    const empreinte = await hacherMotDePasse(motDePasse);

    // Inscription non confirmée reprise : le mot de passe le plus récent
    // l'emporte, ce qui rattrape une faute de frappe au premier essai.
    await this.db.query(
      `INSERT INTO credentials (identifier, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (identifier) DO UPDATE SET
         password_hash = excluded.password_hash,
         updated_at = now()`,
      [identifiant, empreinte]
    );

    return { ok: true, lien: await this.emettreLien(identifiant, 'confirmation', maintenant) };
  }

  /**
   * Crée un lien et invalide les précédents du même but.
   *
   * Deux liens valides pour la même chose, c'est une fenêtre de plus ouverte
   * sans raison : le dernier envoyé est le seul qui marche.
   */
  private async emettreLien(
    identifiant: string,
    but: But,
    maintenant: Date
  ): Promise<LienAEnvoyer> {
    const { clair, empreinte } = creerJeton();
    const durée = but === 'confirmation' ? DUREE_CONFIRMATION_MS : DUREE_REINITIALISATION_MS;
    const expire = new Date(maintenant.getTime() + durée);

    await this.db.tx(async (tx) => {
      await tx.query(
        `UPDATE email_tokens SET consumed_at = $3
         WHERE identifier = $1 AND purpose = $2 AND consumed_at IS NULL`,
        [identifiant, but, maintenant.toISOString()]
      );
      await tx.query(
        `INSERT INTO email_tokens (token_hash, identifier, purpose, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [empreinte, identifiant, but, expire.toISOString()]
      );
    });

    return { identifier: identifiant, but, jeton: clair, expireLe: expire };
  }

  /** Ouvre un lien de confirmation : l'adresse devient utilisable. */
  async confirmer(
    jeton: string,
    maintenant: Date = new Date()
  ): Promise<{ ok: true; identifier: string } | { ok: false; raison: EchecJeton }> {
    const ligne = await this.consommer(jeton, 'confirmation', maintenant);
    if (!ligne.ok) return ligne;

    await this.db.query(
      `UPDATE credentials
       SET verified_at = COALESCE(verified_at, $2), failed_attempts = 0, locked_until = NULL,
           updated_at = now()
       WHERE identifier = $1`,
      [ligne.identifier, maintenant.toISOString()]
    );

    return { ok: true, identifier: ligne.identifier };
  }

  /**
   * Vérifie un lien et le brûle, en une seule instruction.
   *
   * Le `UPDATE … WHERE consumed_at IS NULL … RETURNING` fait que deux ouvertures
   * simultanées du même lien ne peuvent pas réussir toutes les deux : c'est la
   * base qui tranche, pas l'ordre des requêtes.
   */
  private async consommer(
    jeton: string,
    but: But,
    maintenant: Date
  ): Promise<{ ok: true; identifier: string } | { ok: false; raison: EchecJeton }> {
    const empreinte = empreinteDeJeton(jeton);

    const brûlé = await this.db.one<{ identifier: string }>(
      `UPDATE email_tokens SET consumed_at = $3
       WHERE token_hash = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > $3
       RETURNING identifier`,
      [empreinte, but, maintenant.toISOString()]
    );
    if (brûlé) return { ok: true, identifier: brûlé.identifier };

    // Rien brûlé : dire lequel des trois cas, pour que l'écran propose la
    // bonne suite — redemander un lien, ou simplement se connecter.
    const ligne = await this.db.one<{ consumed_at: Date | null; expires_at: Date }>(
      'SELECT consumed_at, expires_at FROM email_tokens WHERE token_hash = $1 AND purpose = $2',
      [empreinte, but]
    );
    if (!ligne) return { ok: false, raison: 'jeton_inconnu' };
    if (ligne.consumed_at) return { ok: false, raison: 'jeton_deja_utilise' };
    return { ok: false, raison: 'jeton_expire' };
  }

  /** Au-delà, on ralentit : six essais, c'est déjà plus qu'un oubli. */
  private static readonly ESSAIS_AVANT_BLOCAGE = 6;
  private static readonly BLOCAGE_MS = 15 * 60 * 1000;

  async connecter(
    adresse: string,
    motDePasse: string,
    maintenant: Date = new Date()
  ): Promise<{ ok: true; identifier: string } | { ok: false; raison: EchecConnexion }> {
    const identifiant = normalizeEmail(adresse);
    const ligne = await this.credential(identifiant);

    // Adresse inconnue : même réponse et même temps de calcul qu'un mot de
    // passe faux, pour ne pas révéler qui a un compte.
    if (!ligne) {
      await hacherMotDePasse(motDePasse);
      return { ok: false, raison: 'identifiants_refuses' };
    }

    if (ligne.locked_until && ligne.locked_until > maintenant) {
      return { ok: false, raison: 'compte_bloque' };
    }

    if (!(await motDePasseCorrespond(motDePasse, ligne.password_hash))) {
      await this.compterEchec(identifiant, ligne.failed_attempts + 1, maintenant);
      return { ok: false, raison: 'identifiants_refuses' };
    }

    // Mot de passe bon mais adresse jamais confirmée : on ne laisse pas entrer,
    // sinon le lien de confirmation ne servirait à rien.
    if (!ligne.verified_at) return { ok: false, raison: 'adresse_non_confirmee' };

    await this.db.query(
      `UPDATE credentials SET failed_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE identifier = $1`,
      [identifiant]
    );

    return { ok: true, identifier: identifiant };
  }

  private async compterEchec(identifiant: string, essais: number, maintenant: Date): Promise<void> {
    const bloquéJusque =
      essais >= AccountService.ESSAIS_AVANT_BLOCAGE
        ? new Date(maintenant.getTime() + AccountService.BLOCAGE_MS).toISOString()
        : null;

    await this.db.query(
      `UPDATE credentials
       SET failed_attempts = $2, locked_until = $3, updated_at = now()
       WHERE identifier = $1`,
      [identifiant, essais >= AccountService.ESSAIS_AVANT_BLOCAGE ? 0 : essais, bloquéJusque]
    );
  }

  /**
   * Renvoie un lien de confirmation, si et seulement si l'adresse existe et
   * n'est pas confirmée. Silencieux dans tous les autres cas.
   */
  async renvoyerConfirmation(
    adresse: string,
    maintenant: Date = new Date()
  ): Promise<LienAEnvoyer | undefined> {
    const identifiant = normalizeEmail(adresse);
    const ligne = await this.credential(identifiant);
    if (!ligne || ligne.verified_at) return undefined;

    return this.emettreLien(identifiant, 'confirmation', maintenant);
  }

  /** Lien de réinitialisation, pour une adresse confirmée seulement. */
  async demanderReinitialisation(
    adresse: string,
    maintenant: Date = new Date()
  ): Promise<LienAEnvoyer | undefined> {
    const identifiant = normalizeEmail(adresse);
    const ligne = await this.credential(identifiant);
    if (!ligne?.verified_at) return undefined;

    return this.emettreLien(identifiant, 'reset', maintenant);
  }

  async reinitialiser(
    jeton: string,
    motDePasse: string,
    maintenant: Date = new Date()
  ): Promise<
    { ok: true; identifier: string } | { ok: false; raison: EchecJeton | EchecInscription }
  > {
    const refus = refuserMotDePasse(motDePasse);
    if (refus) {
      const raisons = {
        trop_court: 'mot_de_passe_trop_court',
        trop_long: 'mot_de_passe_trop_long',
        trop_courant: 'mot_de_passe_trop_courant',
      } as const;
      return { ok: false, raison: raisons[refus] };
    }

    const ligne = await this.consommer(jeton, 'reset', maintenant);
    if (!ligne.ok) return ligne;

    await this.db.query(
      `UPDATE credentials
       SET password_hash = $2, failed_attempts = 0, locked_until = NULL, updated_at = now()
       WHERE identifier = $1`,
      [ligne.identifier, await hacherMotDePasse(motDePasse)]
    );

    return { ok: true, identifier: ligne.identifier };
  }

  /** Vrai si cette adresse a un compte confirmé — pour `/health` et les tests. */
  async estConfirme(adresse: string): Promise<boolean> {
    return Boolean((await this.credential(normalizeEmail(adresse)))?.verified_at);
  }

  /** Efface les jetons périmés. Appelé par le ménage quotidien. */
  async oublierJetonsPerimes(maintenant: Date = new Date()): Promise<number> {
    const effacés = await this.db.query(
      'DELETE FROM email_tokens WHERE expires_at < $1 RETURNING token_hash',
      [maintenant.toISOString()]
    );
    return effacés.length;
  }

  private async credential(identifiant: string) {
    return this.db.one<{
      identifier: string;
      password_hash: string;
      verified_at: Date | null;
      failed_attempts: number;
      locked_until: Date | null;
    }>(
      `SELECT identifier, password_hash, verified_at, failed_attempts, locked_until
       FROM credentials WHERE identifier = $1`,
      [identifiant]
    );
  }
}
