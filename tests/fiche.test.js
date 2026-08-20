'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Fiche = require('../app/js/fiche.js');

function alerteFactice() {
  return {
    id: 'alerte-fiche-1',
    categorie: 'malware',
    horodatage: '2026-08-17T10:15:00.000Z',
    description: "Le poste poste-042 a exécuté un fichier potentiellement malveillant.",
    entitesAffectees: [{ type: 'poste_de_travail', identifiant: 'poste-042' }],
    indicateurs: [{ type: 'hachage_fichier', valeur: 'abc123' }],
    classificationReference: 'vrai_positif',
    actionsRecommandees: ['Isoler le poste du réseau', 'Lancer une analyse antivirus complète'],
  };
}

function decisionFactice() {
  return {
    alerteId: 'alerte-fiche-1',
    classificationEtudiant: 'a_investiguer',
    raison: "Le hachage ne correspond à aucune base de réputation connue.",
    horodatageDecision: '2026-08-17T10:20:00.000Z',
    verrouillee: true,
  };
}

test('genererFicheMarkdown inclut les 7 éléments requis (FR-006, SC-002)', () => {
  const alerte = alerteFactice();
  const decision = decisionFactice();
  const fiche = Fiche.genererFicheMarkdown(alerte, decision);

  assert.equal(fiche.alerteId, alerte.id);
  assert.equal(typeof fiche.genereeA, 'string');

  const contenu = fiche.contenuMarkdown;
  assert.ok(contenu.includes(alerte.horodatage), 'heure de l\'alerte manquante');
  assert.ok(contenu.includes('poste-042'), 'entité affectée manquante');
  assert.ok(contenu.includes('À investiguer'), 'classification de l\'étudiant manquante');
  assert.ok(contenu.includes(decision.raison), 'raison manquante');
  assert.ok(contenu.includes('abc123'), 'indicateur manquant');
  assert.ok(contenu.includes('Vrai positif'), 'classification de référence manquante');
  alerte.actionsRecommandees.forEach((action) => {
    assert.ok(contenu.includes(action), `action recommandée manquante : ${action}`);
  });
});
