import type { Comment, Neighbor, Post } from '../domain/types';

/**
 * Contenu de démarrage repris du prototype, pour qu'un quartier vide ne
 * s'ouvre pas sur un écran blanc pendant les tests. Ces publications sont
 * datées relativement au premier lancement.
 *
 * À supprimer dès que le fil est alimenté par le backend réel.
 */
const minutesAgo = (from: Date, minutes: number) =>
  new Date(from.getTime() - minutes * 60_000).toISOString();

export function seedPosts(neighborhoodId: string, now: Date = new Date()): Post[] {
  return [
    {
      id: 'seed-alerte-1',
      authorName: 'Yacine O.',
      category: 'securite',
      text: 'Vol signalé rue des Frères Bouadou vers 21h. Pensez à bien fermer les portails.',
      neighborhoodId,
      building: 'Immeuble B',
      createdAt: minutesAgo(now, 20),
      likes: 4,
      likedByMe: false,
    },
    {
      id: 'seed-entraide-1',
      authorName: 'Karim B.',
      category: 'entraide',
      text: "Quelqu'un aurait une perceuse à me prêter pour ce week-end ? Je vous la rends lundi 🙏",
      neighborhoodId,
      building: 'Immeuble C',
      createdAt: minutesAgo(now, 40),
      likes: 6,
      likedByMe: false,
    },
    {
      id: 'seed-annonce-1',
      authorName: 'Amina R.',
      category: 'annonce',
      text: 'Je donne une table basse en bon état, à venir chercher chez moi. Premier arrivé, premier servi !',
      neighborhoodId,
      building: 'Immeuble A',
      createdAt: minutesAgo(now, 120),
      likes: 9,
      likedByMe: false,
    },
    {
      id: 'seed-evenement-1',
      authorName: 'Association du quartier',
      authorOfficial: true,
      category: 'evenement',
      text: 'Journée de nettoyage collectif du quartier samedi matin, 9h devant la mosquée. Tout le monde est bienvenu !',
      neighborhoodId,
      createdAt: minutesAgo(now, 300),
      likes: 23,
      likedByMe: false,
    },
    {
      id: 'seed-alerte-2',
      authorName: 'SEAAL (relayé)',
      authorOfficial: true,
      category: 'securite',
      text: "Coupure d'eau prévue demain de 8h à 14h sur le quartier. Pensez à remplir vos réserves.",
      neighborhoodId,
      createdAt: minutesAgo(now, 180),
      likes: 12,
      likedByMe: false,
    },
  ];
}

export function seedComments(now: Date = new Date()): Comment[] {
  return [
    {
      id: 'seed-comment-1',
      postId: 'seed-entraide-1',
      authorName: 'Sofiane K.',
      text: "J'en ai une, je te l'apporte ce soir vers 19h !",
      createdAt: minutesAgo(now, 25),
    },
    {
      id: 'seed-comment-2',
      postId: 'seed-entraide-1',
      authorName: 'Karim B.',
      text: 'Merci beaucoup Sofiane, à ce soir 🙏',
      createdAt: minutesAgo(now, 18),
    },
  ];
}

export function seedNeighbors(): Neighbor[] {
  return [
    { id: 'n-amina', name: 'Amina R.', building: 'Immeuble A', trusted: true },
    { id: 'n-karim', name: 'Karim B.', building: 'Immeuble C', trusted: true },
    { id: 'n-sofiane', name: 'Sofiane K.', building: 'Immeuble B', trusted: false },
    { id: 'n-yacine', name: 'Yacine O.', building: 'Immeuble B', trusted: false },
    { id: 'n-nadia', name: 'Nadia H.', building: 'Immeuble C', trusted: false },
  ];
}
