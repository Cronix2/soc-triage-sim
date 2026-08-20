'use strict';

/*
 * Liaison entre la logique métier (entreprise.js, alertes.js, session.js,
 * triage.js, fiche.js, correction.js, stockage.js) et le DOM. Seul module
 * non couvert par des tests automatisés (voir plan.md) — vérifié
 * manuellement via quickstart.md.
 */
(function () {
  const decisions = [];
  let alerteSelectionneeId = null;
  let minuteurIntervalle = null;

  // --- État du mini-jeu de résolution d'incident (LVL2/LVL3, FR-054 à FR-057) ---
  let exerciceRemediation = [];
  let reponsesRemediation = {};
  let indexCorrectifActuel = 0;
  let resultatRemediation = null;

  // --- État de la chasse aux menaces (LVL3, FR-058 à FR-062) ---
  let exerciceChasse = null;
  let signalementsChasse = [];
  let visionUtilisee = false;
  let chargesVision = 0;
  let visionTimeoutId = null;
  let modeEurekaActif = false;
  let indexPenseeActuelle = 0;
  let resultatChasse = null;

  // --- État du guide scénarisé du mode Tuto (FR-035 à FR-035ter) ---
  let modeTutorielActif = false;
  let etapeTutorielActuelle = 0;
  // Niveau de champs explicitement imposé par l'étape en cours du guide
  // (voir champsEffectifs) — indépendant de session.difficulte, qui reste
  // sans effet tant que le guide est actif.
  let tutorielNiveauChamps = null;

  const ETIQUETTES_CATEGORIE = {
    phishing: 'Phishing',
    authentification_suspecte: 'Authentification suspecte',
    malware: 'Malware',
    exfiltration: 'Exfiltration de données',
    deni_de_service: 'Déni de service (DDoS)',
    elevation_privileges: 'Élévation de privilèges',
    vulnerabilite_exploitee: 'Vulnérabilité exploitée',
  };

  const ETIQUETTES_CLASSIFICATION = {
    vrai_positif: 'Vrai positif',
    faux_positif: 'Faux positif',
    a_investiguer: 'À investiguer',
  };

  const COULEURS_CATEGORIE = {
    phishing: 'var(--cat-phishing)',
    authentification_suspecte: 'var(--cat-auth)',
    malware: 'var(--cat-malware)',
    exfiltration: 'var(--cat-exfiltration)',
    deni_de_service: 'var(--cat-deni-service)',
    elevation_privileges: 'var(--cat-elevation-privileges)',
    vulnerabilite_exploitee: 'var(--cat-vulnerabilite)',
  };

  const ACTIONS_PROPOSEES = [
    "Isoler le poste ou le compte concerné",
    'Réinitialiser les identifiants',
    "Bloquer l'indicateur (IP / domaine / hachage)",
    'Mettre en quarantaine',
    'Clôturer sans action',
    'Escalader vers un analyste senior',
  ];

  function formaterHorodatage(iso) {
    return new Date(iso).toLocaleString('fr-FR');
  }

  function trouverAlerte(alerteId) {
    return window.Principal.obtenirSession().alertesApparues.find((a) => a.id === alerteId);
  }

  function trouverDecision(alerteId) {
    return decisions.find((d) => d.alerteId === alerteId);
  }

  // --- Briefing de mission (US5) ---

  function afficherBriefing({ entreprise, role }) {
    const conteneur = document.getElementById('briefing-contenu');
    const noteTuto =
      role === 'tuto'
        ? `<p class="indication-discrete">Mode tuto : ce contexte sert d'exemple pour découvrir l'outil ; un référent vous guidera pas à pas, sans limite de temps.</p>`
        : '';
    conteneur.innerHTML = `
      ${noteTuto}
      <p><strong>${entreprise.nom}</strong> — ${entreprise.description} (secteur : ${entreprise.secteur}).</p>
      <p>Vous rejoignez le SOC de l'entreprise pour la durée de la session. Repères utiles :</p>
      <h3 class="titre-section">Effectif</h3>
      <ul>
        ${entreprise.employes.map((e) => `<li>${e.nom} — ${e.poste}</li>`).join('')}
      </ul>
      <h3 class="titre-section">Systèmes clés</h3>
      <ul>
        ${entreprise.serveurs.map((s) => `<li class="valeur-mono">${s.nom} — ${s.role}</li>`).join('')}
      </ul>
    `;
  }

  // --- Liste des alertes (US1 : FR-001, FR-002) ---

  function ajouterAlerteALaListe(alerte) {
    document.getElementById('liste-alertes-vide').hidden = true;

    const item = document.createElement('li');
    item.className = 'alerte-item arrivee';
    item.dataset.id = alerte.id;
    item.dataset.categorie = alerte.categorie;
    item.style.setProperty('--categorie-couleur', COULEURS_CATEGORIE[alerte.categorie]);
    item.innerHTML = `
      <div class="alerte-entete">
        <span class="alerte-categorie">${ETIQUETTES_CATEGORIE[alerte.categorie]}</span>
        <span class="etiquette-nouveau">NOUVEAU</span>
        <span>${formaterHorodatage(alerte.horodatage)}</span>
      </div>
      <p>${alerte.description}</p>
    `;
    item.addEventListener('click', () => selectionnerAlerte(alerte.id));

    document.getElementById('liste-alertes-contenu').appendChild(item);

    setTimeout(() => item.classList.remove('arrivee'), 1500);
    setTimeout(() => {
      const etiquette = item.querySelector('.etiquette-nouveau');
      if (etiquette) {
        etiquette.remove();
      }
    }, 4000);
  }

  function retirerAlerteDeLaListe(alerteId) {
    const item = document.querySelector(`.alerte-item[data-id="${alerteId}"]`);
    if (!item) {
      return;
    }

    const finaliser = () => {
      item.remove();
      if (document.querySelectorAll('#liste-alertes-contenu .alerte-item').length === 0) {
        document.getElementById('liste-alertes-vide').hidden = false;
      }
    };

    item.classList.add('disparition');
    item.addEventListener('transitionend', finaliser, { once: true });
    // Filet de sécurité si la transition ne se déclenche pas (mouvement
    // réduit préféré par l'utilisateur, ou navigateur atypique).
    setTimeout(finaliser, 500);
  }

  function reinitialiserDetailAlerte() {
    alerteSelectionneeId = null;
    document.getElementById('detail-alerte-vide').hidden = false;
    const conteneur = document.getElementById('detail-alerte-contenu');
    conteneur.hidden = true;
    conteneur.innerHTML = '';
  }

  // --- Détail d'une alerte (US1 : FR-002 ; US6 : détails complémentaires) ---

  function selectionnerAlerte(alerteId) {
    alerteSelectionneeId = alerteId;

    document.querySelectorAll('.alerte-item').forEach((item) => {
      item.classList.toggle('selectionnee', item.dataset.id === alerteId);
    });

    const alerte = trouverAlerte(alerteId);
    afficherDetailAlerte(alerte);
  }

  function afficherDetailAlerte(alerte) {
    document.getElementById('detail-alerte-vide').hidden = true;
    const conteneur = document.getElementById('detail-alerte-contenu');
    conteneur.hidden = false;

    const entitesHtml = alerte.entitesAffectees
      .map((e) => `<span class="valeur-mono">${e.type} : ${e.identifiant}</span>`)
      .join('<br>');
    const indicateursHtml = `
      <ul class="liste-indicateurs">
        ${alerte.indicateurs
          .map(
            (i, index) => `
          <li>
            <span class="valeur-mono">${i.type} : ${i.valeur}</span>
            <button type="button" class="secondaire bouton-analyser" data-index="${index}">${window.Icones.balise('loupe')} Analyser</button>
          </li>
        `
          )
          .join('')}
      </ul>
    `;

    const decisionExistante = trouverDecision(alerte.id);

    conteneur.innerHTML = `
      <dl class="bloc-detail">
        <dt>Catégorie</dt>
        <dd>${ETIQUETTES_CATEGORIE[alerte.categorie]}</dd>
        <dt>Heure</dt>
        <dd class="valeur-mono">${formaterHorodatage(alerte.horodatage)}</dd>
        <dt>Description</dt>
        <dd>${alerte.description}</dd>
        <dt>Entités affectées</dt>
        <dd>${entitesHtml}</dd>
        <dt>Indicateurs</dt>
        <dd>${indicateursHtml}</dd>
      </dl>
      <div class="actions-contact">
        ${alerte.employeContact ? `<button type="button" class="secondaire" id="bouton-contacter-employe">${window.Icones.balise('messages')} Contacter ${alerte.employeContact.nom}</button>` : ''}
        <button type="button" class="secondaire" id="bouton-plus-details">${window.Icones.balise('chevron')} Afficher plus de détails</button>
      </div>
      <dl class="bloc-detail" id="plus-details-contenu" hidden></dl>
      <div id="zone-classification"></div>
    `;

    conteneur.querySelectorAll('.bouton-analyser').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        afficherAnalyseIndicateur(alerte.analysesIndicateurs[Number(bouton.dataset.index)]);
      });
    });

    const boutonContacter = document.getElementById('bouton-contacter-employe');
    if (boutonContacter) {
      boutonContacter.addEventListener('click', () => afficherConversationEmploye(alerte));
    }

    document.getElementById('bouton-plus-details').addEventListener('click', (evenement) => {
      const zoneDetails = document.getElementById('plus-details-contenu');
      const etaitCachee = zoneDetails.hidden;
      if (etaitCachee && zoneDetails.childElementCount === 0) {
        zoneDetails.innerHTML = alerte.detailsSupplementaires
          .map((d) => `<dt>${d.libelle}</dt><dd class="valeur-mono">${d.valeur}</dd>`)
          .join('');
      }
      zoneDetails.hidden = !etaitCachee;
      evenement.currentTarget.innerHTML = etaitCachee
        ? `${window.Icones.balise('chevron')} Masquer les détails`
        : `${window.Icones.balise('chevron')} Afficher plus de détails`;
    });

    if (decisionExistante) {
      afficherAlerteVerrouillee(decisionExistante);
    } else {
      afficherFormulaireClassification(alerte);
    }
  }

  function afficherAlerteVerrouillee(decision) {
    const zone = document.getElementById('zone-classification');
    zone.innerHTML = `
      <p>
        Alerte verrouillée : déjà classée
        « ${ETIQUETTES_CLASSIFICATION[decision.classificationEtudiant]} », non modifiable.
      </p>
      <p><strong>Raison saisie</strong> : ${decision.raison}</p>
    `;
  }

  // --- Fenêtre modale générique ---

  function ouvrirModale(titre, contenuHtml) {
    document.getElementById('modale-titre').textContent = titre;
    document.getElementById('modale-corps').innerHTML = contenuHtml;
    document.getElementById('modale-fond').hidden = false;
    document.getElementById('modale-fermer').focus();
  }

  function fermerModale() {
    document.getElementById('modale-fond').hidden = true;
    document.getElementById('modale-corps').innerHTML = '';
  }

  function initialiserModale() {
    document.getElementById('modale-fermer').innerHTML = window.Icones.balise('fermer');
    document.getElementById('modale-fermer').addEventListener('click', fermerModale);
    document.getElementById('modale-fond').addEventListener('click', (evenement) => {
      if (evenement.target.id === 'modale-fond') {
        fermerModale();
      }
    });
    document.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Escape' && !document.getElementById('modale-fond').hidden) {
        fermerModale();
      }
    });
  }

  // --- Analyse fictive d'un indicateur (US7 : outil façon « VirusTotal ») ---

  function afficherAnalyseIndicateur(analyse) {
    ouvrirModale(
      `Analyse — ${analyse.typeCible}`,
      `
      <div class="rapport-analyse">
        <p class="valeur-mono">${analyse.cible}</p>
        <p class="rapport-score">${analyse.score} <span class="badge ${analyse.detections >= 15 ? 'incorrect' : 'correct'}">${analyse.verdictAffiche}</span></p>
        <dl>
          <dt>Première observation</dt>
          <dd>${analyse.premiereObservation}</dd>
          ${analyse.details.map((d) => `<dt>Élément</dt><dd>${d}</dd>`).join('')}
        </dl>
      </div>
    `
    );
  }

  // --- Conversation fictive avec l'employé concerné (US7 : discussion SMS) ---

  function ajouterBulle(conteneur, sens, texte) {
    const bulle = document.createElement('p');
    bulle.className = `bulle ${sens}`;
    bulle.textContent = texte;
    conteneur.appendChild(bulle);
    conteneur.scrollTop = conteneur.scrollHeight;
  }

  function afficherConversationEmploye(alerte) {
    ouvrirModale(
      `Discussion — ${alerte.employeContact.nom}`,
      `
      <div class="fil-conversation" id="fil-conversation"></div>
      <div class="groupe-questions" id="groupe-questions"></div>
    `
    );

    const fil = document.getElementById('fil-conversation');
    const zoneQuestions = document.getElementById('groupe-questions');

    alerte.conversationEmploye.forEach((echange) => {
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'puce';
      bouton.textContent = echange.question;
      bouton.addEventListener('click', () => {
        bouton.disabled = true;
        ajouterBulle(fil, 'envoye', echange.question);
        setTimeout(() => ajouterBulle(fil, 'recu', echange.reponse), 500);
      });
      zoneQuestions.appendChild(bouton);
    });
  }

  // --- Formulaire de classification (US1 : FR-003, FR-004, FR-015 ; US6 : difficulté) ---

  // Détermine le nombre de champs à remplir pour l'alerte courante
  // (FR-030) : dépend de la Difficulté (facile/intermediaire/difficile),
  // indépendamment du Rôle — sauf pendant le guide du mode Tuto, qui
  // impose explicitement le niveau démontré à chaque étape (voir
  // tutorielNiveauChamps ci-dessous, section « Guide scénarisé »).
  function champsEffectifs() {
    if (modeTutorielActif) {
      return tutorielNiveauChamps || 'facile';
    }
    const session = window.Principal.obtenirSession();
    return (session && session.difficulte) || 'intermediaire';
  }

  function afficherFormulaireClassification(alerte) {
    const difficulte = champsEffectifs();
    const niveauAvance = difficulte === 'intermediaire' || difficulte === 'difficile';
    const zone = document.getElementById('zone-classification');
    const session = window.Principal.obtenirSession();
    // Le L3 est le plus haut niveau de technicité : il n'y a personne
    // au-dessus à qui escalader une ambiguïté, il doit toujours trancher
    // (FR-053bis).
    const peutInvestiguer = !session || session.role !== 'lvl3';

    const champIndicateurs = !niveauAvance
      ? ''
      : `
      <div class="champ-raison">
        <label>Indicateurs jugés pertinents pour votre décision</label>
        ${alerte.indicateurs
          .map(
            (indicateur, index) => `
          <label class="option-case">
            <input type="checkbox" class="case-indicateur" value="${index}"> ${indicateur.type} : ${indicateur.valeur}
          </label>
        `
          )
          .join('')}
      </div>
    `;

    const champAction =
      difficulte !== 'difficile'
        ? ''
        : `
      <div class="champ-raison">
        <label for="action-choisie">Action recommandée</label>
        <select id="action-choisie">
          <option value="">— Choisir —</option>
          ${ACTIONS_PROPOSEES.map((action) => `<option>${action}</option>`).join('')}
        </select>
      </div>
    `;

    const plusieursEntites = alerte.entitesAffectees.length > 1;
    const champEntite =
      difficulte !== 'difficile' || !plusieursEntites
        ? ''
        : `
      <div class="champ-raison">
        <label for="entite-prioritaire">Entité prioritaire à traiter</label>
        <select id="entite-prioritaire">
          <option value="">— Choisir —</option>
          ${alerte.entitesAffectees
            .map((entite) => `<option value="${entite.identifiant}">${entite.type} : ${entite.identifiant}</option>`)
            .join('')}
        </select>
      </div>
    `;

    zone.innerHTML = `
      <div class="groupe-classification${peutInvestiguer ? '' : ' groupe-classification-reduit'}" role="group" aria-label="Classification">
        <button type="button" class="carte-classification" data-classe="vrai_positif" aria-pressed="false">Vrai positif</button>
        <button type="button" class="carte-classification" data-classe="faux_positif" aria-pressed="false">Faux positif</button>
        ${peutInvestiguer ? '<button type="button" class="carte-classification" data-classe="a_investiguer" aria-pressed="false">À investiguer</button>' : ''}
      </div>
      ${peutInvestiguer ? '' : '<p class="indication-discrete">Niveau LVL3 : à vous de trancher, il n\'y a personne au-dessus à qui escalader le doute.</p>'}
      ${champIndicateurs}
      ${champAction}
      ${champEntite}
      <div class="champ-raison">
        <label for="raison-classification">Raison de la décision</label>
        <textarea id="raison-classification" rows="3" placeholder="Qu'est-ce qui justifie ce choix ?"></textarea>
      </div>
      <p class="erreur-champ" id="erreur-classification" hidden></p>
      <button type="button" id="bouton-valider-classification" disabled>Valider la classification</button>
    `;

    let classeChoisie = null;
    const champRaison = document.getElementById('raison-classification');
    const boutonValider = document.getElementById('bouton-valider-classification');
    const champActionEl = document.getElementById('action-choisie');
    const champEntiteEl = document.getElementById('entite-prioritaire');

    function actualiserActivationBouton() {
      const raisonRemplie = champRaison.value.trim().length > 0;
      const indicateursOk =
        !niveauAvance || zone.querySelectorAll('.case-indicateur:checked').length > 0;
      const actionOk = difficulte !== 'difficile' || (champActionEl && champActionEl.value !== '');
      const entiteOk = !champEntiteEl || champEntiteEl.value !== '';
      boutonValider.disabled = !classeChoisie || !raisonRemplie || !indicateursOk || !actionOk || !entiteOk;
    }

    zone.querySelectorAll('.carte-classification').forEach((carte) => {
      carte.addEventListener('click', () => {
        zone.querySelectorAll('.carte-classification').forEach((c) => c.setAttribute('aria-pressed', 'false'));
        carte.setAttribute('aria-pressed', 'true');
        classeChoisie = carte.dataset.classe;
        actualiserActivationBouton();
      });
    });

    champRaison.addEventListener('input', actualiserActivationBouton);
    zone.querySelectorAll('.case-indicateur').forEach((c) => c.addEventListener('change', actualiserActivationBouton));
    if (champActionEl) {
      champActionEl.addEventListener('change', actualiserActivationBouton);
    }
    if (champEntiteEl) {
      champEntiteEl.addEventListener('change', actualiserActivationBouton);
    }

    boutonValider.addEventListener('click', () => soumettreClassification(alerte, classeChoisie));
  }

  function soumettreClassification(alerte, classeChoisie) {
    const raison = document.getElementById('raison-classification').value;
    const erreur = document.getElementById('erreur-classification');

    try {
      const decision = window.Triage.validerClassification(alerte, classeChoisie, raison, decisions);

      const casesIndicateurs = document.querySelectorAll('.case-indicateur:checked');
      if (casesIndicateurs.length > 0) {
        decision.indicateursSelectionnes = Array.from(casesIndicateurs).map(
          (c) => alerte.indicateurs[Number(c.value)]
        );
      }
      const champAction = document.getElementById('action-choisie');
      if (champAction && champAction.value) {
        decision.actionChoisie = champAction.value;
      }
      const champEntite = document.getElementById('entite-prioritaire');
      if (champEntite && champEntite.value) {
        decision.entitePrioritaire = champEntite.value;
      }

      decisions.push(decision);
      erreur.hidden = true;
      retirerAlerteDeLaListe(alerte.id);
      afficherAlerteVerrouillee(decision);
      setTimeout(() => {
        if (alerteSelectionneeId === alerte.id) {
          reinitialiserDetailAlerte();
        }
      }, 1500);

      // La fiche est générée et conservée dès maintenant, mais volontairement
      // pas affichée : elle révèle la classification de référence, ce qui
      // casserait la correction différée (FR-013). Elle n'est révélée qu'à
      // l'écran de correction, en fin de session.
      const fiche = window.Fiche.genererFicheMarkdown(alerte, decision);
      window.Stockage.enregistrerFiche(fiche);
      actualiserHistorique();
      verifierFinDeTriage();
    } catch (e) {
      erreur.textContent = e.message;
      erreur.hidden = false;
    }
  }

  // --- Historique de la session, sans révélation (US2/US6 : FR-011) ---

  function actualiserHistorique() {
    const conteneur = document.getElementById('historique-fiches-contenu');
    document.getElementById('historique-fiches-vide').hidden = decisions.length > 0;
    conteneur.innerHTML = '';

    decisions.forEach((decision) => {
      const alerte = trouverAlerte(decision.alerteId);
      const item = document.createElement('li');
      item.innerHTML = `
        <span>${formaterHorodatage(decision.horodatageDecision)} — ${ETIQUETTES_CATEGORIE[alerte.categorie]}</span>
        <span class="badge ${decision.classificationEtudiant}">${ETIQUETTES_CLASSIFICATION[decision.classificationEtudiant]}</span>
      `;
      conteneur.appendChild(item);
    });
  }

  // --- Filtre par catégorie (US3) ---

  function appliquerFiltreCategorie(categorieChoisie) {
    document.querySelectorAll('.alerte-item').forEach((item) => {
      item.hidden = categorieChoisie !== 'toutes' && item.dataset.categorie !== categorieChoisie;
    });
  }

  function initialiserFiltreCategorie() {
    const conteneur = document.getElementById('filtre-categorie-conteneur');
    const options = [{ valeur: 'toutes', libelle: 'Toutes' }].concat(
      Object.entries(ETIQUETTES_CATEGORIE).map(([valeur, libelle]) => ({ valeur, libelle }))
    );

    conteneur.innerHTML = options
      .map(
        (option, index) => `
        <button type="button" class="puce puce-filtre" data-categorie="${option.valeur}"
          aria-pressed="${index === 0}">
          ${option.valeur === 'toutes' ? '' : `<span class="pastille" style="background: ${COULEURS_CATEGORIE[option.valeur]}"></span> `}${option.libelle}
        </button>
      `
      )
      .join('');

    conteneur.querySelectorAll('.puce-filtre').forEach((puce) => {
      puce.addEventListener('click', () => {
        conteneur.querySelectorAll('.puce-filtre').forEach((p) => p.setAttribute('aria-pressed', 'false'));
        puce.setAttribute('aria-pressed', 'true');
        appliquerFiltreCategorie(puce.dataset.categorie);
      });
    });
  }

  // --- Chasse aux menaces (LVL3 uniquement, FR-058 à FR-062) ---
  //
  // Onglet disponible pendant toute la session (en parallèle de la file
  // d'alertes classique) : un « bureau » simulé avec un SIEM et un
  // terminal fictifs à ouvrir, une bulle de pensées qui suggère des
  // pistes, un bouton « Vision de l'expert » (ulti à charges limitées,
  // FR-061) et un bouton « Eureka » pour signaler un élément suspect,
  // validé explicitement via une fenêtre de confirmation. Aucun verdict
  // n'est révélé au moment du signalement (FR-013/FR-026) : le résultat
  // n'apparaît qu'à l'écran de correction.

  const CHARGES_VISION_PAR_DIFFICULTE = { facile: 3, intermediaire: 2, difficile: 1 };
  const DUREE_REVELATION_VISION_MS = 6000;

  // Horloge décorative de la barre des tâches (bureau façon Flipper Zero) :
  // purement cosmétique, démarrée une fois par bureau au premier affichage.
  function demarrerHorloge(idHorloge, idDate) {
    const elementHorloge = document.getElementById(idHorloge);
    const elementDate = idDate ? document.getElementById(idDate) : null;
    if (!elementHorloge) {
      return;
    }
    const actualiser = () => {
      const maintenant = new Date();
      elementHorloge.textContent = maintenant.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      if (elementDate) {
        elementDate.textContent = maintenant.toLocaleDateString('fr-FR');
      }
    };
    actualiser();
    setInterval(actualiser, 1000);
  }

  // --- Fenêtres du bureau : déplaçables au glisser, position mémorisée ---
  //
  // Une seule instance de fenêtre par bureau (le contenu est remplacé
  // selon l'application ouverte) : on ne recentre qu'à la toute première
  // ouverture de la session, ensuite la position choisie par l'étudiant
  // (glissée ou non) est conservée d'une application à l'autre.

  function centrerFenetre(fenetre) {
    const fond = fenetre.parentElement;
    const left = Math.max(0, Math.round((fond.clientWidth - fenetre.offsetWidth) / 2));
    fenetre.style.left = `${left}px`;
    fenetre.style.top = '12px';
  }

  function rendreFenetreDeplacable(fenetre, bandeau) {
    let enGlissement = false;
    let decalageX = 0;
    let decalageY = 0;

    bandeau.addEventListener('pointerdown', (evenement) => {
      if (evenement.target.closest('.bureau-fenetre-controles') || fenetre.dataset.agrandie === 'true') {
        return; // ne pas démarrer un glissement en cliquant un bouton de fenêtre, ni en plein écran
      }
      const rectFenetre = fenetre.getBoundingClientRect();
      decalageX = evenement.clientX - rectFenetre.left;
      decalageY = evenement.clientY - rectFenetre.top;
      enGlissement = true;
      bandeau.setPointerCapture(evenement.pointerId);
    });

    bandeau.addEventListener('pointermove', (evenement) => {
      if (!enGlissement) {
        return;
      }
      const fond = fenetre.parentElement;
      const rectFond = fond.getBoundingClientRect();
      const maxLeft = Math.max(0, fond.clientWidth - fenetre.offsetWidth);
      const maxTop = Math.max(0, fond.clientHeight - fenetre.offsetHeight);
      const nouveauLeft = Math.min(maxLeft, Math.max(0, evenement.clientX - rectFond.left - decalageX));
      const nouveauTop = Math.min(maxTop, Math.max(0, evenement.clientY - rectFond.top - decalageY));
      fenetre.style.left = `${nouveauLeft}px`;
      fenetre.style.top = `${nouveauTop}px`;
    });

    const arreterGlissement = () => {
      enGlissement = false;
    };
    bandeau.addEventListener('pointerup', arreterGlissement);
    bandeau.addEventListener('pointercancel', arreterGlissement);
  }

  // Redimensionnement libre par la poignée en coin bas-droit : une fois
  // utilisée, la taille choisie par l'étudiant prime sur la largeur par
  // défaut de chaque application (cf. afficherFenetreBureau).
  function rendreFenetreRedimensionnable(fenetre, poignee) {
    let enRedimensionnement = false;
    let largeurDepart = 0;
    let hauteurDepart = 0;
    let pointerXDepart = 0;
    let pointerYDepart = 0;

    poignee.addEventListener('pointerdown', (evenement) => {
      largeurDepart = fenetre.offsetWidth;
      hauteurDepart = fenetre.offsetHeight;
      pointerXDepart = evenement.clientX;
      pointerYDepart = evenement.clientY;
      enRedimensionnement = true;
      poignee.setPointerCapture(evenement.pointerId);
      evenement.stopPropagation();
    });

    poignee.addEventListener('pointermove', (evenement) => {
      if (!enRedimensionnement) {
        return;
      }
      const fond = fenetre.parentElement;
      const style = getComputedStyle(fenetre);
      const largeurMin = parseFloat(style.minWidth) || 0;
      const hauteurMin = parseFloat(style.minHeight) || 0;
      const largeurMax = fond.clientWidth - fenetre.offsetLeft;
      const hauteurMax = fond.clientHeight - fenetre.offsetTop;
      const nouvelleLargeur = Math.min(largeurMax, Math.max(largeurMin, largeurDepart + (evenement.clientX - pointerXDepart)));
      const nouvelleHauteur = Math.min(hauteurMax, Math.max(hauteurMin, hauteurDepart + (evenement.clientY - pointerYDepart)));
      fenetre.style.width = `${nouvelleLargeur}px`;
      fenetre.style.height = `${nouvelleHauteur}px`;
      fenetre.dataset.redimensionnee = 'true';
    });

    const arreterRedimensionnement = () => {
      enRedimensionnement = false;
    };
    poignee.addEventListener('pointerup', arreterRedimensionnement);
    poignee.addEventListener('pointercancel', arreterRedimensionnement);
  }

  // Masque la fenêtre sans réinitialiser l'état « application en cours » —
  // contrairement à fermer, l'icône reste active et la rouvrir (icône
  // bureau ou barre des tâches) affiche à nouveau la même fenêtre.
  function reduireFenetre(fenetre) {
    fenetre.hidden = true;
  }

  // Bascule plein écran (bouton « agrandir ») : occupe tout le bureau, un
  // second clic restaure la position et la taille précédentes.
  function basculerAgrandirFenetre(fenetre) {
    const fond = fenetre.parentElement;
    if (fenetre.dataset.agrandie === 'true') {
      fenetre.style.left = fenetre.dataset.avantAgrandirLeft;
      fenetre.style.top = fenetre.dataset.avantAgrandirTop;
      fenetre.style.width = fenetre.dataset.avantAgrandirLargeur;
      fenetre.style.height = fenetre.dataset.avantAgrandirHauteur;
      fenetre.dataset.agrandie = 'false';
      fenetre.classList.remove('agrandie');
      return;
    }
    fenetre.dataset.avantAgrandirLeft = fenetre.style.left;
    fenetre.dataset.avantAgrandirTop = fenetre.style.top;
    fenetre.dataset.avantAgrandirLargeur = fenetre.style.width;
    fenetre.dataset.avantAgrandirHauteur = fenetre.style.height;
    fenetre.style.left = '0px';
    fenetre.style.top = '0px';
    fenetre.style.width = `${fond.clientWidth}px`;
    fenetre.style.height = `${fond.clientHeight}px`;
    fenetre.dataset.agrandie = 'true';
    fenetre.classList.add('agrandie');
  }

  // Câble les trois boutons de contrôle (réduire, agrandir, fermer) d'une
  // fenêtre du bureau — partagé entre chasse et résolution d'incident.
  function initialiserControlesFenetre(fenetre, fermer) {
    fenetre.querySelector('[data-action="reduire"]').addEventListener('click', () => reduireFenetre(fenetre));
    fenetre.querySelector('[data-action="agrandir"]').addEventListener('click', () => basculerAgrandirFenetre(fenetre));
    fenetre.querySelector('[data-action="fermer"]').addEventListener('click', fermer);
    rendreFenetreDeplacable(fenetre, fenetre.querySelector('.bureau-fenetre-bandeau'));
    rendreFenetreRedimensionnable(fenetre, fenetre.querySelector('.bureau-fenetre-redimension'));
  }

  // Repart d'un état propre (position centrée, taille par défaut) à
  // chaque nouvelle session — sans quoi la fenêtre garderait la position,
  // la taille ou le plein écran choisis lors d'une session précédente.
  function reinitialiserEtatFenetre(fenetre) {
    delete fenetre.dataset.positionnee;
    delete fenetre.dataset.redimensionnee;
    delete fenetre.dataset.agrandie;
    fenetre.classList.remove('agrandie');
    fenetre.style.width = '';
    fenetre.style.height = '';
  }

  // Affiche la fenêtre à la largeur propre à `nomApp`, en la centrant
  // seulement au tout premier affichage de la session ; une fois que
  // l'étudiant l'a redimensionnée à la main, sa taille est conservée
  // d'une application à l'autre plutôt que d'être réécrasée.
  function afficherFenetreBureau(fenetre, nomApp, largeursParApp) {
    if (fenetre.dataset.redimensionnee !== 'true') {
      fenetre.style.width = largeursParApp[nomApp] || largeursParApp.defaut;
      fenetre.style.height = fenetre.style.height || '24rem';
    }
    const dejaPositionnee = fenetre.dataset.positionnee === 'true';
    fenetre.hidden = false;
    if (!dejaPositionnee) {
      centrerFenetre(fenetre);
      fenetre.dataset.positionnee = 'true';
    }
  }

  function initialiserOngletsSession() {
    document.querySelectorAll('.onglet-bouton').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        document.querySelectorAll('.onglet-bouton').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        bouton.setAttribute('aria-pressed', 'true');
        const onglet = bouton.dataset.onglet;
        document.getElementById('onglet-file').hidden = onglet !== 'file';
        document.getElementById('onglet-chasse').hidden = onglet !== 'chasse';
      });
    });
  }

  function afficherPenseeCourante() {
    document.getElementById('chasse-pensee-texte').textContent = exerciceChasse.pensees[indexPenseeActuelle];
  }

  function penseeSuivante() {
    indexPenseeActuelle = (indexPenseeActuelle + 1) % exerciceChasse.pensees.length;
    afficherPenseeCourante();
  }

  // Marque visiblement un élément signalé : contour + badge texte (pas
  // seulement une couleur discrète), pour que la confirmation Eureka soit
  // sans ambiguïté.
  function marquerElementSignale(element, signale) {
    element.classList.toggle('signale', signale);
    const cible = element.tagName === 'TR' ? element.querySelector('td:last-child') || element : element;
    let badge = cible.querySelector('.badge-signale');
    if (signale && !badge) {
      badge = document.createElement('span');
      badge.className = 'badge-signale';
      badge.textContent = 'Signalé';
      cible.appendChild(badge);
    } else if (!signale && badge) {
      badge.remove();
    }
  }

  function actualiserCompteurSignalements() {
    const compteur = document.getElementById('chasse-compteur-signalements');
    if (compteur) {
      compteur.textContent =
        signalementsChasse.length > 0 ? `${signalementsChasse.length} signalement(s) enregistré(s)` : '';
    }
  }

  // Les 4 applications du bureau chasse : 2 tables (SIEM, Annuaire) et 2
  // vues « lignes de sortie » (Terminal, Explorateur), même mécanique
  // d'ouverture de fenêtre pour toutes.
  const APPS_CHASSE = {
    siem: { titre: "SIEM — journal d'événements", nomCourt: 'SIEM', icone: 'pixelSiem' },
    terminal: { titre: 'Terminal', nomCourt: 'Terminal', icone: 'pixelTerminal' },
    annuaire: { titre: 'Annuaire — comptes et groupes', nomCourt: 'Annuaire', icone: 'pixelAnnuaire' },
    explorateur: { titre: 'Explorateur de fichiers', nomCourt: 'Explorateur', icone: 'pixelDossier' },
    pare_feu: { titre: 'Pare-feu — règles de filtrage', nomCourt: 'Pare-feu', icone: 'pixelParefeu' },
  };

  // Largeur propre à chaque application (tables larges pour SIEM/Annuaire/
  // Pare-feu, fenêtre plus étroite façon console pour le Terminal) — fixe
  // par application, ne se redimensionne jamais selon le contenu affiché.
  const LARGEUR_APPS_CHASSE = {
    siem: '40rem',
    annuaire: '36rem',
    terminal: '28rem',
    explorateur: '34rem',
    pare_feu: '38rem',
    defaut: '30rem',
  };

  function corpsApplicationChasse(nomApp) {
    if (nomApp === 'siem') {
      return `
        <table class="chasse-table">
          <thead><tr><th>Heure</th><th>Compte</th><th>Action</th><th>Source</th></tr></thead>
          <tbody>
            ${exerciceChasse.siem
              .map(
                (ligne) => `
              <tr class="chasse-element" data-id="${ligne.id}" data-faille="${ligne.estFaille}">
                <td>${ligne.horodatage}</td><td>${ligne.compte}</td><td>${ligne.action}</td><td>${ligne.source}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
    if (nomApp === 'annuaire') {
      return `
        <table class="chasse-table">
          <thead><tr><th>Compte</th><th>Groupe</th><th>Modifié le</th><th>Modifié par</th></tr></thead>
          <tbody>
            ${exerciceChasse.annuaire
              .map(
                (ligne) => `
              <tr class="chasse-element" data-id="${ligne.id}" data-faille="${ligne.estFaille}">
                <td>${ligne.compte}</td><td>${ligne.groupe}</td><td>${ligne.modifie}</td><td>${ligne.modifiePar}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
    if (nomApp === 'terminal') {
      return `
        <div class="terminal-invite"><span class="terminal-prompt">etu.dupont@soc-l3:~$</span> tasklist /v &amp;&amp; netstat -ano</div>
        ${exerciceChasse.terminal
          .map(
            (ligne) => `<p class="ligne-terminal chasse-element" data-id="${ligne.id}" data-faille="${ligne.estFaille}">${ligne.texte}</p>`
          )
          .join('')}
        <div class="terminal-invite"><span class="terminal-prompt">etu.dupont@soc-l3:~$</span> <span class="terminal-curseur" aria-hidden="true">▮</span></div>
      `;
    }
    if (nomApp === 'explorateur') {
      return `
        <table class="chasse-table">
          <thead><tr><th></th><th>Nom</th><th>Modifié</th><th>Taille</th><th>Emplacement</th></tr></thead>
          <tbody>
            ${exerciceChasse.explorateur
              .map(
                (ligne) => `
              <tr class="chasse-element" data-id="${ligne.id}" data-faille="${ligne.estFaille}">
                <td>${window.Icones.balise('pixelFichier')}</td><td>${ligne.nom}</td><td>${ligne.modifie}</td><td>${ligne.taille}</td><td>${ligne.emplacement}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      `;
    }
    return `
      <table class="chasse-table">
        <thead><tr><th>Source</th><th>Destination</th><th>Port</th><th>Action</th></tr></thead>
        <tbody>
          ${exerciceChasse.pare_feu
            .map(
              (ligne) => `
            <tr class="chasse-element" data-id="${ligne.id}" data-faille="${ligne.estFaille}">
              <td>${ligne.source}</td><td>${ligne.destination}</td><td>${ligne.port}</td><td>${ligne.action}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  // Les icônes du bureau et leurs équivalents épinglés dans la barre des
  // tâches représentent les mêmes applications : les deux jeux doivent
  // rester synchronisés (aria-pressed) quelle que soit l'icône cliquée.
  function iconesEtEpinglesChasse() {
    return document.querySelectorAll('#chasse-bureau .bureau-icone, #chasse-epingles .bureau-icone-epinglee');
  }

  function ouvrirApplicationChasse(nomApp) {
    const fenetre = document.getElementById('chasse-fenetre');
    const corps = document.getElementById('chasse-fenetre-corps');
    const application = APPS_CHASSE[nomApp];

    document.getElementById('chasse-fenetre-titre').innerHTML = `${window.Icones.balise(application.icone)} ${application.titre}`;

    corps.innerHTML = corpsApplicationChasse(nomApp);

    corps.querySelectorAll('.chasse-element').forEach((element) => {
      marquerElementSignale(element, signalementsChasse.includes(element.dataset.id));
    });

    iconesEtEpinglesChasse().forEach((icone) => {
      icone.setAttribute('aria-pressed', String(icone.dataset.app === nomApp));
    });

    afficherFenetreBureau(fenetre, nomApp, LARGEUR_APPS_CHASSE);
  }

  // Le bureau ne présente plus de fenêtre « vide » quand aucune
  // application n'est ouverte : elle est simplement masquée (position
  // absolue, sans effet sur la hauteur du bureau).
  function fermerFenetreChasse() {
    document.getElementById('chasse-fenetre').hidden = true;
    iconesEtEpinglesChasse().forEach((icone) => icone.setAttribute('aria-pressed', 'false'));
  }

  // Bouton rond, icône seule : le nombre de charges restantes s'affiche en
  // badge plutôt qu'en texte, le libellé complet reste porté par
  // aria-label/title pour l'accessibilité et l'infobulle.
  function actualiserBoutonVision() {
    const bouton = document.getElementById('bouton-vision-expert');
    bouton.disabled = chargesVision <= 0;
    const libelle =
      chargesVision > 0
        ? `Vision de l'expert (${chargesVision} charge${chargesVision > 1 ? 's' : ''} restante${chargesVision > 1 ? 's' : ''})`
        : "Vision de l'expert (épuisée)";
    bouton.innerHTML = `${window.Icones.balise('pixelOeil')}${chargesVision > 0 ? `<span class="bouton-rond-badge">${chargesVision}</span>` : ''}`;
    bouton.setAttribute('aria-label', libelle);
    bouton.title = libelle;
  }

  // Ulti à charges limitées (FR-061) : révélation temporaire, non un
  // simple bouton à bascule — chaque usage consomme une charge.
  function utiliserVisionExpert() {
    if (chargesVision <= 0) {
      return;
    }
    chargesVision -= 1;
    visionUtilisee = true;
    actualiserBoutonVision();

    const fenetre = document.getElementById('chasse-fenetre');
    fenetre.classList.add('vision-active');
    if (visionTimeoutId) {
      clearTimeout(visionTimeoutId);
    }
    visionTimeoutId = setTimeout(() => {
      fenetre.classList.remove('vision-active');
      visionTimeoutId = null;
    }, DUREE_REVELATION_VISION_MS);
  }

  function toggleModeEureka() {
    modeEurekaActif = !modeEurekaActif;
    document.getElementById('chasse-fenetre').classList.toggle('mode-eureka', modeEurekaActif);
    document.getElementById('bouton-eureka').setAttribute('aria-pressed', String(modeEurekaActif));
  }

  // Demande confirmation avant d'enregistrer/retirer un signalement (au
  // lieu de le faire silencieusement au clic) : la validation explicite
  // était absente et rendait le geste peu clair.
  function demanderConfirmationSignalement(element) {
    const id = element.dataset.id;
    const dejaSignale = signalementsChasse.includes(id);
    const extrait = element.textContent.replace(/\s+/g, ' ').trim().slice(0, 90);

    ouvrirModale(
      dejaSignale ? 'Retirer ce signalement ?' : 'Signaler comme faille potentielle ?',
      `
      <p class="valeur-mono">« ${extrait} »</p>
      <div class="actions-pause">
        <button type="button" id="bouton-confirmer-signalement">${dejaSignale ? 'Retirer le signalement' : 'Confirmer le signalement'}</button>
        <button type="button" class="secondaire" id="bouton-annuler-signalement">Annuler</button>
      </div>
    `
    );

    document.getElementById('bouton-confirmer-signalement').addEventListener('click', () => {
      if (dejaSignale) {
        signalementsChasse = signalementsChasse.filter((s) => s !== id);
      } else {
        signalementsChasse.push(id);
      }
      marquerElementSignale(element, !dejaSignale);
      actualiserCompteurSignalements();
      fermerModale();
    });
    document.getElementById('bouton-annuler-signalement').addEventListener('click', fermerModale);
  }

  function initialiserChasse() {
    document.querySelectorAll('#chasse-bureau .bureau-icone').forEach((icone) => {
      icone.addEventListener('click', () => ouvrirApplicationChasse(icone.dataset.app));
    });

    // Icônes épinglées dans la barre des tâches : mêmes applications que
    // les icônes du bureau, juste sans libellé (icône seule).
    document.getElementById('chasse-epingles').innerHTML = Object.entries(APPS_CHASSE)
      .map(([cle]) => `<button type="button" class="bureau-icone-epinglee" data-app="${cle}" aria-pressed="false"></button>`)
      .join('');
    document.querySelectorAll('#chasse-epingles .bureau-icone-epinglee').forEach((icone) => {
      icone.innerHTML = window.Icones.balise(APPS_CHASSE[icone.dataset.app].icone);
      icone.setAttribute('aria-label', APPS_CHASSE[icone.dataset.app].nomCourt);
      icone.addEventListener('click', () => ouvrirApplicationChasse(icone.dataset.app));
    });

    document.getElementById('chasse-fenetre-fermer').innerHTML = window.Icones.balise('fermer');
    initialiserControlesFenetre(document.getElementById('chasse-fenetre'), fermerFenetreChasse);
    document.getElementById('bouton-vision-expert').addEventListener('click', utiliserVisionExpert);
    document.getElementById('bouton-eureka').addEventListener('click', toggleModeEureka);
    document.getElementById('chasse-pensee-suivante').addEventListener('click', penseeSuivante);

    // Délégation sur le conteneur stable (le corps est régénéré à chaque
    // ouverture d'application) : un clic sur une ligne, en mode Eureka,
    // ouvre la confirmation plutôt que de signaler silencieusement.
    document.getElementById('chasse-fenetre').addEventListener('click', (evenement) => {
      if (!modeEurekaActif) {
        return;
      }
      const element = evenement.target.closest('.chasse-element');
      if (!element) {
        return;
      }
      demanderConfirmationSignalement(element);
    });
  }

  function initialiserChasseSiPertinente() {
    const session = window.Principal.obtenirSession();
    if (!session || session.role !== 'lvl3') {
      return;
    }

    exerciceChasse = window.Chasse.genererExercice(session.entreprise);
    signalementsChasse = [];
    visionUtilisee = false;
    chargesVision = CHARGES_VISION_PAR_DIFFICULTE[session.difficulte] || CHARGES_VISION_PAR_DIFFICULTE.intermediaire;
    indexPenseeActuelle = 0;

    document.getElementById('onglets-session').hidden = false;
    document.querySelectorAll('#chasse-bureau .bureau-icone').forEach((icone) => {
      const application = APPS_CHASSE[icone.dataset.app];
      icone.innerHTML = `${window.Icones.balise(application.icone)} ${application.nomCourt}`;
    });
    actualiserBoutonVision();
    document.getElementById('bouton-eureka').innerHTML = window.Icones.balise('pixelAmpoule');
    document.getElementById('bouton-eureka').setAttribute('aria-label', 'Eureka — signaler un élément suspect');
    document.getElementById('bouton-eureka').title = 'Eureka — signaler un élément suspect';
    document.getElementById('chasse-pensee').hidden = false;
    actualiserCompteurSignalements();
    afficherPenseeCourante();
    reinitialiserEtatFenetre(document.getElementById('chasse-fenetre'));
    fermerFenetreChasse();
    demarrerHorloge('chasse-horloge', 'chasse-date');
  }

  // --- Pause de session (menu pause : bouton dédié + clic sur la marque) ---

  function actualiserBoutonPause() {
    const bouton = document.getElementById('bouton-pause');
    if (!bouton) {
      return;
    }
    const enPause = window.Principal.estEnPause();
    bouton.innerHTML = enPause
      ? `${window.Icones.balise('lecture')} Reprendre`
      : `${window.Icones.balise('pause')} Pause`;
  }

  function ouvrirPause() {
    const session = window.Principal.obtenirSession();
    if (!session || session.etat === 'terminee') {
      return;
    }
    window.Principal.mettreEnPause();
    document.getElementById('pause-fond').hidden = false;
    document.getElementById('bouton-reprendre').focus();
    actualiserBoutonPause();
  }

  function fermerPause() {
    window.Principal.reprendre();
    document.getElementById('pause-fond').hidden = true;
    actualiserBoutonPause();
  }

  function initialiserPause() {
    document.getElementById('bouton-reprendre').innerHTML = `${window.Icones.balise('lecture')} Reprendre`;
    document.getElementById('bouton-quitter-session').innerHTML = `${window.Icones.balise('sortie')} Quitter la session`;

    document.getElementById('bouton-pause').addEventListener('click', () => {
      if (window.Principal.estEnPause()) {
        fermerPause();
      } else {
        ouvrirPause();
      }
    });

    const marque = document.querySelector('.marque');
    marque.addEventListener('click', ouvrirPause);
    marque.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Enter' || evenement.key === ' ') {
        evenement.preventDefault();
        ouvrirPause();
      }
    });

    document.getElementById('bouton-reprendre').addEventListener('click', fermerPause);
    document.getElementById('bouton-quitter-session').addEventListener('click', () => window.location.reload());

    document.addEventListener('keydown', (evenement) => {
      if (evenement.key === 'Escape' && !document.getElementById('pause-fond').hidden) {
        fermerPause();
      }
    });
  }

  // --- Minuteur de session (US4 : FR-022) ---

  function formaterDureeMmSs(millisecondes) {
    const secondesTotales = Math.max(0, Math.ceil(millisecondes / 1000));
    const minutes = Math.floor(secondesTotales / 60);
    const secondes = secondesTotales % 60;
    return `${minutes}:${String(secondes).padStart(2, '0')}`;
  }

  function mettreAJourMinuteur() {
    const session = window.Principal.obtenirSession();
    if (!session) {
      return;
    }

    const maintenant = Date.now();
    const restant = session.finA - maintenant;
    const dureeTotale = session.finA - session.debutA;
    const ecoule = maintenant - session.debutA;
    const pourcentage = Math.min(100, Math.max(0, (ecoule / dureeTotale) * 100));

    document.getElementById('bandeau-temps').textContent = formaterDureeMmSs(restant);
    document.getElementById('bandeau-barre-remplissage').style.width = `${pourcentage}%`;

    if (restant <= 0 && minuteurIntervalle) {
      clearInterval(minuteurIntervalle);
      minuteurIntervalle = null;
    }
  }

  // Le mode Tuto n'a pas de minuteur (visite guidée sans limite de temps,
  // cf. main.js:demarrer) : rien à afficher ici pour lui.
  function demarrerAffichageMinuteur() {
    const session = window.Principal.obtenirSession();
    if (session && session.role === 'tuto') {
      return;
    }
    document.getElementById('bandeau-etat').hidden = false;
    mettreAJourMinuteur();
    minuteurIntervalle = setInterval(mettreAJourMinuteur, 1000);
  }

  // Pendant la pause, le temps affiché doit rester figé : on arrête
  // l'intervalle plutôt que de le laisser décompter sur un `finA` qui,
  // lui, n'est décalé qu'au moment de la reprise (cf. main.js).
  function arreterAffichageMinuteur() {
    if (minuteurIntervalle) {
      clearInterval(minuteurIntervalle);
      minuteurIntervalle = null;
    }
  }

  // --- Fin de session conditionnée à la file vidée (FR-050, FR-051) ---
  //
  // Le temps configuré écoulé n'arrête plus que l'apparition de nouvelles
  // alertes (cf. main.js:signalerTempsEcoule) : la session n'est réellement
  // close qu'une fois toutes les alertes déjà apparues classées.

  function afficherBanniereTempsEcoule() {
    const banniere = document.getElementById('banniere-temps-ecoule');
    if (banniere) {
      banniere.hidden = false;
    }
  }

  function verifierFinDeTriage() {
    const session = window.Principal.obtenirSession();
    if (!session || !session.tempsEcoule) {
      return;
    }
    if (decisions.length >= session.alertesApparues.length) {
      window.Principal.terminerMaintenant();
    }
  }

  function gererTempsEcoule() {
    afficherBanniereTempsEcoule();
    verifierFinDeTriage();
  }

  // --- Résolution d'incident (LVL2/LVL3, FR-054 à FR-057) ---
  //
  // Ne porte que sur les alertes que l'étudiant a lui-même classées Vrai
  // positif pendant le tri (jamais sur la classification de référence
  // brute) : cohérent avec l'auto-correction différée (FR-013/FR-026).

  const ICONES_PAR_APPLICATION = {
    pare_feu: 'pixelParefeu',
    antivirus: 'pixelAntivirus',
    politique_groupe: 'pixelGroupe',
    gestionnaire_correctifs: 'pixelCorrectifs',
  };

  // Amorce de contexte affichée en haut de chaque fenêtre applicative,
  // pour qu'elle ressemble à un vrai outil plutôt qu'à un écran générique.
  const TAGLINE_PAR_APPLICATION = {
    pare_feu: 'Règles de filtrage',
    antivirus: "Résultats de l'analyse",
    politique_groupe: 'Comptes et groupes',
    gestionnaire_correctifs: 'Correctifs disponibles',
  };

  // Contenu comparable (liste d'actions) quelle que soit l'application
  // ouverte ici : une seule largeur par défaut suffit.
  const LARGEUR_APPS_REMEDIATION = { defaut: '30rem' };

  // Les icônes du bureau et leurs équivalents épinglés dans la barre des
  // tâches représentent les mêmes applications : les deux jeux doivent
  // rester synchronisés (aria-pressed) quelle que soit l'icône cliquée.
  function iconesEtEpinglesRemediation() {
    return document.querySelectorAll('#remediation-icones .bureau-icone, #remediation-epingles .bureau-icone-epinglee');
  }

  // Les 4 icônes d'application sont fixes (indépendantes de la session) :
  // construites une seule fois, au premier passage — pour le bureau et
  // pour la barre des tâches (icône seule, sans libellé).
  function initialiserIconesRemediation() {
    const conteneur = document.getElementById('remediation-icones');
    if (conteneur.childElementCount > 0) {
      return;
    }
    conteneur.innerHTML = Object.entries(window.Remediation.APPLICATIONS)
      .map(
        ([cle, application]) => `
      <button type="button" class="bureau-icone" data-app="${cle}">${window.Icones.balise(ICONES_PAR_APPLICATION[cle])} ${application.nom}</button>
    `
      )
      .join('');
    conteneur.querySelectorAll('.bureau-icone').forEach((bouton) => {
      bouton.addEventListener('click', () => ouvrirApplicationRemediation(bouton.dataset.app));
    });

    const epingles = document.getElementById('remediation-epingles');
    epingles.innerHTML = Object.entries(window.Remediation.APPLICATIONS)
      .map(([cle]) => `<button type="button" class="bureau-icone-epinglee" data-app="${cle}" aria-pressed="false"></button>`)
      .join('');
    epingles.querySelectorAll('.bureau-icone-epinglee').forEach((bouton) => {
      const application = window.Remediation.APPLICATIONS[bouton.dataset.app];
      bouton.innerHTML = window.Icones.balise(ICONES_PAR_APPLICATION[bouton.dataset.app]);
      bouton.setAttribute('aria-label', application.nom);
      bouton.addEventListener('click', () => ouvrirApplicationRemediation(bouton.dataset.app));
    });
  }

  function correctifCourant() {
    return exerciceRemediation[indexCorrectifActuel];
  }

  // Le bureau ne présente plus de fenêtre « vide » quand aucune
  // application n'est ouverte : elle est simplement masquée (position
  // absolue, sans effet sur la hauteur du bureau).
  function fermerFenetreRemediation() {
    document.getElementById('remediation-fenetre').hidden = true;
    iconesEtEpinglesRemediation().forEach((b) => b.setAttribute('aria-pressed', 'false'));
  }

  function afficherCorrectifCourant() {
    const item = correctifCourant();
    document.getElementById('remediation-progression').textContent =
      `Correctif ${indexCorrectifActuel + 1} / ${exerciceRemediation.length}`;
    document.getElementById('remediation-ticket').innerHTML = `
      <div class="bloc-remediation">
        <p><strong>${ETIQUETTES_CATEGORIE[item.categorie]}</strong> — indicateur : <span class="valeur-mono">${item.indicateurCible.type} : ${item.indicateurCible.valeur}</span></p>
        <p class="indication-discrete">Ouvrez l'application adaptée à cet indicateur : les actions possibles s'affichent dans sa fenêtre.</p>
      </div>
    `;
    fermerFenetreRemediation();
  }

  function validerActionRemediation(actionChoisie) {
    reponsesRemediation[correctifCourant().alerteId] = actionChoisie;
    if (indexCorrectifActuel + 1 < exerciceRemediation.length) {
      indexCorrectifActuel += 1;
      afficherCorrectifCourant();
    } else if (modeTutorielActif) {
      // Démonstration du guide (voir role-l2-demo) : pas de bascule vers
      // le véritable écran de correction, le guide garde la main.
      fermerFenetreRemediation();
    } else {
      resultatRemediation = window.Remediation.evaluerReponses(exerciceRemediation, reponsesRemediation);
      afficherEcranCorrection();
      window.Principal.afficherVue('vue-correction');
    }
  }

  // Tout se joue dans la fenêtre de l'application ouverte : un rappel de
  // la cible du correctif en cours, puis la liste des actions proposées
  // par cette application (la bonne action si c'est la bonne application,
  // sinon uniquement des leurres) — cliquer une action valide ce
  // correctif (FR-055bis).
  function ouvrirApplicationRemediation(cleApplication) {
    const item = correctifCourant();
    const application = window.Remediation.APPLICATIONS[cleApplication];
    const options = item.optionsParApplication[cleApplication];

    document.getElementById('remediation-fenetre-titre').innerHTML =
      `${window.Icones.balise(ICONES_PAR_APPLICATION[cleApplication])} ${application.nom}`;

    document.getElementById('remediation-fenetre-corps').innerHTML = `
      <p class="remediation-app-tagline">${TAGLINE_PAR_APPLICATION[cleApplication]}</p>
      <p class="remediation-app-cible">Cible actuelle : <span class="valeur-mono">${item.indicateurCible.type} — ${item.indicateurCible.valeur}</span></p>
      <ul class="remediation-actions">
        ${options
          .map((option, index) => `<li><button type="button" class="remediation-action" data-index="${index}">${option}</button></li>`)
          .join('')}
      </ul>
    `;

    document.querySelectorAll('#remediation-fenetre-corps .remediation-action').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        validerActionRemediation(options[Number(bouton.dataset.index)]);
      });
    });

    iconesEtEpinglesRemediation().forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.app === cleApplication));
    });

    afficherFenetreBureau(document.getElementById('remediation-fenetre'), cleApplication, LARGEUR_APPS_REMEDIATION);
  }

  function initialiserRemediation() {
    document.getElementById('remediation-fenetre-fermer').innerHTML = window.Icones.balise('fermer');
    initialiserControlesFenetre(document.getElementById('remediation-fenetre'), fermerFenetreRemediation);
  }

  // N'est appelée qu'une fois par session (déclenchée depuis
  // gererFinDeSession), pas besoin de protéger contre un double démarrage.
  function afficherExerciceRemediation() {
    indexCorrectifActuel = 0;
    reponsesRemediation = {};
    initialiserIconesRemediation();
    reinitialiserEtatFenetre(document.getElementById('remediation-fenetre'));
    afficherCorrectifCourant();
    demarrerHorloge('remediation-horloge', 'remediation-date');
  }

  // --- Correction et note de fin de session (US4 : FR-023, FR-024, FR-025) ---

  function revelerFiche(bouton, alerteId) {
    const zone = document.getElementById(`fiche-revelee-${alerteId}`);
    const etaitCachee = zone.hidden;

    if (etaitCachee && zone.childElementCount === 0) {
      const fiche = window.Stockage.listerFiches().find((f) => f.alerteId === alerteId);
      zone.innerHTML = `
        <pre class="fiche-markdown">${fiche.contenuMarkdown}</pre>
        <button type="button" class="secondaire" id="bouton-export-${alerteId}">${window.Icones.balise('telechargement')} Télécharger la fiche (.md)</button>
      `;
      document.getElementById(`bouton-export-${alerteId}`).addEventListener('click', () => {
        window.Stockage.exporterFicheEnFichier(fiche);
      });
    }

    zone.hidden = !etaitCachee;
    bouton.innerHTML = etaitCachee
      ? `${window.Icones.balise('chevron')} Masquer la fiche`
      : `${window.Icones.balise('chevron')} Voir la fiche`;
  }

  // Blocs d'exercices affichés à côté (et non fondus dans) la note sur 20 :
  // FR-025/SC-007 ne portent que sur la classification, ces mini-jeux
  // restent des scores distincts.
  function construireBlocsExercices(session) {
    const blocs = [];

    if (resultatRemediation) {
      blocs.push(`
        <div class="bloc-exercice">
          <h3 class="titre-section">Résolution d'incident</h3>
          <p>${resultatRemediation.correctes} / ${resultatRemediation.total} action(s) de confinement correctement choisie(s).</p>
        </div>
      `);
    }

    if (session.role === 'lvl3' && exerciceChasse) {
      resultatChasse = window.Chasse.evaluerChasse(exerciceChasse, signalementsChasse);
      blocs.push(`
        <div class="bloc-exercice">
          <h3 class="titre-section">Chasse aux menaces</h3>
          <p>${resultatChasse.vraisTrouves} / ${resultatChasse.totalReels} incident(s) caché(s) débusqué(s), ${resultatChasse.fauxPositifs} faux positif(s) signalé(s)${visionUtilisee ? ' — exercice réalisé avec « Vision de l\'expert »' : ''}.</p>
        </div>
      `);
    }

    return blocs.join('');
  }

  function afficherEcranCorrection() {
    const session = window.Principal.obtenirSession();
    const resultat = window.Correction.calculerNote(session.alertesApparues, decisions);

    const noteTexte =
      resultat.noteSur20 === null ? 'Non applicable' : `${resultat.noteSur20} / 20`;

    document.getElementById('correction-note').innerHTML = `
      <span class="note-valeur">${noteTexte}</span>
      <span class="note-detail">${resultat.correctes} / ${resultat.totalClassees} classification(s) correcte(s)</span>
    `;

    document.getElementById('correction-exercices').innerHTML = construireBlocsExercices(session);

    document.getElementById('correction-details').innerHTML =
      resultat.details
        .map(
          (d) => `
        <div class="ligne-correction ${d.estCorrecte ? 'correcte' : 'incorrecte'}">
          <div class="ligne-correction-entete">
            <span>${ETIQUETTES_CATEGORIE[d.categorie]}</span>
            <span class="verdict">${d.estCorrecte ? window.Icones.balise('coche') : window.Icones.balise('croix')} ${d.estCorrecte ? 'correct' : 'incorrect'}</span>
          </div>
          <p>vous : ${ETIQUETTES_CLASSIFICATION[d.classificationEtudiant]}, référence : ${ETIQUETTES_CLASSIFICATION[d.classificationReference]}</p>
          <button type="button" class="secondaire bouton-voir-fiche" data-alerte-id="${d.alerteId}">${window.Icones.balise('chevron')} Voir la fiche</button>
          <div class="fiche-revelee" id="fiche-revelee-${d.alerteId}" hidden></div>
        </div>
      `
        )
        .join('') || '<p>Aucune alerte classée durant cette session.</p>';

    document.querySelectorAll('.bouton-voir-fiche').forEach((bouton) => {
      bouton.addEventListener('click', () => revelerFiche(bouton, bouton.dataset.alerteId));
    });

    const conteneurNonTraitees = document.getElementById('correction-non-traitees');
    conteneurNonTraitees.textContent =
      resultat.nonTraitees.length > 0
        ? `${resultat.nonTraitees.length} alerte(s) apparue(s) mais non traitée(s) avant la fin de la session (non comptée(s) dans la note).`
        : '';

    const boutonRapport = document.getElementById('bouton-telecharger-rapport');
    boutonRapport.innerHTML = `${window.Icones.balise('telechargement')} Télécharger le rapport complet (.json)`;
    boutonRapport.onclick = () => {
      const rapport = window.Rapport.genererRapportSession(session, decisions, resultatRemediation, resultatChasse);
      window.Stockage.exporterRapportJSON(rapport);
    };
  }

  function gererFinDeSession() {
    if (minuteurIntervalle) {
      clearInterval(minuteurIntervalle);
      minuteurIntervalle = null;
    }
    document.getElementById('bandeau-etat').hidden = true;
    document.getElementById('pause-fond').hidden = true;

    const session = window.Principal.obtenirSession();
    if (session.role === 'lvl2' || session.role === 'lvl3') {
      exerciceRemediation = window.Remediation.genererExercice(session.alertesApparues, decisions, session.difficulte);
      if (exerciceRemediation.length > 0) {
        afficherExerciceRemediation();
        window.Principal.afficherVue('vue-remediation');
        return;
      }
    }
    afficherEcranCorrection();
    window.Principal.afficherVue('vue-correction');
  }

  // --- Guide scénarisé du mode Tuto (FR-035 à FR-035ter) ---
  //
  // Bulle de dialogue non modale qui avance pas à pas dans
  // window.Tutoriel.ETAPES (contenu pur, cf. app/js/tutoriel.js). Chaque
  // étape peut déclencher un effet bespoke (injecter une alerte d'exemple,
  // ouvrir une application du bureau, simuler temporairement un autre
  // rôle...) via executerEffetEtapeTutoriel. Le rôle réel de la session
  // reste 'tuto' du début à la fin : seule la valeur lue par le reste de
  // l'interface (session.role) est temporairement basculée le temps
  // d'illustrer un rôle donné, avec les VRAIS mécanismes (chasse,
  // résolution d'incident, absence d'« à investiguer »...) plutôt qu'une
  // resimulation parallèle à entretenir.
  //
  // Chaque étape se (re)construit entièrement à son activation plutôt que
  // de dépendre de la précédente : la navigation Suivant/Précédent reste
  // ainsi fiable dans les deux sens, y compris en cas d'aller-retour.

  // Tire une alerte d'exemple parmi les mêmes gabarits qu'une vraie
  // session (window.Alertes.genererAlerte), en réessayant jusqu'à
  // satisfaire `predicat` — pour illustrer un point précis (plusieurs
  // entités affectées, etc.). Ajoutée à la file visible comme une vraie
  // alerte, pour que le reste de l'interface (détail, historique,
  // correction) fonctionne sans aucun cas particulier.
  function genererAlerteDemoVisible(predicat) {
    const session = window.Principal.obtenirSession();
    const sessionPourGeneration = { entreprise: session.entreprise, role: 'lvl1', alertesApparues: session.alertesApparues };
    const filtre = predicat || (() => true);
    for (let tentative = 0; tentative < 200; tentative += 1) {
      let alerte;
      try {
        alerte = window.Alertes.genererAlerte(sessionPourGeneration);
      } catch (e) {
        break; // pool de gabarits épuisé (visite très longue) : on arrête d'être sélectif
      }
      if (filtre(alerte)) {
        session.alertesApparues.push(alerte);
        ajouterAlerteALaListe(alerte);
        return alerte;
      }
    }
    const alerteRepli = window.Alertes.genererAlerte(sessionPourGeneration);
    session.alertesApparues.push(alerteRepli);
    ajouterAlerteALaListe(alerteRepli);
    return alerteRepli;
  }

  // Variante « fixture » : alerte fictive utilisée uniquement comme donnée
  // d'entrée d'une démonstration de résolution d'incident — jamais ajoutée
  // à la file visible ni comptée dans la correction, seul son indicateur
  // ciblé (parmi `typesRecherches`) importe.
  function genererAlerteFixtureAvecIndicateur(typesRecherches, accumulateur) {
    const session = window.Principal.obtenirSession();
    const sessionPourGeneration = { entreprise: session.entreprise, role: 'lvl1', alertesApparues: accumulateur };
    for (let tentative = 0; tentative < 200; tentative += 1) {
      let alerte;
      try {
        alerte = window.Alertes.genererAlerte(sessionPourGeneration);
      } catch (e) {
        break;
      }
      const indicateurCible = alerte.indicateurs.find((i) => typesRecherches.includes(i.type));
      if (indicateurCible) {
        alerte.indicateurs = [indicateurCible].concat(alerte.indicateurs.filter((i) => i !== indicateurCible));
        accumulateur.push(alerte);
        return alerte;
      }
    }
    const alerteRepli = window.Alertes.genererAlerte(sessionPourGeneration);
    accumulateur.push(alerteRepli);
    return alerteRepli;
  }

  function basculerOngletTutoriel(onglet) {
    document.querySelectorAll('.onglet-bouton').forEach((bouton) => {
      bouton.setAttribute('aria-pressed', String(bouton.dataset.onglet === onglet));
    });
    document.getElementById('onglet-file').hidden = onglet !== 'file';
    document.getElementById('onglet-chasse').hidden = onglet !== 'chasse';
  }

  // Génère et affiche une démonstration de résolution d'incident couvrant
  // les quatre applications (une alerte fixture par application, classée
  // Vrai positif localement — ces décisions fictives n'affectent jamais le
  // tableau `decisions` réel ni la correction).
  function demarrerDemoRemediation() {
    const accumulateur = [];
    const alertesDemo = Object.values(window.Remediation.APPLICATIONS).map((application) =>
      genererAlerteFixtureAvecIndicateur(Object.keys(application.actions), accumulateur)
    );
    const decisionsDemo = alertesDemo.map((alerte) => ({ alerteId: alerte.id, classificationEtudiant: 'vrai_positif' }));
    exerciceRemediation = window.Remediation.genererExercice(alertesDemo, decisionsDemo, 'intermediaire');
    afficherExerciceRemediation();
  }

  function definirRoleSimule(role) {
    window.Principal.obtenirSession().role = role;
  }

  // Effets propres à certaines étapes du guide (celles qui ne se limitent
  // pas à changer de vue/onglet ou à surligner un élément, déjà gérés
  // génériquement par afficherEtapeTutoriel).
  function executerEffetEtapeTutoriel(etape) {
    switch (etape.id) {
      case 'ouverture-alerte': {
        selectionnerAlerte(genererAlerteDemoVisible().id);
        break;
      }
      case 'difficulte-facile': {
        tutorielNiveauChamps = 'facile';
        selectionnerAlerte(genererAlerteDemoVisible().id);
        break;
      }
      case 'difficulte-intermediaire': {
        tutorielNiveauChamps = 'intermediaire';
        selectionnerAlerte(genererAlerteDemoVisible().id);
        break;
      }
      case 'difficulte-difficile': {
        tutorielNiveauChamps = 'difficile';
        selectionnerAlerte(genererAlerteDemoVisible((a) => a.entitesAffectees.length > 1).id);
        break;
      }
      case 'role-l2-demo': {
        definirRoleSimule('lvl2');
        demarrerDemoRemediation();
        break;
      }
      case 'role-l3-intro': {
        definirRoleSimule('lvl3');
        tutorielNiveauChamps = 'facile';
        selectionnerAlerte(genererAlerteDemoVisible().id);
        break;
      }
      case 'role-l3-chasse': {
        definirRoleSimule('lvl3');
        initialiserChasseSiPertinente();
        basculerOngletTutoriel('chasse');
        ouvrirApplicationChasse('siem');
        break;
      }
      case 'retour-file': {
        definirRoleSimule('tuto');
        basculerOngletTutoriel('file');
        break;
      }
      case 'correction-intro': {
        definirRoleSimule('tuto');
        afficherEcranCorrection();
        break;
      }
      default:
        break;
    }
  }

  // Réserve, sous le contenu de la page, la place exacte que prend le
  // bandeau du guide (mesurée en JS car sa hauteur varie avec la longueur
  // du texte de l'étape) : garantit qu'il ne recouvre jamais un élément
  // interactif, plutôt que de deviner une marge fixe au jugé.
  function ajusterEspacementPourGuide() {
    const guide = document.getElementById('tuto-guide');
    if (guide.hidden) {
      document.body.style.paddingBottom = '';
      return;
    }
    const hauteur = document.getElementById('tuto-guide-bulle').offsetHeight;
    document.body.style.paddingBottom = `${hauteur + 24}px`;
  }

  function appliquerSurlignageTutoriel(etape) {
    document.querySelectorAll('.tuto-spotlight').forEach((el) => el.classList.remove('tuto-spotlight'));
    if (!etape.cible) {
      return;
    }
    const cible = document.querySelector(etape.cible);
    if (!cible) {
      return;
    }
    cible.classList.add('tuto-spotlight');
    cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function afficherEtapeTutoriel(index) {
    const etapes = window.Tutoriel.ETAPES;
    etapeTutorielActuelle = Math.max(0, Math.min(index, etapes.length - 1));
    const etape = etapes[etapeTutorielActuelle];

    window.Principal.afficherVue(`vue-${etape.vue}`);
    if (etape.vue === 'session') {
      basculerOngletTutoriel(etape.onglet);
    }
    executerEffetEtapeTutoriel(etape);

    document.getElementById('tuto-guide-titre').textContent = etape.titre;
    document.getElementById('tuto-guide-texte').innerHTML = etape.texte;
    document.getElementById('tuto-guide-etape').textContent = `Étape ${etapeTutorielActuelle + 1} / ${etapes.length}`;
    document.getElementById('tuto-guide-precedent').disabled = etapeTutorielActuelle === 0;
    const boutonSuivant = document.getElementById('tuto-guide-suivant');
    boutonSuivant.textContent = etapeTutorielActuelle === etapes.length - 1 ? 'Terminer le tutoriel' : 'Suivant';

    appliquerSurlignageTutoriel(etape);
    ajusterEspacementPourGuide();
  }

  function etapeTutorielSuivante() {
    if (etapeTutorielActuelle >= window.Tutoriel.ETAPES.length - 1) {
      terminerTutoriel();
      return;
    }
    afficherEtapeTutoriel(etapeTutorielActuelle + 1);
  }

  function etapeTutorielPrecedente() {
    afficherEtapeTutoriel(etapeTutorielActuelle - 1);
  }

  // Fin (dernière étape) ou abandon (« Passer le tutoriel ») : dans les
  // deux cas, on recharge la page plutôt que de démêler l'état transitoire
  // du guide (rôle simulé, exercices de démonstration...) — retour garanti
  // à un accueil parfaitement propre, sans rien conserver en mémoire.
  function terminerTutoriel() {
    window.location.reload();
  }

  function demarrerTutorielSiPertinent() {
    const session = window.Principal.obtenirSession();
    if (!session || session.role !== 'tuto') {
      document.getElementById('tuto-guide').hidden = true;
      return;
    }
    modeTutorielActif = true;
    document.getElementById('tuto-guide').hidden = false;
    afficherEtapeTutoriel(0);
  }

  function initialiserTutoriel() {
    document.getElementById('tuto-guide-avatar').innerHTML = window.Icones.balise('pixelDialogue');
    document.getElementById('tuto-guide-suivant').addEventListener('click', etapeTutorielSuivante);
    document.getElementById('tuto-guide-precedent').addEventListener('click', etapeTutorielPrecedente);
    document.getElementById('tuto-guide-passer').addEventListener('click', terminerTutoriel);
    // Le texte d'une étape peut se réajuster sur plusieurs lignes lors
    // d'un redimensionnement de fenêtre : la marge réservée doit suivre.
    window.addEventListener('resize', () => {
      if (modeTutorielActif) {
        ajusterEspacementPourGuide();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initialiserModale();
    initialiserPause();
    initialiserOngletsSession();
    initialiserChasse();
    initialiserRemediation();
    initialiserTutoriel();
    window.Principal.sur('briefing', afficherBriefing);
    window.Principal.sur('debut', demarrerAffichageMinuteur);
    window.Principal.sur('debut', demarrerTutorielSiPertinent);
    window.Principal.sur('debut', actualiserBoutonPause);
    window.Principal.sur('debut', initialiserChasseSiPertinente);
    window.Principal.sur('alerte', ajouterAlerteALaListe);
    window.Principal.sur('fin', gererFinDeSession);
    window.Principal.sur('pause', arreterAffichageMinuteur);
    window.Principal.sur('reprise', demarrerAffichageMinuteur);
    window.Principal.sur('tempsEcoule', gererTempsEcoule);
    initialiserFiltreCategorie();
    actualiserHistorique();
  });
})();
