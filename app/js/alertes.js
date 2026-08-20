'use strict';

/*
 * Génération procédurale d'alertes fictives (FR-001, FR-008, FR-014, FR-019).
 * Enveloppe UMD : ce fichier est chargé tel quel par <script> dans le
 * navigateur (attache `window.Alertes`) ET par `require()` dans les tests
 * Node (`node --test`), sans outil de build ni dépendance.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Alertes = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const CATEGORIES = [
    'phishing',
    'authentification_suspecte',
    'malware',
    'exfiltration',
    'deni_de_service',
    'elevation_privileges',
    'vulnerabilite_exploitee',
  ];
  const CLASSIFICATIONS = ['vrai_positif', 'faux_positif', 'a_investiguer'];
  const TENTATIVES_MAX = 25;

  // Mix de classifications par rôle (FR-052, FR-053, FR-053bis) : reflète
  // la hiérarchie du SOC — le L1 reçoit le flux brut (mix équilibré, valeur
  // par défaut ci-dessous) ; le L2 reçoit surtout de l'« à investiguer » à
  // résoudre plus les « vrai positif » remontées par le L1 (peu de faux
  // positifs, déjà filtrés en amont) ; le L3, plus haut niveau de
  // technicité, ne reçoit plus jamais d'« à investiguer » comme vérité de
  // référence — il tranche toujours définitivement (vrai/faux positif),
  // ce qui reflète l'absence d'échelon supérieur auquel escalader une
  // ambiguïté. lvl1/tuto ne sont volontairement pas dans cette table : ils
  // gardent le tirage uniforme d'origine. Indépendant de la Difficulté
  // (FR-030bis), qui module d'autres aspects (cadence, champs à remplir,
  // pièges des exercices).
  const POIDS_CLASSIFICATION_PAR_ROLE = {
    lvl2: { a_investiguer: 0.5, vrai_positif: 0.35, faux_positif: 0.15 },
    lvl3: { vrai_positif: 0.55, faux_positif: 0.45 },
  };

  function choisirClassificationReference(role, rng) {
    const poids = POIDS_CLASSIFICATION_PAR_ROLE[role];
    if (!poids) {
      return choix(rng, CLASSIFICATIONS);
    }
    const classesPossibles = Object.keys(poids);
    const tirage = rng();
    let cumul = 0;
    for (let i = 0; i < classesPossibles.length; i += 1) {
      cumul += poids[classesPossibles[i]];
      if (tirage < cumul) {
        return classesPossibles[i];
      }
    }
    return classesPossibles[classesPossibles.length - 1]; // filet de sécurité (arrondi flottant)
  }

  const NOMS_UTILISATEURS = ['dupont', 'martin', 'bernard', 'leroy', 'moreau', 'girard', 'morel', 'fournier'];
  const NOMS_DOMAINES = ['securite-verification', 'maj-systeme', 'portail-rh', 'support-compte', 'service-facturation'];
  const NOMS_FICHIERS = ['facture_2024.pdf.exe', 'mise_a_jour_urgente.exe', 'rapport_confidentiel.zip', 'document_signe.scr', 'photo_vacances.jpg.exe'];
  const NOMS_DOCUMENTS_MACRO = ['note_de_frais.docm', 'planning_equipe.xlsm', 'contrat_partenaire.docm'];
  const NOMS_COMPTES = ['service-backup', 'admin-test', 'svc-crm', 'support-rh'];
  const NOMS_SERVEURS = ['fichiers', 'web', 'bdd', 'messagerie'];
  const NOMS_SERVICES_CLOUD = ['DriveShare Perso', 'CloudDepot Externe', 'FileSync Non Approuvé'];
  const PREFIXES_IP = ['192.0.2.', '198.51.100.', '203.0.113.'];
  const PORTS_COURANTS = [80, 443, 53, 3389, 22, 8080];
  const NOMS_GROUPES = ['Administrateurs locaux', 'Domain Admins', 'Opérateurs de sauvegarde'];
  const NOMS_PROCESSUS = ['powershell.exe', 'cmd.exe', 'rundll32.exe', 'psexec.exe'];

  function choix(rng, liste) {
    const index = Math.min(liste.length - 1, Math.floor(rng() * liste.length));
    return liste[index];
  }

  function entierDans(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function hexAleatoire(rng, longueur) {
    let resultat = '';
    for (let i = 0; i < longueur; i += 1) {
      resultat += Math.floor(rng() * 16).toString(16);
    }
    return resultat;
  }

  function utilisateurFictif(rng) {
    return `etu.${choix(rng, NOMS_UTILISATEURS)}`;
  }

  function posteFictif(rng) {
    return `poste-${entierDans(rng, 100, 999)}`;
  }

  function compteFictif(rng) {
    return `compte-${choix(rng, NOMS_COMPTES)}`;
  }

  function serveurFictif(rng) {
    return `srv-${choix(rng, NOMS_SERVEURS)}-${entierDans(rng, 1, 9)}`;
  }

  function tiretiser(texte) {
    return texte
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // retire les accents (é -> e, etc.)
      .replace(/[^a-z0-9]+/g, '-');
  }

  // Quand un contexte d'entreprise (briefing) est fourni, les entités
  // affectées sont puisées dans son effectif/parc plutôt que générées de
  // façon isolée, pour que les alertes d'une même session restent
  // cohérentes avec le personnel et les systèmes présentés à l'étudiant.
  function employeAleatoire(rng, entreprise) {
    if (entreprise && entreprise.employes.length > 0) {
      return choix(rng, entreprise.employes);
    }
    return { nom: utilisateurFictif(rng), poste: null };
  }

  function serveurDeEntreprise(rng, entreprise) {
    if (entreprise && entreprise.serveurs.length > 0) {
      return choix(rng, entreprise.serveurs).nom;
    }
    return serveurFictif(rng);
  }

  function ipFictive(rng) {
    return `${choix(rng, PREFIXES_IP)}${entierDans(rng, 1, 254)}`;
  }

  function domaineFictif(rng) {
    return `${choix(rng, NOMS_DOMAINES)}.example`;
  }

  function emailFictif(rng) {
    return `${choix(rng, ['support', 'verification', 'no-reply', 'contact'])}@${domaineFictif(rng)}`;
  }

  function nomFichierFictif(rng) {
    return choix(rng, NOMS_FICHIERS);
  }

  function hachageFictif(rng) {
    return hexAleatoire(rng, 64);
  }

  function documentMacroFictif(rng) {
    return choix(rng, NOMS_DOCUMENTS_MACRO);
  }

  function peripheriqueFictif(rng) {
    return `usb-${hexAleatoire(rng, 6)}`;
  }

  function serviceCloudFictif(rng) {
    return choix(rng, NOMS_SERVICES_CLOUD);
  }

  function portFictif(rng) {
    return `${choix(rng, PORTS_COURANTS)}/tcp`;
  }

  function groupeFictif(rng) {
    return choix(rng, NOMS_GROUPES);
  }

  function processusFictif(rng) {
    return choix(rng, NOMS_PROCESSUS);
  }

  function cveFictif(rng) {
    return `CVE-${entierDans(rng, 2019, 2025)}-${entierDans(rng, 1000, 49999)}`;
  }

  const GABARITS = {
    phishing: [
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const domaine = domaineFictif(rng);
        const email = emailFictif(rng);
        return {
          description: `Un e-mail suspect invitant à cliquer sur un lien vers ${domaine} a été reçu par ${employe.nom}.`,
          indicateurs: [
            { type: 'domaine', valeur: domaine },
            { type: 'adresse_email', valeur: email },
          ],
          entitesAffectees: [{ type: 'utilisateur', identifiant: employe.nom }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: "Domaine d'expédition réel (usurpation)", valeur: domaineFictif(rng) },
            { libelle: "Destinataires similaires touchés dans l'organisation", valeur: entierDans(rng, 1, 12) },
            { libelle: 'Pièce jointe', valeur: choix(rng, ['Aucune', 'facture.pdf.exe', 'RIB_modifie.pdf']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const domaine = domaineFictif(rng);
        const nomFichier = nomFichierFictif(rng);
        return {
          description: `Une facture jointe (${nomFichier}) a été envoyée à ${employe.nom}, en apparence depuis ${domaine}.`,
          indicateurs: [
            { type: 'nom_fichier', valeur: nomFichier },
            { type: 'domaine', valeur: domaine },
          ],
          entitesAffectees: [{ type: 'utilisateur', identifiant: employe.nom }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: "Cohérence entre l'expéditeur affiché et le domaine réel", valeur: choix(rng, ['Incohérente', 'Cohérente']) },
            { libelle: 'Résultat du scan antivirus fictif de la pièce jointe', valeur: choix(rng, ['Suspect', 'Non détecté']) },
            { libelle: 'Historique d\'échanges avec cet expéditeur', valeur: choix(rng, ['Aucun échange antérieur', 'Fournisseur habituel', 'Premier contact']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const domaine = domaineFictif(rng);
        return {
          description: `Un message se faisant passer pour la direction demande à ${employe.nom} un virement urgent et confidentiel, avec ${domaine} comme adresse de réponse.`,
          indicateurs: [{ type: 'domaine', valeur: domaine }],
          entitesAffectees: [{ type: 'utilisateur', identifiant: employe.nom }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Ton du message', valeur: choix(rng, ['Urgence et confidentialité', 'Neutre']) },
            { libelle: 'Demande de contournement de procédure', valeur: choix(rng, ['Oui', 'Non mentionné']) },
            { libelle: "Adresse habituelle de la direction", valeur: choix(rng, ['Différente de celle du message', 'Non vérifiable']) },
          ],
        };
      },
    ],
    authentification_suspecte: [
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const ip = ipFictive(rng);
        const compte = entreprise ? `compte-${tiretiser(employe.nom)}` : compteFictif(rng);
        return {
          description: `Une connexion inhabituelle a été détectée sur le compte de ${employe.nom} depuis l'adresse IP ${ip}.`,
          indicateurs: [{ type: 'adresse_ip', valeur: ip }],
          entitesAffectees: [
            { type: 'utilisateur', identifiant: employe.nom },
            { type: 'compte', identifiant: compte },
          ],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Localisation de la connexion', valeur: choix(rng, ['Paris, FR', 'Bucarest, RO', 'Lagos, NG', 'Hanoï, VN', 'Localisation habituelle']) },
            { libelle: 'Tentatives échouées avant succès', valeur: entierDans(rng, 0, 6) },
            { libelle: 'Appareil utilisé', valeur: choix(rng, ['Navigateur inconnu / Linux', "Poste habituel de l'utilisateur", 'Application mobile non enregistrée']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const ip = ipFictive(rng);
        return {
          description: `Plusieurs échecs de connexion ont précédé un succès sur le compte de ${employe.nom}, depuis l'adresse IP ${ip}.`,
          indicateurs: [{ type: 'adresse_ip', valeur: ip }],
          entitesAffectees: [{ type: 'utilisateur', identifiant: employe.nom }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: "Nombre total de tentatives", valeur: entierDans(rng, 5, 40) },
            { libelle: 'Intervalle entre les tentatives', valeur: choix(rng, ['Quelques secondes (automatisé)', 'Quelques minutes']) },
            { libelle: 'Authentification à deux facteurs', valeur: choix(rng, ['Activée', 'Non activée sur ce compte']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const ip = ipFictive(rng);
        return {
          description: `Une connexion au compte de ${employe.nom} a eu lieu en dehors des horaires habituels de travail, depuis l'adresse IP ${ip}.`,
          indicateurs: [{ type: 'adresse_ip', valeur: ip }],
          entitesAffectees: [{ type: 'utilisateur', identifiant: employe.nom }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Heure de connexion', valeur: `${entierDans(rng, 0, 5)}h${String(entierDans(rng, 0, 59)).padStart(2, '0')}` },
            { libelle: 'Horaires habituels de cet utilisateur', valeur: '8h-19h en semaine' },
            { libelle: 'Action effectuée après connexion', valeur: choix(rng, ['Consultation de fichiers RH', 'Aucune action visible', "Export d'un rapport"]) },
          ],
        };
      },
    ],
    malware: [
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const poste = entreprise ? `poste-${tiretiser(employe.nom)}` : posteFictif(rng);
        const nomFichier = nomFichierFictif(rng);
        const hachage = hachageFictif(rng);
        return {
          description: `Le poste ${poste} a exécuté un fichier potentiellement malveillant (${nomFichier}).`,
          indicateurs: [
            { type: 'nom_fichier', valeur: nomFichier },
            { type: 'hachage_fichier', valeur: hachage },
          ],
          entitesAffectees: [{ type: 'poste_de_travail', identifiant: poste }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Processus parent', valeur: choix(rng, ['winword.exe', 'explorer.exe', 'powershell.exe', 'cmd.exe']) },
            { libelle: 'Connexions réseau initiées après exécution', valeur: entierDans(rng, 0, 5) },
            { libelle: 'Résultat antivirus (moteur fictif)', valeur: choix(rng, ['Suspect', 'Non détecté', 'Détecté : générique.trojan']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const poste = entreprise ? `poste-${tiretiser(employe.nom)}` : posteFictif(rng);
        const document = documentMacroFictif(rng);
        const hachage = hachageFictif(rng);
        return {
          description: `Le poste ${poste} a ouvert un document bureautique contenant une macro exécutant du code (${document}).`,
          indicateurs: [
            { type: 'nom_fichier', valeur: document },
            { type: 'hachage_fichier', valeur: hachage },
          ],
          entitesAffectees: [{ type: 'poste_de_travail', identifiant: poste }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Origine du document', valeur: choix(rng, ['Pièce jointe e-mail', 'Partage réseau', 'Clé USB']) },
            { libelle: 'Commande lancée par la macro (fictif)', valeur: choix(rng, ['Téléchargement additionnel', 'Aucune commande visible']) },
            { libelle: 'Macros autorisées par la politique de sécurité', valeur: choix(rng, ['Non', 'Oui, avec avertissement']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const poste = entreprise ? `poste-${tiretiser(employe.nom)}` : posteFictif(rng);
        const nomFichier = nomFichierFictif(rng);
        const peripherique = peripheriqueFictif(rng);
        return {
          description: `Une clé USB non autorisée (${peripherique}) connectée au poste ${poste} a démarré automatiquement un exécutable (${nomFichier}).`,
          indicateurs: [
            { type: 'nom_fichier', valeur: nomFichier },
            { type: 'peripherique', valeur: peripherique },
          ],
          entitesAffectees: [{ type: 'poste_de_travail', identifiant: poste }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Politique USB du poste', valeur: choix(rng, ['Périphériques non autorisés bloqués', 'Aucune restriction']) },
            { libelle: 'Exécution automatique (autorun)', valeur: choix(rng, ['Activée', 'Désactivée']) },
            { libelle: 'Propriétaire déclaré de la clé', valeur: choix(rng, ['Inconnu', employe.nom]) },
          ],
        };
      },
    ],
    exfiltration: [
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const employe = employeAleatoire(rng, entreprise);
        return {
          description: `Un volume de données inhabituel a été transféré depuis ${serveur} vers l'adresse IP ${ip}.`,
          indicateurs: [{ type: 'adresse_ip', valeur: ip }],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Volume transféré', valeur: `${entierDans(rng, 50, 4000)} Mo` },
            { libelle: 'Protocole utilisé', valeur: choix(rng, ['HTTPS', 'FTP', 'DNS (tunneling suspecté)']) },
            { libelle: 'Durée du transfert', valeur: `${entierDans(rng, 1, 45)} min` },
            { libelle: 'Compte associé au transfert', valeur: employe.nom },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const service = serviceCloudFictif(rng);
        const employe = employeAleatoire(rng, entreprise);
        return {
          description: `Un volume important de fichiers a été téléversé depuis ${serveur} vers « ${service} », un service non approuvé par l'organisation.`,
          indicateurs: [{ type: 'domaine', valeur: `${tiretiser(service)}.example` }],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Volume téléversé', valeur: `${entierDans(rng, 50, 4000)} Mo` },
            { libelle: 'Service dans la liste approuvée par l\'organisation', valeur: 'Non' },
            { libelle: 'Compte utilisé pour le transfert', valeur: employe.nom },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const peripherique = peripheriqueFictif(rng);
        const employe = employeAleatoire(rng, entreprise);
        return {
          description: `Un volume important de fichiers a été copié depuis ${serveur} vers un support de stockage amovible (${peripherique}).`,
          indicateurs: [{ type: 'peripherique', valeur: peripherique }],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Capacité du support', valeur: choix(rng, ['32 Go', '128 Go', '1 To']) },
            { libelle: 'Support chiffré', valeur: choix(rng, ['Oui', 'Non']) },
            { libelle: 'Dossier source copié', valeur: choix(rng, ['Contrats clients', 'Ressources humaines', 'Sauvegardes techniques']) },
            { libelle: 'Dernière personne ayant accédé au serveur', valeur: employe.nom },
          ],
        };
      },
    ],
    deni_de_service: [
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const port = portFictif(rng);
        return {
          description: `Un pic de trafic anormal vise ${serveur} sur le port ${port}, saturant sa bande passante et rendant le service indisponible par intermittence.`,
          indicateurs: [
            { type: 'adresse_ip', valeur: ip },
            { type: 'port', valeur: port },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: 'Nombre de sources distinctes observées', valeur: entierDans(rng, 5, 5000) },
            { libelle: 'Protocole ciblé', valeur: choix(rng, ['HTTP', 'HTTPS', 'DNS']) },
            { libelle: "Disponibilité du service au moment de l'alerte", valeur: choix(rng, ['Dégradée', 'Indisponible', 'Normale']) },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const port = portFictif(rng);
        return {
          description: `Un volume inhabituel de réponses DNS (amplification) submerge ${serveur}, en provenance d'un grand nombre d'adresses sources probablement usurpées.`,
          indicateurs: [
            { type: 'adresse_ip', valeur: ip },
            { type: 'port', valeur: port },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: 'Facteur d\'amplification observé', valeur: `x${entierDans(rng, 2, 70)}` },
            { libelle: 'Serveurs relais impliqués', valeur: entierDans(rng, 1, 30) },
            { libelle: 'Test de charge planifié', valeur: choix(rng, ['Non', 'Oui, par une équipe interne']) },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const port = portFictif(rng);
        return {
          description: `Un grand nombre de connexions TCP incomplètes (SYN flood) épuise les ressources de ${serveur} sur le port ${port}.`,
          indicateurs: [
            { type: 'adresse_ip', valeur: ip },
            { type: 'port', valeur: port },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: 'Connexions ouvertes simultanément', valeur: entierDans(rng, 500, 50000) },
            { libelle: 'Charge processeur du serveur', valeur: `${entierDans(rng, 60, 100)} %` },
            { libelle: 'Mitigation anti-DDoS active', valeur: choix(rng, ['Non', 'Oui, partielle']) },
          ],
        };
      },
    ],
    elevation_privileges: [
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const serveur = serveurDeEntreprise(rng, entreprise);
        const compte = entreprise ? `compte-${tiretiser(employe.nom)}` : compteFictif(rng);
        const groupe = groupeFictif(rng);
        return {
          description: `Le compte ${compte} a été ajouté au groupe « ${groupe} » sur ${serveur} sans demande de changement approuvée.`,
          indicateurs: [
            { type: 'compte', valeur: compte },
            { type: 'groupe', valeur: groupe },
          ],
          entitesAffectees: [
            { type: 'compte', identifiant: compte },
            { type: 'serveur', identifiant: serveur },
          ],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: "Auteur de l'ajout au groupe", valeur: choix(rng, ['Inconnu', 'Compte administrateur légitime']) },
            { libelle: 'Ticket de changement associé', valeur: choix(rng, ['Aucun', 'Référence introuvable']) },
            { libelle: 'Membres habituels de ce groupe', valeur: entierDans(rng, 1, 10) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const poste = entreprise ? `poste-${tiretiser(employe.nom)}` : posteFictif(rng);
        const processus = processusFictif(rng);
        const hachage = hachageFictif(rng);
        return {
          description: `Une élévation de privilèges via une faille locale (processus ${processus}) a été détectée sur ${poste}.`,
          indicateurs: [
            { type: 'processus', valeur: processus },
            { type: 'hachage_fichier', valeur: hachage },
          ],
          entitesAffectees: [{ type: 'poste_de_travail', identifiant: poste }],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Compte au moment des faits', valeur: choix(rng, ['Utilisateur standard', 'Compte de service']) },
            { libelle: 'Correctifs de sécurité à jour sur ce poste', valeur: choix(rng, ['Non', 'Oui']) },
            { libelle: 'Actions effectuées après élévation', valeur: choix(rng, ['Création de compte local', 'Aucune action visible', 'Désactivation de l\'antivirus']) },
          ],
        };
      },
      (rng, entreprise) => {
        const employe = employeAleatoire(rng, entreprise);
        const serveur = serveurDeEntreprise(rng, entreprise);
        const compte = compteFictif(rng);
        const processus = processusFictif(rng);
        return {
          description: `Le compte de service ${compte} a exécuté des commandes avec des privilèges administrateur en dehors de son usage habituel sur ${serveur}.`,
          indicateurs: [
            { type: 'compte', valeur: compte },
            { type: 'processus', valeur: processus },
          ],
          entitesAffectees: [
            { type: 'compte', identifiant: compte },
            { type: 'serveur', identifiant: serveur },
          ],
          contactEmploye: employe,
          detailsSupplementaires: [
            { libelle: 'Usage habituel de ce compte de service', valeur: choix(rng, ['Tâches planifiées automatisées', 'Sauvegardes nocturnes']) },
            { libelle: 'Commandes inhabituelles observées', valeur: choix(rng, ['Création de compte', 'Modification de droits', 'Aucune'])},
            { libelle: 'Mot de passe de ce compte changé récemment', valeur: choix(rng, ['Non', 'Oui']) },
          ],
        };
      },
    ],
    vulnerabilite_exploitee: [
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const cve = cveFictif(rng);
        return {
          description: `Une tentative d'exploitation de la vulnérabilité ${cve} a été détectée contre ${serveur}, non corrigé, depuis l'adresse IP ${ip}.`,
          indicateurs: [
            { type: 'cve', valeur: cve },
            { type: 'adresse_ip', valeur: ip },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: 'Version du logiciel exposé', valeur: `v${entierDans(rng, 1, 9)}.${entierDans(rng, 0, 9)}` },
            { libelle: 'Correctif disponible', valeur: choix(rng, ['Oui', 'Non']) },
            { libelle: 'Résultat de la tentative', valeur: choix(rng, ['Indéterminé', 'Semble avoir échoué', 'Semble avoir réussi']) },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const cve = cveFictif(rng);
        return {
          description: `Un scan de vulnérabilités suivi d'une tentative d'exploitation (${cve}) a été observé sur ${serveur} depuis l'adresse IP ${ip}.`,
          indicateurs: [
            { type: 'cve', valeur: cve },
            { type: 'adresse_ip', valeur: ip },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: 'Nombre de ports scannés avant la tentative', valeur: entierDans(rng, 5, 500) },
            { libelle: 'Durée entre le scan et la tentative', valeur: `${entierDans(rng, 1, 90)} min` },
            { libelle: 'Cette IP a-t-elle déjà été signalée', valeur: choix(rng, ['Oui, dans une base de réputation', 'Non']) },
          ],
        };
      },
      (rng, entreprise) => {
        const serveur = serveurDeEntreprise(rng, entreprise);
        const ip = ipFictive(rng);
        const cve = cveFictif(rng);
        return {
          description: `Une charge utile exploitant ${cve} a atteint ${serveur} en provenance de l'adresse IP ${ip}, via une application exposée sur Internet.`,
          indicateurs: [
            { type: 'cve', valeur: cve },
            { type: 'adresse_ip', valeur: ip },
          ],
          entitesAffectees: [{ type: 'serveur', identifiant: serveur }],
          contactEmploye: employeAleatoire(rng, entreprise),
          detailsSupplementaires: [
            { libelle: "Fenêtre de maintenance la plus récente sur ce serveur", valeur: `il y a ${entierDans(rng, 1, 120)} jour(s)` },
            { libelle: 'Pare-feu applicatif en place', valeur: choix(rng, ['Oui', 'Non']) },
            { libelle: 'Sévérité annoncée de la vulnérabilité', valeur: choix(rng, ['Critique', 'Élevée', 'Moyenne']) },
          ],
        };
      },
    ],
  };

  const ACTIONS_RECOMMANDEES = {
    phishing: {
      vrai_positif: [
        "Isoler la boîte mail concernée",
        "Réinitialiser le mot de passe de l'utilisateur",
        'Bloquer le domaine expéditeur',
      ],
      faux_positif: ['Clôturer sans action', "Ajouter l'expéditeur à la liste blanche si légitime"],
      a_investiguer: [
        "Demander confirmation à l'utilisateur",
        "Analyser l'en-tête du message",
      ],
    },
    authentification_suspecte: {
      vrai_positif: ['Verrouiller le compte concerné', 'Forcer une réinitialisation du mot de passe'],
      faux_positif: ['Clôturer sans action', "Confirmer le déplacement légitime de l'utilisateur"],
      a_investiguer: [
        "Contacter l'utilisateur pour confirmation",
        'Analyser la géolocalisation de la connexion',
      ],
    },
    malware: {
      vrai_positif: ['Isoler le poste du réseau', 'Lancer une analyse antivirus complète'],
      faux_positif: ['Clôturer sans action', 'Ajouter le fichier à la liste blanche si légitime'],
      a_investiguer: ['Mettre le fichier en quarantaine', 'Analyser le hachage sur une base de réputation'],
    },
    exfiltration: {
      vrai_positif: [
        'Isoler le poste ou le serveur concerné',
        'Bloquer le trafic sortant vers la destination identifiée',
      ],
      faux_positif: ['Clôturer sans action', 'Confirmer un transfert de données légitime'],
      a_investiguer: ['Analyser le volume et la destination des données', "Vérifier les autorisations de l'utilisateur"],
    },
    deni_de_service: {
      vrai_positif: ['Activer le filtrage anti-DDoS / limiter le débit', 'Bloquer les adresses sources identifiées'],
      faux_positif: ['Clôturer sans action', 'Confirmer un test de charge légitime'],
      a_investiguer: ['Analyser la répartition géographique des sources', "Contacter l'équipe infrastructure"],
    },
    elevation_privileges: {
      vrai_positif: ['Révoquer les privilèges accordés', 'Isoler le compte ou le poste concerné'],
      faux_positif: ['Clôturer sans action', "Confirmer la demande d'élévation auprès du responsable"],
      a_investiguer: ["Vérifier l'historique des demandes d'accès", "Analyser le processus à l'origine de l'élévation"],
    },
    vulnerabilite_exploitee: {
      vrai_positif: ['Isoler le serveur concerné', 'Appliquer le correctif de sécurité en urgence'],
      faux_positif: ['Clôturer sans action', 'Confirmer un test de sécurité autorisé (pentest interne)'],
      a_investiguer: ['Vérifier le niveau de correctifs du serveur', 'Analyser la charge utile envoyée'],
    },
  };

  function actionsPour(categorie, classification) {
    return ACTIONS_RECOMMANDEES[categorie][classification];
  }

  function categoriesDisponibles() {
    return CATEGORIES.slice();
  }

  function choisirCategorie(etatSession, rng) {
    // Sélection équilibrée (FR-001, SC-003) : tant que certaines catégories
    // ne sont pas encore apparues dans la session, on tire uniquement parmi
    // elles ; une fois les 4 catégories couvertes, le tirage redevient
    // uniforme sur l'ensemble des catégories.
    const dejaVues = new Set(etatSession.alertesApparues.map((alerte) => alerte.categorie));
    const nonEncoreVues = CATEGORIES.filter((categorie) => !dejaVues.has(categorie));
    const bassin = nonEncoreVues.length > 0 ? nonEncoreVues : CATEGORIES;
    return choix(rng, bassin);
  }

  function signatureAlerte(alerte) {
    const indicateurs = alerte.indicateurs
      .map((i) => `${i.type}:${i.valeur}`)
      .sort()
      .join('|');
    return `${alerte.categorie}::${indicateurs}`;
  }

  function estDoublon(alerte, alertesApparues) {
    const sig = signatureAlerte(alerte);
    return alertesApparues.some((a) => signatureAlerte(a) === sig);
  }

  // --- Analyse fictive d'indicateur (façon « VirusTotal ») ---
  //
  // Le score de détection est corrélé à la classification de référence
  // mais volontairement bruité : il donne un indice d'enquête réaliste
  // sans révéler directement le verdict (cf. FR-013/FR-026 — auto-
  // correction différée).
  function genererRapportAnalyse(indicateur, classificationReference, rng) {
    let detections;
    if (classificationReference === 'vrai_positif') {
      detections = entierDans(rng, 12, 55);
    } else if (classificationReference === 'faux_positif') {
      detections = entierDans(rng, 0, 4);
    } else {
      detections = entierDans(rng, 3, 18);
    }
    const total = 70;
    const verdictAffiche = detections >= 15 ? 'Malveillant' : detections >= 5 ? 'Suspect' : 'Aucune détection significative';
    const joursDepuisPremiereObservation = entierDans(rng, 1, 900);
    const premiereObservation = `il y a ${joursDepuisPremiereObservation} jour(s)`;

    const detailsParType = {
      adresse_ip: [`Pays associé : ${choix(rng, ['Pays-Bas', 'Roumanie', 'France', 'Singapour', 'Inconnu'])}`, `Catégorie réseau : ${choix(rng, ['Hébergeur cloud', 'FAI résidentiel', 'VPN/anonymisation connu', 'Non catégorisé'])}`],
      domaine: [`Âge du domaine : ${choix(rng, ['Enregistré il y a moins de 30 jours', 'Enregistré depuis plusieurs années'])}`, `Catégorie : ${choix(rng, ['Hameçonnage signalé', 'Non catégorisé', 'Service légitime connu'])}`],
      nom_fichier: [`Type de fichier détecté : ${choix(rng, ['Exécutable Windows', 'Document bureautique avec macro', 'Archive compressée'])}`, `Signature numérique : ${choix(rng, ['Absente', 'Présente mais invalide', 'Présente et valide'])}`],
      hachage_fichier: [`Type de fichier détecté : ${choix(rng, ['Exécutable Windows', 'Document bureautique avec macro', 'Archive compressée'])}`, `Familles associées (fictif) : ${choix(rng, ['Aucune', 'générique.trojan', 'ransomware.generique'])}`],
      adresse_email: [`Domaine expéditeur connu : ${choix(rng, ['Oui', 'Non'])}`, `Signalements similaires reçus par l'organisation : ${entierDans(rng, 0, 15)}`],
      peripherique: [`Périphérique déjà vu sur le parc : ${choix(rng, ['Oui', 'Non'])}`, `Politique de sécurité applicable : ${choix(rng, ['Périphériques non autorisés bloqués', 'Aucune restriction connue'])}`],
      compte: [`Compte à privilèges : ${choix(rng, ['Oui', 'Non'])}`, `Dernière modification du mot de passe : il y a ${entierDans(rng, 1, 400)} jour(s)`],
      port: [`Type de trafic observé : ${choix(rng, ['Volumétrique', 'Applicatif (couche 7)', 'Protocolaire'])}`, `Nombre de sources distinctes : ${entierDans(rng, 5, 5000)}`],
      groupe: [`Groupe à privilèges : ${choix(rng, ['Oui', 'Non'])}`, `Membres habituels du groupe : ${entierDans(rng, 1, 10)}`],
      processus: [`Signature numérique : ${choix(rng, ['Absente', 'Présente mais invalide', 'Présente et valide'])}`, `Éditeur déclaré : ${choix(rng, ['Inconnu', 'Éditeur reconnu'])}`],
      cve: [`Score de sévérité (CVSS) : ${(entierDans(rng, 50, 100) / 10).toFixed(1)}`, `Correctif disponible : ${choix(rng, ['Oui', 'Non'])}`],
    };

    return {
      cible: indicateur.valeur,
      typeCible: indicateur.type,
      detections,
      total,
      score: `${detections}/${total}`,
      verdictAffiche,
      premiereObservation,
      details: detailsParType[indicateur.type] || [],
    };
  }

  // --- Conversation fictive avec l'employé concerné ---
  //
  // Réponses scénarisées (pas d'IA, pas de réseau) : quelques questions
  // fermées par catégorie, chacune avec une réponse par grande famille de
  // classification. Comme pour l'analyse ci-dessus, les réponses orientent
  // sans jamais nommer la classification de référence.
  const QUESTIONS_CONVERSATION = {
    phishing: [
      {
        question: 'Avez-vous cliqué sur le lien de cet e-mail ?',
        reponses: {
          vrai_positif: "Oui, j'ai cliqué avant de me rendre compte que ça semblait louche.",
          faux_positif: "Non, j'ai tout de suite reconnu un lien officiel de notre outil habituel, tout va bien.",
          a_investiguer: 'Je ne suis plus très sûr(e), le message ressemblait beaucoup à nos e-mails habituels.',
        },
      },
      {
        question: 'Avez-vous saisi des identifiants ou ouvert une pièce jointe ?',
        reponses: {
          vrai_positif: "Oui, j'ai saisi mon mot de passe sur la page qui s'est ouverte.",
          faux_positif: "Non, je n'ai rien téléchargé ni saisi.",
          a_investiguer: 'Je ne me souviens plus exactement, ça allait très vite.',
        },
      },
    ],
    authentification_suspecte: [
      {
        question: 'Est-ce vous qui vous êtes connecté(e) à cette heure et depuis ce lieu ?',
        reponses: {
          vrai_positif: "Non, absolument pas, je n'étais pas connecté(e) à ce moment-là.",
          faux_positif: "Oui, c'était moi, j'étais en déplacement.",
          a_investiguer: "Je ne suis pas sûr(e), j'avais peut-être laissé une session ouverte.",
        },
      },
      {
        question: 'Avez-vous remarqué une activité inhabituelle sur votre compte ?',
        reponses: {
          vrai_positif: "Oui, des e-mails envoyés que je n'ai pas écrits.",
          faux_positif: 'Non, rien d\'anormal de mon côté.',
          a_investiguer: "Rien de flagrant, mais je n'ai pas tout vérifié.",
        },
      },
    ],
    malware: [
      {
        question: 'Avez-vous ouvert ou exécuté ce fichier récemment ?',
        reponses: {
          vrai_positif: "Oui, je l'ai ouvert, je pensais que c'était un document normal.",
          faux_positif: 'Non, ce fichier ne me dit rien du tout.',
          a_investiguer: 'Peut-être, je reçois beaucoup de documents, difficile à dire.',
        },
      },
      {
        question: 'Votre poste vous a-t-il semblé lent ou anormal depuis ?',
        reponses: {
          vrai_positif: "Oui, il est plus lent que d'habitude depuis hier.",
          faux_positif: 'Non, tout fonctionne normalement.',
          a_investiguer: 'Un peu, mais ça arrive souvent.',
        },
      },
    ],
    exfiltration: [
      {
        question: 'Avez-vous transféré ou téléversé des fichiers volumineux récemment ?',
        reponses: {
          vrai_positif: 'Oui, je devais partager un gros dossier rapidement avec un contact externe.',
          faux_positif: "Non, je n'ai rien transféré d'inhabituel.",
          a_investiguer: "Pas que je me souvienne, mais d'autres personnes ont accès à ce serveur.",
        },
      },
      {
        question: 'Cette destination vous est-elle familière ?',
        reponses: {
          vrai_positif: "Pas vraiment, on me l'avait recommandée pour aller plus vite.",
          faux_positif: 'Oui, c\'est un outil que notre équipe utilise couramment.',
          a_investiguer: "Je ne sais pas, je n'ai pas vérifié qui d'autre y a accès.",
        },
      },
    ],
    deni_de_service: [
      {
        question: 'Avez-vous constaté une lenteur ou une indisponibilité du service ces dernières minutes ?',
        reponses: {
          vrai_positif: 'Oui, plusieurs collègues se sont plaints de ne plus pouvoir accéder au service.',
          faux_positif: 'Non, tout fonctionnait normalement de mon côté.',
          a_investiguer: "Un peu de lenteur, mais rien d'alarmant pour l'instant.",
        },
      },
      {
        question: 'Une opération inhabituelle (test de charge, migration) était-elle prévue sur ce serveur ?',
        reponses: {
          vrai_positif: 'Non, aucune opération planifiée à ma connaissance.',
          faux_positif: 'Oui, une équipe menait justement un test de charge autorisé.',
          a_investiguer: "Je ne suis pas sûr(e), il faudrait vérifier avec l'équipe infrastructure.",
        },
      },
    ],
    elevation_privileges: [
      {
        question: 'Avez-vous demandé une extension de vos droits récemment ?',
        reponses: {
          vrai_positif: "Non, je n'ai fait aucune demande de ce type.",
          faux_positif: 'Oui, une demande a été validée par mon manager la semaine dernière.',
          a_investiguer: "Je ne me souviens pas d'une demande précise, il faudrait vérifier.",
        },
      },
      {
        question: 'Avez-vous exécuté des commandes ou installé un logiciel nécessitant des droits administrateur ?',
        reponses: {
          vrai_positif: "Non, je n'ai rien fait de tel récemment.",
          faux_positif: "Oui, j'installais un logiciel autorisé par le support informatique.",
          a_investiguer: "Peut-être, un script m'a été envoyé par un collègue.",
        },
      },
    ],
    vulnerabilite_exploitee: [
      {
        question: 'Savez-vous si ce serveur a reçu ses derniers correctifs de sécurité ?',
        reponses: {
          vrai_positif: 'Non, je crois que la dernière campagne de mise à jour a été reportée.',
          faux_positif: 'Oui, il a été patché la semaine dernière lors de la fenêtre de maintenance.',
          a_investiguer: "Je ne suis pas certain(e), il faudrait vérifier avec l'équipe infrastructure.",
        },
      },
      {
        question: 'Avez-vous remarqué un comportement inhabituel sur ce serveur récemment ?',
        reponses: {
          vrai_positif: 'Oui, des processus inconnus tournaient depuis ce matin.',
          faux_positif: 'Non, tout semblait normal.',
          a_investiguer: "Rien de flagrant, mais je n'ai pas tout vérifié.",
        },
      },
    ],
  };

  function genererConversationEmploye(categorie, classificationReference) {
    return QUESTIONS_CONVERSATION[categorie].map((q) => ({
      question: q.question,
      reponse: q.reponses[classificationReference],
    }));
  }

  function genererAlerte(etatSession, rngPersonnalise) {
    const rng = rngPersonnalise || Math.random;

    for (let tentative = 0; tentative < TENTATIVES_MAX; tentative += 1) {
      const categorie = choisirCategorie(etatSession, rng);
      const variante = choix(rng, GABARITS[categorie]);
      const gabarit = variante(rng, etatSession.entreprise);
      const classificationReference = choisirClassificationReference(etatSession.role, rng);

      const alerte = {
        id: `alerte-${etatSession.alertesApparues.length + 1}-${Math.floor(rng() * 1e9)}`,
        categorie,
        horodatage: new Date().toISOString(),
        description: gabarit.description,
        entitesAffectees: gabarit.entitesAffectees,
        indicateurs: gabarit.indicateurs,
        detailsSupplementaires: gabarit.detailsSupplementaires,
        classificationReference,
        actionsRecommandees: actionsPour(categorie, classificationReference),
        apparueA: Date.now(),
        employeContact: gabarit.contactEmploye,
        analysesIndicateurs: gabarit.indicateurs.map((indicateur) =>
          genererRapportAnalyse(indicateur, classificationReference, rng)
        ),
        conversationEmploye: genererConversationEmploye(categorie, classificationReference),
      };

      if (!estDoublon(alerte, etatSession.alertesApparues)) {
        return alerte;
      }
    }

    throw new Error(
      "Impossible de générer une alerte inédite (catégorie + indicateurs) après plusieurs tentatives."
    );
  }

  return { categoriesDisponibles, genererAlerte };
});
