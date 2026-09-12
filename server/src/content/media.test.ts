import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openTestDb } from '../db/testDb.js';
import { MAX_PHOTO_BYTES, MediaService, STORY_WINDOW_MS } from './media.js';
import { ContentRepository, type Member } from './repository.js';

const image = (taille: number) => new Uint8Array(taille).fill(7);

describe('photos et stories', () => {
  let media: MediaService;
  let content: ContentRepository;
  let hafid: Member;
  let salim: Member;
  let karim: Member;

  beforeEach(async () => {
    const db = await openTestDb();
    content = new ContentRepository(db);
    media = new MediaService(db);
    hafid = (await content.saveMember({ identifier: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' }));
    salim = (await content.saveMember({ identifier: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' }));
    karim = (await content.saveMember({ identifier: '0555000003', firstName: 'Karim', neighborhoodId: 'oran' }));
  });

  it('enregistre une photo et la rend au quartier, à lui seul', async () => {
    const saved = (await media.savePhoto(hafid, 'image/jpeg', image(1024)));
    assert.notEqual(typeof saved, 'string');
    if (typeof saved === 'string') return;

    const vue = (await media.photo(salim, saved.id));
    assert.notEqual(typeof vue, 'string');
    if (typeof vue === 'string') return;
    assert.equal(vue.kind, 'bytes', 'sans Supabase, les octets restent en base');
    if (vue.kind !== 'bytes') return;
    assert.equal(vue.mime, 'image/jpeg');
    assert.equal(vue.bytes.byteLength, 1024);

    assert.equal((await media.photo(karim, saved.id)), 'introuvable', 'un autre quartier ne la voit pas');
  });

  it('refuse un format inconnu et une photo trop lourde', async () => {
    assert.equal((await media.savePhoto(hafid, 'image/gif', image(10))), 'format_refuse');
    assert.equal((await media.savePhoto(hafid, 'application/pdf', image(10))), 'format_refuse');
    assert.equal((await media.savePhoto(hafid, 'image/jpeg', image(MAX_PHOTO_BYTES + 1))), 'trop_lourde');
  });

  it('n’accroche pas la photo d’un voisin à sa propre publication', async () => {
    const saved = (await media.savePhoto(hafid, 'image/jpeg', image(64)));
    if (typeof saved === 'string') return;

    assert.equal((await media.ownsPhoto(hafid, saved.id)), true);
    assert.equal((await media.ownsPhoto(salim, saved.id)), false);
  });

  it('publie une story, visible du quartier pendant 24 heures', async () => {
    const photo = (await media.savePhoto(hafid, 'image/jpeg', image(64)));
    if (typeof photo === 'string') return;

    const story = (await media.addStory(hafid, { photoId: photo.id, text: 'Le marché ce matin' }));
    assert.notEqual(typeof story, 'string');

    const vues = (await media.stories(salim));
    assert.equal(vues.length, 1);
    assert.equal(vues[0]!.authorName, 'Hafid');
    assert.equal(vues[0]!.authorIsMe, false);
    assert.equal((await media.stories(hafid))[0]!.authorIsMe, true);
    assert.equal((await media.stories(karim)).length, 0, 'un autre quartier ne la voit pas');

    const demain = new Date(Date.now() + STORY_WINDOW_MS + 1000);
    assert.equal((await media.stories(salim, demain)).length, 0, 'passé 24 h, elle disparaît');
  });

  it('applique le filtre de texte aux stories', async () => {
    assert.equal((await media.addStory(hafid, { text: 'espèce de connard' })), 'texte_refuse');
  });

  it('ne laisse retirer que sa propre story', async () => {
    const story = (await media.addStory(hafid, { text: 'Bonjour le quartier' }));
    if (typeof story === 'string') return;

    assert.equal((await media.removeStory(salim, story.id)), false);
    assert.equal((await media.removeStory(hafid, story.id)), true);
    assert.equal((await media.stories(hafid)).length, 0);
  });
});
