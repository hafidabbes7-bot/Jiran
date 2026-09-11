import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import { openDatabase } from './db.js';
import { MAX_PHOTO_BYTES, MediaService, STORY_WINDOW_MS } from './media.js';
import { ContentRepository } from './repository.js';

const image = (taille: number) => new Uint8Array(taille).fill(7);

describe('photos et stories', () => {
  let media: MediaService;
  let content: ContentRepository;
  let hafid: ReturnType<ContentRepository['saveMember']>;
  let salim: ReturnType<ContentRepository['saveMember']>;
  let karim: ReturnType<ContentRepository['saveMember']>;

  beforeEach(() => {
    const db = openDatabase(':memory:');
    content = new ContentRepository(db);
    media = new MediaService(db);
    hafid = content.saveMember({ identifier: '0555000001', firstName: 'Hafid', neighborhoodId: 'bejaia-centre' });
    salim = content.saveMember({ identifier: '0555000002', firstName: 'Salim', neighborhoodId: 'bejaia-centre' });
    karim = content.saveMember({ identifier: '0555000003', firstName: 'Karim', neighborhoodId: 'oran' });
  });

  it('enregistre une photo et la rend au quartier, à lui seul', () => {
    const saved = media.savePhoto(hafid, 'image/jpeg', image(1024));
    assert.notEqual(typeof saved, 'string');
    if (typeof saved === 'string') return;

    const vue = media.photo(salim, saved.id);
    assert.notEqual(typeof vue, 'string');
    if (typeof vue === 'string') return;
    assert.equal(vue.mime, 'image/jpeg');
    assert.equal(vue.bytes.byteLength, 1024);

    assert.equal(media.photo(karim, saved.id), 'introuvable', 'un autre quartier ne la voit pas');
  });

  it('refuse un format inconnu et une photo trop lourde', () => {
    assert.equal(media.savePhoto(hafid, 'image/gif', image(10)), 'format_refuse');
    assert.equal(media.savePhoto(hafid, 'application/pdf', image(10)), 'format_refuse');
    assert.equal(media.savePhoto(hafid, 'image/jpeg', image(MAX_PHOTO_BYTES + 1)), 'trop_lourde');
  });

  it('n’accroche pas la photo d’un voisin à sa propre publication', () => {
    const saved = media.savePhoto(hafid, 'image/jpeg', image(64));
    if (typeof saved === 'string') return;

    assert.equal(media.ownsPhoto(hafid, saved.id), true);
    assert.equal(media.ownsPhoto(salim, saved.id), false);
  });

  it('publie une story, visible du quartier pendant 24 heures', () => {
    const photo = media.savePhoto(hafid, 'image/jpeg', image(64));
    if (typeof photo === 'string') return;

    const story = media.addStory(hafid, { photoId: photo.id, text: 'Le marché ce matin' });
    assert.notEqual(typeof story, 'string');

    const vues = media.stories(salim);
    assert.equal(vues.length, 1);
    assert.equal(vues[0]!.authorName, 'Hafid');
    assert.equal(vues[0]!.authorIsMe, false);
    assert.equal(media.stories(hafid)[0]!.authorIsMe, true);
    assert.equal(media.stories(karim).length, 0, 'un autre quartier ne la voit pas');

    const demain = new Date(Date.now() + STORY_WINDOW_MS + 1000);
    assert.equal(media.stories(salim, demain).length, 0, 'passé 24 h, elle disparaît');
  });

  it('applique le filtre de texte aux stories', () => {
    assert.equal(media.addStory(hafid, { text: 'espèce de connard' }), 'texte_refuse');
  });

  it('ne laisse retirer que sa propre story', () => {
    const story = media.addStory(hafid, { text: 'Bonjour le quartier' });
    if (typeof story === 'string') return;

    assert.equal(media.removeStory(salim, story.id), false);
    assert.equal(media.removeStory(hafid, story.id), true);
    assert.equal(media.stories(hafid).length, 0);
  });
});
