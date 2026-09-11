import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

process.env.OTP_SECRET = 'secret-otp-de-test-suffisamment-long-123';
process.env.SESSION_SECRET = 'secret-session-de-test-assez-long-12345';

/** Un voisin inscrit, avec son jeton de session. */
interface Voisin {
  token: string;
  nom: string;
}

describe('fil de quartier partagé', () => {
  let baseUrl: string;
  let server: { close: (cb: (error?: Error) => void) => void; address: () => unknown };
  let issue: (phone: string) => string;

  const call = async (
    method: string,
    path: string,
    voisin?: Voisin,
    body?: unknown
  ): Promise<{ status: number; data: any }> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(voisin ? { Authorization: `Bearer ${voisin.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json().catch(() => null);
    return { status: response.status, data };
  };

  /** Inscrit un voisin : numéro vérifié puis profil créé. */
  const inscrire = async (phone: string, nom: string, quartier = 'bab-ezzouar') => {
    const voisin: Voisin = { token: issue(phone), nom };
    const { status } = await call('POST', '/profile', voisin, {
      firstName: nom,
      neighborhoodId: quartier,
    });
    assert.equal(status, 200);
    return voisin;
  };

  before(async () => {
    const { createServer } = await import('../server.js');
    const { InMemoryChallengeStore } = await import('../otp/store.js');
    const { issueSessionToken } = await import('../session.js');
    const { config } = await import('../config.js');

    issue = (phone: string) => issueSessionToken(phone, config.sessionSecret, 1);

    const app = createServer({
      store: new InMemoryChallengeStore(),
      providers: {},
      databasePath: ':memory:',
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve()) as never;
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('refuse tout accès sans jeton valable', async () => {
    assert.equal((await call('GET', '/feed')).status, 401);
    assert.equal((await call('GET', '/feed', { token: 'faux', nom: '' })).status, 401);
  });

  it('demande un profil à un numéro vérifié qui n’en a pas encore', async () => {
    const sansProfil: Voisin = { token: issue('0555000001'), nom: 'Sans profil' };
    const { status, data } = await call('GET', '/feed', sansProfil);

    assert.equal(status, 403);
    assert.equal(data.error, 'profile_required');
  });

  it('montre à un voisin ce qu’un autre publie', async () => {
    const karim = await inscrire('0555000010', 'Karim');
    const amina = await inscrire('0555000011', 'Amina');

    const publie = await call('POST', '/posts', karim, {
      category: 'entraide',
      text: 'Quelqu’un aurait une perceuse à me prêter ce week-end ?',
    });
    assert.equal(publie.status, 201);

    // C'est tout l'objet de l'application : le fil est commun.
    const vuParAmina = await call('GET', '/feed', amina);
    const post = vuParAmina.data.posts.find((p: any) => p.id === publie.data.id);

    assert.ok(post, 'la publication de Karim devrait apparaître chez Amina');
    assert.equal(post.authorName, 'Karim');
    assert.equal(post.authorIsMe, false);
    assert.equal(post.likes, 0);
  });

  it('refuse une publication au texte inapproprié, même si le client l’accepte', async () => {
    const voisin = await inscrire('0555000020', 'Test');

    const { status, data } = await call('POST', '/posts', voisin, {
      category: 'entraide',
      text: 'espèce de c0nnard',
    });

    assert.equal(status, 422);
    assert.equal(data.error, 'inappropriate_text');
  });

  it('compte les « j’aime » de chacun une seule fois', async () => {
    const auteur = await inscrire('0555000030', 'Auteur');
    const lecteur = await inscrire('0555000031', 'Lecteur');

    const { data } = await call('POST', '/posts', auteur, {
      category: 'annonce',
      text: 'Je donne une table basse en bon état.',
    });

    await call('POST', `/posts/${data.id}/like`, lecteur, { liked: true });
    await call('POST', `/posts/${data.id}/like`, lecteur, { liked: true });

    const feed = await call('GET', '/feed', lecteur);
    const post = feed.data.posts.find((p: any) => p.id === data.id);
    assert.equal(post.likes, 1);
    assert.equal(post.likedByMe, true);

    await call('POST', `/posts/${data.id}/like`, lecteur, { liked: false });
    const apres = await call('GET', '/feed', lecteur);
    assert.equal(apres.data.posts.find((p: any) => p.id === data.id).likes, 0);
  });

  it('masque une publication signalée par 3 voisins différents', async () => {
    const auteur = await inscrire('0555000040', 'Auteur');
    const un = await inscrire('0555000041', 'Un');
    const deux = await inscrire('0555000042', 'Deux');
    const trois = await inscrire('0555000043', 'Trois');

    const { data } = await call('POST', '/posts', auteur, {
      category: 'annonce',
      text: 'Publication qui va être signalée par le quartier.',
    });

    const premier = await call('POST', `/posts/${data.id}/report`, un, { reason: 'spam' });
    assert.equal(premier.status, 201);
    assert.equal(premier.data.moderation.hidden, false);

    // Le même voisin qui insiste ne fait pas avancer le compteur.
    const doublon = await call('POST', `/posts/${data.id}/report`, un, { reason: 'spam' });
    assert.equal(doublon.status, 409);
    assert.equal(doublon.data.moderation.cycles, 0);

    await call('POST', `/posts/${data.id}/report`, deux, { reason: 'inapproprie' });
    const troisieme = await call('POST', `/posts/${data.id}/report`, trois, {
      reason: 'inapproprie',
    });

    assert.equal(troisieme.data.moderation.cycles, 1);
    assert.equal(troisieme.data.moderation.hidden, true);
    assert.equal(troisieme.data.moderation.permanent, false);

    // Le fil de tout le quartier porte le verdict, pas seulement celui qui a signalé.
    const feed = await call('GET', '/feed', auteur);
    assert.equal(feed.data.posts.find((p: any) => p.id === data.id).moderation.hidden, true);

    // Et on ne peut plus répondre sous un contenu masqué.
    const reponse = await call('POST', `/posts/${data.id}/comments`, un, { text: 'bonjour' });
    assert.equal(reponse.status, 409);
  });

  it('bloque définitivement à la récidive', async () => {
    const auteur = await inscrire('0555000050', 'Auteur');
    const voisins = await Promise.all(
      Array.from({ length: 6 }, (_, i) => inscrire(`055500006${i}`, `Voisin ${i}`))
    );

    const { data } = await call('POST', '/posts', auteur, {
      category: 'annonce',
      text: 'Publication signalée deux fois de suite.',
    });

    let dernier;
    for (const voisin of voisins) {
      dernier = await call('POST', `/posts/${data.id}/report`, voisin, { reason: 'spam' });
    }

    assert.equal(dernier!.data.moderation.cycles, 2);
    assert.equal(dernier!.data.moderation.permanent, true);
    assert.equal(dernier!.data.moderation.hiddenUntil, undefined);
  });

  it('ne mélange pas les fils de deux quartiers éloignés', async () => {
    const alger = await inscrire('0555000070', 'Alger', 'alger-centre');
    const blida = await inscrire('0555000071', 'Blida', 'blida-centre');

    const { data } = await call('POST', '/posts', alger, {
      category: 'evenement',
      text: 'Nettoyage du quartier samedi matin.',
    });

    const vuDeBlida = await call('GET', '/feed', blida);
    assert.equal(
      vuDeBlida.data.posts.some((p: any) => p.id === data.id),
      false
    );
  });

  it('partage le fil entre cités jumelées, en gardant l’origine', async () => {
    const rouiba = await inscrire('0555000080', 'Rouiba', 'rouiba');
    const darElBeida = await inscrire('0555000081', 'Dar El Beïda', 'dar-el-beida');

    const { data } = await call('POST', '/posts', rouiba, {
      category: 'securite',
      text: 'Coupure d’eau annoncée pour demain matin.',
    });

    const vu = await call('GET', '/feed', darElBeida);
    const post = vu.data.posts.find((p: any) => p.id === data.id);

    assert.ok(post, 'le fil devrait être partagé avec la cité jumelée');
    // L'origine exacte reste affichée (§2 du cahier des charges).
    assert.equal(post.neighborhoodId, 'rouiba');
  });

  it('liste les voisins du fil sans s’y inclure', async () => {
    const moi = await inscrire('0555000090', 'Moi', 'kouba');
    const autre = await inscrire('0555000091', 'Autre', 'kouba');

    const { data } = await call('GET', '/neighbors', moi);
    const noms = data.neighbors.map((n: any) => n.name);

    assert.ok(noms.includes('Autre'));
    assert.equal(noms.includes('Moi'), false);
    assert.ok(autre);
  });

  it('enchaîne une réponse et son décompte', async () => {
    const auteur = await inscrire('0555000100', 'Auteur');
    const lecteur = await inscrire('0555000101', 'Lecteur');

    const { data } = await call('POST', '/posts', auteur, {
      category: 'entraide',
      text: 'Quelqu’un a vu un trousseau de clés près du parc ?',
    });

    await call('POST', `/posts/${data.id}/comments`, lecteur, {
      text: 'Oui, je l’ai déposé à la pharmacie.',
    });

    const comments = await call('GET', `/posts/${data.id}/comments`, auteur);
    assert.equal(comments.data.comments.length, 1);
    assert.equal(comments.data.comments[0].authorName, 'Lecteur');

    const feed = await call('GET', '/feed', auteur);
    assert.equal(feed.data.posts.find((p: any) => p.id === data.id).commentCount, 1);
  });
});
