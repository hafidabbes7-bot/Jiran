import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  avertissementsAdresse,
  connecter,
  serveurExigeTls,
  serveurSansTls,
  sslChoisiExplicitement,
  sslFor,
} from './client.js';

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

describe('négociation du chiffrement', () => {
  it('respecte ce que l’adresse impose, même en local', () => {
    assert.equal(sslFor('postgresql://localhost/jiran?sslmode=disable'), false);
    assert.deepEqual(sslFor('postgresql://localhost/jiran?sslmode=require'), {
      rejectUnauthorized: false,
    });
    assert.equal(sslChoisiExplicitement('postgresql://localhost/jiran'), false);
    assert.equal(sslChoisiExplicitement('postgresql://localhost/jiran?sslmode=require'), true);
  });

  it('reconnaît un serveur qui ne parle pas TLS', () => {
    assert.equal(
      serveurSansTls(new Error('The server does not support SSL connections')),
      true
    );
    assert.equal(serveurSansTls(new Error('password authentication failed')), false);
  });

  it('reconnaît un serveur qui l’exige', () => {
    assert.equal(
      serveurExigeTls(new Error('no pg_hba.conf entry for host "1.2.3.4", SSL off')),
      true
    );
    assert.equal(serveurExigeTls(new Error('connection refused')), false);
  });

  it('se connecte pour de vrai, et ne se laisse pas arrêter par le TLS', async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) return;

    // Cette base locale ne parle pas TLS. En exigeant le chiffrement par
    // déduction — hôte réputé public — la connexion doit malgré tout aboutir.
    const db = await connecter(url, 1);
    assert.deepEqual(await db.query('SELECT 1 AS n'), [{ n: 1 }]);
    await db.close();
  });
});
