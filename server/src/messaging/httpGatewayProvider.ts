import { config } from '../config.js';
import { MessageDeliveryError, type MessageProvider } from './provider.js';

/**
 * Passerelle HTTP générique, pensée pour un agrégateur local algérien : la
 * plupart exposent un simple POST JSON avec une clé d'API, seuls les noms des
 * champs changent — d'où leur configuration par variables d'environnement.
 *
 * C'est la voie à privilégier pour de vrais utilisateurs : un agrégateur
 * local, avec un identifiant d'expéditeur déclaré auprès des opérateurs,
 * délivre bien mieux qu'une route internationale.
 */
export class HttpGatewaySmsProvider implements MessageProvider {
  readonly name = 'http';

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly senderId: string
  ) {}

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    const { phoneField, messageField, senderField } = config.sms.http;

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        [phoneField]: to,
        [messageField]: message,
        [senderField]: this.senderId,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new MessageDeliveryError(
        `La passerelle SMS a répondu ${response.status} : ${detail}`,
        this.name
      );
    }
  }
}
