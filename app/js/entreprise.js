'use strict';

/*
 * Contexte fictif de l'entreprise dans laquelle se déroule l'exercice
 * (briefing de mission). Enveloppe UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Entreprise = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PROFILS_ENTREPRISE = [
    { nom: 'Norbec Assurances', secteur: 'assurance', description: "compagnie d'assurance régionale" },
    { nom: 'Vertex Logistique', secteur: 'logistique', description: "prestataire de transport et d'entreposage" },
    { nom: 'Alcyon Santé', secteur: 'santé', description: 'réseau de cliniques privées' },
    { nom: 'Fabrik Industries', secteur: 'industrie', description: 'fabricant de composants électroniques' },
    { nom: 'Lumeo Télécom', secteur: 'télécommunications', description: 'opérateur de télécommunications régional' },
  ];

  const PRENOMS = ['Camille', 'Lucas', 'Manon', 'Hugo', 'Sarah', 'Nathan', 'Chloé', 'Louis', 'Emma', 'Yanis'];
  const NOMS_FAMILLE = ['Girard', 'Bernard', 'Dupont', 'Martin', 'Leroy', 'Moreau', 'Fournier', 'Petit', 'Roux', 'Simon'];
  const POSTES_METIER = [
    'comptabilité',
    'ressources humaines',
    'support informatique',
    'direction commerciale',
    'service client',
    'logistique',
    'marketing',
    'direction générale',
  ];

  const NOMBRE_EMPLOYES = 6;

  function choix(rng, liste) {
    const index = Math.min(liste.length - 1, Math.floor(rng() * liste.length));
    return liste[index];
  }

  function genererEntreprise(rngPersonnalise) {
    const rng = rngPersonnalise || Math.random;
    const profil = choix(rng, PROFILS_ENTREPRISE);

    const employes = [];
    for (let i = 0; i < NOMBRE_EMPLOYES; i += 1) {
      employes.push({
        nom: `${choix(rng, PRENOMS)} ${choix(rng, NOMS_FAMILLE)}`,
        poste: choix(rng, POSTES_METIER),
      });
    }

    const serveurs = [
      { nom: 'srv-fichiers-1', role: 'partage de fichiers' },
      { nom: 'srv-messagerie-1', role: 'messagerie interne' },
      { nom: 'srv-erp-1', role: `système métier (${profil.secteur})` },
    ];

    return {
      nom: profil.nom,
      secteur: profil.secteur,
      description: profil.description,
      employes,
      serveurs,
    };
  }

  return { genererEntreprise };
});
