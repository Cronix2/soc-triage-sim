'use strict';

/*
 * Point d'entrée de l'application : configuration de session et
 * planification de l'apparition des alertes (FR-016, FR-017, FR-018).
 * Ce module ne connaît pas ui.js — il publie des événements ('alerte',
 * 'fin') auxquels ui.js s'abonne, pour garder les deux modules indépendants.
 */
(function () {
  let sessionActuelle = null;
  let minuteurAlerte = null;
  let minuteurFinSession = null;
  let enPause = false;
  let pauseDebutA = null;
  let alerteEnAttentePendantPause = false;
  const gestionnaires = { briefing: [], debut: [], alerte: [], fin: [], pause: [], reprise: [], tempsEcoule: [] };

  function afficherVue(idVue) {
    document.querySelectorAll('.vue').forEach((vue) => {
      vue.classList.toggle('active', vue.id === idVue);
    });
  }

  function sur(evenement, gestionnaire) {
    gestionnaires[evenement].push(gestionnaire);
  }

  function emettre(evenement, donnee) {
    gestionnaires[evenement].forEach((gestionnaire) => gestionnaire(donnee));
  }

  function terminerSession() {
    if (sessionActuelle.etat === 'terminee') {
      return; // déjà traité (le minuteur d'alerte et le minuteur de fin peuvent tous deux y mener)
    }
    if (minuteurAlerte) {
      clearTimeout(minuteurAlerte);
      minuteurAlerte = null;
    }
    if (minuteurFinSession) {
      clearTimeout(minuteurFinSession);
      minuteurFinSession = null;
    }
    enPause = false;
    sessionActuelle.etat = 'terminee';
    emettre('fin', sessionActuelle);
  }

  // Programme minuteurAlerte pour se déclencher dans `delaiMs`, en gardant
  // trace de l'échéance absolue (sessionActuelle.prochaineAlerteA) : c'est
  // ce qui permet à reprendre() de recalculer le délai restant après une
  // pause, sans perdre l'aléa déjà tiré pour cette alerte.
  function programmerAlerteDans(delaiMs) {
    sessionActuelle.prochaineAlerteA = Date.now() + delaiMs;
    minuteurAlerte = setTimeout(() => {
      if (window.Session.sessionEstTerminee(sessionActuelle, Date.now())) {
        signalerTempsEcoule();
        return;
      }
      const alerte = window.Alertes.genererAlerte(sessionActuelle);
      sessionActuelle.alertesApparues.push(alerte);
      emettre('alerte', alerte);
      planifierProchaineAlerte();
    }, delaiMs);
  }

  // Volume d'alertes volontairement réduit en LVL3 : un profil « senior »
  // n'est pas noyé sous les alertes, ce qui laisse du temps pour la chasse
  // aux menaces (activité en parallèle de la file, cf. ui.js/chasse.js).
  const LVL3_DELAI_MIN_MS = 20000;
  const LVL3_DELAI_MAX_MS = 90000;

  // Multiplicateur de cadence lié à la Difficulté (indépendante du Rôle,
  // FR-030) : Facile laisse plus de temps entre les alertes, Difficile
  // resserre le rythme, quel que soit le rôle choisi.
  const MULTIPLICATEUR_CADENCE_PAR_DIFFICULTE = { facile: 1.5, intermediaire: 1, difficile: 0.6 };

  function planifierProchaineAlerte() {
    if (window.Session.sessionEstTerminee(sessionActuelle, Date.now())) {
      signalerTempsEcoule();
      return;
    }

    let delai;
    if (sessionActuelle.role === 'lvl3') {
      delai = window.Session.prochainDelaiApparitionMs(undefined, LVL3_DELAI_MIN_MS, LVL3_DELAI_MAX_MS);
    } else {
      delai = window.Session.prochainDelaiApparitionMs();
    }
    delai = Math.round(delai * (MULTIPLICATEUR_CADENCE_PAR_DIFFICULTE[sessionActuelle.difficulte] || 1));
    programmerAlerteDans(delai);
  }

  // Le temps configuré écoulé n'implique plus la fin immédiate de la
  // session : on arrête seulement l'apparition de nouvelles alertes.
  // ui.js décide du moment réel de la clôture, une fois toutes les
  // alertes déjà apparues classées (voir verifierFinDeTriage).
  function signalerTempsEcoule() {
    if (!sessionActuelle || sessionActuelle.etat === 'terminee' || sessionActuelle.tempsEcoule) {
      return;
    }
    sessionActuelle.tempsEcoule = true;
    if (minuteurAlerte) {
      clearTimeout(minuteurAlerte);
      minuteurAlerte = null;
    }
    if (minuteurFinSession) {
      clearTimeout(minuteurFinSession);
      minuteurFinSession = null;
    }
    emettre('tempsEcoule', sessionActuelle);
  }

  function estEnPause() {
    return enPause;
  }

  // Pause : suspend le minuteur de fin de session et l'apparition de la
  // prochaine alerte, sans perdre leur échéance — reprendre() les décale
  // simplement de la durée de la pause au lieu de les recalculer.
  function mettreEnPause() {
    if (!sessionActuelle || sessionActuelle.etat === 'terminee' || enPause) {
      return;
    }
    enPause = true;
    pauseDebutA = Date.now();
    alerteEnAttentePendantPause = minuteurAlerte !== null;
    if (minuteurAlerte) {
      clearTimeout(minuteurAlerte);
      minuteurAlerte = null;
    }
    if (minuteurFinSession) {
      clearTimeout(minuteurFinSession);
      minuteurFinSession = null;
    }
    emettre('pause', sessionActuelle);
  }

  function reprendre() {
    if (!sessionActuelle || !enPause) {
      return;
    }
    const dureePauseMs = Date.now() - pauseDebutA;
    enPause = false;
    pauseDebutA = null;
    sessionActuelle.finA += dureePauseMs;

    if (alerteEnAttentePendantPause) {
      sessionActuelle.prochaineAlerteA += dureePauseMs;
      programmerAlerteDans(Math.max(0, sessionActuelle.prochaineAlerteA - Date.now()));
    }
    // Le mode Tuto n'a pas de minuteur de fin (voir demarrer ci-dessous) :
    // rien à reprogrammer pour lui après une pause.
    if (!sessionActuelle.tempsEcoule && sessionActuelle.role !== 'tuto') {
      minuteurFinSession = setTimeout(signalerTempsEcoule, Math.max(0, sessionActuelle.finA - Date.now()));
    }
    emettre('reprise', sessionActuelle);
  }

  // Le mode Tuto est une visite guidée scénarisée (cf. app/js/tutoriel.js
  // et ui.js), sans limite de temps ni apparition aléatoire d'alertes :
  // c'est le guide lui-même qui fait apparaître des alertes d'exemple, au
  // rythme de l'étudiant plutôt que sur un minuteur.
  function demarrer(dureeSecondes, entreprise, role, difficulte) {
    sessionActuelle = window.Session.demarrerSession(dureeSecondes);
    sessionActuelle.entreprise = entreprise;
    sessionActuelle.role = role;
    sessionActuelle.difficulte = difficulte;
    emettre('debut', sessionActuelle);
    if (role !== 'tuto') {
      planifierProchaineAlerte();
      // Minuteur dédié à la fin de session : détecte l'échéance exactement
      // à l'heure configurée, indépendamment de l'aléa des apparitions
      // d'alertes (FR-018). Ne clôt plus la session directement (FR-050) :
      // stoppe seulement l'apparition de nouvelles alertes tant que la
      // file en cours n'est pas entièrement traitée (cf.
      // ui.js:verifierFinDeTriage).
      minuteurFinSession = setTimeout(signalerTempsEcoule, dureeSecondes * 1000);
    }
    return sessionActuelle;
  }

  function obtenirSession() {
    return sessionActuelle;
  }

  const DUREES_PROPOSEES_MIN = [5, 10, 15, 30];
  const DUREE_PAR_DEFAUT_MIN = 15;
  // Le Rôle reflète la hiérarchie d'un SOC réel : LVL1 (triage), LVL2
  // (investigation + confinement), LVL3 (réponse experte / senior + chasse
  // aux menaces) — indépendant de la Difficulté (FR-030bis, FR-030ter).
  const NIVEAUX_ROLE = [
    { valeur: 'tuto', libelle: 'Tuto' },
    { valeur: 'lvl1', libelle: 'LVL1' },
    { valeur: 'lvl2', libelle: 'LVL2' },
    { valeur: 'lvl3', libelle: 'LVL3' },
  ];
  const ROLE_PAR_DEFAUT = 'lvl1';

  // La Difficulté module la cadence des alertes, le nombre de champs à
  // remplir par alerte (FR-030) et le nombre de pièges dans les exercices
  // — indépendamment du Rôle choisi.
  const NIVEAUX_DIFFICULTE = [
    { valeur: 'facile', libelle: 'Facile' },
    { valeur: 'intermediaire', libelle: 'Intermédiaire' },
    { valeur: 'difficile', libelle: 'Difficile' },
  ];
  const DIFFICULTE_PAR_DEFAUT = 'intermediaire';

  let dureeChoisieMin = DUREE_PAR_DEFAUT_MIN;
  let roleChoisi = ROLE_PAR_DEFAUT;
  let difficulteChoisie = DIFFICULTE_PAR_DEFAUT;
  let entrepriseActuelle = null;

  function initialiserFormulaireConfiguration() {
    const conteneur = document.getElementById('config-session');
    if (!conteneur) {
      return;
    }

    const pucesDuree = DUREES_PROPOSEES_MIN.map(
      (minutes) => `
        <button type="button" class="puce" data-minutes="${minutes}"
          aria-pressed="${minutes === DUREE_PAR_DEFAUT_MIN}">${minutes} MIN</button>
      `
    ).join('');

    const pucesRole = NIVEAUX_ROLE.map(
      (niveau) => `
        <button type="button" class="puce" data-role="${niveau.valeur}"
          aria-pressed="${niveau.valeur === ROLE_PAR_DEFAUT}">${niveau.libelle}</button>
      `
    ).join('');

    const pucesDifficulte = NIVEAUX_DIFFICULTE.map(
      (niveau) => `
        <button type="button" class="puce" data-difficulte="${niveau.valeur}"
          aria-pressed="${niveau.valeur === DIFFICULTE_PAR_DEFAUT}">${niveau.libelle}</button>
      `
    ).join('');

    conteneur.innerHTML = `
      <h2 class="titre-section">Durée de la session</h2>
      <div class="groupe-puces" id="groupe-duree" role="group" aria-label="Durée de la session">
        ${pucesDuree}
      </div>
      <h2 class="titre-section">Rôle</h2>
      <p class="indication-discrete">Votre position dans la hiérarchie du SOC — LVL1 : triage, LVL2 : investigation et confinement, LVL3 : réponse experte et chasse aux menaces.</p>
      <div class="groupe-puces" id="groupe-role" role="group" aria-label="Rôle">
        ${pucesRole}
      </div>
      <h2 class="titre-section">Difficulté</h2>
      <p class="indication-discrete">Indépendante du rôle — module le rythme des alertes, le nombre de champs à justifier par alerte et le nombre de pièges dans les exercices.</p>
      <div class="groupe-puces" id="groupe-difficulte" role="group" aria-label="Difficulté">
        ${pucesDifficulte}
      </div>
    `;

    const noteDureeTuto = document.createElement('p');
    noteDureeTuto.className = 'indication-discrete';
    noteDureeTuto.id = 'note-duree-tuto';
    noteDureeTuto.hidden = true;
    noteDureeTuto.textContent = 'Mode tuto : visite guidée scénarisée, sans limite de temps — un référent vous accompagne pas à pas.';
    document.getElementById('groupe-duree').insertAdjacentElement('afterend', noteDureeTuto);

    conteneur.querySelectorAll('#groupe-duree .puce').forEach((puce) => {
      puce.addEventListener('click', () => {
        conteneur
          .querySelectorAll('#groupe-duree .puce')
          .forEach((autre) => autre.setAttribute('aria-pressed', 'false'));
        puce.setAttribute('aria-pressed', 'true');
        dureeChoisieMin = Number(puce.dataset.minutes);
      });
    });

    // Le Tuto n'a ni durée ni Difficulté configurables : c'est une visite
    // guidée scénarisée, sans limite de temps (cf. main.js:demarrer et
    // ui.js pour le moteur du guide).
    function appliquerEtatSelonRole(role) {
      const enTuto = role === 'tuto';
      document.getElementById('groupe-duree').hidden = enTuto;
      document.getElementById('note-duree-tuto').hidden = !enTuto;
      document.getElementById('groupe-difficulte').hidden = enTuto;
      if (!enTuto) {
        dureeChoisieMin = DUREE_PAR_DEFAUT_MIN;
        conteneur.querySelectorAll('#groupe-duree .puce').forEach((puce) => {
          puce.setAttribute('aria-pressed', String(Number(puce.dataset.minutes) === DUREE_PAR_DEFAUT_MIN));
        });
      }
    }

    conteneur.querySelectorAll('#groupe-role .puce').forEach((puce) => {
      puce.addEventListener('click', () => {
        conteneur
          .querySelectorAll('#groupe-role .puce')
          .forEach((autre) => autre.setAttribute('aria-pressed', 'false'));
        puce.setAttribute('aria-pressed', 'true');
        roleChoisi = puce.dataset.role;
        appliquerEtatSelonRole(roleChoisi);
      });
    });

    conteneur.querySelectorAll('#groupe-difficulte .puce').forEach((puce) => {
      puce.addEventListener('click', () => {
        conteneur
          .querySelectorAll('#groupe-difficulte .puce')
          .forEach((autre) => autre.setAttribute('aria-pressed', 'false'));
        puce.setAttribute('aria-pressed', 'true');
        difficulteChoisie = puce.dataset.difficulte;
      });
    });

    document.getElementById('bouton-demarrer').addEventListener('click', () => {
      entrepriseActuelle = window.Entreprise.genererEntreprise();
      emettre('briefing', { entreprise: entrepriseActuelle, role: roleChoisi, difficulte: difficulteChoisie });
      afficherVue('vue-briefing');
    });
  }

  function initialiserBoutonCommencerTri() {
    const bouton = document.getElementById('bouton-commencer-tri');
    if (!bouton) {
      return;
    }
    bouton.addEventListener('click', () => {
      demarrer(dureeChoisieMin * 60, entrepriseActuelle, roleChoisi, difficulteChoisie);
      afficherVue('vue-session');
    });
  }

  function initialiserBoutonNouvelleSession() {
    const bouton = document.getElementById('bouton-nouvelle-session');
    if (!bouton) {
      return;
    }
    // Recharger la page réinitialise proprement tous les modules (session,
    // alertes, décisions) sans avoir à dupliquer une logique de remise à
    // zéro dans chaque fichier.
    bouton.addEventListener('click', () => window.location.reload());
  }

  document.addEventListener('DOMContentLoaded', () => {
    initialiserFormulaireConfiguration();
    initialiserBoutonCommencerTri();
    initialiserBoutonNouvelleSession();
  });

  window.Principal = {
    demarrer,
    obtenirSession,
    sur,
    afficherVue,
    terminerMaintenant: terminerSession,
    estEnPause,
    mettreEnPause,
    reprendre,
  };
})();
