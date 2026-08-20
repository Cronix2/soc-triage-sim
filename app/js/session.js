'use strict';

/*
 * Minuterie de session de triage (FR-016, FR-017, FR-018).
 * Enveloppe UMD, cf. app/js/alertes.js pour la justification.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Session = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DELAI_MIN_MS = 5000;
  const DELAI_MAX_MS = 45000;

  function demarrerSession(dureeConfigureeSecondes) {
    if (!(dureeConfigureeSecondes > 0)) {
      throw new Error('La durée de la session doit être un nombre de secondes strictement positif.');
    }

    const debutA = Date.now();
    return {
      dureeConfigureeSecondes,
      debutA,
      finA: debutA + dureeConfigureeSecondes * 1000,
      etat: 'en_cours',
      alertesApparues: [],
      decisions: [],
    };
  }

  function sessionEstTerminee(session, maintenant) {
    return maintenant >= session.finA;
  }

  function prochainDelaiApparitionMs(rngPersonnalise, delaiMinPersonnalise, delaiMaxPersonnalise) {
    const rng = rngPersonnalise || Math.random;
    const delaiMin = delaiMinPersonnalise === undefined ? DELAI_MIN_MS : delaiMinPersonnalise;
    const delaiMax = delaiMaxPersonnalise === undefined ? DELAI_MAX_MS : delaiMaxPersonnalise;
    return delaiMin + Math.floor(rng() * (delaiMax - delaiMin));
  }

  return {
    DELAI_MIN_MS,
    DELAI_MAX_MS,
    demarrerSession,
    sessionEstTerminee,
    prochainDelaiApparitionMs,
  };
});
