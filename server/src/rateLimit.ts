/**
 * Limitation par adresse IP, en complément de celle par numéro : sans elle,
 * un seul client peut balayer beaucoup de numéros différents.
 *
 * En mémoire, donc valable pour un processus unique — à déplacer dans Redis le
 * jour où le serveur tourne en plusieurs instances.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly maxHits: number,
    private readonly windowSeconds: number,
    private readonly now: () => number = () => Date.now()
  ) {}

  /** `true` si la requête passe ; `false` si le quota est dépassé. */
  take(key: string): boolean {
    const now = this.now();
    const windowStart = now - this.windowSeconds * 1000;
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);

    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return false;
    }

    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
