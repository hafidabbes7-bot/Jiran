import { moderateText } from '../moderation/textModeration';

describe('moderateText', () => {
  it('laisse passer un message ordinaire', () => {
    expect(moderateText('Quelqu’un aurait une perceuse à me prêter ce week-end ?').clean).toBe(
      true
    );
  });

  it('repère une insulte simple', () => {
    expect(moderateText('espèce de connard').clean).toBe(false);
  });

  it('ne signale pas un mot légitime qui contient une insulte', () => {
    // Le prototype signalait « concert » à cause de « con » : le filtre
    // travaille désormais par mot entier.
    for (const phrase of ['On organise un concert samedi', 'Demande conseil au concierge']) {
      expect(moderateText(phrase).clean).toBe(true);
    }
  });

  it('résiste aux contournements courants', () => {
    for (const phrase of ['c0nnard', 'CONNARD', 'connnnard', 'c.o.n.n.a.r.d', 'c o n n a r d']) {
      expect(moderateText(phrase).clean).toBe(false);
    }
  });

  it('accepte les terminaisons du pluriel', () => {
    expect(moderateText('bande de connards').clean).toBe(false);
  });

  it('repère aussi une insulte en arabe', () => {
    expect(moderateText('يا قحبة').clean).toBe(false);
  });

  it('ne recolle pas des mots normaux qui se suivent', () => {
    expect(moderateText('salut à tous les voisins du bâtiment').clean).toBe(true);
  });
});
