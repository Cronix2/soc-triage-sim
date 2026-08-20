'use strict';

/*
 * Contenu scénarisé du mode Tuto : liste ordonnée des étapes du guide
 * affiché sous forme de bulles de dialogue (cf. app/js/ui.js pour le
 * moteur qui les affiche et déclenche leurs effets sur l'écran réel).
 * Module volontairement pur (aucun DOM, aucune session) pour rester
 * testable comme les autres modules de contenu (chasse.js, remediation.js).
 * Enveloppe UMD, cf. app/js/alertes.js.
 *
 * Chaque étape :
 *  - id          : identifiant stable, utilisé par ui.js pour déclencher
 *                  l'effet bespoke associé (injecter une alerte, ouvrir
 *                  une application, changer de rôle simulé...) — voir
 *                  ui.js:executerEffetEtapeTutoriel.
 *  - titre/texte : contenu de la bulle (texte affiché à l'étudiant).
 *  - vue         : vue principale à activer avant l'effet ('session',
 *                  'remediation' ou 'correction').
 *  - onglet      : sous-onglet à activer quand vue==='session' ('file' ou
 *                  'chasse') — ignoré sinon.
 *  - cible       : sélecteur CSS de l'élément à mettre en valeur
 *                  (surlignage), ou null si aucun.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Tutoriel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ETAPES = [
    {
      id: 'bienvenue',
      titre: 'Bienvenue au SOC',
      texte: `
        <p>Je suis votre référent pour cette prise de poste. Cette visite guidée vous fait parcourir l'outil écran par écran : la file d'alertes, les mini-jeux de résolution d'incident et de chasse aux menaces, et surtout les différences entre les <strong>Rôles</strong> (LVL1/LVL2/LVL3) et les <strong>Difficultés</strong> (Facile/Intermédiaire/Difficile) que vous choisirez pour vos prochaines sessions.</p>
        <p>Ce tutoriel n'est pas chronométré : avancez avec « Suivant », revenez en arrière avec « Précédent », ou passez directement à « Passer le tutoriel » si vous préférez explorer par vous-même.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'bandeau',
      titre: "L'en-tête",
      texte: `
        <p>Le nom « SOC//TRIAGE » est cliquable : il ouvre le menu pause à tout moment, disponible quel que soit le rôle choisi. Le bouton à droite bascule entre thème clair et thème sombre — votre choix est mémorisé pour les prochaines visites.</p>
        <p>En session réelle (hors tutoriel), un minuteur et une barre de progression apparaissent aussi ici, avec un bouton « Pause » dédié à côté.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#bandeau',
    },
    {
      id: 'file-intro',
      titre: "La file d'alertes",
      texte: `
        <p>C'est le cœur du travail : les alertes de sécurité y arrivent au fil du temps. En session réelle, leur rythme d'apparition dépend du Rôle et de la Difficulté choisis — nous y reviendrons dans quelques instants.</p>
        <p>Les puces au-dessus de la liste filtrent par catégorie (phishing, malware, exfiltration de données...) ; la couleur de chaque alerte reprend celle de sa catégorie pour repérer un type d'incident d'un coup d'œil.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#liste-alertes',
    },
    {
      id: 'ouverture-alerte',
      titre: "Ouvrir une alerte",
      texte: `
        <p>Tiens, une alerte vient d'arriver — repérable un instant grâce à l'étiquette « NOUVEAU ». Cliquer dessus affiche son détail : catégorie, horodatage, description, entités affectées (comptes, postes, serveurs concernés) et indicateurs techniques (adresse IP, domaine, hachage...).</p>
        <p>Le bouton « Analyser » à côté d'un indicateur simule une recherche façon VirusTotal ; « Contacter » ouvre une discussion fictive avec la personne concernée quand elle est disponible ; « Afficher plus de détails » révèle des éléments techniques complémentaires. Explorez, puis passez à la suite.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#detail-alerte',
    },
    {
      id: 'classification',
      titre: 'Classer une alerte',
      texte: `
        <p>Trois classifications possibles : <strong>Vrai positif</strong> (menace réelle), <strong>Faux positif</strong> (rien d'anormal) ou <strong>À investiguer</strong> (vous n'êtes pas encore sûr — une équipe plus expérimentée tranchera). Nous verrons plus loin qu'un rôle fait exception à cette troisième option.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '.groupe-classification',
    },
    {
      id: 'raison-et-validation',
      titre: 'Justifier et valider',
      texte: `
        <p>Le champ « Raison de la décision » est obligatoire — comme dans un vrai SOC, chaque décision doit être justifiée par écrit. Une fois validée, l'alerte quitte la file et votre décision est enregistrée dans le panneau « Traité » en bas de l'écran.</p>
        <p>Important : aucun verdict « correct / incorrect » ne s'affiche à ce moment-là. Le corrigé complet n'apparaît qu'à l'écran de correction, en fin de session — exactement comme un retour d'expérience en conditions réelles n'est jamais instantané.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#historique-fiches',
    },
    {
      id: 'difficulte-intro',
      titre: 'La Difficulté',
      texte: `
        <p>La Difficulté (Facile / Intermédiaire / Difficile) est indépendante du Rôle : elle module le rythme d'apparition des alertes, le nombre de pièges dans les mini-jeux, et surtout le nombre de champs à remplir pour classer une alerte. Regardons les trois niveaux sur un exemple, l'un après l'autre.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'difficulte-facile',
      titre: 'Difficulté Facile',
      texte: `
        <p>En <strong>Facile</strong>, le formulaire ne demande que l'essentiel : la classification et sa raison. De quoi se concentrer sur le jugement de fond sans se disperser.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#zone-classification',
    },
    {
      id: 'difficulte-intermediaire',
      titre: 'Difficulté Intermédiaire',
      texte: `
        <p>En <strong>Intermédiaire</strong>, un champ s'ajoute : cocher les <strong>indicateurs jugés pertinents</strong> pour la décision, parmi ceux de l'alerte. Il faut désormais justifier concrètement ce qui, techniquement, a motivé le choix.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#zone-classification',
    },
    {
      id: 'difficulte-difficile',
      titre: 'Difficulté Difficile',
      texte: `
        <p>En <strong>Difficile</strong>, deux champs supplémentaires apparaissent : l'<strong>action recommandée</strong> à appliquer, et — quand l'alerte touche plusieurs entités — l'<strong>entité prioritaire</strong> à traiter en premier. C'est le niveau le plus exigeant, le plus proche d'une vraie prise de décision opérationnelle complète.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#zone-classification',
    },
    {
      id: 'roles-intro',
      titre: 'Le Rôle',
      texte: `
        <p>Le Rôle (Tuto / LVL1 / LVL2 / LVL3) représente votre position dans la hiérarchie d'un SOC réel, indépendamment de la Difficulté que nous venons de voir. Chaque niveau ajoute une responsabilité par rapport au précédent.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'role-l1',
      titre: 'LVL1 — Triage',
      texte: `
        <p><strong>LVL1</strong> ne fait que le tri : recevoir les alertes et les classer, exactement ce que nous venons de pratiquer ensemble. C'est le rôle d'entrée, celui qui reçoit le flux brut d'alertes.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'role-l2-intro',
      titre: 'LVL2 — Investigation et confinement',
      texte: `
        <p><strong>LVL2</strong> ajoute une étape après le tri : une fois la file traitée, chaque alerte que vous avez classée <strong>Vrai positif</strong> devient un correctif à résoudre dans un vrai petit poste de travail SOC — quatre logiciels simulés (pare-feu, antivirus, politique de groupe, gestionnaire de correctifs). Regardons à quoi ça ressemble.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'role-l2-demo',
      titre: 'Le bureau de résolution',
      texte: `
        <p>Pour chaque correctif, ouvrez l'application que vous jugez adaptée à l'indicateur mis en avant (cible affichée dans la fenêtre elle-même) : la liste des actions possibles s'y affiche directement, une seule est correcte pour cet indicateur. Comme pour la classification, aucun verdict immédiat — cliquer une action fait simplement passer au correctif suivant. Essayez les quatre applications de la barre des tâches !</p>
      `,
      vue: 'remediation',
      onglet: 'file',
      cible: '#remediation-bureau',
    },
    {
      id: 'role-l3-intro',
      titre: 'LVL3 — Réponse experte',
      texte: `
        <p><strong>LVL3</strong> est le niveau le plus élevé — et le dernier rempart, avec une différence notable dans le tri : l'option <strong>« À investiguer »</strong> disparaît du formulaire de classification. Il n'y a plus personne au-dessus à qui déléguer le doute : à ce niveau, on tranche toujours, Vrai ou Faux positif. Regardez le formulaire ci-dessous.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '.groupe-classification',
    },
    {
      id: 'role-l3-chasse',
      titre: 'La chasse aux menaces',
      texte: `
        <p>Seul le LVL3 a accès à un second onglet, en parallèle de la file : la <strong>chasse aux menaces</strong>. Un bureau simulé (SIEM, terminal, annuaire, explorateur de fichiers, pare-feu) contient des lignes bénignes noyant quelques signaux réels que le flux d'alertes classique n'a volontairement pas remontés — par exemple une règle de pare-feu bien trop permissive, noyée parmi des règles légitimes.</p>
        <p>Le bouton <strong>Eureka</strong> permet de signaler un élément suspect (avec confirmation avant enregistrement) ; <strong>Vision de l'expert</strong> est un « ulti » à charges limitées qui révèle temporairement les vrais signaux de la fenêtre ouverte — à utiliser avec parcimonie, le nombre de charges dépend de la Difficulté.</p>
      `,
      vue: 'session',
      onglet: 'chasse',
      cible: '#chasse-bureau',
    },
    {
      id: 'retour-file',
      titre: 'Naviguer librement',
      texte: `
        <p>En LVL3, vous alternez librement entre la file d'alertes et la chasse aux menaces à tout moment pendant la session — aucune des deux n'attend que l'autre soit terminée. Et comme en LVL2, une fois la file vidée, la résolution d'incident s'ajoute avant l'écran de correction.</p>
      `,
      vue: 'session',
      onglet: 'file',
      cible: '#onglets-session',
    },
    {
      id: 'correction-intro',
      titre: "L'écran de correction",
      texte: `
        <p>Une fois la file vidée (et la résolution d'incident terminée, si applicable), voici l'écran de correction : une note sur 20 fondée sur l'exactitude des classifications, un corrigé détaillé alerte par alerte avec la fiche complète consultable, et — pour LVL2/LVL3 — des scores séparés pour la résolution d'incident et la chasse aux menaces, jamais fondus dans la note principale. Un rapport JSON complet est aussi téléchargeable.</p>
        <p>Si vous avez validé quelques classifications pendant la visite, vous les retrouverez corrigées ci-dessous ; les alertes utilisées pour les démonstrations (résolution d'incident, difficultés) apparaissent comme non traitées, ce qui est normal — elles n'étaient pas là pour être classées.</p>
      `,
      vue: 'correction',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'recap',
      titre: 'En résumé',
      texte: `
        <p><strong>Rôle</strong> — quel travail vous faites : LVL1 trie, LVL2 trie puis résout les incidents confirmés, LVL3 trie (sans « à investiguer »), chasse en parallèle, puis résout aussi les incidents.</p>
        <p><strong>Difficulté</strong> — à quel point c'est exigeant, quel que soit le rôle : Facile (peu de champs, rythme calme, peu de pièges), Intermédiaire (+ indicateurs pertinents), Difficile (+ action recommandée et entité prioritaire, rythme soutenu, davantage de pièges).</p>
        <p>Les deux se combinent librement : un LVL3 peut très bien jouer en Facile, ou un LVL1 en Difficile.</p>
      `,
      vue: 'correction',
      onglet: 'file',
      cible: null,
    },
    {
      id: 'fin',
      titre: 'À vous de jouer',
      texte: `
        <p>Vous avez fait le tour de l'outil. Vous êtes prêt(e) à configurer une vraie session : choisissez votre Rôle et votre Difficulté sur l'écran d'accueil. Bonne chasse !</p>
      `,
      vue: 'correction',
      onglet: 'file',
      cible: null,
    },
  ];

  return { ETAPES };
});
