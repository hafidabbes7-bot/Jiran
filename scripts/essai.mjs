#!/usr/bin/env node
/**
 * Prépare une démonstration à plusieurs, en une commande.
 *
 * Construit l'application web, puis démarre le serveur qui la sert en même
 * temps que l'API. Il n'y a plus qu'une adresse à partager : le navigateur du
 * voisin trouve le serveur tout seul, il n'a rien à installer ni à régler.
 */
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mobile = path.join(racine, 'mobile');
const serveur = path.join(racine, 'server');
const web = path.join(mobile, 'dist');

const PORT = process.env.PORT ?? '4000';

/** Première adresse IPv4 de la machine sur le réseau local. */
function adresseLocale() {
  for (const cartes of Object.values(networkInterfaces())) {
    for (const carte of cartes ?? []) {
      if (carte.family === 'IPv4' && !carte.internal) return carte.address;
    }
  }
  return 'localhost';
}

function executer(commande, args, options) {
  return new Promise((resolve, reject) => {
    const processus = spawn(commande, args, { stdio: 'inherit', shell: true, ...options });
    processus.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${commande} a échoué (${code})`))
    );
  });
}

/** Crée le fichier de configuration du serveur s'il manque, avec des secrets. */
function preparerEnvServeur() {
  const fichier = path.join(serveur, '.env');
  if (fs.existsSync(fichier)) return;

  const secret = () => crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(
    fichier,
    [
      '# Créé automatiquement pour un essai local.',
      `OTP_SECRET=${secret()}`,
      `SESSION_SECRET=${secret()}`,
      'SMS_PROVIDER=console',
      'PUSH_PROVIDER=console',
      '# Remplit le code de vérification tout seul : aucun SMS n’est envoyé.',
      'EXPOSE_DEV_CODE=true',
      '',
    ].join('\n')
  );
  console.log('→ server/.env créé, avec des secrets tirés au hasard.');
}

console.log('\n[1/2] Construction de l’application web…\n');
// Aucune adresse n'est figée : servie par le serveur, l'application prend
// celle de la page.
await executer('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist', '--clear'], {
  cwd: mobile,
});

preparerEnvServeur();

const adresse = adresseLocale();
console.log(`
[2/2] Démarrage du serveur…

   Sur cet ordinateur :  http://localhost:${PORT}

   POUR VOS VOISINS, il faut une adresse en https://. Les navigateurs
   refusent la géolocalisation sur http:// — sans elle, l’inscription
   s’arrête à l’étape « Confirmer ma position ».

   Dans un autre terminal :
       npx localtunnel --port ${PORT}

   Partagez l’adresse https://… qu’il affiche : elle marche depuis
   n’importe où, même sur les données mobiles.

   (http://${adresse}:${PORT} fonctionne sur le même Wi-Fi, mais sans
   la géolocalisation — donc sans inscription possible.)

   Les codes de vérification s’affichent ci-dessous — aucun SMS n’est envoyé.
   Arrêter : Ctrl+C
`);

await executer('npm', ['start'], {
  cwd: serveur,
  env: { ...process.env, WEB_DIR: web, PORT },
});
