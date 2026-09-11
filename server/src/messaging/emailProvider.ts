import nodemailer, { type Transporter } from 'nodemailer';

import { MessageDeliveryError, type MessageProvider } from './provider.js';

/**
 * Envoi du code par e-mail, par un serveur SMTP.
 *
 * C'est le canal gratuit : une boîte Gmail ou Outlook avec un mot de passe
 * d'application suffit, là où le SMS demande un contrat et se paie au message.
 * Pour un quartier qui démarre, c'est ce qui permet de vérifier vraiment les
 * comptes sans rien dépenser.
 */
export class SmtpEmailProvider implements MessageProvider {
  readonly name = 'smtp';
  private readonly transport: Transporter;

  constructor(
    options: { host: string; port: number; user: string; pass: string; secure: boolean },
    private readonly from: string,
    private readonly subject: string
  ) {
    this.transport = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: { user: options.user, pass: options.pass },
    });
  }

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    try {
      await this.transport.sendMail({ from: this.from, to, subject: this.subject, text: message });
    } catch (error) {
      throw new MessageDeliveryError(
        `Envoi SMTP impossible : ${(error as Error).message}`,
        this.name
      );
    }
  }
}

/**
 * Envoi par l'API de Resend, dont l'offre gratuite couvre largement un
 * quartier (3 000 messages par mois, sans carte bancaire).
 *
 * Écrit avec `fetch` plutôt qu'avec leur paquet : une dépendance de moins pour
 * un appel HTTP de dix lignes.
 */
export class ResendEmailProvider implements MessageProvider {
  readonly name = 'resend';

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly subject: string
  ) {}

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, to: [to], subject: this.subject, text: message }),
    });

    if (!response.ok) {
      const détail = await response.text().catch(() => '');
      throw new MessageDeliveryError(
        `Resend a refusé l'envoi (${response.status}) : ${détail.slice(0, 200)}`,
        this.name
      );
    }
  }
}
