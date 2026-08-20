'use strict';

/*
 * Mini-jeu de résolution d'incident (LVL2 + LVL3) : pour chaque alerte que
 * l'étudiant a lui-même classée Vrai positif pendant le tri (jamais la
 * classification de référence brute — FR-013, FR-026), il doit ouvrir la
 * bonne application d'un « bureau » SOC simulé (pare-feu, antivirus,
 * politique de groupe, gestionnaire de correctifs) et y choisir la bonne
 * action de confinement pour l'indicateur mis en avant. Logique pure, sans
 * DOM (le bureau lui-même vit dans app/js/ui.js). Enveloppe UMD, cf.
 * app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Remediation = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const APPLICATIONS = {
    pare_feu: {
      nom: 'Pare-feu',
      actions: {
        adresse_ip: "Bloquer l'IP",
        domaine: 'Bloquer le domaine',
        adresse_email: "Bloquer l'expéditeur",
        port: 'Filtrer le port',
      },
    },
    antivirus: {
      nom: 'Antivirus',
      actions: {
        nom_fichier: 'Mettre le fichier en quarantaine',
        hachage_fichier: 'Mettre en quarantaine (par hachage)',
        processus: 'Arrêter le processus',
      },
    },
    politique_groupe: {
      nom: 'Politique de groupe',
      actions: {
        compte: 'Désactiver le compte',
        groupe: 'Retirer du groupe à privilèges',
        peripherique: 'Bloquer le périphérique (politique USB)',
      },
    },
    gestionnaire_correctifs: {
      nom: 'Gestionnaire de correctifs',
      actions: {
        cve: 'Appliquer le correctif de sécurité',
      },
    },
  };

  const APPLICATIONS_CLES = Object.keys(APPLICATIONS);
  const TOUTES_LES_ACTIONS = APPLICATIONS_CLES.flatMap((cle) => Object.values(APPLICATIONS[cle].actions));

  // Nombre d'options affichées par application ouverte (FR-030bis) : plus
  // il y en a, plus il faut trier parmi des leurres plausibles.
  const NB_OPTIONS_PAR_DIFFICULTE = { facile: 2, intermediaire: 3, difficile: 5 };

  function applicationPourIndicateur(typeIndicateur) {
    return APPLICATIONS_CLES.find((cle) => typeIndicateur in APPLICATIONS[cle].actions);
  }

  function melanger(liste, rng) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  function tirerN(liste, n, rng) {
    const bassin = liste.slice();
    const resultat = [];
    for (let i = 0; i < n && bassin.length > 0; i += 1) {
      const index = Math.floor(rng() * bassin.length);
      resultat.push(bassin.splice(index, 1)[0]);
    }
    return resultat;
  }

  // Options affichées quand l'étudiant ouvre `cleApp` pour cet item : si
  // c'est la bonne application, l'action correcte y figure toujours,
  // complétée de leurres ; sinon, uniquement des leurres (l'action
  // correcte n'existe dans aucune autre application — impossible de la
  // trouver « par erreur » dans la mauvaise app).
  function optionsPourApplication(cleApp, item, nombreOptions, rng) {
    const estBonneApp = cleApp === item.application;
    const actionsPropres = Object.values(APPLICATIONS[cleApp].actions).filter((a) => a !== item.action);
    const autresActions = TOUTES_LES_ACTIONS.filter((a) => a !== item.action && !actionsPropres.includes(a));
    const bassinLeurres = actionsPropres.concat(autresActions);
    const nombreLeurres = estBonneApp ? nombreOptions - 1 : nombreOptions;
    const leurres = tirerN(bassinLeurres, Math.max(0, nombreLeurres), rng);
    const options = estBonneApp ? [item.action].concat(leurres) : leurres;
    return melanger(options, rng);
  }

  // Alertes éligibles : celles que l'étudiant a lui-même classées Vrai
  // positif (jamais la classification de référence brute).
  function alertesEligibles(alertesApparues, decisions) {
    return decisions
      .filter((decision) => decision.classificationEtudiant === 'vrai_positif')
      .map((decision) => alertesApparues.find((alerte) => alerte.id === decision.alerteId))
      .filter(Boolean);
  }

  function genererExercice(alertesApparues, decisions, difficulte, rngPersonnalise) {
    const rng = rngPersonnalise || Math.random;
    const nombreOptions = NB_OPTIONS_PAR_DIFFICULTE[difficulte] || NB_OPTIONS_PAR_DIFFICULTE.intermediaire;

    return alertesEligibles(alertesApparues, decisions).map((alerte) => {
      const indicateurCible = alerte.indicateurs[0];
      const application = applicationPourIndicateur(indicateurCible.type);
      const action = APPLICATIONS[application].actions[indicateurCible.type];
      const item = { alerteId: alerte.id, categorie: alerte.categorie, indicateurCible, application, action };

      const optionsParApplication = {};
      APPLICATIONS_CLES.forEach((cleApp) => {
        optionsParApplication[cleApp] = optionsPourApplication(cleApp, item, nombreOptions, rng);
      });
      item.optionsParApplication = optionsParApplication;
      return item;
    });
  }

  // reponses : { [alerteId]: actionChoisie }
  function evaluerReponses(exercice, reponses) {
    const correctes = exercice.filter((item) => reponses[item.alerteId] === item.action).length;
    return { correctes, total: exercice.length };
  }

  return { APPLICATIONS, genererExercice, evaluerReponses };
});
