import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

import type { PushMessage, PushSender } from '../push/index.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';

export interface SosResult {
  alertId: string;
  /** Voisins réellement prévenus. */
  alerted: number;
  /** Appareils joints. Zéro si les voisins n'ont pas encore ouvert l'appli. */
  devices: number;
  /** `false` si le service de notifications ne remet rien (développement). */
  delivered: boolean;
}

/**
 * Alertes SOS et alertes de sécurité (§4.16 et §7.7).
 *
 * Le SOS ne part pas à tout le quartier : le voisin désigne lui-même qui il
 * prévient. Une alerte de sécurité, elle, concerne tout le fil.
 */
export class AlertService {
  constructor(
    private readonly db: DatabaseSync,
    private readonly push: PushSender
  ) {}

  /** Enregistre l'appareil d'un voisin pour pouvoir le joindre. */
  registerDevice(member: Member, token: string, platform: string): void {
    this.db
      .prepare(
        `INSERT INTO devices (token, member_id, platform, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token) DO UPDATE SET
           member_id = excluded.member_id,
           platform = excluded.platform,
           updated_at = excluded.updated_at`
      )
      .run(token, member.id, platform, new Date().toISOString());
  }

  forgetDevice(token: string): void {
    this.db.prepare('DELETE FROM devices WHERE token = ?').run(token);
  }

  /**
   * Déclenche un SOS vers les voisins choisis.
   *
   * Les destinataires sont filtrés sur le fil du demandeur : on ne peut pas
   * faire sonner le téléphone de quelqu'un d'un autre quartier.
   */
  async triggerSos(
    member: Member,
    targetIds: string[],
    position?: { latitude: number; longitude: number }
  ): Promise<SosResult> {
    const allowed = this.membersOfSameFeed(member, targetIds);
    const alertId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO sos_alerts (id, member_id, latitude, longitude, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        alertId,
        member.id,
        position?.latitude ?? null,
        position?.longitude ?? null,
        new Date().toISOString()
      );

    const insertTarget = this.db.prepare(
      'INSERT OR IGNORE INTO sos_targets (alert_id, member_id) VALUES (?, ?)'
    );
    for (const id of allowed) insertTarget.run(alertId, id);

    const tokens = this.tokensOf(allowed);
    const place = member.building ? `${member.building}` : '';

    await this.push.send(
      tokens.map(
        (token): PushMessage => ({
          to: token,
          title: `🆘 ${member.firstName} demande de l'aide`,
          body: place
            ? `${place} — ouvre l'application pour voir où.`
            : "Ouvre l'application pour voir où.",
          data: { type: 'sos', alertId },
          priority: 'high',
        })
      )
    );

    return {
      alertId,
      alerted: allowed.length,
      devices: tokens.length,
      delivered: this.push.delivers,
    };
  }

  /** Fausse alerte : les mêmes voisins sont prévenus que c'est fini. */
  async cancelSos(member: Member, alertId: string): Promise<boolean> {
    const alert = this.db
      .prepare('SELECT id, member_id, cancelled_at FROM sos_alerts WHERE id = ?')
      .get(alertId) as { id: string; member_id: string; cancelled_at: string | null } | undefined;

    // Seul l'auteur peut annuler son alerte.
    if (!alert || alert.member_id !== member.id || alert.cancelled_at) return false;

    this.db
      .prepare('UPDATE sos_alerts SET cancelled_at = ? WHERE id = ?')
      .run(new Date().toISOString(), alertId);

    const targets = (
      this.db
        .prepare('SELECT member_id FROM sos_targets WHERE alert_id = ?')
        .all(alertId) as { member_id: string }[]
    ).map((row) => row.member_id);

    await this.push.send(
      this.tokensOf(targets).map(
        (token): PushMessage => ({
          to: token,
          title: `✅ Fausse alerte`,
          body: `${member.firstName} va bien, l'alerte est annulée.`,
          data: { type: 'sos_cancelled', alertId },
          priority: 'normal',
        })
      )
    );

    return true;
  }

  /**
   * Prévient le quartier d'une alerte de sécurité. L'auteur n'est pas notifié
   * de sa propre publication.
   */
  async announceSecurityPost(member: Member, postId: string, text: string): Promise<void> {
    const ids = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const placeholders = ids.map(() => '?').join(', ');

    const recipients = (
      this.db
        .prepare(
          `SELECT id FROM members WHERE neighborhood_id IN (${placeholders}) AND id != ?`
        )
        .all(...ids, member.id) as { id: string }[]
    ).map((row) => row.id);

    const tokens = this.tokensOf(recipients);
    const extract = text.length > 120 ? `${text.slice(0, 117)}…` : text;

    await this.push.send(
      tokens.map(
        (token): PushMessage => ({
          to: token,
          title: '🚨 Alerte sécurité dans ton quartier',
          body: extract,
          data: { type: 'security_post', postId },
          priority: 'high',
        })
      )
    );
  }

  /** Filtre les destinataires demandés sur ceux qui partagent le même fil. */
  private membersOfSameFeed(member: Member, targetIds: string[]): string[] {
    if (targetIds.length === 0) return [];

    const neighborhoods = sharedFeedNeighborhoodIds(member.neighborhoodId);
    const targetPlaceholders = targetIds.map(() => '?').join(', ');
    const neighborhoodPlaceholders = neighborhoods.map(() => '?').join(', ');

    const rows = this.db
      .prepare(
        `SELECT id FROM members
         WHERE id IN (${targetPlaceholders})
           AND neighborhood_id IN (${neighborhoodPlaceholders})
           AND id != ?`
      )
      .all(...targetIds, ...neighborhoods, member.id) as { id: string }[];

    return rows.map((row) => row.id);
  }

  private tokensOf(memberIds: string[]): string[] {
    if (memberIds.length === 0) return [];
    const placeholders = memberIds.map(() => '?').join(', ');

    const rows = this.db
      .prepare(`SELECT token FROM devices WHERE member_id IN (${placeholders})`)
      .all(...memberIds) as { token: string }[];

    return rows.map((row) => row.token);
  }
}
