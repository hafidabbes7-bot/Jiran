import { maskPhone } from '../phone.js';
import type { SmsProvider } from './provider.js';

/**
 * Fournisseur de développement : rien n'est envoyé, le message est écrit dans
 * la console du serveur. Permet de dérouler tout le parcours sans contrat
 * agrégateur ni frais d'envoi.
 *
 * À ne jamais laisser actif en production — le serveur refuse d'ailleurs de
 * démarrer avec ce fournisseur si `NODE_ENV=production`.
 */
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    console.info(`[SMS:console] → ${maskPhone(to)} : ${message}`);
  }
}
