import type { PushMessage, PushSender } from './sender.js';

/**
 * Notifications de développement : rien n'est remis, tout s'affiche dans la
 * console. `delivers` vaut `false`, et l'application le dit à l'écran plutôt
 * que de laisser croire qu'une alerte est partie — sur un bouton SOS, la
 * confusion serait grave.
 */
export class ConsolePushSender implements PushSender {
  readonly name = 'console';
  readonly delivers = false;

  async send(messages: PushMessage[]): Promise<void> {
    for (const message of messages) {
      console.info(
        `[push:console] ${message.priority} → ${message.to.slice(0, 12)}… « ${message.title} : ${message.body} »`
      );
    }
  }
}
