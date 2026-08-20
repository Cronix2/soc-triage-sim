'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Triage = require('../app/js/triage.js');

function alerteFactice(id) {
  return { id: id || 'alerte-test-1', categorie: 'phishing' };
}

test('validerClassification rejette une raison vide (FR-004)', () => {
  assert.throws(() => Triage.validerClassification(alerteFactice(), 'vrai_positif', '', []));
});

test('validerClassification rejette une raison composée uniquement d\'espaces (FR-004)', () => {
  assert.throws(() => Triage.validerClassification(alerteFactice(), 'vrai_positif', '   ', []));
});

test('validerClassification accepte une raison non vide et retourne une décision verrouillée', () => {
  const alerte = alerteFactice();
  const decision = Triage.validerClassification(alerte, 'faux_positif', 'Aucun signe malveillant identifié.', []);

  assert.equal(decision.alerteId, alerte.id);
  assert.equal(decision.classificationEtudiant, 'faux_positif');
  assert.equal(decision.raison, 'Aucun signe malveillant identifié.');
  assert.equal(decision.verrouillee, true);
  assert.equal(typeof decision.horodatageDecision, 'string');
});

test('validerClassification refuse de reclasser une alerte déjà décidée (FR-015)', () => {
  const alerte = alerteFactice('alerte-verrouillee');
  const decisionExistante = Triage.validerClassification(alerte, 'vrai_positif', 'Indicateurs concordants.', []);

  assert.throws(() =>
    Triage.validerClassification(alerte, 'faux_positif', 'Je change d\'avis.', [decisionExistante])
  );
});

test('estVerrouillee retourne false avant décision et true après (FR-015)', () => {
  const alerte = alerteFactice('alerte-verrouillage-etat');
  assert.equal(Triage.estVerrouillee(alerte.id, []), false);

  const decision = Triage.validerClassification(alerte, 'a_investiguer', 'Nécessite une analyse complémentaire.', []);
  assert.equal(Triage.estVerrouillee(alerte.id, [decision]), true);
});
