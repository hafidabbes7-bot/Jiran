#!/usr/bin/env node
/**
 * Petit serveur local, sans aucune dépendance.
 *
 * Sert à tester sur un vrai téléphone : l'ordinateur et le téléphone sur le
 * même Wi-Fi, on ouvre l'adresse affichée dans Chrome, et c'est joué. Ouvrir
 * le fichier directement marche aussi — ce serveur n'est qu'un confort.
 */
import fs from 'node:fs';
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 8090);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
};

function adresseLocale() {
  for (const cartes of Object.values(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family === 'IPv4' && !carte.internal) return carte.address;
    }
  }
  return 'localhost';
}

http
  .createServer((requete, reponse) => {
    const demande = decodeURIComponent(new URL(requete.url, 'http://x').pathname);
    const fichier = path.join(racine, demande === '/' ? 'index.html' : demande);
    // On ne sert rien hors du dossier du jeu.
    if (!fichier.startsWith(racine) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('Introuvable');
      return;
    }
    reponse.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(fichier).pipe(reponse);
  })
  .listen(PORT, () => {
    console.log('\n  TADDART');
    console.log(`  Sur cet ordinateur : http://localhost:${PORT}`);
    console.log(`  Sur le téléphone   : http://${adresseLocale()}:${PORT}   (même Wi-Fi)`);
    console.log('\n  Ctrl+C pour arrêter.\n');
  });
