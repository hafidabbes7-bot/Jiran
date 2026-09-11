/** Défi en cours : un code envoyé à un numéro, en attente de vérification. */
export interface Challenge {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: number;
  attemptsLeft: number;
  createdAt: number;
  consumed: boolean;
}

/** Trace des envois faits à un numéro, pour la limitation de débit. */
export interface SendLog {
  phone: string;
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
  update(challenge: Challenge): Promise<void>;
  sendLog(phone: string): Promise<SendLog>;
  recordSend(phone: string, at: number): Promise<void>;
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

  async update(challenge: Challenge): Promise<void> {
    this.challenges.set(challenge.id, challenge);
  }

  async sendLog(phone: string): Promise<SendLog> {
    return { phone, timestamps: this.sends.get(phone) ?? [] };
  }

  async recordSend(phone: string, at: number): Promise<void> {
    const timestamps = this.sends.get(phone) ?? [];
    timestamps.push(at);
    this.sends.set(phone, timestamps);
  }

  /** Évite que la mémoire grossisse indéfiniment avec les défis périmés. */
  private evictExpired(): void {
    const now = this.now();
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(id);
    }
  }
}
