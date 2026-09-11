/**
 * Contrat d'envoi de SMS.
 *
 * Toute la logique de vérification est écrite contre cette interface : changer
 * d'agrégateur, c'est écrire un fichier, pas toucher au reste.
 */
export interface SmsProvider {
  /** Nom affiché dans les journaux et sur `/health`. */
  readonly name: string;
  /** Envoie un message court. Doit lever une erreur si l'envoi échoue. */
  send(params: { to: string; message: string }): Promise<void>;
}

export class SmsDeliveryError extends Error {
  constructor(
    message: string,
    readonly provider: string
  ) {
    super(message);
    this.name = 'SmsDeliveryError';
  }
}
