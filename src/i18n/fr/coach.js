/*
  Coach IA : habillage du chat, réponses hors périmètre et messages d'erreur.

  `fallback.*` est renvoyé par api/_lib/prompts.js lorsque Claude est
  court-circuité (question médicale ou demande de plan d'entraînement). Ce sont
  des refus à visée de sécurité : traduire le sens, jamais atténuer le renvoi
  vers un professionnel.
*/
export default {
  eyebrow: "Coach IA",
  title: "Demander à RaceIQ",
  backToDebrief: "← Retour au débriefing",
  backToRaces: "← Retour aux courses",
  clearHistory: "Effacer l'historique",
  clearConfirm: "Effacer l'historique de la conversation ?",
  context: "Contexte : {{name}}",
  intro: "Posez n'importe quelle question sur votre historique de courses, {{name}}. Chaque réponse est tirée de vos données enregistrées.",
  defaultName: "vous",
  tryAsking: "Essayez de demander",
  suggested: {
    bonk: "Pourquoi ai-je explosé sur ma dernière course ?",
    improving: "Est-ce que je progresse sur l'ensemble de mon historique ?",
    fit: "Quels types de courses me conviennent le mieux ?",
    next: "Que devrais-je changer avant mon prochain marathon ?",
  },
  coachLabel: "Coach RaceIQ",
  youLabel: "Vous",
  basedOn: "D'après :",
  analyzing: "Analyse de vos données…",
  send: "Envoyer",
  inputLabel: "Votre question",
  inputHint: "Entrée pour envoyer · Maj+Entrée pour un saut de ligne",
  placeholder: {
    race: "Posez une question sur {{name}}…",
    general: "Posez une question sur votre historique de courses…",
    signedOut: "Connectez-vous pour interroger le coach…",
  },
  demoNotice: {
    title: "Démo · athlète exemple",
    body: "Les questions suggérées rejouent des réponses enregistrées sur les courses de l'athlète exemple, et chaque chiffre qu'elles citent est vérifié par la suite de tests par rapport aux données de course. Vos propres questions ne sont envoyées au coach en direct que si cette démo dispose d'un budget actif.",
  },
  recorded: "Réponse enregistrée",
  signInRequired: {
    title: "Connexion requise",
    body: "Le coach IA analyse vos courses enregistrées sur les serveurs de RaceIQ. Connectez-vous pour l'utiliser — vos données de course ne sont envoyées que pour les questions que vous posez.",
  },

  fallback: {
    medical: "Cela semble relever d'une douleur ou d'une blessure — en dehors de ce que RaceIQ peut traiter. Consultez un médecin du sport ou un kinésithérapeute qui pourra vous examiner en personne.",
    training: "RaceIQ se concentre sur l'analyse de courses et l'état de préparation — élaborer un plan d'entraînement sort de son périmètre. Un entraîneur peut s'appuyer sur ces analyses, mais les décisions de planification lui reviennent.",
  },

  systemDirective: "Réponds en français. Le bloc DATA est fourni en anglais quelle que soit la langue de réponse — traduis les valeurs que tu en cites, mais ne traduis jamais les noms de courses.",

  errors: {
    signedOut: "Connectez-vous pour utiliser le coach IA.",
    unreachable: "Impossible de joindre le coach. Vérifiez votre connexion.",
    requestFailed: "Échec de la requête ({{status, number}}).",
    generic: "Une erreur est survenue — veuillez réessayer.",
    methodNotAllowed: "Méthode non autorisée.",
    notConfigured: "Le coach IA n'est pas configuré sur ce serveur.",
    rateLimited: "Trop de requêtes — réessayez dans {{seconds, number}} s.",
    malformedBody: "Corps de requête mal formé.",
    unknownTask: "Tâche inconnue « {{task}} ».",
    questionTooLong: "Cette question est trop longue : restez sous {{max, number}} caractères.",
    demoLiveOff: "Les questions en direct sont désactivées dans cette démo. Essayez une des questions suggérées : elles rejouent des réponses enregistrées sur l'athlète exemple.",
    demoBudgetSpent: "Le budget en direct de la démo est épuisé pour le moment. Les questions suggérées fonctionnent toujours : elles rejouent des réponses enregistrées sur l'athlète exemple.",
    serverError: "Une erreur est survenue lors de la génération de cette réponse.",
  },
};
