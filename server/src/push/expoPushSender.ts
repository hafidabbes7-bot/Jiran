import type { PushMessage, PushSender } from './sender.js';

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/** Expo n'accepte pas plus de 100 messages par appel. */
const BATCH_SIZE = 100;

/**
 * Service de notifications d'Expo.
 *
 * Il relaie vers FCM (Android) et APNs (iOS) sans qu'on ait à manipuler ces
 * deux services séparément. Il faut tout de même avoir déposé les
 * identifiants FCM et APNs dans le projet Expo : sans eux, les jetons sont
 * acceptés mais rien n'arrive sur les téléphones.
 */
export class ExpoPushSender implements PushSender {
  readonly name = 'expo';
  readonly delivers = true;

  constructor(private readonly accessToken?: string) {}

  async send(messages: PushMessage[]): Promise<void> {
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE).map((message) => ({
        to: message.to,
        title: message.title,
        body: message.body,
        data: message.data,
        priority: message.priority,
        // Le son et le canal Android comptent pour une alerte : une
        // notification muette dans une poche ne sert à rien.
        sound: 'default',
        channelId: message.priority === 'high' ? 'alertes' : 'default',
      }));

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // On journalise sans interrompre : les autres lots doivent partir.
        console.error(`[push:expo] lot refusé (${response.status}) : ${detail}`);
      }
    }
  }
}
