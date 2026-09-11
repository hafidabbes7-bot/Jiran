/**
 * Manière dont le numéro est prouvé :
 * - `code` : le serveur envoie un code, le voisin le recopie ;
 * - `link` : le voisin nous envoie lui-même un jeton depuis WhatsApp, et c'est
 *   Meta qui nous dit de quel numéro il provient. Rien n'est envoyé, donc rien
 *   n'est facturé.
 */
export type ChallengeMode = 'code' | 'link';

/** Défi en cours, en attente de vérification. */
export interface Challenge {
  id: string;
  identifier: string;
  mode: ChallengeMode;
  /** Empreinte du code (mode `code`) ou du jeton à envoyer (mode `link`). */
  codeHash: string;
  expiresAt: number;
  attemptsLeft: number;
  createdAt: number;
  consumed: boolean;
  /** Mode `link` : vrai une fois le message reçu depuis le bon numéro. */
  linkConfirmed?: boolean;
}

/** Trace des envois faits à un numéro, pour la limitation de débit. */
export interface SendLog {
  identifier: string;
  /** Horodatages des envois, du plus ancien au plus récent. */
  timestamps: number[];
}

/**
 * Stockage des défis. L'implémentation en mémoire suffit pour un seul
 * processus ; une mise en production sur plusieurs instances demandera un
 * Redis ou une table, derrière cette même interface.
 */
export interface ChallengeStore {
  save(challenge: Challenge): Promise<void>;
  find(id: string): Promise<Challenge | undefined>;
  /** Défis encore vivants, pour retrouver celui que porte un message WhatsApp. */
  findAllPending(): Promise<Challenge[]>;
  update(challenge: Challenge): Promise<void>;
  sendLog(identifier: string): Promise<SendLog>;
  recordSend(identifier: string, at: number): Promise<void>;
}

export class InMemoryChallengeStore implements ChallengeStore {
  private readonly challenges = new Map<string, Challenge>();
  private readonly sends = new Map<string, number[]>();

  /**
   * Même source de temps que le service qui l'utilise : deux horloges
   * différentes feraient disparaître des défis encore valides.
   */
  constructor(private readonly now: () => number = () => Date.now()) {}

  async save(challenge: Challenge): Promise<void> {
    this.challenges.set(challenge.id, challenge);
    this.evictExpired();
  }

  async find(id: string): Promise<Challenge | undefined> {
    return this.challenges.get(id);
  }

  async findAllPending(): Promise<Challenge[]> {
    const now = this.now();
    return [...this.challenges.values()].filter(
      (challenge) => !challenge.consumed && challenge.expiresAt >= now
    );
  }

  async update(challenge: Challenge): Promise<void> {
    this.challenges.set(challenge.id, challenge);
  }

  async sendLog(identifier: string): Promise<SendLog> {
    return { identifier, timestamps: this.sends.get(identifier) ?? [] };
  }

  async recordSend(identifier: string, at: number): Promise<void> {
    const timestamps = this.sends.get(identifier) ?? [];
    timestamps.push(at);
    this.sends.set(identifier, timestamps);
  }

  /** Évite que la mémoire grossisse indéfiniment avec les défis périmés. */
  private evictExpired(): void {
    const now = this.now();
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(id);
    }
  }
}
