'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Chasse = require('../app/js/chasse.js');
const Entreprise = require('../app/js/entreprise.js');

const FENETRES = ['siem', 'terminal', 'annuaire', 'explorateur', 'pare_feu'];

test('genererExercice produit 10 lignes par fenêtre (4 fenêtres) dont exactement 3 failles réelles chacune', () => {
  for (let i = 0; i < 10; i += 1) {
    const exercice = Chasse.genererExercice(Entreprise.genererEntreprise(), Math.random);

    FENETRES.forEach((cle) => {
      assert.equal(exercice[cle].length, 10, `${cle} : 10 lignes attendues`);
      assert.equal(exercice[cle].filter((l) => l.estFaille).length, 3, `${cle} : 3 failles attendues`);
    });

    const toutesLesLignes = FENETRES.flatMap((cle) => exercice[cle]);
    const idsUniques = new Set(toutesLesLignes.map((l) => l.id));
    assert.equal(idsUniques.size, 50, 'tous les identifiants doivent être uniques');
  }
});

test('genererExercice fonctionne sans contexte d\'entreprise (repli sur des valeurs par défaut)', () => {
  const exercice = Chasse.genererExercice(undefined, Math.random);
  FENETRES.forEach((cle) => assert.equal(exercice[cle].length, 10));
});

test('genererExercice fournit un pool de pensées non vide', () => {
  const exercice = Chasse.genererExercice(Entreprise.genererEntreprise(), Math.random);
  assert.ok(Array.isArray(exercice.pensees));
  assert.ok(exercice.pensees.length >= 3);
  exercice.pensees.forEach((pensee) => assert.equal(typeof pensee, 'string'));
});

test('evaluerChasse compte les vrais trouvés et les faux positifs signalés, sur les 4 fenêtres', () => {
  const exercice = Chasse.genererExercice(Entreprise.genererEntreprise(), () => 0);
  const toutesLesLignes = FENETRES.flatMap((cle) => exercice[cle]);
  const idsReels = toutesLesLignes.filter((l) => l.estFaille).map((l) => l.id);
  const idBenin = toutesLesLignes.find((l) => !l.estFaille).id;

  const toutTrouve = Chasse.evaluerChasse(exercice, idsReels);
  assert.equal(toutTrouve.vraisTrouves, 15);
  assert.equal(toutTrouve.totalReels, 15);
  assert.equal(toutTrouve.fauxPositifs, 0);

  const avecFauxPositif = Chasse.evaluerChasse(exercice, idsReels.concat([idBenin]));
  assert.equal(avecFauxPositif.vraisTrouves, 15);
  assert.equal(avecFauxPositif.fauxPositifs, 1);

  const rienSignale = Chasse.evaluerChasse(exercice, []);
  assert.equal(rienSignale.vraisTrouves, 0);
  assert.equal(rienSignale.totalReels, 15);
  assert.equal(rienSignale.fauxPositifs, 0);
});
