import { config } from '../config.js';
import { fournisseurMuetAutorise } from '../modeEssai.js';
import { ConsolePushSender } from './consolePushSender.js';
import { ExpoPushSender } from './expoPushSender.js';
import type { PushSender } from './sender.js';

/** Construit le service choisi par `PUSH_PROVIDER`. */
export function createPushSender(): PushSender {
  switch (config.push.provider) {
    case 'expo':
      return new ExpoPushSender(config.push.expoAccessToken || undefined);

    case 'console':
      if (!fournisseurMuetAutorise(config.isProduction, config.trialMode)) {
        throw new Error(
          'PUSH_PROVIDER=console ne remet aucune notification : interdit en production, ' +
            'où le SOS doit joindre les voisins. Posez TRIAL_MODE=true pour un essai assumé.'
        );
      }
      return new ConsolePushSender();

    default:
      throw new Error(`PUSH_PROVIDER inconnu : ${config.push.provider}`);
  }
}

export type { PushMessage, PushSender } from './sender.js';
