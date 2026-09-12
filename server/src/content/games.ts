import crypto from 'node:crypto';

import type { Db } from '../db/client.js';
import { estUuid, toIso } from '../db/rows.js';
import { sharedFeedNeighborhoodIds } from './neighborhoods.js';
import type { Member } from './repository.js';
import { EMPTY_BOARD, applyMove, type Mark } from './morpion.js';

/** Seul jeu réellement jouable pour l'instant (§7.6). */
export const GAME_KINDS = ['morpion'] as const;
export type GameKind = (typeof GAME_KINDS)[number];

export type GameStatus = 'waiting' | 'playing' | 'won' | 'draw';

/** Une partie vue par un joueur : jamais « X » ni « O » à l'écran, mais « toi ». */
export interface GameView {
  id: string;
  kind: GameKind;
  status: GameStatus;
  board: string;
  hostName: string;
  opponentName?: string;
  /** Marque du voisin qui regarde, absente s'il ne joue pas cette partie. */
  yourMark?: Mark;
  yourTurn: boolean;
  /** Renseigné une fois la partie finie, du point de vue de celui qui regarde. */
  outcome?: 'gagne' | 'perdu' | 'nul';
  updatedAt: string;
}

export type GameError =
  | 'partie_inconnue'
  | 'partie_pleine'
  | 'partie_finie'
  | 'pas_ton_tour'
  | 'pas_ta_partie'
  | 'ta_propre_partie'
  | 'hors_plateau'
  | 'case_occupee';

interface GameRow {
  id: string;
  kind: string;
  neighborhood_id: string;
  player_x: string;
  player_o: string | null;
  name_x: string;
  name_o: string | null;
  board: string;
  turn: string;
  status: string;
  winner: string | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `
  SELECT g.*, x.first_name AS name_x, o.first_name AS name_o
  FROM games g
  JOIN members x ON x.id = g.player_x
  LEFT JOIN members o ON o.id = g.player_o
`;

/**
 * Parties entre voisins du même fil.
 *
 * Le tour par tour se joue en rechargeant la partie : pas de connexion
 * permanente à tenir, ce qui tient sur un hébergement gratuit et survit à une
 * coupure de réseau — un voisin retrouve sa partie là où il l'a laissée.
 */
export class GameService {
  constructor(private readonly db: Db) {}

  /** Parties du voisin, puis celles qui attendent un adversaire dans son fil. */
  async list(member: Member): Promise<GameView[]> {
    const rows = await this.db.query<GameRow>(
      `${SELECT}
       WHERE g.neighborhood_id = ANY($1)
         AND (g.player_x = $2 OR g.player_o = $2 OR g.status = 'waiting')
       ORDER BY g.updated_at DESC
       LIMIT 40`,
      [sharedFeedNeighborhoodIds(member.neighborhoodId), member.id]
    );

    return rows.map((row) => this.view(row, member));
  }

  async create(member: Member, kind: GameKind, now: Date = new Date()): Promise<GameView> {
    const id = crypto.randomUUID();
    const stamp = now.toISOString();
    await this.db.query(
      `INSERT INTO games (id, kind, neighborhood_id, player_x, player_o, board, turn, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NULL, $5, 'X', 'waiting', $6, $6)`,
      [id, kind, member.neighborhoodId, member.id, EMPTY_BOARD, stamp]
    );
    return this.require(id, member);
  }

  async join(
    member: Member,
    gameId: string,
    now: Date = new Date()
  ): Promise<GameView | GameError> {
    const row = await this.row(gameId);
    if (!row) return 'partie_inconnue';
    if (row.player_x === member.id) return 'ta_propre_partie';
    if (row.player_o) return 'partie_pleine';

    await this.db.query(
      `UPDATE games SET player_o = $1, status = 'playing', updated_at = $2 WHERE id = $3`,
      [member.id, now.toISOString(), gameId]
    );
    return this.require(gameId, member);
  }

  async play(
    member: Member,
    gameId: string,
    cell: number,
    now: Date = new Date()
  ): Promise<GameView | GameError> {
    const row = await this.row(gameId);
    if (!row) return 'partie_inconnue';

    const mark = this.markOf(row, member);
    if (!mark) return 'pas_ta_partie';
    if (row.status === 'won' || row.status === 'draw') return 'partie_finie';
    if (row.status === 'waiting') return 'pas_ton_tour';
    if (row.turn !== mark) return 'pas_ton_tour';

    const result = applyMove(row.board, mark, cell);
    if (result === 'hors_plateau' || result === 'case_occupee') return result;

    const status: GameStatus = result.winner ? 'won' : result.draw ? 'draw' : 'playing';
    await this.db.query(
      `UPDATE games SET board = $1, turn = $2, status = $3, winner = $4, updated_at = $5 WHERE id = $6`,
      [
        result.board,
        mark === 'X' ? 'O' : 'X',
        status,
        result.winner ?? null,
        now.toISOString(),
        gameId,
      ]
    );
    return this.require(gameId, member);
  }

  // --- interne ---------------------------------------------------------

  private async row(gameId: string): Promise<GameRow | undefined> {
    // Un identifiant qui n'a pas la forme attendue ne peut désigner aucune
    // partie : autant le dire tout de suite, plutôt que de le faire refuser
    // par la base sous forme d'erreur.
    if (!estUuid(gameId)) return undefined;

    return this.db.one<GameRow>(`${SELECT} WHERE g.id = $1`, [gameId]);
  }

  private async require(gameId: string, member: Member): Promise<GameView> {
    const row = await this.row(gameId);
    if (!row) throw new Error(`partie introuvable juste après écriture : ${gameId}`);
    return this.view(row, member);
  }

  private markOf(row: GameRow, member: Member): Mark | undefined {
    if (row.player_x === member.id) return 'X';
    if (row.player_o === member.id) return 'O';
    return undefined;
  }

  private view(row: GameRow, member: Member): GameView {
    const mark = this.markOf(row, member);
    const status = row.status as GameStatus;
    const winner = row.winner as Mark | null;

    let outcome: GameView['outcome'];
    if (status === 'draw') outcome = 'nul';
    else if (status === 'won' && mark) outcome = winner === mark ? 'gagne' : 'perdu';

    return {
      id: row.id,
      kind: row.kind as GameKind,
      status,
      board: row.board,
      hostName: row.name_x,
      opponentName: row.name_o ?? undefined,
      yourMark: mark,
      yourTurn: status === 'playing' && mark === row.turn,
      outcome,
      updatedAt: toIso(row.updated_at),
    };
  }
}
