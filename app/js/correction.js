'use strict';

/*
 * Calcul de la correction et de la note de fin de session (FR-023, FR-024,
 * FR-025, SC-007). Enveloppe UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Correction = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function calculerNote(alertesApparues, decisions) {
    const details = [];
    const nonTraitees = [];

    alertesApparues.forEach((alerte) => {
      const decision = decisions.find((d) => d.alerteId === alerte.id);
      if (!decision) {
        nonTraitees.push(alerte.id);
        return;
      }
      details.push({
        alerteId: alerte.id,
        categorie: alerte.categorie,
        classificationEtudiant: decision.classificationEtudiant,
        classificationReference: alerte.classificationReference,
        estCorrecte: decision.classificationEtudiant === alerte.classificationReference,
      });
    });

    const totalClassees = details.length;
    const correctes = details.filter((d) => d.estCorrecte).length;
    const noteSur20 = totalClassees > 0 ? Math.round((correctes / totalClassees) * 20 * 10) / 10 : null;

    return { totalClassees, correctes, noteSur20, details, nonTraitees };
  }

  return { calculerNote };
});
