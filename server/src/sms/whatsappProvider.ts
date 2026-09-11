import { SmsDeliveryError, type SmsProvider } from './provider.js';

/**
 * WhatsApp Cloud API (Meta).
 *
 * WhatsApp est très répandu en Algérie et échappe au filtrage A2P qui touche
 * le SMS ; en revanche il exclut les voisins qui ne l'utilisent pas, d'où
 * l'intérêt de le garder en complément du SMS plutôt qu'à sa place.
 *
 * Prérequis côté Meta, à obtenir avant que ce fournisseur serve à quoi que ce
 * soit : un compte WhatsApp Business vérifié, un numéro d'expédition, et un
 * modèle de message de catégorie « authentification » approuvé. Un code ne peut
 * pas être envoyé en texte libre — seul un modèle approuvé passe.
 */
export class WhatsAppProvider implements SmsProvider {
  readonly name = 'whatsapp';

  constructor(
    private readonly phoneNumberId: string,
    private readonly accessToken: string,
    private readonly templateName: string,
    private readonly templateLanguage: string
  ) {}

  async send({ to, message }: { to: string; message: string }): Promise<void> {
    // Le modèle d'authentification ne reçoit que le code, pas la phrase
    // entière : le texte autour est figé par le modèle approuvé.
    const code = message.match(/\b(\d{4,8})\b/)?.[1];
    if (!code) {
      throw new SmsDeliveryError('Aucun code trouvé dans le message.', this.name);
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to.replace('+', ''),
          type: 'template',
          template: {
            name: this.templateName,
            language: { code: this.templateLanguage },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }] },
              {
                // Bouton « copier le code », imposé par les modèles
                // d'authentification de Meta.
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: code }],
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new SmsDeliveryError(
        `WhatsApp a répondu ${response.status} : ${detail}`,
        this.name
      );
    }
  }
}
