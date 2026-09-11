import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openDatabase } from './db.js';
import { GameService } from './games.js';
import { applyMove, winnerOf, EMPTY_BOARD } from './morpion.js';
import { ContentRepository } from './repository.js';

describe('règles du morpion', () => {
  it('refuse une case déjà prise et une case hors plateau', () => {
    const plein = applyMove(EMPTY_BOARD, 'X', 0);
    assert.notEqual(typeof plein, 'string');
    assert.equal(applyMove('X........', 'O', 0), 'case_occupee');
    assert.equal(applyMove(EMPTY_BOARD, 'O', 9), 'hors_plateau');
  });

  it('voit les alignements dans les trois sens', () => {
    assert.equal(winnerOf('XXX......'), 'X');
    assert.equal(winnerOf('O..O..O..'), 'O');
    assert.equal(winnerOf('X...X...X'), 'X');
    assert.equal(winnerOf('XO.......'), undefined);
  });

  it('déclare le match nul quand le plateau est plein sans alignement', () => {
    const result = applyMove('XOXXOOOX.', 'X', 8);
    assert.notEqual(typeof result, 'string');
    if (typeof result === 'string') return;
    assert.equal(result.winner, undefined);
    assert.equal(result.draw, true);
  });
});

describe('parties entre voisins', () => {
  let games: GameService;
  let hafid: ReturnType<ContentRepository['saveMember']>;
  let salim: ReturnType<ContentRepository['saveMember']>;
  let karim: ReturnType<ContentRepository['saveMember']>;

  beforeEach(() => {
    const db = openDatabase(':memory:');
    const content = new ContentRepository(db);
    games = new GameService(db);
    hafid = content.saveMember({ phone: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' });
    salim = content.saveMember({ phone: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' });
    karim = content.saveMember({ phone: '0555000003', firstName: 'Karim', neighborhoodId: 'oran' });
  });

  it('ouvre une partie qui attend un adversaire', () => {
    const partie = games.create(hafid, 'morpion');
    assert.equal(partie.status, 'waiting');
    assert.equal(partie.yourMark, 'X');
    assert.equal(partie.yourTurn, false);
    assert.equal(partie.hostName, 'Hafid');
  });

  it('ne propose pas les parties d’un autre quartier', () => {
    games.create(karim, 'morpion');
    assert.deepEqual(games.list(hafid), []);
    assert.equal(games.list(karim).length, 1);
  });

  it('refuse de rejoindre sa propre partie, puis une partie pleine', () => {
    const partie = games.create(hafid, 'morpion');
    assert.equal(games.join(hafid, partie.id), 'ta_propre_partie');
    assert.notEqual(typeof games.join(salim, partie.id), 'string');
    assert.equal(games.join(karim, partie.id), 'partie_pleine');
  });

  it('fait jouer chacun à son tour, et personne d’autre', () => {
    const partie = games.create(hafid, 'morpion');
    games.join(salim, partie.id);

    assert.equal(games.play(salim, partie.id, 0), 'pas_ton_tour');
    assert.equal(games.play(karim, partie.id, 0), 'pas_ta_partie');

    const apres = games.play(hafid, partie.id, 0);
    assert.notEqual(typeof apres, 'string');
    if (typeof apres === 'string') return;
    assert.equal(apres.board, 'X........');
    assert.equal(apres.yourTurn, false);
    assert.equal(games.play(hafid, partie.id, 1), 'pas_ton_tour');
    assert.equal(games.play(salim, partie.id, 0), 'case_occupee');
  });

  it('désigne le gagnant et ferme la partie', () => {
    const partie = games.create(hafid, 'morpion');
    games.join(salim, partie.id);

    games.play(hafid, partie.id, 0); // X
    games.play(salim, partie.id, 3); // O
    games.play(hafid, partie.id, 1); // X
    games.play(salim, partie.id, 4); // O
    const fin = games.play(hafid, partie.id, 2); // X aligne 0-1-2

    assert.notEqual(typeof fin, 'string');
    if (typeof fin === 'string') return;
    assert.equal(fin.status, 'won');
    assert.equal(fin.outcome, 'gagne');

    const vuDeSalim = games.list(salim).find((g) => g.id === partie.id);
    assert.equal(vuDeSalim?.outcome, 'perdu');
    assert.equal(games.play(salim, partie.id, 5), 'partie_finie');
  });

  it('ne connaît pas une partie inventée', () => {
    assert.equal(games.join(hafid, 'inexistante'), 'partie_inconnue');
    assert.equal(games.play(hafid, 'inexistante', 0), 'partie_inconnue');
  });
});
