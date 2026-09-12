import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { avertissementsAdresse, sslFor } from './client.js';

describe('adresse de la base', () => {
  it('chiffre la liaison hors de la machine, et pas dedans', () => {
    assert.equal(sslFor('postgresql://localhost/jiran'), false);
    assert.equal(sslFor('postgresql://127.0.0.1:5432/jiran'), false);
    assert.deepEqual(sslFor('postgresql://u:p@aws-0-eu-central-1.pooler.supabase.com/postgres'), {
      rejectUnauthorized: false,
    });
  });

  it('prévient que l’adresse directe de Supabase est injoignable depuis Render', () => {
    const avertissements = avertissementsAdresse(
      'postgresql://postgres:secret@db.abcdefgh.supabase.co:5432/postgres'
    );
    assert.equal(avertissements.length, 1);
    assert.match(avertissements[0]!, /IPv6/);
    assert.match(avertissements[0]!, /pooler\.supabase\.com/);
  });

  it('ne dit rien de l’adresse du pooler, qui est la bonne', () => {
    assert.deepEqual(
      avertissementsAdresse(
        'postgresql://postgres.abc:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
      ),
      []
    );
  });

  it('repère un mot de passe laissé en gabarit', () => {
    const avertissements = avertissementsAdresse(
      'postgresql://postgres.abc:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
    );
    assert.equal(avertissements.length, 1);
    assert.match(avertissements[0]!, /mot de passe/);
  });

  it('le dit quand ce n’est pas une adresse du tout', () => {
    assert.match(avertissementsAdresse('mon mot de passe')[0]!, /URL PostgreSQL/);
  });
});
