#!/usr/bin/env node
/**
 * Fabrique « taddart-autonome.html » : le jeu entier dans UN seul fichier.
 *
 * Pratique pour le téléphone : un fichier s'envoie par WhatsApp ou par câble,
 * et s'ouvre d'un appui. Les fichiers séparés restent la version de travail ;
 * celle-ci en est la photocopie, à refaire après chaque modification
 * (npm run construire).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const lire = (nom) => fs.readFileSync(path.join(racine, nom), 'utf8');

let page = lire('index.html');
page = page.replace('<link rel="stylesheet" href="./style.css" />', `<style>\n${lire('style.css')}\n    </style>`);

for (const script of ['donnees-histoire.js', 'donnees-jeu.js', 'moteur.js', 'game.js']) {
  const code = lire(script);
  if (code.includes('</script')) throw new Error(`${script} contient « </script » : l'inclusion en ligne le couperait.`);
  page = page.replace(`<script src="./${script}"></script>`, `<script>\n${code}\n    </script>`);
}

if (page.includes('<script src=') || page.includes('<link rel="stylesheet"')) {
  throw new Error('Un fichier externe n’a pas été inclus : la version autonome serait incomplète.');
}

const sortie = path.join(racine, 'taddart-autonome.html');
fs.writeFileSync(sortie, page);
console.log(`taddart-autonome.html écrit (${(fs.statSync(sortie).size / 1024).toFixed(0)} ko) — un seul fichier, aucune dépendance.`);
