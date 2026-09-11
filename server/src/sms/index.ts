import { config } from '../config.js';
import { ConsoleSmsProvider } from './consoleProvider.js';
import { HttpGatewaySmsProvider } from './httpGatewayProvider.js';
import type { SmsProvider } from './provider.js';
import { TwilioSmsProvider } from './twilioProvider.js';
import { WhatsAppProvider } from './whatsappProvider.js';

/** Construit le fournisseur choisi par `SMS_PROVIDER`. */
export function createSmsProvider(): SmsProvider {
  switch (config.sms.provider) {
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

    case 'whatsapp': {
      const { phoneNumberId, accessToken, templateName, templateLanguage } =
        config.sms.whatsapp;
      if (!phoneNumberId || !accessToken) {
        throw new Error(
          'SMS_PROVIDER=whatsapp exige WHATSAPP_PHONE_NUMBER_ID et WHATSAPP_ACCESS_TOKEN.'
        );
      }
      return new WhatsAppProvider(phoneNumberId, accessToken, templateName, templateLanguage);
    }

    case 'console': {
      if (config.isProduction) {
        throw new Error(
          "SMS_PROVIDER=console n'envoie aucun SMS : interdit en production, choisissez « twilio » ou « http »."
        );
      }
      return new ConsoleSmsProvider();
    }

    default:
      throw new Error(`SMS_PROVIDER inconnu : ${config.sms.provider}`);
  }
}

export type { SmsProvider } from './provider.js';
export { SmsDeliveryError } from './provider.js';
