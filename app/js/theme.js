'use strict';

/*
 * Préférence de thème clair/sombre, mémorisée localement (FR-020). Module
 * DOM (bouton, attribut sur <html>) — pas d'enveloppe UMD nécessaire ici
 * puisqu'il n'est pas requis par les tests Node (cf. plan.md).
 */
(function () {
  const CLE_THEME = 'soc_triage_theme';

  function preferenceSysteme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'sombre'
      : 'clair';
  }

  function themeMemorise() {
    try {
      return localStorage.getItem(CLE_THEME);
    } catch (e) {
      return null;
    }
  }

  function memoriserTheme(theme) {
    try {
      localStorage.setItem(CLE_THEME, theme);
    } catch (e) {
      // Stockage indisponible (mode privé strict, par ex.) : le thème
      // s'applique quand même pour la session en cours, simplement sans
      // être mémorisé d'une visite à l'autre.
    }
  }

  function appliquerTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const bouton = document.getElementById('bouton-theme');
    if (bouton) {
      bouton.innerHTML =
        theme === 'sombre' ? `${window.Icones.balise('soleil')} CLAIR` : `${window.Icones.balise('lune')} SOMBRE`;
    }
  }

  function basculerTheme() {
    const themeActuel = document.documentElement.dataset.theme;
    const nouveauTheme = themeActuel === 'sombre' ? 'clair' : 'sombre';
    memoriserTheme(nouveauTheme);
    appliquerTheme(nouveauTheme);
  }

  function initialiser() {
    appliquerTheme(themeMemorise() || preferenceSysteme());
    const bouton = document.getElementById('bouton-theme');
    if (bouton) {
      bouton.addEventListener('click', basculerTheme);
    }
  }

  document.addEventListener('DOMContentLoaded', initialiser);
})();
