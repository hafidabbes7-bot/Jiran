import { config } from './config.js';
import { createServer } from './server.js';

const app = await createServer();

app.listen(config.port, () => {
  console.info(`Jiran — serveur sur le port ${config.port}`);
  console.info(`Fournisseur SMS : ${config.sms.provider}`);

  if (config.trialMode) {
    console.warn(
      '\n' +
        '  ╭──────────────────────────────────────────────────────────────╮\n' +
        '  │  MODE ESSAI — TRIAL_MODE=true                                │\n' +
        '  │  Aucun SMS n\'est envoyé et le code de vérification est rendu │\n' +
        '  │  à qui le demande : n\'importe qui peut s\'inscrire sous       │\n' +
        '  │  n\'importe quel numéro. À retirer avant de vrais voisins.    │\n' +
        '  ╰──────────────────────────────────────────────────────────────╯\n'
    );
  } else if (config.exposeDevCode) {
    console.warn('EXPOSE_DEV_CODE=true : le code est renvoyé dans la réponse HTTP.');
  }
});
