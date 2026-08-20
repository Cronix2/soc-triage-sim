'use strict';

/*
 * Historique des fiches de triage, dédié à la session en cours (FR-011,
 * FR-024bis) et export en fichier téléchargeable (voir research.md §2).
 * Enveloppe UMD, cf. app/js/alertes.js.
 *
 * Volontairement gardé en mémoire (jamais dans localStorage) : l'historique
 * ne doit pas survivre au-delà de l'exercice en cours, ni mélanger les
 * fiches de plusieurs sessions. `enregistrerFiche`/`listerFiches` acceptent
 * un objet de stockage injecté (mêmes méthodes que `localStorage`) pour
 * rester testables ; `exporterFicheEnFichier` nécessite en revanche un DOM
 * réel.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Stockage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const CLE_STOCKAGE = 'soc_triage_fiches_session';
  let stockageMemoireParDefaut = null;

  function creerStockageMemoire() {
    const donnees = Object.create(null);
    return {
      getItem(cle) {
        return Object.prototype.hasOwnProperty.call(donnees, cle) ? donnees[cle] : null;
      },
      setItem(cle, valeur) {
        donnees[cle] = String(valeur);
      },
    };
  }

  function obtenirStockageParDefaut() {
    if (!stockageMemoireParDefaut) {
      stockageMemoireParDefaut = creerStockageMemoire();
    }
    return stockageMemoireParDefaut;
  }

  function listerFiches(stockagePersonnalise) {
    const stockage = stockagePersonnalise || obtenirStockageParDefaut();
    const brut = stockage.getItem(CLE_STOCKAGE);
    return brut ? JSON.parse(brut) : [];
  }

  function enregistrerFiche(fiche, stockagePersonnalise) {
    const stockage = stockagePersonnalise || obtenirStockageParDefaut();
    const fiches = listerFiches(stockage);
    fiches.push(fiche);
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(fiches));
  }

  function telechargerBlob(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    URL.revokeObjectURL(url);
  }

  function exporterFicheEnFichier(fiche) {
    telechargerBlob(new Blob([fiche.contenuMarkdown], { type: 'text/markdown;charset=utf-8' }), `fiche-triage-${fiche.alerteId}.md`);
  }

  function exporterRapportJSON(rapport) {
    const contenu = JSON.stringify(rapport, null, 2);
    telechargerBlob(new Blob([contenu], { type: 'application/json;charset=utf-8' }), 'rapport-session-triage.json');
  }

  return { enregistrerFiche, listerFiches, exporterFicheEnFichier, exporterRapportJSON };
});
