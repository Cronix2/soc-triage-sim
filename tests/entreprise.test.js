'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Entreprise = require('../app/js/entreprise.js');

test('genererEntreprise retourne un contexte complet (nom, secteur, employés, serveurs)', () => {
  const entreprise = Entreprise.genererEntreprise();

  assert.equal(typeof entreprise.nom, 'string');
  assert.ok(entreprise.nom.length > 0);
  assert.equal(typeof entreprise.secteur, 'string');
  assert.equal(typeof entreprise.description, 'string');

  assert.ok(Array.isArray(entreprise.employes) && entreprise.employes.length >= 4);
  entreprise.employes.forEach((employe) => {
    assert.equal(typeof employe.nom, 'string');
    assert.equal(typeof employe.poste, 'string');
  });

  assert.ok(Array.isArray(entreprise.serveurs) && entreprise.serveurs.length >= 1);
  entreprise.serveurs.forEach((serveur) => {
    assert.equal(typeof serveur.nom, 'string');
    assert.equal(typeof serveur.role, 'string');
  });
});

test('genererEntreprise accepte une source aléatoire injectée pour un résultat déterministe', () => {
  const rngFige = () => 0;
  const e1 = Entreprise.genererEntreprise(rngFige);
  const e2 = Entreprise.genererEntreprise(rngFige);
  assert.deepEqual(e1, e2);
});
