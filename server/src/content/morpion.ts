/**
 * Règles du morpion, sans base ni réseau.
 *
 * Le cahier des charges demandait de vrais jeux, pas l'interface seule (§7.6) :
 * les règles vivent donc ici, côté serveur, et c'est le serveur qui dit qui
 * joue et qui a gagné. Un client modifié ne peut pas jouer deux fois de suite
 * ni écrire dans une case occupée.
 */

export type Mark = 'X' | 'O';

/** Plateau : neuf caractères, `.` pour une case libre. */
export const EMPTY_BOARD = '.........';

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function isValidBoard(board: string): boolean {
  return board.length === 9 && /^[.XO]{9}$/.test(board);
}

/** Marque gagnante, ou `undefined` si personne n'a encore aligné trois cases. */
export function winnerOf(board: string): Mark | undefined {
  for (const [a, b, c] of LINES) {
    const value = board[a];
    if (value !== '.' && value === board[b] && value === board[c]) return value as Mark;
  }
  return undefined;
}

export function isFull(board: string): boolean {
  return !board.includes('.');
}

export type MoveError = 'hors_plateau' | 'case_occupee';

export interface MoveResult {
  board: string;
  winner?: Mark;
  draw: boolean;
}

/**
 * Pose une marque. Renvoie l'erreur plutôt que de lever : l'appelant en fait un
 * code HTTP, et les deux cas se testent sans try/catch.
 */
export function applyMove(board: string, mark: Mark, cell: number): MoveResult | MoveError {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return 'hors_plateau';
  if (board[cell] !== '.') return 'case_occupee';

  const next = board.slice(0, cell) + mark + board.slice(cell + 1);
  const winner = winnerOf(next);
  return { board: next, winner, draw: !winner && isFull(next) };
}
