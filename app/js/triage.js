'use strict';

/*
 * Validation d'une classification et verrouillage des alertes déjà
 * traitées (FR-003, FR-004, FR-015). Enveloppe UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Triage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const CLASSIFICATIONS_VALIDES = ['vrai_positif', 'faux_positif', 'a_investiguer'];

  function estVerrouillee(alerteId, decisionsExistantes) {
    return decisionsExistantes.some((decision) => decision.alerteId === alerteId);
  }

  function validerClassification(alerte, classificationEtudiant, raison, decisionsExistantes) {
    if (!CLASSIFICATIONS_VALIDES.includes(classificationEtudiant)) {
      throw new Error(`Classification inconnue : ${classificationEtudiant}`);
    }

    if (typeof raison !== 'string' || raison.trim().length === 0) {
      throw new Error('Une raison non vide est requise avant de valider une classification (FR-004).');
    }

    if (estVerrouillee(alerte.id, decisionsExistantes)) {
      throw new Error("Cette alerte a déjà été classée et ne peut plus être reclassée (FR-015).");
    }

    return {
      alerteId: alerte.id,
      classificationEtudiant,
      raison: raison.trim(),
      horodatageDecision: new Date().toISOString(),
      verrouillee: true,
    };
  }

  return { validerClassification, estVerrouillee };
});
