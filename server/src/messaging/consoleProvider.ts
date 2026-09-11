import { maskPhone } from '../phone.js';
import type { Channel, MessageProvider } from './provider.js';

/**
 * Fournisseur de développement : rien n'est envoyé, le message est écrit dans
 * la console du serveur. Permet de dérouler tout le parcours, sur les deux
 * canaux, sans contrat ni frais d'envoi.
 *
 * À ne jamais laisser actif en production — le serveur refuse d'ailleurs de
 * démarrer avec ce fournisseur si `NODE_ENV=production`.
 */
export class ConsoleProvider implements MessageProvider {
  readonly name = 'console';

  constructor(private readonly channel: Channel) {}

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    console.info(`[${this.channel}:console] → ${maskPhone(to)} : ${message}`);
  }
}
