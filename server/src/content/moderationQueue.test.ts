import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';

process.env.OTP_SECRET = 'secret-otp-de-test-suffisamment-long-123';
process.env.SESSION_SECRET = 'secret-session-de-test-assez-long-12345';
// Le premier numéro est déclaré modérateur ; le second ne l'est pas.
process.env.MODERATOR_PHONES = '0555400001, +213555400002';

interface Voisin {
  token: string;
  nom: string;
  id: string;
}

describe('file de modération', () => {
  let baseUrl: string;
  let server: { close: (cb: (error?: Error) => void) => void; address: () => unknown };
  let issue: (phone: string) => string;
  let compteur = 10;

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

  const inscrire = async (nom: string, phone?: string) => {
    compteur += 1;
    const numero = phone ?? `05554000${String(compteur).padStart(2, '0')}`;
    const voisin: Voisin = { token: issue(numero), nom, id: '' };
    const profil = await call('POST', '/profile', voisin, {
      firstName: nom,
      neighborhoodId: 'bab-ezzouar',
    });
    voisin.id = profil.data.id;
    return { voisin, profil: profil.data };
  };

  /** Publie, puis fait signaler par trois voisins différents. */
  const publierEtSignaler = async (auteur: Voisin, texte: string) => {
    const { data } = await call('POST', '/posts', auteur, {
      category: 'annonce',
      text: texte,
    });

    for (let i = 0; i < 3; i += 1) {
      const { voisin } = await inscrire(`Signalant ${compteur}`);
      await call('POST', `/posts/${data.id}/report`, voisin, { reason: 'inapproprie' });
    }
    return String(data.id);
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
      push: { name: 'test', delivers: false, send: async () => {} },
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

  it('annonce à l’inscription qui est modérateur', async () => {
    const { profil: moderateur } = await inscrire('Modérateur', '0555400001');
    const { profil: ordinaire } = await inscrire('Ordinaire');

    assert.equal(moderateur.isModerator, true);
    assert.equal(ordinaire.isModerator, false);
  });

  it('reconnaît un modérateur quel que soit le format de son numéro', async () => {
    // Déclaré en +213…, connecté en 05…
    const { profil } = await inscrire('International', '0555400002');
    assert.equal(profil.isModerator, true);
  });

  it('ferme la file aux voisins ordinaires', async () => {
    const { voisin } = await inscrire('Curieux');

    const queue = await call('GET', '/moderation/queue', voisin);
    assert.equal(queue.status, 403);
    assert.equal(queue.data.error, 'not_moderator');

    const decision = await call('POST', '/moderation/posts/x/decision', voisin, {
      decision: 'restore',
    });
    assert.equal(decision.status, 403);
  });

  it('liste les contenus signalés avec leurs motifs', async () => {
    const { voisin: moderateur } = await inscrire('Modérateur bis', '0555400001');
    const { voisin: auteur } = await inscrire('Auteur file');
    const postId = await publierEtSignaler(auteur, 'Publication qui finit dans la file.');

    const { status, data } = await call('GET', '/moderation/queue', moderateur);
    assert.equal(status, 200);

    const entree = data.posts.find((post: any) => post.postId === postId);
    assert.ok(entree, 'la publication signalée devrait être dans la file');
    assert.equal(entree.authorName, 'Auteur file');
    assert.equal(entree.reports.length, 3);
    assert.equal(entree.moderation.hidden, true);
  });

  it('rétablit un contenu masqué à tort, sans le laisser se refermer', async () => {
    const { voisin: moderateur } = await inscrire('Modérateur ter', '0555400001');
    const { voisin: auteur } = await inscrire('Injustement signalé');
    const postId = await publierEtSignaler(auteur, 'Publication parfaitement correcte.');

    const avant = await call('GET', '/feed', auteur);
    assert.equal(avant.data.posts.find((p: any) => p.id === postId).moderation.hidden, true);

    const decision = await call('POST', `/moderation/posts/${postId}/decision`, moderateur, {
      decision: 'restore',
      note: 'Rien de répréhensible, signalements abusifs.',
    });
    assert.equal(decision.status, 200);
    assert.equal(decision.data.moderation.hidden, false);
    assert.equal(decision.data.moderation.decidedByModerator, 'restore');

    // Le fil de tout le quartier suit la décision du modérateur.
    const apres = await call('GET', '/feed', auteur);
    const post = apres.data.posts.find((p: any) => p.id === postId);
    assert.equal(post.moderation.hidden, false);

    // Et les anciens signalements ne le remasquent pas aussitôt.
    assert.equal(post.moderation.cycles, 0);
  });

  it('remasque si de nouveaux signalements arrivent après un rétablissement', async () => {
    const { voisin: moderateur } = await inscrire('Modérateur 4', '0555400001');
    const { voisin: auteur } = await inscrire('Récidiviste');
    const postId = await publierEtSignaler(auteur, 'Publication rétablie puis resignalée.');

    await call('POST', `/moderation/posts/${postId}/decision`, moderateur, {
      decision: 'restore',
    });

    // Trois nouveaux voisins, postérieurs à la décision.
    for (let i = 0; i < 3; i += 1) {
      const { voisin } = await inscrire(`Nouveau ${compteur}`);
      await call('POST', `/posts/${postId}/report`, voisin, { reason: 'spam' });
    }

    const feed = await call('GET', '/feed', auteur);
    assert.equal(feed.data.posts.find((p: any) => p.id === postId).moderation.hidden, true);
  });

  it('bloque définitivement sur décision, sans attendre le seuil', async () => {
    const { voisin: moderateur } = await inscrire('Modérateur 5', '0555400001');
    const { voisin: auteur } = await inscrire('Auteur bloqué');

    const { data } = await call('POST', '/posts', auteur, {
      category: 'annonce',
      text: 'Publication signalée une seule fois mais jugée inacceptable.',
    });
    const { voisin: signalant } = await inscrire('Unique signalant');
    await call('POST', `/posts/${data.id}/report`, signalant, { reason: 'inapproprie' });

    const avant = await call('GET', '/feed', auteur);
    assert.equal(avant.data.posts.find((p: any) => p.id === data.id).moderation.hidden, false);

    const decision = await call('POST', `/moderation/posts/${data.id}/decision`, moderateur, {
      decision: 'block',
    });
    assert.equal(decision.data.moderation.hidden, true);
    assert.equal(decision.data.moderation.permanent, true);
    assert.equal(decision.data.moderation.decidedByModerator, 'block');
  });

  it('refuse une décision sur une publication inexistante', async () => {
    const { voisin: moderateur } = await inscrire('Modérateur 6', '0555400001');
    const { status } = await call('POST', '/moderation/posts/inconnu/decision', moderateur, {
      decision: 'block',
    });
    assert.equal(status, 404);
  });
});
