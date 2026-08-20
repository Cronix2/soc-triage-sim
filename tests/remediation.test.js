'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Remediation = require('../app/js/remediation.js');

function alerte(id, categorie, typeIndicateur) {
  return {
    id,
    categorie,
    indicateurs: [{ type: typeIndicateur, valeur: `valeur-${id}` }],
  };
}

function decision(alerteId, classificationEtudiant) {
  return { alerteId, classificationEtudiant };
}

test("genererExercice ne retient que les alertes classées Vrai positif par l'étudiant", () => {
  const alertesApparues = [
    alerte('a1', 'malware', 'hachage_fichier'),
    alerte('a2', 'phishing', 'domaine'),
    alerte('a3', 'exfiltration', 'adresse_ip'),
  ];
  const decisions = [
    decision('a1', 'vrai_positif'),
    decision('a2', 'faux_positif'),
    decision('a3', 'a_investiguer'),
  ];

  const exercice = Remediation.genererExercice(alertesApparues, decisions, 'intermediaire', () => 0);

  assert.equal(exercice.length, 1);
  assert.equal(exercice[0].alerteId, 'a1');
});

test('genererExercice résout la bonne application pour chaque type d\'indicateur', () => {
  const alertesApparues = [
    alerte('a1', 'malware', 'hachage_fichier'),
    alerte('a2', 'authentification_suspecte', 'compte'),
    alerte('a3', 'deni_de_service', 'port'),
    alerte('a4', 'vulnerabilite_exploitee', 'cve'),
  ];
  const decisions = alertesApparues.map((a) => decision(a.id, 'vrai_positif'));

  const exercice = Remediation.genererExercice(alertesApparues, decisions, 'intermediaire', Math.random);
  const applicationParId = Object.fromEntries(exercice.map((item) => [item.alerteId, item.application]));

  assert.equal(applicationParId.a1, 'antivirus');
  assert.equal(applicationParId.a2, 'politique_groupe');
  assert.equal(applicationParId.a3, 'pare_feu');
  assert.equal(applicationParId.a4, 'gestionnaire_correctifs');
});

test('genererExercice fournit, pour chaque application, un nombre d\'options conforme à la difficulté, avec la bonne action uniquement dans la bonne application', () => {
  const alertesApparues = [alerte('a1', 'malware', 'hachage_fichier')];
  const decisions = [decision('a1', 'vrai_positif')];
  const attendu = { facile: 2, intermediaire: 3, difficile: 5 };

  Object.entries(attendu).forEach(([difficulte, nombre]) => {
    for (let i = 0; i < 5; i += 1) {
      const exercice = Remediation.genererExercice(alertesApparues, decisions, difficulte, Math.random);
      const item = exercice[0];

      Object.keys(Remediation.APPLICATIONS).forEach((cleApp) => {
        const options = item.optionsParApplication[cleApp];
        assert.equal(options.length, nombre, `${difficulte}/${cleApp} : nombre d'options attendu ${nombre}`);
        assert.equal(new Set(options).size, nombre, 'les options ne doivent pas contenir de doublon');

        if (cleApp === item.application) {
          assert.ok(options.includes(item.action), 'la bonne application doit proposer la bonne action');
        } else {
          assert.ok(!options.includes(item.action), 'une mauvaise application ne doit jamais proposer la bonne action');
        }
      });
    }
  });
});

test('genererExercice retourne un tableau vide si aucune alerte n\'a été classée Vrai positif', () => {
  const alertesApparues = [alerte('a1', 'malware', 'hachage_fichier')];
  const decisions = [decision('a1', 'faux_positif')];

  const exercice = Remediation.genererExercice(alertesApparues, decisions, 'intermediaire', () => 0);

  assert.deepEqual(exercice, []);
});

test('evaluerReponses compte correctement les bonnes réponses (action correcte uniquement)', () => {
  const alertesApparues = [
    alerte('a1', 'malware', 'hachage_fichier'),
    alerte('a2', 'phishing', 'domaine'),
  ];
  const decisions = alertesApparues.map((a) => decision(a.id, 'vrai_positif'));
  const exercice = Remediation.genererExercice(alertesApparues, decisions, 'intermediaire', () => 0);

  const reponsesToutesCorrectes = {};
  exercice.forEach((item) => {
    reponsesToutesCorrectes[item.alerteId] = item.action;
  });
  assert.deepEqual(Remediation.evaluerReponses(exercice, reponsesToutesCorrectes), {
    correctes: exercice.length,
    total: exercice.length,
  });

  // Une action piochée dans la mauvaise application ne doit jamais compter.
  const reponsesIncorrectes = {};
  exercice.forEach((item) => {
    const mauvaiseCle = Object.keys(Remediation.APPLICATIONS).find((cle) => cle !== item.application);
    reponsesIncorrectes[item.alerteId] = item.optionsParApplication[mauvaiseCle][0];
  });
  assert.equal(Remediation.evaluerReponses(exercice, reponsesIncorrectes).correctes, 0);

  const resultatVide = Remediation.evaluerReponses(exercice, {});
  assert.equal(resultatVide.correctes, 0);
  assert.equal(resultatVide.total, exercice.length);
});
