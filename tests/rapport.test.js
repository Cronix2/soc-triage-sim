'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Rapport = require('../app/js/rapport.js');

function alerte(id, categorie, classificationReference) {
  return {
    id,
    categorie,
    horodatage: '2026-08-19T10:00:00.000Z',
    description: `Description de ${id}`,
    entitesAffectees: [{ type: 'utilisateur', identifiant: 'etu.test' }],
    indicateurs: [{ type: 'adresse_ip', valeur: '198.51.100.10' }],
    detailsSupplementaires: [{ libelle: 'Test', valeur: '42' }],
    classificationReference,
    actionsRecommandees: ['Action A', 'Action B'],
  };
}

function decision(alerteId, classificationEtudiant) {
  return {
    alerteId,
    classificationEtudiant,
    raison: `Raison pour ${alerteId}`,
    horodatageDecision: '2026-08-19T10:05:00.000Z',
    verrouillee: true,
  };
}

function sessionFactice() {
  return {
    role: 'lvl2',
    difficulte: 'facile',
    dureeConfigureeSecondes: 900,
    debutA: Date.parse('2026-08-19T10:00:00.000Z'),
    finA: Date.parse('2026-08-19T10:15:00.000Z'),
    entreprise: { nom: 'Norbec Assurances', secteur: 'assurance' },
    alertesApparues: [
      alerte('a1', 'phishing', 'vrai_positif'),
      alerte('a2', 'malware', 'faux_positif'),
      alerte('a3', 'exfiltration', 'a_investiguer'),
    ],
  };
}

test('genererRapportSession inclut chaque alerte avec la décision de l\'étudiant et le verdict', () => {
  const session = sessionFactice();
  const decisions = [decision('a1', 'vrai_positif'), decision('a2', 'vrai_positif')];

  const rapport = Rapport.genererRapportSession(session, decisions);

  assert.equal(rapport.alertes.length, 3);
  assert.equal(typeof rapport.genereLe, 'string');
  assert.equal(rapport.session.role, 'lvl2');
  assert.equal(rapport.session.difficulte, 'facile');
  assert.equal(rapport.session.entreprise.nom, 'Norbec Assurances');

  const a1 = rapport.alertes.find((a) => a.id === 'a1');
  assert.equal(a1.classificationReference, 'vrai_positif');
  assert.equal(a1.decisionEtudiant.classification, 'vrai_positif');
  assert.equal(a1.estCorrecte, true);

  const a2 = rapport.alertes.find((a) => a.id === 'a2');
  assert.equal(a2.decisionEtudiant.classification, 'vrai_positif');
  assert.equal(a2.classificationReference, 'faux_positif');
  assert.equal(a2.estCorrecte, false);
});

test('genererRapportSession marque les alertes non traitées (decisionEtudiant null, estCorrecte null)', () => {
  const session = sessionFactice();
  const decisions = [decision('a1', 'vrai_positif')];

  const rapport = Rapport.genererRapportSession(session, decisions);
  const a3 = rapport.alertes.find((a) => a.id === 'a3');

  assert.equal(a3.decisionEtudiant, null);
  assert.equal(a3.estCorrecte, null);
});

test('genererRapportSession calcule un résumé cohérent avec les décisions prises', () => {
  const session = sessionFactice();
  const decisions = [decision('a1', 'vrai_positif'), decision('a2', 'vrai_positif')];

  const rapport = Rapport.genererRapportSession(session, decisions);

  assert.equal(rapport.resume.totalAlertes, 3);
  assert.equal(rapport.resume.totalClassees, 2);
  assert.equal(rapport.resume.correctes, 1);
});
