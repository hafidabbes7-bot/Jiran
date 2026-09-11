import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import { openDatabase } from './db.js';
import { ContentRepository } from './repository.js';

describe('migration vers l’identifiant', () => {
  it('garde les comptes d’une base née avec « phone »', () => {
    const fichier = join(mkdtempSync(join(tmpdir(), 'jiran-')), 'ancienne.db');

    // Une base telle qu'elle existait avant l'e-mail.
    const ancienne = new DatabaseSync(fichier);
    ancienne.exec(`
      CREATE TABLE members (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL UNIQUE,
        first_name TEXT NOT NULL,
        neighborhood_id TEXT NOT NULL,
        building TEXT,
        joined_at TEXT NOT NULL
      );
      INSERT INTO members VALUES ('m1', '0555112233', 'Hafid', 'bejaia-centre', NULL, '2026-01-01T10:00:00.000Z');
    `);
    ancienne.close();

    const db = openDatabase(fichier);
    const membre = new ContentRepository(db).findMemberByIdentifier('0555112233');
    assert.equal(membre?.id, 'm1', 'le compte garde son identifiant interne');
    assert.equal(membre?.identifierKind, 'phone');
    assert.equal(membre?.firstName, 'Hafid');
    db.close();

    // Ouvrir deux fois de suite ne doit pas rejouer la migration.
    const rouverte = openDatabase(fichier);
    assert.equal(new ContentRepository(rouverte).findMemberByIdentifier('0555112233')?.id, 'm1');
    rouverte.close();
  });

  it('accepte une adresse comme identifiant', () => {
    const repository = new ContentRepository(openDatabase(':memory:'));
    const membre = repository.saveMember({
      identifier: 'hafid@example.com',
      firstName: 'Hafid',
      neighborhoodId: 'bejaia-centre',
    });

    assert.equal(membre.identifierKind, 'email');
    assert.equal(repository.findMemberByIdentifier('hafid@example.com')?.id, membre.id);
  });
});
