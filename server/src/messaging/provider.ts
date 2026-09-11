/**
 * Manière dont le voisin prouve son numéro :
 * - `sms` et `whatsapp` : nous lui envoyons un code (facturé par le
 *   fournisseur, au message) ;
 * - `whatsapp_link` : c'est lui qui nous envoie un message depuis WhatsApp.
 *   Nous n'émettons rien, donc rien n'est facturé, et c'est Meta qui nous
 *   indique le numéro d'origine.
 */
export type Channel = 'sms' | 'whatsapp' | 'whatsapp_link';

export const CHANNELS: readonly Channel[] = ['sms', 'whatsapp', 'whatsapp_link'];

export function isChannel(value: unknown): value is Channel {
  return CHANNELS.includes(value as Channel);
}

/** Canaux où le serveur envoie lui-même un message, et paie pour cela. */
export const OUTBOUND_CHANNELS: readonly Channel[] = ['sms', 'whatsapp'];

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
