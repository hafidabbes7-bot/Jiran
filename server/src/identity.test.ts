import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isValidEmail,
  isValidIdentifier,
  kindOf,
  maskIdentifier,
  normalizeEmail,
  normalizeIdentifier,
} from './identity.js';

describe('identifiant d’un voisin', () => {
  it('accepte une adresse ordinaire et refuse ce qui n’en est pas une', () => {
    assert.equal(isValidEmail('hafid@example.com'), true);
    assert.equal(isValidEmail('hafid.abbes+jiran@mail.dz'), true);
    assert.equal(isValidEmail('hafid@example'), false);
    assert.equal(isValidEmail('hafid example.com'), false);
    assert.equal(isValidEmail(''), false);
    assert.equal(isValidEmail(`${'a'.repeat(250)}@example.com`), false);
  });

  it('ramène deux graphies d’une même adresse au même compte', () => {
    assert.equal(normalizeEmail('  Hafid@Example.COM '), 'hafid@example.com');
  });

  it('distingue un numéro d’une adresse', () => {
    assert.equal(kindOf('0555112233'), 'phone');
    assert.equal(kindOf('hafid@example.com'), 'email');
    assert.equal(isValidIdentifier('0555112233', 'phone'), true);
    assert.equal(isValidIdentifier('0555112233', 'email'), false);
    assert.equal(normalizeIdentifier('+213555112233', 'phone'), '0555112233');
  });

  it('ne met ni numéro ni adresse entière dans un journal', () => {
    assert.equal(maskIdentifier('0555112233').includes('112233'), false);
    const masqué = maskIdentifier('hafid@example.com');
    assert.equal(masqué.startsWith('ha'), true);
    assert.equal(masqué.includes('fid'), false);
    assert.equal(masqué.endsWith('@example.com'), true);
  });
});
