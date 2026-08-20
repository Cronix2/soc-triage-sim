'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Correction = require('../app/js/correction.js');

function alerte(id, categorie, classificationReference) {
  return { id, categorie, classificationReference };
}

function decision(alerteId, classificationEtudiant) {
  return { alerteId, classificationEtudiant, raison: 'test', verrouillee: true };
}

test('calculerNote compte correctement les bonnes/mauvaises réponses et calcule la note sur 20 (FR-025, SC-007)', () => {
  const alertesApparues = [
    alerte('a1', 'phishing', 'vrai_positif'),
    alerte('a2', 'malware', 'faux_positif'),
    alerte('a3', 'exfiltration', 'a_investiguer'),
    alerte('a4', 'authentification_suspecte', 'vrai_positif'),
  ];
  const decisions = [
    decision('a1', 'vrai_positif'), // correcte
    decision('a2', 'vrai_positif'), // incorrecte
    decision('a3', 'a_investiguer'), // correcte
    // a4 : jamais classée
  ];

  const resultat = Correction.calculerNote(alertesApparues, decisions);

  assert.equal(resultat.totalClassees, 3);
  assert.equal(resultat.correctes, 2);
  assert.equal(resultat.noteSur20, 13.3); // 2/3 * 20, arrondi à 1 décimale

  assert.equal(resultat.details.length, 3);
  const detailA1 = resultat.details.find((d) => d.alerteId === 'a1');
  assert.equal(detailA1.estCorrecte, true);
  const detailA2 = resultat.details.find((d) => d.alerteId === 'a2');
  assert.equal(detailA2.estCorrecte, false);

  assert.deepEqual(resultat.nonTraitees, ['a4']);
});

test('calculerNote exclut les alertes non classées du calcul de la note (FR-024)', () => {
  const alertesApparues = [alerte('a1', 'phishing', 'vrai_positif'), alerte('a2', 'malware', 'faux_positif')];
  const decisions = [decision('a1', 'vrai_positif')];

  const resultat = Correction.calculerNote(alertesApparues, decisions);

  assert.equal(resultat.totalClassees, 1);
  assert.equal(resultat.correctes, 1);
  assert.equal(resultat.noteSur20, 20);
  assert.deepEqual(resultat.nonTraitees, ['a2']);
});

test('calculerNote retourne une note non applicable si aucune alerte n\'a été classée', () => {
  const alertesApparues = [alerte('a1', 'phishing', 'vrai_positif')];
  const decisions = [];

  const resultat = Correction.calculerNote(alertesApparues, decisions);

  assert.equal(resultat.totalClassees, 0);
  assert.equal(resultat.correctes, 0);
  assert.equal(resultat.noteSur20, null);
  assert.deepEqual(resultat.nonTraitees, ['a1']);
});
