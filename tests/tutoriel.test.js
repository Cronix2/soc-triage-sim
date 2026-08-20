'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Tutoriel = require('../app/js/tutoriel.js');

test('ETAPES est un tableau non vide de contenu bien formé', () => {
  assert.ok(Array.isArray(Tutoriel.ETAPES));
  assert.ok(Tutoriel.ETAPES.length >= 15, 'le guide doit compter un nombre substantiel d\'étapes');

  Tutoriel.ETAPES.forEach((etape) => {
    assert.equal(typeof etape.id, 'string');
    assert.ok(etape.id.length > 0);
    assert.equal(typeof etape.titre, 'string');
    assert.ok(etape.titre.length > 0);
    assert.equal(typeof etape.texte, 'string');
    assert.ok(etape.texte.trim().length > 0);
    assert.ok(['session', 'remediation', 'correction'].includes(etape.vue), `vue inattendue pour ${etape.id}`);
    assert.ok(['file', 'chasse'].includes(etape.onglet), `onglet inattendu pour ${etape.id}`);
    assert.ok(etape.cible === null || typeof etape.cible === 'string');
  });
});

test('les identifiants d\'étape sont uniques', () => {
  const ids = Tutoriel.ETAPES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('couvre bien les trois niveaux de Difficulté et les trois Rôles hors Tuto', () => {
  const ids = Tutoriel.ETAPES.map((e) => e.id);
  ['difficulte-facile', 'difficulte-intermediaire', 'difficulte-difficile'].forEach((id) =>
    assert.ok(ids.includes(id), `étape ${id} manquante`)
  );
  ['role-l1', 'role-l2-intro', 'role-l2-demo', 'role-l3-intro', 'role-l3-chasse'].forEach((id) =>
    assert.ok(ids.includes(id), `étape ${id} manquante`)
  );
});

test('la première étape est un accueil et la dernière conclut le tutoriel', () => {
  assert.equal(Tutoriel.ETAPES[0].id, 'bienvenue');
  assert.equal(Tutoriel.ETAPES[Tutoriel.ETAPES.length - 1].id, 'fin');
});
