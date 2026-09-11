import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidAlgerianMobile, maskPhone, normalizePhone, toE164 } from './phone.js';

describe('numéros algériens', () => {
  it('normalise les formats internationaux', () => {
    assert.equal(normalizePhone('+213 555 12 34 56'), '0555123456');
    assert.equal(normalizePhone('00213661234567'), '0661234567');
    assert.equal(normalizePhone('213771234567'), '0771234567');
    assert.equal(normalizePhone('05 55 12 34 56'), '0555123456');
  });

  it('accepte les préfixes mobiles', () => {
    for (const number of ['0555123456', '0661234567', '0771234567']) {
      assert.equal(isValidAlgerianMobile(number), true);
    }
  });

  it('refuse le fixe et les numéros mal formés', () => {
    for (const number of ['0212345678', '055512345', '0123456789', '', 'abcdefghij']) {
      assert.equal(isValidAlgerianMobile(number), false);
    }
  });

  it('produit la forme internationale attendue par les passerelles', () => {
    assert.equal(toE164('0555123456'), '+213555123456');
    assert.equal(toE164('+213555123456'), '+213555123456');
  });

  it('masque le numéro pour les journaux', () => {
    const masked = maskPhone('0555123456');
    assert.equal(masked.includes('12345'), false);
    assert.equal(masked, '0555****56');
  });
});
