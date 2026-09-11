import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fournisseurMuetAutorise, modeEssaiDemande } from './modeEssai.js';

describe('mode essai', () => {
  it('ne s’ouvre que sur la valeur exacte « true »', () => {
    assert.equal(modeEssaiDemande('true'), true);

    // Tout le reste laisse la porte fermée : une faute de frappe ne doit pas
    // désactiver silencieusement les garde-fous.
    for (const valeur of ['TRUE', 'True', '1', 'oui', 'yes', 'false', '', ' true', undefined]) {
      assert.equal(modeEssaiDemande(valeur), false, `« ${valeur} » ne doit pas ouvrir la porte`);
    }
  });

  it('laisse les fournisseurs muets hors production', () => {
    assert.equal(fournisseurMuetAutorise(false, false), true);
  });

  it('les refuse en production tant que l’essai n’est pas assumé', () => {
    // C'est ce cas qui empêche de mettre en ligne, pour de vrais voisins, un
    // serveur qui n'enverrait aucun message.
    assert.equal(fournisseurMuetAutorise(true, false), false);
  });

  it('les autorise en production quand l’essai est demandé', () => {
    assert.equal(fournisseurMuetAutorise(true, true), true);
  });
});
