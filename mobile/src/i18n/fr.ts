/**
 * Textes français. Source de vérité de la forme du dictionnaire : le fichier
 * arabe doit exposer exactement les mêmes clés (le typage l'impose).
 *
 * Les `{...}` sont remplacés par `format()`.
 */
export const fr = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    close: 'Fermer',
    retry: 'Réessayer',
    loading: 'Chargement…',
  },
  onboarding: {
    tagline: 'Le réseau de ton quartier, entre voisins',
    langFr: 'Français',
    langAr: 'العربية',

    accountTitle: 'Créer ton compte',
    accountSubtitle: 'Pour publier et échanger avec tes voisins en confiance',
    firstNameLabel: 'Prénom',
    firstNamePlaceholder: 'Ex : Hafid',
    phoneLabel: 'Numéro de téléphone',
    phonePlaceholder: '05 xx xx xx xx',
    phoneHint: 'Inscription par téléphone uniquement.',
    firstNameError: 'Indique ton prénom.',
    phoneError: 'Numéro algérien invalide (05, 06 ou 07 suivi de 8 chiffres).',
    createAccount: 'Créer mon compte',

    channelLabel: 'Recevoir le code par',
    channelSms: 'SMS',
    channelWhatsapp: 'WhatsApp',
    channelWhatsappLink: 'WhatsApp',
    channelFreeHint:
      'Tu n’as pas reçu de SMS ? Avec cette option, c’est toi qui nous envoies un message WhatsApp, et ton numéro est confirmé par WhatsApp lui-même.',
    channelUnavailable: 'Ce canal n’est pas disponible pour le moment. Essaie l’autre.',

    linkTitle: 'Envoie-nous un message',
    linkSubtitle:
      'Touche le bouton : WhatsApp s’ouvre avec un message déjà écrit. Envoie-le sans rien changer, on reconnaît ton numéro tout seuls.',
    linkOpen: 'Ouvrir WhatsApp',
    linkWaiting: 'En attente de ton message…',
    linkOpenFailed: 'WhatsApp n’a pas pu s’ouvrir. Est-il installé sur ce téléphone ?',
    linkExpired: 'La demande a expiré. Recommence.',
    linkManual: 'Ou envoie ce message au {number} : {message}',

    codeTitle: 'Vérifie ton numéro',
    codeSubtitle: 'Nous avons envoyé un code à {length} chiffres au {phone} par {channel}.',
    codeLabel: 'Code reçu par {channel}',
    codePlaceholder: '000000',
    verify: 'Vérifier',
    resend: 'Renvoyer le code',
    resendIn: 'Renvoyer le code ({seconds} s)',
    changeNumber: 'Modifier le numéro',
    codeSent: '✓ Code envoyé',
    codeInvalidOne: 'Code incorrect. Il te reste 1 essai.',
    codeInvalidMany: 'Code incorrect. Il te reste {count} essais.',
    codeExpired: 'Ce code a expiré. Demande-en un nouveau.',
    codeTooManyAttempts: 'Trop d’essais. Demande un nouveau code.',
    codeConsumed: 'Ce code a déjà été utilisé. Demande-en un nouveau.',
    sendFailed: 'L’envoi du message a échoué. Réessaie dans un instant.',
    rateLimited: 'Trop de demandes pour ce numéro. Réessaie dans {seconds} s.',
    networkError:
      'Serveur injoignable. Vérifie ta connexion — et, en développement, que l’API de vérification tourne.',
    devCodeNotice: 'Mode développement : code {code} (aucun message n’a été envoyé).',

    locationTitle: 'Où habites-tu ?',
    locationSubtitle: 'Pour te connecter uniquement avec tes vrais voisins',
    neighborhoodLabel: 'Quartier',
    buildingLabel: 'Cité / Immeuble (optionnel)',
    buildingPlaceholder: 'Ex : Cité 500 Logts, Bât. C',
    confirmPosition: '📍 Confirmer ma position',
    positionChecking: 'Vérification de ta position…',
    positionOk: '✅ Position confirmée dans {neighborhood}',
    positionTooFar: '❌ Tu es à {distance} de {neighborhood}.',
    positionSuggestion: 'Tu habites plutôt {neighborhood} ? Touche pour corriger.',
    positionDenied:
      "Sans autorisation de localisation, ton quartier ne peut pas être vérifié. Tu peux l'autoriser dans les réglages du téléphone.",
    positionUnavailable: 'Position introuvable pour le moment. Réessaie dehors ou près d’une fenêtre.',
    mustVerify: 'Confirme ta position pour continuer.',
    continue: 'Continuer',

    introTitle: 'Trois choses à savoir',
    intro1Title: 'Un fil réservé à ton quartier',
    intro1Text: 'Seuls tes vrais voisins peuvent voir et publier ici',
    intro2Title: 'Alertes sécurité en temps réel',
    intro2Text: 'Sois prévenu rapidement de ce qui se passe près de chez toi',
    intro3Title: 'Entraide entre voisins',
    intro3Text: 'Emprunte, donne, demande un coup de main',
    discover: 'Découvrir mon quartier',

    rulesTitle: 'Les règles du quartier',
    rulesSubtitle: 'À lire avant de commencer — merci de les respecter',
    rule1: "Respect entre voisins, pas d'insultes ni de harcèlement.",
    rule2: "N'alerte que sur des informations vérifiées.",
    rule3: "Pas de publicité commerciale ni de contenu inapproprié.",
    rule4: '3 signalements = contenu bloqué 3 jours. Une 2ᵉ fois = blocage définitif.',
    agree: "J'ai compris, je m'engage à les respecter",
    agreeCountdown: "J'ai compris, je m'engage à les respecter ({seconds}s)",
  },
  categories: {
    tout: 'Tout',
    securite: 'Sécurité',
    entraide: 'Entraide',
    annonce: 'Annonce',
    evenement: 'Événement',
  },
  feed: {
    title: 'Mon quartier',
    searchPlaceholder: 'Chercher une publication ou un voisin',
    empty: 'Rien de neuf dans le quartier pour le moment.',
    offline: 'Serveur injoignable — tire vers le bas pour réessayer.',
    emptyFiltered: 'Aucune publication dans cette catégorie.',
    twinnedNotice:
      '{neighborhood} partage son fil avec {twin} le temps d’atteindre {threshold} voisins vérifiés.',
    origin: '{neighborhood}',
    originWithBuilding: '{building} · {neighborhood}',
    replies: '{count} réponses',
    reply: '1 réponse',
    noReply: 'Répondre',
    newPost: 'Publier',
    blockedTemporary:
      '🚫 Contenu masqué — signalé par 3 voisins différents. Bloqué pendant 3 jours.',
    blockedPermanent: '🚫 Contenu bloqué définitivement après plusieurs signalements.',
  },
  compose: {
    title: 'Nouvelle publication',
    categoryLabel: 'Catégorie',
    placeholder: 'Qu’est-ce que tu veux partager avec tes voisins ?',
    moderationWarning:
      '⚠️ Ce message contient des termes potentiellement inappropriés. Merci de reformuler.',
    tooShort: 'Écris au moins quelques mots.',
    publish: 'Publier',
    photoUnavailable:
      '📷 Les photos arriveront quand la modération d’image sera branchée (§7.3 du cahier des charges).',
    published: '✓ Publication envoyée à ton quartier',
    publishFailed: 'Publication impossible pour l’instant. Réessaie dans un instant.',
  },
  detail: {
    repliesTitle: 'Réponses',
    commentPlaceholder: 'Écrire une réponse…',
    send: 'Envoyer',
    noComments: 'Sois le premier à répondre.',
  },
  alerts: {
    title: 'Alertes du quartier',
    subtitle: 'Sécurité, coupures et objets perdus',
    empty: 'Aucune alerte en cours. Bonne nouvelle.',
  },
  report: {
    title: 'Signaler cette publication',
    spam: 'Spam ou publicité',
    inapproprie: 'Contenu inapproprié',
    fausse_alerte: 'Fausse alerte',
    autre: 'Autre raison',
    sent: '✓ Merci, signalement envoyé aux modérateurs',
    alreadyReported: 'Tu as déjà signalé cette publication.',
  },
  sos: {
    title: 'Alerte SOS',
    subtitle: 'Choisis les voisins de confiance à prévenir. Eux seuls seront alertés.',
    selectAll: 'Tout sélectionner',
    unselectAll: 'Tout désélectionner',
    send: 'Envoyer l’alerte',
    noSelection: 'Choisis au moins un voisin.',
    noTrusted:
      'Tu n’as pas encore de voisin de confiance. Ajoute-les depuis la liste ci-dessous.',
    sentTitle: 'Alerte envoyée',
    sentDetailOne: '1 voisin a été alerté et connaît ta position.',
    sentDetailMany: '{count} voisins ont été alertés et connaissent ta position.',
    falseAlarm: 'Fausse alerte, annuler',
    cancelled: 'Alerte annulée, tes voisins ont été prévenus.',
    positionShared: 'Position partagée : {position}',
    positionUnknown: 'Position non partagée (localisation refusée)',
    deliveryPending:
      '⚠️ Les notifications ne sont pas encore branchées sur ce serveur : l’alerte est enregistrée, mais aucun téléphone ne sonnera.',
    noDevices:
      '⚠️ Aucun de ces voisins n’a encore ouvert Jiran sur son téléphone : ils verront l’alerte à leur prochaine ouverture, sans notification.',
    sendFailed: 'L’alerte n’a pas pu partir. Réessaie.',
    noReachable: 'Aucun des voisins choisis ne peut être alerté.',
    othersTitle: 'Autres voisins du quartier',
  },
  neighborhood: {
    title: 'Mon quartier',
    verified: '{count} voisins vérifiés',
    twinnedTitle: 'Cités jumelées',
    twinnedExplain:
      'Ces cités partagent le même fil pour l’instant, le temps d’avoir assez de voisins actifs. L’origine reste toujours affichée sur chaque publication.',
    twinnedMeta: '{count} voisins · seuil : {threshold}',
    trustedTitle: 'Voisins de confiance',
    trustedExplain: 'Eux seuls reçoivent tes alertes SOS.',
    trustedAdd: 'Ajouter',
    trustedRemove: 'Retirer',
    rulesTitle: 'Règles du quartier',
    moderationTitle: 'Modération',
    moderationPending: '{count} contenus actuellement masqués',
  },
  nav: {
    feed: 'Accueil',
    alerts: 'Alertes',
    publish: 'Publier',
    neighborhood: 'Quartier',
  },
};

/** Forme du dictionnaire, imposée à toutes les langues. */
export type Strings = typeof fr;
