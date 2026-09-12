import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toBool, toIso } from '../db/rows.js';
import type { PushMessage, PushSender } from '../push/index.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';

/** Une alerte SOS en cours, telle qu'elle s'affiche dans l'application. */
export interface ActiveSos {
  id: string;
  fromName: string;
  building?: string;
  /** Vrai si c'est l'alerte lancée par celui qui regarde. */
  mine: boolean;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

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
    private readonly db: Db,
    private readonly push: PushSender
  ) {}

  /** Enregistre l'appareil d'un voisin pour pouvoir le joindre. */
  async registerDevice(member: Member, token: string, platform: string): Promise<void> {
    await this.db.query(
      `INSERT INTO devices (token, member_id, platform, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (token) DO UPDATE SET
         member_id = excluded.member_id,
         platform = excluded.platform,
         updated_at = excluded.updated_at`,
      [token, member.id, platform]
    );
  }

  async forgetDevice(token: string): Promise<void> {
    await this.db.query('DELETE FROM devices WHERE token = $1', [token]);
  }

  /**
   * Déclenche un SOS vers les voisins choisis.
   *
   * Les destinataires sont filtrés sur le fil du demandeur : on ne peut pas
   * faire sonner le téléphone de quelqu'un d'un autre quartier.
   */
  /** Au-delà de deux heures, une alerte n'est plus « en cours ». */
  private static readonly WINDOW_MS = 2 * 60 * 60 * 1000;

  async triggerSos(
    member: Member,
    targetIds: string[],
    position?: { latitude: number; longitude: number }
  ): Promise<SosResult> {
    const allowed = await this.membersOfSameFeed(member, targetIds);
    const alertId = crypto.randomUUID();

    await this.db.query(
      `INSERT INTO sos_alerts (id, member_id, latitude, longitude)
       VALUES ($1, $2, $3, $4)`,
      [alertId, member.id, position?.latitude ?? null, position?.longitude ?? null]
    );

    if (allowed.length > 0) {
      await this.db.query(
        `INSERT INTO sos_targets (alert_id, member_id)
         SELECT $1, unnest($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [alertId, allowed]
      );
    }

    const tokens = await this.tokensOf(allowed);
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
  /**
   * Alertes SOS encore vivantes pour ce voisin : celles qu'on lui a adressées,
   * et la sienne s'il en a lancé une.
   *
   * Le SOS ne peut pas dépendre des seules notifications : tant qu'aucun
   * service de remise n'est branché — et même après, si le voisin a coupé les
   * notifications ou n'a pas encore ouvert l'application — l'alerte doit se
   * voir dans l'application. Une alerte d'urgence qui ne s'affiche nulle part
   * n'est pas une alerte.
   */
  async activeSos(member: Member, now: Date = new Date()): Promise<ActiveSos[]> {
    const depuis = new Date(now.getTime() - AlertService.WINDOW_MS).toISOString();

    const rows = await this.db.query<Record<string, unknown>>(
      `SELECT a.id, a.latitude, a.longitude, a.created_at, a.member_id,
              m.first_name, m.building,
              (a.member_id = $1) AS mine
       FROM sos_alerts a
       JOIN members m ON m.id = a.member_id
       WHERE a.cancelled_at IS NULL
         AND a.created_at >= $2
         AND (a.member_id = $1 OR EXISTS (
               SELECT 1 FROM sos_targets t WHERE t.alert_id = a.id AND t.member_id = $1))
       ORDER BY a.created_at DESC
       LIMIT 20`,
      [member.id, depuis]
    );

    return rows.map((row) => ({
      id: String(row.id),
      fromName: String(row.first_name),
      building: (row.building as string | null) ?? undefined,
      mine: toBool(row.mine),
      latitude: row.latitude === null ? undefined : Number(row.latitude),
      longitude: row.longitude === null ? undefined : Number(row.longitude),
      createdAt: toIso(row.created_at),
    }));
  }

  async cancelSos(member: Member, alertId: string): Promise<boolean> {
    if (!estUuid(alertId)) return false;
    const alert = await this.db.one<{ member_id: string; cancelled_at: Date | null }>(
      'SELECT member_id, cancelled_at FROM sos_alerts WHERE id = $1',
      [alertId]
    );

    // Seul l'auteur peut annuler son alerte.
    if (!alert || alert.member_id !== member.id || alert.cancelled_at) return false;

    await this.db.query('UPDATE sos_alerts SET cancelled_at = now() WHERE id = $1', [alertId]);

    const targets = (
      await this.db.query<{ member_id: string }>(
        'SELECT member_id FROM sos_targets WHERE alert_id = $1',
        [alertId]
      )
    ).map((row) => row.member_id);

    await this.push.send(
      (await this.tokensOf(targets)).map(
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
    const recipients = (
      await this.db.query<{ id: string }>(
        'SELECT id FROM members WHERE neighborhood_id = ANY($1) AND id <> $2',
        [sharedFeedNeighborhoodIds(member.neighborhoodId), member.id]
      )
    ).map((row) => row.id);

    const tokens = await this.tokensOf(recipients);
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
  private async membersOfSameFeed(member: Member, targetIds: string[]): Promise<string[]> {
    const valides = targetIds.filter(estUuid);
    if (valides.length === 0) return [];

    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM members
       WHERE id = ANY($1::uuid[])
         AND neighborhood_id = ANY($2)
         AND id <> $3`,
      [valides, sharedFeedNeighborhoodIds(member.neighborhoodId), member.id]
    );

    return rows.map((row) => row.id);
  }

  private async tokensOf(memberIds: string[]): Promise<string[]> {
    const valides = memberIds.filter(estUuid);
    if (valides.length === 0) return [];

    const rows = await this.db.query<{ token: string }>(
      'SELECT token FROM devices WHERE member_id = ANY($1::uuid[])',
      [valides]
    );

    return rows.map((row) => row.token);
  }
}
