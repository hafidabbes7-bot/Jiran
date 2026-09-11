import { config } from './config.js';
import { createServer } from './server.js';

const app = createServer();

app.listen(config.port, () => {
  console.info(`Jiran — API de vérification sur http://localhost:${config.port}`);
  console.info(`Fournisseur SMS : ${config.sms.provider}`);
  if (config.exposeDevCode) {
    console.warn('EXPOSE_DEV_CODE=true : le code est renvoyé dans la réponse HTTP.');
  }
});
