import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openTestDb } from '../db/testDb.js';
import { GameService } from './games.js';
import { applyMove, winnerOf, EMPTY_BOARD } from './morpion.js';
import { ContentRepository, type Member } from './repository.js';

describe('règles du morpion', () => {
  it('refuse une case déjà prise et une case hors plateau', async () => {
    const plein = applyMove(EMPTY_BOARD, 'X', 0);
    assert.notEqual(typeof plein, 'string');
    assert.equal(applyMove('X........', 'O', 0), 'case_occupee');
    assert.equal(applyMove(EMPTY_BOARD, 'O', 9), 'hors_plateau');
  });

  it('voit les alignements dans les trois sens', async () => {
    assert.equal(winnerOf('XXX......'), 'X');
    assert.equal(winnerOf('O..O..O..'), 'O');
    assert.equal(winnerOf('X...X...X'), 'X');
    assert.equal(winnerOf('XO.......'), undefined);
  });

  it('déclare le match nul quand le plateau est plein sans alignement', async () => {
    const result = applyMove('XOXXOOOX.', 'X', 8);
    assert.notEqual(typeof result, 'string');
    if (typeof result === 'string') return;
    assert.equal(result.winner, undefined);
    assert.equal(result.draw, true);
  });
});

describe('parties entre voisins', () => {
  let games: GameService;
  let hafid: Member;
  let salim: Member;
  let karim: Member;

  beforeEach(async () => {
    const db = await openTestDb();
    const content = new ContentRepository(db);
    games = new GameService(db);
    hafid = (await content.saveMember({ identifier: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' }));
    salim = (await content.saveMember({ identifier: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' }));
    karim = (await content.saveMember({ identifier: '0555000003', firstName: 'Karim', neighborhoodId: 'oran' }));
  });

  it('ouvre une partie qui attend un adversaire', async () => {
    const partie = (await games.create(hafid, 'morpion'));
    assert.equal(partie.status, 'waiting');
    assert.equal(partie.yourMark, 'X');
    assert.equal(partie.yourTurn, false);
    assert.equal(partie.hostName, 'Hafid');
  });

  it('ne propose pas les parties d’un autre quartier', async () => {
    await games.create(karim, 'morpion');
    assert.deepEqual((await games.list(hafid)), []);
    assert.equal((await games.list(karim)).length, 1);
  });

  it('refuse de rejoindre sa propre partie, puis une partie pleine', async () => {
    const partie = (await games.create(hafid, 'morpion'));
    assert.equal((await games.join(hafid, partie.id)), 'ta_propre_partie');
    assert.notEqual(typeof (await games.join(salim, partie.id)), 'string');
    assert.equal((await games.join(karim, partie.id)), 'partie_pleine');
  });

  it('fait jouer chacun à son tour, et personne d’autre', async () => {
    const partie = (await games.create(hafid, 'morpion'));
    await games.join(salim, partie.id);

    assert.equal((await games.play(salim, partie.id, 0)), 'pas_ton_tour');
    assert.equal((await games.play(karim, partie.id, 0)), 'pas_ta_partie');

    const apres = (await games.play(hafid, partie.id, 0));
    assert.notEqual(typeof apres, 'string');
    if (typeof apres === 'string') return;
    assert.equal(apres.board, 'X........');
    assert.equal(apres.yourTurn, false);
    assert.equal((await games.play(hafid, partie.id, 1)), 'pas_ton_tour');
    assert.equal((await games.play(salim, partie.id, 0)), 'case_occupee');
  });

  it('désigne le gagnant et ferme la partie', async () => {
    const partie = (await games.create(hafid, 'morpion'));
    await games.join(salim, partie.id);

    (await games.play(hafid, partie.id, 0)); // X
    (await games.play(salim, partie.id, 3)); // O
    (await games.play(hafid, partie.id, 1)); // X
    (await games.play(salim, partie.id, 4)); // O
    const fin = (await games.play(hafid, partie.id, 2)); // X aligne 0-1-2

    assert.notEqual(typeof fin, 'string');
    if (typeof fin === 'string') return;
    assert.equal(fin.status, 'won');
    assert.equal(fin.outcome, 'gagne');

    const vuDeSalim = (await games.list(salim)).find((g) => g.id === partie.id);
    assert.equal(vuDeSalim?.outcome, 'perdu');
    assert.equal((await games.play(salim, partie.id, 5)), 'partie_finie');
  });

  it('ne connaît pas une partie inventée', async () => {
    assert.equal((await games.join(hafid, 'inexistante')), 'partie_inconnue');
    assert.equal((await games.play(hafid, 'inexistante', 0)), 'partie_inconnue');
  });
});
