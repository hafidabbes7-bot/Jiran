import { config } from '../config.js';
import { ConsoleProvider } from './consoleProvider.js';
import { HttpGatewaySmsProvider } from './httpGatewayProvider.js';
import type { Channel, ChannelProviders, MessageProvider } from './provider.js';
import { TwilioSmsProvider } from './twilioProvider.js';
import { WhatsAppProvider } from './whatsappProvider.js';

/** Fournisseur du canal SMS, d'après `SMS_PROVIDER`. `none` ferme le canal. */
function createSmsProvider(): MessageProvider | undefined {
  switch (config.sms.provider) {
    case 'none':
      return undefined;

    case 'twilio': {
      const { accountSid, authToken, from } = config.sms.twilio;
      if (!accountSid || !authToken || !from) {
        throw new Error(
          'SMS_PROVIDER=twilio exige TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM.'
        );
      }
      return new TwilioSmsProvider(accountSid, authToken, from);
    }

    case 'http': {
      const { url, apiKey } = config.sms.http;
      if (!url || !apiKey) {
        throw new Error('SMS_PROVIDER=http exige SMS_HTTP_URL et SMS_HTTP_API_KEY.');
      }
      return new HttpGatewaySmsProvider(url, apiKey, config.sms.senderId);
    }

    case 'console': {
      if (config.isProduction) {
        throw new Error(
          "SMS_PROVIDER=console n'envoie aucun message : interdit en production, choisissez « twilio » ou « http »."
        );
      }
      return new ConsoleProvider('sms');
    }

    default:
      throw new Error(`SMS_PROVIDER inconnu : ${config.sms.provider}`);
  }
}

/**
 * Fournisseur du canal WhatsApp. Il s'ouvre dès que les identifiants Meta sont
 * présents ; en développement avec le fournisseur console, il s'ouvre aussi,
 * pour pouvoir tester le choix du canal sans compte WhatsApp Business.
 */
function createWhatsAppProvider(): MessageProvider | undefined {
  const { phoneNumberId, accessToken, templateName, templateLanguage } = config.whatsapp;

  if (phoneNumberId && accessToken) {
    return new WhatsAppProvider(phoneNumberId, accessToken, templateName, templateLanguage);
  }

  if (!config.isProduction && config.sms.provider === 'console') {
    return new ConsoleProvider('whatsapp');
  }

  return undefined;
}

/**
 * Canaux réellement ouverts. L'application interroge `/auth/channels` pour
 * n'afficher que ceux-là : proposer WhatsApp sans compte Meta configuré
 * reviendrait à promettre un message qui n'arrivera jamais.
 */
export function createChannelProviders(): ChannelProviders {
  const providers: ChannelProviders = {};

  const sms = createSmsProvider();
  if (sms) providers.sms = sms;

  const whatsapp = createWhatsAppProvider();
  if (whatsapp) providers.whatsapp = whatsapp;

  if (Object.keys(providers).length === 0) {
    throw new Error(
      "Aucun canal d'envoi configuré : renseignez SMS_PROVIDER ou les identifiants WhatsApp."
    );
  }

  return providers;
}

export type { Channel, ChannelProviders, MessageProvider } from './provider.js';
export { CHANNELS, isChannel, MessageDeliveryError } from './provider.js';
