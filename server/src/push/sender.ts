/** Notification à remettre sur un appareil. */
export interface PushMessage {
  /** Jeton de notification de l'appareil destinataire. */
  to: string;
  title: string;
  body: string;
  /** Données lues par l'application à l'ouverture (écran à afficher). */
  data?: Record<string, string>;
  /**
   * Une alerte de sécurité ou un SOS doit passer devant tout le reste, et
   * réveiller le téléphone même en veille (§7.7).
   */
  priority: 'high' | 'normal';
}

/**
 * Contrat d'envoi des notifications.
 *
 * Comme pour les SMS, tout est écrit contre cette interface : changer de
 * service, c'est écrire un fichier.
 */
export interface PushSender {
  readonly name: string;
  /** `true` si les notifications partent réellement vers les téléphones. */
  readonly delivers: boolean;
  send(messages: PushMessage[]): Promise<void>;
}
