'use strict';

/*
 * Chasse aux menaces (LVL3 uniquement) : contenu et notation de l'activité
 * de threat hunting proposée en parallèle de la file d'alertes classique
 * (cf. app/js/ui.js pour le « bureau » simulé — SIEM, terminal, annuaire et
 * explorateur de fichiers et pare-feu fictifs). Génère, pour chacune des 5 fenêtres,
 * une majorité de leurres bénins et quelques signaux réels — des incidents
 * que le flux d'alertes classique (FR-001 à FR-019) n'a volontairement pas
 * remontés, pour que l'étudiant s'entraîne à aller chercher au-delà de ce
 * que le SIEM signale déjà de lui-même. Logique pure, sans DOM. Enveloppe
 * UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Chasse = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function choix(rng, liste) {
    const index = Math.min(liste.length - 1, Math.floor(rng() * liste.length));
    return liste[index];
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

  function melanger(liste, rng) {
    const copie = liste.slice();
    for (let i = copie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie;
  }

  function employeAleatoire(rng, entreprise) {
    if (entreprise && entreprise.employes && entreprise.employes.length > 0) {
      return choix(rng, entreprise.employes).nom;
    }
    return 'etu.dupont';
  }

  function serveurAleatoire(rng, entreprise) {
    if (entreprise && entreprise.serveurs && entreprise.serveurs.length > 0) {
      return choix(rng, entreprise.serveurs).nom;
    }
    return 'srv-fichiers-1';
  }

  // --- Fenêtre « SIEM » : table horodatage / compte / action / source ---

  function lignesSiemBenignes(rng, entreprise) {
    return [
      { horodatage: '08:52', compte: employeAleatoire(rng, entreprise), action: 'Connexion réussie', source: 'poste habituel' },
      { horodatage: '09:14', compte: employeAleatoire(rng, entreprise), action: 'Consultation du portail RH', source: 'poste habituel' },
      { horodatage: '13:05', compte: 'svc-backup', action: 'Sauvegarde nocturne exécutée', source: serveurAleatoire(rng, entreprise) },
      { horodatage: '17:40', compte: employeAleatoire(rng, entreprise), action: 'Déconnexion', source: 'poste habituel' },
      { horodatage: '10:22', compte: 'svc-crm', action: 'Synchronisation CRM programmée', source: serveurAleatoire(rng, entreprise) },
      { horodatage: '07:58', compte: employeAleatoire(rng, entreprise), action: 'Connexion réussie', source: 'VPN entreprise' },
      { horodatage: '12:01', compte: employeAleatoire(rng, entreprise), action: 'Modification de mot de passe (à la demande)', source: 'poste habituel' },
      { horodatage: '16:45', compte: 'svc-erp', action: 'Export mensuel programmé', source: serveurAleatoire(rng, entreprise) },
      { horodatage: '09:30', compte: employeAleatoire(rng, entreprise), action: 'Connexion réussie', source: 'poste habituel (badge validé)' },
    ];
  }

  function lignesSiemFailles(rng, entreprise) {
    return [
      { horodatage: '03:14', compte: 'svc-backup', action: 'Élévation de privilèges vers « Domain Admins »', source: 'adresse IP inconnue du parc' },
      { horodatage: '23:47', compte: employeAleatoire(rng, entreprise), action: 'Téléchargement de 40 fichiers en 2 minutes', source: 'poste habituel' },
      { horodatage: '04:02', compte: 'compte-test-admin', action: 'Connexion réussie après 15 échecs consécutifs', source: 'adresse IP externe non répertoriée' },
      { horodatage: '05:30', compte: 'svc-crm', action: 'Modification de la politique de pare-feu', source: 'poste non enregistré au parc' },
      { horodatage: '22:15', compte: employeAleatoire(rng, entreprise), action: 'Export complet de la base clients', source: 'poste habituel' },
    ];
  }

  // --- Fenêtre « Terminal » : lignes de sortie fictive (processus / réseau) ---

  const LIGNES_TERMINAL_BENIGNES = [
    'explorer.exe        PID 1244   CPU 0%    Utilisateur: local',
    'svchost.exe         PID 812    CPU 1%    Utilisateur: SYSTEM',
    'chrome.exe          PID 5521   CPU 4%    Utilisateur: local',
    'backup-agent.exe    PID 998    CPU 2%    Utilisateur: SYSTEM',
    'TCP 192.168.1.12:443  ESTABLISHED   (mise à jour antivirus)',
    'TCP 10.0.0.5:445  ESTABLISHED   (partage de fichiers interne)',
    'outlook.exe         PID 3391   CPU 3%    Utilisateur: local',
    'TCP 192.168.1.20:389  ESTABLISHED   (annuaire interne)',
    'onedrive.exe        PID 2210   CPU 1%    Utilisateur: local',
  ];

  const LIGNES_TERMINAL_FAILLES = [
    'powershell.exe -enc <base64 tronqué>   PID 4410   CPU 12%   Utilisateur: SYSTEM   (lancé depuis un dossier temporaire)',
    'TCP 203.0.113.44:4444  ESTABLISHED   (processus parent : winword.exe)',
    'svc-inconnu.exe     PID 7788   CPU 8%    Utilisateur: SYSTEM   (aucune signature numérique)',
    'schtasks.exe /create /tn "maj-systeme"   PID 5502   CPU 1%    Utilisateur: SYSTEM   (tâche planifiée créée hors fenêtre de maintenance)',
    'TCP 198.51.100.9:53  ESTABLISHED   (volume de requêtes DNS anormalement élevé — tunneling suspecté)',
  ];

  // --- Fenêtre « Annuaire » : table compte / groupe / modifié le / modifié par ---

  function lignesAnnuaireBenignes(rng, entreprise) {
    return [
      { compte: employeAleatoire(rng, entreprise), groupe: 'Utilisateurs standard', modifie: 'Intégration RH', modifiePar: 'svc-rh' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Accès VPN', modifie: 'Changement de poste', modifiePar: 'support informatique' },
      { compte: 'svc-crm', groupe: 'Comptes de service', modifie: 'Création initiale', modifiePar: 'admin-si' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Retiré — congé longue durée', modifie: 'Suspension temporaire', modifiePar: 'support informatique' },
      { compte: 'svc-backup', groupe: 'Opérateurs de sauvegarde', modifie: 'Renouvellement annuel', modifiePar: 'admin-si' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Accès partagé — marketing', modifie: "Changement d'équipe", modifiePar: 'support informatique' },
      { compte: 'compte-invite', groupe: 'Accès limité', modifie: 'Création pour prestataire', modifiePar: 'admin-si' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Accès imprimantes', modifie: 'Demande standard', modifiePar: 'support informatique' },
    ];
  }

  function lignesAnnuaireFailles(rng, entreprise) {
    return [
      { compte: 'svc-crm', groupe: 'Domain Admins', modifie: 'il y a 2 minutes', modifiePar: 'inconnu (aucun ticket associé)' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Administrateurs locaux — tous les postes', modifie: 'hors procédure', modifiePar: 'compte-test-admin' },
      { compte: 'compte-test-admin', groupe: 'Opérateurs de sauvegarde', modifie: 'ajout récent', modifiePar: 'svc-backup (usage inhabituel)' },
      { compte: employeAleatoire(rng, entreprise), groupe: 'Délégation messagerie — direction', modifie: 'sans validation managériale', modifiePar: 'support informatique (ticket introuvable)' },
      { compte: 'svc-erp', groupe: 'Domain Admins', modifie: 'hors fenêtre de changement', modifiePar: 'inconnu' },
    ];
  }

  // --- Fenêtre « Explorateur de fichiers » : lignes de sortie fictive ---

  const LIGNES_EXPLORATEUR_BENIGNES = [
    { nom: 'rapport_mensuel.docx', modifie: '09:12', taille: '340 Ko', emplacement: 'Documents' },
    { nom: 'planning_equipe.xlsx', modifie: '08:40', taille: '120 Ko', emplacement: 'Documents partagés' },
    { nom: 'photo_evenement.jpg', modifie: '14:05', taille: '2,1 Mo', emplacement: 'Images' },
    { nom: 'notes_reunion.txt', modifie: '11:30', taille: '4 Ko', emplacement: 'Documents' },
    { nom: 'facture_fournisseur.pdf', modifie: '10:15', taille: '210 Ko', emplacement: 'Comptabilité' },
    { nom: 'sauvegarde_config.zip', modifie: '02:00', taille: '18 Mo', emplacement: 'Sauvegardes' },
    { nom: 'presentation_client.pptx', modifie: '16:20', taille: '5,4 Mo', emplacement: 'Documents' },
    { nom: 'contrat_signe.pdf', modifie: '15:02', taille: '640 Ko', emplacement: 'Contrats' },
  ];

  const LIGNES_EXPLORATEUR_FAILLES = [
    { nom: 'facture_2024.pdf.exe', modifie: '23:52', taille: '890 Ko', emplacement: 'Téléchargements (extension double)' },
    { nom: 'svchost32.exe', modifie: '03:10', taille: '12 Ko', emplacement: 'Documents (hors dossier système habituel)' },
    { nom: 'mise_a_jour.scr', modifie: '22:47', taille: '640 Ko', emplacement: 'Téléchargements' },
    { nom: 'export_clients.csv.tmp', modifie: '22:15', taille: '45 Mo', emplacement: 'Dossier temporaire (volume inhabituel)' },
    { nom: '.cache_systeme', modifie: '04:02', taille: '3 Ko', emplacement: 'Démarrage (fichier caché non répertorié)' },
  ];

  // --- Fenêtre « Pare-feu » : table source / destination / port / action ---
  //
  // Contrairement au pare-feu de la résolution d'incident (agir sur un
  // indicateur précis), ici il s'agit d'auditer des règles déjà en place :
  // la plupart sont légitimes et bien restreintes, quelques-unes sont
  // beaucoup trop permissives (ouvertes à tout Internet, ou à « tout vers
  // tout ») et constituent le signal à débusquer.

  function lignesParefeuBenignes(rng, entreprise) {
    return [
      { source: '10.0.0.0/24 (réseau interne)', destination: serveurAleatoire(rng, entreprise), port: '443/HTTPS', action: 'Autoriser' },
      { source: 'VPN entreprise', destination: serveurAleatoire(rng, entreprise), port: '445/SMB (partage interne)', action: 'Autoriser' },
      { source: 'poste habituel', destination: 'srv-messagerie-1', port: '25/SMTP', action: 'Autoriser' },
      { source: 'DMZ', destination: serveurAleatoire(rng, entreprise), port: '443/HTTPS', action: 'Autoriser' },
      { source: '10.0.0.0/24 (réseau interne)', destination: 'srv-fichiers-1', port: '445/SMB', action: 'Autoriser' },
      { source: 'poste habituel', destination: 'proxy sortant', port: '80/HTTP', action: 'Autoriser' },
      { source: '10.0.0.0/24 (réseau interne)', destination: 'srv-backup', port: '22/SSH (clé uniquement)', action: 'Autoriser' },
      { source: 'VLAN imprimantes', destination: 'serveur d’impression', port: '9100/RAW', action: 'Autoriser' },
      { source: 'Internet', destination: serveurAleatoire(rng, entreprise), port: '443/HTTPS (portail public)', action: 'Autoriser' },
    ];
  }

  function lignesParefeuFailles(rng, entreprise) {
    return [
      { source: '0.0.0.0/0 (Internet)', destination: serveurAleatoire(rng, entreprise), port: '3389/RDP', action: 'Autoriser (bureau à distance ouvert au monde entier)' },
      { source: 'Any', destination: 'Any', port: 'Any', action: 'Autoriser (règle passe-partout)' },
      { source: '0.0.0.0/0 (Internet)', destination: 'srv-fichiers-1', port: '445/SMB', action: 'Autoriser (partage de fichiers exposé publiquement)' },
      { source: '0.0.0.0/0 (Internet)', destination: serveurAleatoire(rng, entreprise), port: '3306/MySQL', action: 'Autoriser (base de données accessible depuis Internet)' },
      { source: '0.0.0.0/0 (Internet)', destination: 'srv-backup', port: '22/SSH (mot de passe autorisé)', action: 'Autoriser (sauvegardes accessibles depuis n’importe où)' },
    ];
  }

  const PENSEES = [
    "Les alertes classiques ratent parfois ce qui reste juste sous le seuil de déclenchement... et si je regardais les horaires inhabituels ?",
    "Un compte de service qui agit en dehors de son usage habituel, ça vaut le coup d'œil.",
    "Le terminal peut révéler un processus qui tourne sans qu'aucune alerte ne l'ait signalé.",
    "Une connexion réseau vers une adresse jamais vue sur le parc mérite d'être creusée.",
    'Un transfert de fichiers rapide, même petit, peut passer sous le radar du SIEM.',
    "Une tâche planifiée qui apparaît hors de la fenêtre de maintenance habituelle, ça se creuse.",
    "Un volume inhabituel de requêtes vers un service qui n'en reçoit normalement presque jamais mérite un coup d'œil.",
    "Toutes les règles de pare-feu ne se valent pas : une règle beaucoup trop permissive peut dormir des mois avant d'être exploitée.",
  ];

  // Volume de la chasse (LVL3) : 10 lignes par fenêtre, dont 3 signaux réels
  // — volontairement généreux pour laisser une vraie activité de recherche
  // en parallèle de la file d'alertes, plus réduite à ce rôle (FR-053bis).
  const NB_LIGNES_TOTAL_PAR_FENETRE = 10;
  const NB_FAILLES_PAR_FENETRE = 3;

  function construireLignes(prefixe, benignes, failles, rng, entreprise) {
    const poolBenignes = typeof benignes === 'function' ? benignes(rng, entreprise) : benignes;
    const poolFailles = typeof failles === 'function' ? failles(rng, entreprise) : failles;

    const beningsTires = tirerN(poolBenignes, NB_LIGNES_TOTAL_PAR_FENETRE - NB_FAILLES_PAR_FENETRE, rng);
    const faillesTirees = tirerN(poolFailles, NB_FAILLES_PAR_FENETRE, rng);

    const lignes = beningsTires
      .map((contenu, index) => Object.assign({ id: `${prefixe}-${index}`, estFaille: false }, typeof contenu === 'string' ? { texte: contenu } : contenu))
      .concat(
        faillesTirees.map((contenu, index) =>
          Object.assign({ id: `${prefixe}-faille-${index}`, estFaille: true }, typeof contenu === 'string' ? { texte: contenu } : contenu)
        )
      );

    return melanger(lignes, rng);
  }

  // Les 5 fenêtres du bureau (FR-059) partagent la même mécanique de
  // génération (construireLignes) ; cette liste évite de la répéter à la
  // main dans genererExercice/evaluerChasse.
  const CLES_FENETRES = ['siem', 'terminal', 'annuaire', 'explorateur', 'pare_feu'];

  function genererExercice(entreprise, rngPersonnalise) {
    const rng = rngPersonnalise || Math.random;

    return {
      siem: construireLignes('siem', lignesSiemBenignes, lignesSiemFailles, rng, entreprise),
      terminal: construireLignes('terminal', LIGNES_TERMINAL_BENIGNES, LIGNES_TERMINAL_FAILLES, rng, entreprise),
      annuaire: construireLignes('annuaire', lignesAnnuaireBenignes, lignesAnnuaireFailles, rng, entreprise),
      explorateur: construireLignes('explorateur', LIGNES_EXPLORATEUR_BENIGNES, LIGNES_EXPLORATEUR_FAILLES, rng, entreprise),
      pare_feu: construireLignes('parefeu', lignesParefeuBenignes, lignesParefeuFailles, rng, entreprise),
      pensees: melanger(PENSEES, rng),
    };
  }

  // idsSignales : identifiants des éléments que l'étudiant a marqués via
  // le bouton « Eureka ».
  function evaluerChasse(exercice, idsSignales) {
    const reels = CLES_FENETRES.flatMap((cle) => exercice[cle])
      .filter((ligne) => ligne.estFaille)
      .map((ligne) => ligne.id);

    const vraisTrouves = reels.filter((id) => idsSignales.includes(id)).length;
    const fauxPositifs = idsSignales.filter((id) => !reels.includes(id)).length;

    return { vraisTrouves, totalReels: reels.length, fauxPositifs };
  }

  return { genererExercice, evaluerChasse };
});
