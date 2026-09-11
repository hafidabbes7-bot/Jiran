import { SmsDeliveryError, type SmsProvider } from './provider.js';

/**
 * Twilio, via son API REST directement — la dépendance officielle n'apporte
 * rien pour un seul appel.
 *
 * Attention pour l'Algérie : les routes internationales A2P sont souvent
 * filtrées et l'identifiant d'expéditeur doit être approuvé au préalable. À
 * tester sur de vrais numéros Mobilis, Djezzy et Ooredoo avant de s'engager.
 */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string
  ) {}

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: this.from, Body: message }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new SmsDeliveryError(`Twilio a répondu ${response.status} : ${detail}`, this.name);
    }
  }
}
