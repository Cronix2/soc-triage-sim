'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../app/js/session.js');

test('demarrerSession rejette une durée <= 0 (FR-016)', () => {
  assert.throws(() => Session.demarrerSession(0));
  assert.throws(() => Session.demarrerSession(-5));
});

test('demarrerSession crée une session en cours avec une échéance cohérente', () => {
  const avant = Date.now();
  const session = Session.demarrerSession(60);
  const apres = Date.now();

  assert.equal(session.etat, 'en_cours');
  assert.ok(session.debutA >= avant && session.debutA <= apres);
  assert.equal(session.finA, session.debutA + 60 * 1000);
  assert.deepEqual(session.alertesApparues, []);
  assert.deepEqual(session.decisions, []);
});

test('sessionEstTerminee détecte correctement le temps écoulé (FR-018)', () => {
  const session = Session.demarrerSession(60);

  assert.equal(Session.sessionEstTerminee(session, session.debutA), false);
  assert.equal(Session.sessionEstTerminee(session, session.finA - 1), false);
  assert.equal(Session.sessionEstTerminee(session, session.finA), true);
  assert.equal(Session.sessionEstTerminee(session, session.finA + 1000), true);
});

test('prochainDelaiApparitionMs retourne une valeur dans une plage bornée strictement positive (FR-017)', () => {
  for (let i = 0; i < 50; i += 1) {
    const delai = Session.prochainDelaiApparitionMs();
    assert.ok(Number.isFinite(delai));
    assert.ok(delai > 0);
    assert.ok(delai <= Session.DELAI_MAX_MS);
  }
});

test('prochainDelaiApparitionMs accepte une source aléatoire injectée pour un résultat déterministe', () => {
  const rngFige = () => 0;
  const delaiMin = Session.prochainDelaiApparitionMs(rngFige);
  assert.equal(delaiMin, Session.DELAI_MIN_MS);

  const rngMax = () => 0.999999;
  const delaiProcheMax = Session.prochainDelaiApparitionMs(rngMax);
  assert.ok(delaiProcheMax <= Session.DELAI_MAX_MS);
  assert.ok(delaiProcheMax > delaiMin);
});

test('prochainDelaiApparitionMs accepte des bornes personnalisées (mode tuto)', () => {
  for (let i = 0; i < 50; i += 1) {
    const delai = Session.prochainDelaiApparitionMs(undefined, 1000, 3000);
    assert.ok(delai >= 1000);
    assert.ok(delai < 3000);
  }
});
