/** Canal par lequel le voisin veut recevoir son code. */
export type Channel = 'sms' | 'whatsapp';

export const CHANNELS: readonly Channel[] = ['sms', 'whatsapp'];

export function isChannel(value: unknown): value is Channel {
  return value === 'sms' || value === 'whatsapp';
}

/**
 * Contrat d'envoi d'un message court.
 *
 * Toute la logique de vérification est écrite contre cette interface : changer
 * d'agrégateur ou ajouter un canal, c'est écrire un fichier, pas toucher au
 * reste.
 */
export interface MessageProvider {
  /** Nom affiché dans les journaux et sur `/health`. */
  readonly name: string;
  /** Envoie le message. Doit lever une erreur si l'envoi échoue. */
  send(params: { to: string; message: string }): Promise<void>;
}

/** Fournisseur utilisé pour chaque canal ouvert. Un canal absent est fermé. */
export type ChannelProviders = Partial<Record<Channel, MessageProvider>>;

export class MessageDeliveryError extends Error {
  constructor(
    message: string,
    readonly provider: string
  ) {
    super(message);
    this.name = 'MessageDeliveryError';
  }
}
