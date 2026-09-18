import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

import { openTestDb } from '../db/testDb.js';
import type { MessageProvider } from '../messaging/provider.js';
import { InMemoryChallengeStore } from '../otp/store.js';
import { createServer } from '../server.js';

/** Boîte aux lettres d'essai : on lit ce qui serait parti. */
class BoiteAuxLettres implements MessageProvider {
  readonly name = 'boite-essai';
  readonly envoyes: { to: string; message: string }[] = [];
  échoue = false;

  async send(params: { to: string; message: string }): Promise<void> {
    if (this.échoue) throw new Error('boîte pleine');
    this.envoyes.push(params);
  }

  /** Le lien contenu dans le dernier message. */
  dernierLien(): string {
    const message = this.envoyes.at(-1)?.message ?? '';
    return /https?:\/\/\S+/.exec(message)?.[0] ?? '';
  }

  dernierJeton(): string {
    return new URL(this.dernierLien()).searchParams.get('token') ?? '';
  }
}

describe('comptes par e-mail, de bout en bout', () => {
  let baseUrl: string;
  let server: { close: (cb: (error?: Error) => void) => void; address: () => unknown };
  const boite = new BoiteAuxLettres();

  const poster = (chemin: string, corps: unknown) =>
    fetch(`${baseUrl}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });

  before(async () => {
    const app = await createServer({
      store: new InMemoryChallengeStore(),
      providers: { email: boite },
      db: await openTestDb(),
      push: { name: 'test', delivers: false, send: async () => {} },
      // La suite tape bien plus vite qu'un voisin ; le plafond par IP est
      // éprouvé à part, dans rateLimit.test.ts.
      authRequestsPerMinute: 10_000,
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve()) as never;
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  const adresse = () => `voisin.${Math.random().toString(36).slice(2)}@example.com`;
  const MDP = 'perceuse-bejaia-2026';

  it('inscrit, envoie un lien, et ne laisse entrer qu’après confirmation', async () => {
    const email = adresse();

    const inscription = await poster('/auth/register', { email, password: MDP });
    assert.equal(inscription.status, 201);
    assert.deepEqual(await inscription.json(), { ok: true, emailSent: true });

    const message = boite.envoyes.at(-1)!;
    assert.equal(message.to, email);
    assert.match(message.message, /Bienvenue sur Jiran/);
    assert.match(boite.dernierLien(), /\/auth\/confirm\?token=/);

    // Avant d'ouvrir le lien : porte fermée.
    const refus = await poster('/auth/login', { email, password: MDP });
    assert.equal(refus.status, 403);
    assert.deepEqual(await refus.json(), { error: 'adresse_non_confirmee' });

    // Le lien s'ouvre dans un navigateur et rend une page lisible.
    const page = await fetch(boite.dernierLien());
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.match(await page.text(), /Adresse confirmée/);

    const connexion = await poster('/auth/login', { email, password: MDP });
    assert.equal(connexion.status, 200);
    const session = (await connexion.json()) as { token: string; identifierKind: string };
    assert.equal(session.identifierKind, 'email');
    assert.ok(session.token, 'un jeton de session est délivré');

    // Et ce jeton vaut pour tout le reste de l'application.
    const moi = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${session.token}` },
    });
    assert.equal(moi.status, 200);
    assert.deepEqual((await moi.json()) as Record<string, unknown>, {
      phone: email,
      identifier: email,
      identifierKind: 'email',
    });
  });

  it('crée un vrai compte en base, qui survit à la session', async () => {
    const email = adresse();
    await poster('/auth/register', { email, password: MDP });
    await fetch(boite.dernierLien());

    // Deux connexions successives rendent deux jetons : la preuve est en base,
    // pas dans l'appareil.
    const première = await poster('/auth/login', { email, password: MDP });
    const seconde = await poster('/auth/login', { email, password: MDP });
    assert.equal(première.status, 200);
    assert.equal(seconde.status, 200);
  });

  it('refuse un mot de passe faux, sans dire si l’adresse existe', async () => {
    const email = adresse();
    await poster('/auth/register', { email, password: MDP });
    await fetch(boite.dernierLien());

    const faux = await poster('/auth/login', { email, password: 'pas-le-bon-du-tout' });
    const inconnu = await poster('/auth/login', { email: adresse(), password: MDP });

    assert.equal(faux.status, 401);
    assert.equal(inconnu.status, 401);
    assert.deepEqual(await faux.json(), await inconnu.json(), 'même réponse, mot pour mot');
  });

  it('répond pareil que l’adresse soit libre ou déjà prise', async () => {
    const email = adresse();
    const première = await poster('/auth/register', { email, password: MDP });
    await fetch(boite.dernierLien());

    const envoyésAvant = boite.envoyes.length;
    const seconde = await poster('/auth/register', { email, password: 'un-autre-mot-de-passe' });

    assert.equal(seconde.status, première.status);
    assert.deepEqual(await seconde.json(), { ok: true, emailSent: true });
    assert.equal(boite.envoyes.length, envoyésAvant, 'et rien n’est envoyé au vrai titulaire');

    // Le mot de passe d'origine n'a pas été écrasé.
    assert.equal((await poster('/auth/login', { email, password: MDP })).status, 200);
  });

  it('refuse un mot de passe trop court ou trop courant', async () => {
    const court = await poster('/auth/register', { email: adresse(), password: 'court' });
    assert.equal(court.status, 400);
    assert.deepEqual(await court.json(), { error: 'mot_de_passe_trop_court' });

    const courant = await poster('/auth/register', { email: adresse(), password: 'motdepasse' });
    assert.equal(courant.status, 400);
    assert.deepEqual(await courant.json(), { error: 'mot_de_passe_trop_courant' });
  });

  it('refuse une adresse qui n’en est pas une', async () => {
    const réponse = await poster('/auth/register', { email: 'pas-une-adresse', password: MDP });
    assert.equal(réponse.status, 400);
    assert.deepEqual(await réponse.json(), { error: 'adresse_invalide' });
  });

  it('renvoie un lien de confirmation à qui le demande', async () => {
    const email = adresse();
    await poster('/auth/register', { email, password: MDP });
    const premier = boite.dernierJeton();

    const renvoi = await poster('/auth/resend-confirmation', { email });
    assert.equal(renvoi.status, 200);
    const second = boite.dernierJeton();
    assert.notEqual(second, premier, 'un nouveau jeton');

    // L'ancien ne vaut plus rien, le nouveau confirme.
    const ancien = await fetch(`${baseUrl}/auth/confirm?token=${encodeURIComponent(premier)}`);
    assert.equal(ancien.status, 400);
    assert.match(await ancien.text(), /déjà utilisé/);
    assert.equal((await fetch(boite.dernierLien())).status, 200);
  });

  it('reste muet quand on demande un renvoi pour une adresse inconnue', async () => {
    const avant = boite.envoyes.length;
    const réponse = await poster('/auth/resend-confirmation', { email: adresse() });

    assert.equal(réponse.status, 200);
    assert.equal(boite.envoyes.length, avant, 'rien n’est parti');
  });

  it('change le mot de passe oublié, par la page du lien', async () => {
    const email = adresse();
    await poster('/auth/register', { email, password: MDP });
    await fetch(boite.dernierLien());

    const oubli = await poster('/auth/forgot-password', { email });
    assert.equal(oubli.status, 200);
    assert.match(boite.envoyes.at(-1)!.message, /changer ton mot de passe/);

    // La page s'ouvre dans un navigateur, sans l'application.
    const lien = boite.dernierLien();
    assert.match(lien, /\/auth\/reset\?token=/);
    const page = await fetch(lien);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Nouveau mot de passe/);

    const nouveau = 'le-nouveau-mot-de-passe-2026';
    const changement = await poster('/auth/reset-password', {
      token: boite.dernierJeton(),
      password: nouveau,
    });
    assert.equal(changement.status, 200);

    assert.equal((await poster('/auth/login', { email, password: nouveau })).status, 200);
    assert.equal((await poster('/auth/login', { email, password: MDP })).status, 401);
  });

  it('bloque après une série de mots de passe faux', async () => {
    const email = adresse();
    await poster('/auth/register', { email, password: MDP });
    await fetch(boite.dernierLien());

    for (let essai = 0; essai < 6; essai += 1) {
      await poster('/auth/login', { email, password: `faux-${essai}-essai` });
    }

    const bloqué = await poster('/auth/login', { email, password: MDP });
    assert.equal(bloqué.status, 429);
    assert.deepEqual(await bloqué.json(), { error: 'compte_bloque' });
  });

  it('annonce sur /health qu’il sait envoyer les liens', async () => {
    const santé = (await (await fetch(`${baseUrl}/health`)).json()) as {
      emailAccounts: { enabled: boolean; canSendLinks: boolean };
    };
    assert.deepEqual(santé.emailAccounts, { enabled: true, canSendLinks: true });
  });
});
