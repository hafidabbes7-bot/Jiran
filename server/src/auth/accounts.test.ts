import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import type { Db } from '../db/client.js';
import { openTestDb } from '../db/testDb.js';
import { AccountService } from './accounts.js';
import { hacherMotDePasse, motDePasseCorrespond, refuserMotDePasse } from './password.js';

const ADRESSE = 'hafid@example.com';
const MOT_DE_PASSE = 'perceuse-bejaia-2026';

describe('mots de passe', () => {
  it('ne rend jamais deux fois la même empreinte', async () => {
    const a = await hacherMotDePasse(MOT_DE_PASSE);
    const b = await hacherMotDePasse(MOT_DE_PASSE);
    assert.notEqual(a, b, 'le sel diffère');
    assert.equal(await motDePasseCorrespond(MOT_DE_PASSE, a), true);
    assert.equal(await motDePasseCorrespond(MOT_DE_PASSE, b), true);
  });

  it('refuse un mot de passe faux, et une empreinte abîmée', async () => {
    const empreinte = await hacherMotDePasse(MOT_DE_PASSE);
    assert.equal(await motDePasseCorrespond('autre-chose-ici', empreinte), false);
    assert.equal(await motDePasseCorrespond(MOT_DE_PASSE, 'n’importe quoi'), false);
    assert.equal(await motDePasseCorrespond(MOT_DE_PASSE, ''), false);
  });

  it('ne garde jamais le mot de passe en clair dans l’empreinte', async () => {
    assert.equal((await hacherMotDePasse(MOT_DE_PASSE)).includes(MOT_DE_PASSE), false);
  });

  it('écarte ce qui est trop court ou trop courant', () => {
    assert.equal(refuserMotDePasse('court'), 'trop_court');
    assert.equal(refuserMotDePasse('motdepasse'), 'trop_courant');
    assert.equal(refuserMotDePasse('MotDePasse'), 'trop_courant', 'la casse ne sauve rien');
    assert.equal(refuserMotDePasse('a'.repeat(300)), 'trop_long');
    assert.equal(refuserMotDePasse(MOT_DE_PASSE), undefined);
  });

  it('traite deux écritures Unicode du même mot de passe comme une seule', async () => {
    // « é » composé d'un seul caractère, ou de « e » + accent : deux claviers,
    // le même mot de passe aux yeux de qui le tape.
    const empreinte = await hacherMotDePasse('café-du-quartier');
    assert.equal(await motDePasseCorrespond('café-du-quartier', empreinte), true);
  });
});

describe('comptes par e-mail', () => {
  let db: Db;
  let comptes: AccountService;

  beforeEach(async () => {
    db = await openTestDb();
    comptes = new AccountService(db);
  });

  it('inscrit, puis laisse entrer une fois le lien ouvert', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    assert.equal(inscription.ok, true);
    assert.ok(inscription.ok && inscription.lien, 'un lien est à envoyer');

    // Tant que le lien n'est pas ouvert, la porte reste fermée.
    const avant = await comptes.connecter(ADRESSE, MOT_DE_PASSE);
    assert.deepEqual(avant, { ok: false, raison: 'adresse_non_confirmee' });

    const confirmé = await comptes.confirmer(inscription.lien!.jeton);
    assert.deepEqual(confirmé, { ok: true, identifier: ADRESSE });

    const après = await comptes.connecter(ADRESSE, MOT_DE_PASSE);
    assert.deepEqual(après, { ok: true, identifier: ADRESSE });
  });

  it('ne garde le mot de passe nulle part en clair', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    assert.equal(inscription.ok, true);

    const lignes = await db.query<{ password_hash: string }>(
      'SELECT password_hash FROM credentials'
    );
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0]!.password_hash.includes(MOT_DE_PASSE), false);
    assert.match(lignes[0]!.password_hash, /^scrypt\$/);
  });

  it('ne garde pas non plus le jeton du lien en clair', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    const jeton = (inscription as { lien: { jeton: string } }).lien.jeton;

    const lignes = await db.query<{ token_hash: string }>('SELECT token_hash FROM email_tokens');
    assert.equal(lignes.length, 1);
    assert.notEqual(lignes[0]!.token_hash, jeton, 'la base n’a que l’empreinte');
  });

  it('ignore la casse et les espaces de l’adresse', async () => {
    const inscription = await comptes.inscrire('  HaFiD@Example.COM  ', MOT_DE_PASSE);
    await comptes.confirmer((inscription as { lien: { jeton: string } }).lien.jeton);

    const connexion = await comptes.connecter('hafid@example.com', MOT_DE_PASSE);
    assert.deepEqual(connexion, { ok: true, identifier: ADRESSE });
  });

  it('brûle le lien après usage', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    const jeton = (inscription as { lien: { jeton: string } }).lien.jeton;

    assert.equal((await comptes.confirmer(jeton)).ok, true);
    assert.deepEqual(await comptes.confirmer(jeton), {
      ok: false,
      raison: 'jeton_deja_utilise',
    });
  });

  it('refuse un lien périmé, et un lien inventé', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    const jeton = (inscription as { lien: { jeton: string } }).lien.jeton;

    const dansDeuxJours = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    assert.deepEqual(await comptes.confirmer(jeton, dansDeuxJours), {
      ok: false,
      raison: 'jeton_expire',
    });
    assert.deepEqual(await comptes.confirmer('jeton-invente'), {
      ok: false,
      raison: 'jeton_inconnu',
    });
  });

  it('n’a qu’un seul lien valide à la fois', async () => {
    const première = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    const ancien = (première as { lien: { jeton: string } }).lien.jeton;

    const renvoi = await comptes.renvoyerConfirmation(ADRESSE);
    assert.ok(renvoi, 'un nouveau lien part');

    assert.deepEqual(await comptes.confirmer(ancien), {
      ok: false,
      raison: 'jeton_deja_utilise',
    });
    assert.equal((await comptes.confirmer(renvoi!.jeton)).ok, true);
  });

  it('ne dit pas qui a un compte', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    await comptes.confirmer((inscription as { lien: { jeton: string } }).lien.jeton);

    // Se réinscrire sur une adresse confirmée : réponse identique à une
    // inscription neuve, et rien n'est envoyé ni modifié.
    const seconde = await comptes.inscrire(ADRESSE, 'un-autre-mot-de-passe');
    assert.deepEqual(seconde, { ok: true });

    // Et le mot de passe d'origine marche toujours : personne n'a pu l'écraser.
    assert.equal((await comptes.connecter(ADRESSE, MOT_DE_PASSE)).ok, true);
    assert.equal((await comptes.connecter(ADRESSE, 'un-autre-mot-de-passe')).ok, false);
  });

  it('reste muet sur une adresse inconnue', async () => {
    assert.equal(await comptes.renvoyerConfirmation('personne@example.com'), undefined);
    assert.equal(await comptes.demanderReinitialisation('personne@example.com'), undefined);
    assert.deepEqual(await comptes.connecter('personne@example.com', MOT_DE_PASSE), {
      ok: false,
      raison: 'identifiants_refuses',
    });
  });

  it('bloque après six mots de passe faux, puis rouvre', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    await comptes.confirmer((inscription as { lien: { jeton: string } }).lien.jeton);

    for (let essai = 1; essai <= 5; essai += 1) {
      assert.deepEqual(await comptes.connecter(ADRESSE, 'faux-mot-de-passe'), {
        ok: false,
        raison: 'identifiants_refuses',
      });
    }
    // Le sixième ferme la porte…
    await comptes.connecter(ADRESSE, 'faux-mot-de-passe');
    assert.deepEqual(await comptes.connecter(ADRESSE, MOT_DE_PASSE), {
      ok: false,
      raison: 'compte_bloque',
    });

    // …et elle se rouvre d'elle-même un quart d'heure plus tard.
    const plusTard = new Date(Date.now() + 16 * 60 * 1000);
    assert.deepEqual(await comptes.connecter(ADRESSE, MOT_DE_PASSE, plusTard), {
      ok: true,
      identifier: ADRESSE,
    });
  });

  it('change le mot de passe par un lien, et invalide l’ancien', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    await comptes.confirmer((inscription as { lien: { jeton: string } }).lien.jeton);

    const lien = await comptes.demanderReinitialisation(ADRESSE);
    assert.ok(lien);

    const nouveau = 'nouveau-mot-de-passe-du-quartier';
    assert.deepEqual(await comptes.reinitialiser(lien!.jeton, nouveau), {
      ok: true,
      identifier: ADRESSE,
    });

    assert.equal((await comptes.connecter(ADRESSE, nouveau)).ok, true);
    assert.deepEqual(await comptes.connecter(ADRESSE, MOT_DE_PASSE), {
      ok: false,
      raison: 'identifiants_refuses',
    });
  });

  it('refuse de réinitialiser vers un mot de passe trop faible', async () => {
    const inscription = await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    await comptes.confirmer((inscription as { lien: { jeton: string } }).lien.jeton);
    const lien = await comptes.demanderReinitialisation(ADRESSE);

    assert.deepEqual(await comptes.reinitialiser(lien!.jeton, 'court'), {
      ok: false,
      raison: 'mot_de_passe_trop_court',
    });
    // Le lien n'a pas été consommé par un refus : il marche encore.
    assert.equal((await comptes.reinitialiser(lien!.jeton, 'un-mot-de-passe-correct')).ok, true);
  });

  it('refuse une adresse qui n’en est pas une', async () => {
    assert.deepEqual(await comptes.inscrire('pas-une-adresse', MOT_DE_PASSE), {
      ok: false,
      raison: 'adresse_invalide',
    });
  });

  it('oublie les jetons périmés', async () => {
    await comptes.inscrire(ADRESSE, MOT_DE_PASSE);
    assert.equal(await comptes.oublierJetonsPerimes(), 0, 'rien de périmé tout de suite');

    const dansDeuxJours = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    assert.equal(await comptes.oublierJetonsPerimes(dansDeuxJours), 1);
    assert.deepEqual(await db.query('SELECT 1 FROM email_tokens'), []);
  });
});
