'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Alertes = require('../app/js/alertes.js');
const Entreprise = require('../app/js/entreprise.js');

function signature(alerte) {
  const indicateurs = alerte.indicateurs
    .map((i) => `${i.type}:${i.valeur}`)
    .sort()
    .join('|');
  return `${alerte.categorie}::${indicateurs}`;
}

test('categoriesDisponibles retourne au moins les 7 catégories attendues (FR-001)', () => {
  const categories = Alertes.categoriesDisponibles();
  assert.deepEqual(
    [...categories].sort(),
    [
      'authentification_suspecte',
      'deni_de_service',
      'elevation_privileges',
      'exfiltration',
      'malware',
      'phishing',
      'vulnerabilite_exploitee',
    ].sort()
  );
});

test('genererAlerte produit une alerte avec tous les champs requis', () => {
  const etatSession = { alertesApparues: [] };
  const alerte = Alertes.genererAlerte(etatSession);

  assert.equal(typeof alerte.id, 'string');
  assert.ok(Alertes.categoriesDisponibles().includes(alerte.categorie));
  assert.equal(typeof alerte.horodatage, 'string');
  assert.equal(typeof alerte.description, 'string');
  assert.ok(Array.isArray(alerte.entitesAffectees) && alerte.entitesAffectees.length >= 1);
  assert.ok(Array.isArray(alerte.indicateurs) && alerte.indicateurs.length >= 1);
  assert.ok(['vrai_positif', 'faux_positif', 'a_investiguer'].includes(alerte.classificationReference));
  assert.ok(Array.isArray(alerte.actionsRecommandees) && alerte.actionsRecommandees.length >= 1);
});

test('genererAlerte ne produit jamais deux alertes partageant catégorie + indicateurs au sein d\'une session (FR-019)', () => {
  const etatSession = { alertesApparues: [] };
  const signatures = new Set();

  for (let i = 0; i < 50; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    const sig = signature(alerte);
    assert.ok(!signatures.has(sig), `doublon détecté pour la signature ${sig}`);
    signatures.add(sig);
    etatSession.alertesApparues.push(alerte);
  }
});

test('genererAlerte couvre toutes les catégories dès les N premières alertes d\'une session (SC-003)', () => {
  const etatSession = { alertesApparues: [] };
  const rngFige = () => 0;
  const categoriesVues = new Set();
  const nombreCategories = Alertes.categoriesDisponibles().length;

  for (let i = 0; i < nombreCategories; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession, rngFige);
    categoriesVues.add(alerte.categorie);
    etatSession.alertesApparues.push(alerte);
  }

  assert.equal(categoriesVues.size, nombreCategories);
});

test('genererAlerte inclut des détails supplémentaires pour approfondir l\'analyse', () => {
  const etatSession = { alertesApparues: [] };
  for (let i = 0; i < 8; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    etatSession.alertesApparues.push(alerte);
    assert.ok(Array.isArray(alerte.detailsSupplementaires));
    assert.ok(alerte.detailsSupplementaires.length >= 1);
    alerte.detailsSupplementaires.forEach((detail) => {
      assert.equal(typeof detail.libelle, 'string');
      assert.notEqual(detail.valeur, undefined);
    });
  }
});

test('genererAlerte puise les entités affectées dans le contexte d\'entreprise fourni', () => {
  const entreprise = Entreprise.genererEntreprise();
  const nomsEmployes = entreprise.employes.map((e) => e.nom);
  const nomsServeurs = entreprise.serveurs.map((s) => s.nom);
  const etatSession = { alertesApparues: [], entreprise };

  for (let i = 0; i < 12; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    etatSession.alertesApparues.push(alerte);

    alerte.entitesAffectees.forEach((entite) => {
      if (entite.type === 'utilisateur') {
        assert.ok(nomsEmployes.includes(entite.identifiant), `utilisateur inconnu de l'entreprise : ${entite.identifiant}`);
      }
      if (entite.type === 'serveur') {
        assert.ok(nomsServeurs.includes(entite.identifiant), `serveur inconnu de l'entreprise : ${entite.identifiant}`);
      }
    });
  }
});

test('genererAlerte propose plusieurs scénarios distincts par catégorie (diversité)', () => {
  const etatSession = { alertesApparues: [] };
  const gabaritsVusParCategorie = {};

  // 150 tirages (et non 60) : avec désormais 7 catégories (au lieu des 4
  // d'origine), un échantillon de 60 laissait certaines catégories avec
  // trop peu de tirages en moyenne et rendait ce test statistiquement
  // instable (échec observé empiriquement à quelques % des exécutions).
  const tirages = 150;
  for (let i = 0; i < tirages; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    etatSession.alertesApparues.push(alerte);
    // Le gabarit narratif se reconnaît à la forme de la phrase de
    // description une fois les valeurs fictives retirées (premiers mots).
    const debutDescription = alerte.description.split(' ').slice(0, 4).join(' ');
    if (!gabaritsVusParCategorie[alerte.categorie]) {
      gabaritsVusParCategorie[alerte.categorie] = new Set();
    }
    gabaritsVusParCategorie[alerte.categorie].add(debutDescription);
  }

  Alertes.categoriesDisponibles().forEach((categorie) => {
    const vus = gabaritsVusParCategorie[categorie];
    assert.ok(vus, `aucune alerte générée pour ${categorie}`);
    assert.ok(vus.size >= 2, `un seul scénario observé pour ${categorie} sur ${tirages} tirages`);
  });
});

test('genererAlerte fournit une analyse fictive exploitable pour chaque indicateur', () => {
  const etatSession = { alertesApparues: [] };
  for (let i = 0; i < 8; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    etatSession.alertesApparues.push(alerte);

    assert.ok(Array.isArray(alerte.analysesIndicateurs));
    assert.equal(alerte.analysesIndicateurs.length, alerte.indicateurs.length);
    alerte.analysesIndicateurs.forEach((analyse, index) => {
      assert.equal(analyse.cible, alerte.indicateurs[index].valeur);
      assert.equal(analyse.typeCible, alerte.indicateurs[index].type);
      assert.ok(Number.isInteger(analyse.detections));
      assert.ok(Number.isInteger(analyse.total) && analyse.total > 0);
      assert.equal(typeof analyse.verdictAffiche, 'string');
      assert.equal(typeof analyse.premiereObservation, 'string');
      assert.ok(Array.isArray(analyse.details));
    });
  }
});

test('genererAlerte fournit un contact employé et une conversation exploitable pour chaque catégorie', () => {
  const etatSession = { alertesApparues: [] };
  for (let i = 0; i < 8; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession);
    etatSession.alertesApparues.push(alerte);

    assert.equal(typeof alerte.employeContact.nom, 'string');
    assert.ok(Array.isArray(alerte.conversationEmploye));
    assert.ok(alerte.conversationEmploye.length >= 2);
    alerte.conversationEmploye.forEach((echange) => {
      assert.equal(typeof echange.question, 'string');
      assert.ok(echange.question.length > 0);
      assert.equal(typeof echange.reponse, 'string');
      assert.ok(echange.reponse.length > 0);
    });
  }
});

test('genererAlerte lève une erreur explicite si aucune combinaison inédite n\'est trouvable', () => {
  // RNG truqué : renvoie toujours 0, donc chaque tirage produit exactement
  // la même alerte pour une catégorie donnée. Une fois toutes les
  // catégories couvertes (sélection équilibrée, SC-003), tout nouveau
  // tirage avec ce même RNG revient à la première catégorie et entre en
  // collision à chaque tentative.
  const rngFige = () => 0;
  const etatSession = { alertesApparues: [] };
  const nombreCategories = Alertes.categoriesDisponibles().length;

  for (let i = 0; i < nombreCategories; i += 1) {
    const alerte = Alertes.genererAlerte(etatSession, rngFige);
    etatSession.alertesApparues.push(alerte);
  }

  assert.throws(() => Alertes.genererAlerte(etatSession, rngFige));
});

test('genererAlerte oriente le mix de classifications selon le rôle (FR-052, FR-053)', () => {
  function compterClassifications(role, tirages) {
    const compte = { vrai_positif: 0, faux_positif: 0, a_investiguer: 0 };
    for (let i = 0; i < tirages; i += 1) {
      const etatSession = { alertesApparues: [], role };
      const alerte = Alertes.genererAlerte(etatSession);
      compte[alerte.classificationReference] += 1;
    }
    return compte;
  }

  const tirages = 600;

  const lvl1 = compterClassifications('lvl1', tirages);
  ['vrai_positif', 'faux_positif', 'a_investiguer'].forEach((classe) => {
    const proportion = lvl1[classe] / tirages;
    assert.ok(proportion > 0.25 && proportion < 0.42, `lvl1 : mix attendu proche d'un tiers pour ${classe}, observé ${proportion}`);
  });

  const lvl2 = compterClassifications('lvl2', tirages);
  assert.ok(lvl2.a_investiguer > lvl2.vrai_positif, 'lvl2 : "à investiguer" doit dominer');
  assert.ok(lvl2.vrai_positif > lvl2.faux_positif, 'lvl2 : "vrai positif" doit dépasser "faux positif" (peu de faux positifs, déjà filtrés par le L1)');

  // Le L3 est le plus haut niveau de technicité : il ne reçoit jamais
  // d'« à investiguer » comme vérité de référence, il tranche toujours
  // définitivement (FR-053bis).
  const lvl3 = compterClassifications('lvl3', tirages);
  assert.equal(lvl3.a_investiguer, 0, 'lvl3 : jamais "à investiguer" comme classification de référence');
  assert.ok(lvl3.vrai_positif > 0 && lvl3.faux_positif > 0, 'lvl3 : mix de vrai et faux positifs uniquement');

  const sansRole = compterClassifications(undefined, tirages);
  ['vrai_positif', 'faux_positif', 'a_investiguer'].forEach((classe) => {
    const proportion = sansRole[classe] / tirages;
    assert.ok(proportion > 0.25 && proportion < 0.42, `rôle absent : comportement uniforme d'origine préservé pour ${classe}`);
  });
});
