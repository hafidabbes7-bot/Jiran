import { isValidAlgerianMobile, normalizePhone } from '../phone';

describe('normalizePhone', () => {
  it('ramène les formats internationaux à la forme nationale', () => {
    expect(normalizePhone('+213 555 12 34 56')).toBe('0555123456');
    expect(normalizePhone('00213661234567')).toBe('0661234567');
    expect(normalizePhone('213661234567')).toBe('0661234567');
    expect(normalizePhone('05 55 12 34 56')).toBe('0555123456');
  });
});

describe('isValidAlgerianMobile', () => {
  it('accepte les préfixes mobiles algériens', () => {
    for (const number of ['0555123456', '0661234567', '0771234567', '+213 771 23 45 67']) {
      expect(isValidAlgerianMobile(number)).toBe(true);
    }
  });

  it('refuse les numéros mal formés', () => {
    for (const number of ['055512345', '0212345678', '0123456789', 'abcdefghij', '']) {
      expect(isValidAlgerianMobile(number)).toBe(false);
    }
  });
});
