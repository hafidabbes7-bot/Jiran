import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { issueSessionToken, readSessionToken } from './session.js';

const SECRET = 'un-secret-de-session-assez-long-pour-le-test';

describe('jeton de session', () => {
  it('relit le numéro qu’il contient', () => {
    const token = issueSessionToken('0555123456', SECRET, 90);
    assert.equal(readSessionToken(token, SECRET), '0555123456');
  });

  it('rejette un jeton signé avec une autre clé', () => {
    const token = issueSessionToken('0555123456', SECRET, 90);
    assert.equal(readSessionToken(token, 'une-autre-cle-tout-aussi-longue-1234'), null);
  });

  it('rejette un contenu modifié après signature', () => {
    const token = issueSessionToken('0555123456', SECRET, 90);
    const [, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ phone: '0777777777', iat: 0, exp: 4102444800 })
    ).toString('base64url');

    assert.equal(readSessionToken(`${forged}.${signature}`, SECRET), null);
  });

  it('rejette un jeton périmé', () => {
    const token = issueSessionToken('0555123456', SECRET, -1);
    assert.equal(readSessionToken(token, SECRET), null);
  });

  it('rejette une chaîne qui n’est pas un jeton', () => {
    for (const value of ['', 'abc', 'a.b.c', '.', 'eyJhIjoxfQ']) {
      assert.equal(readSessionToken(value, SECRET), null);
    }
  });
});
