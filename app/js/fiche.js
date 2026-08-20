'use strict';

/*
 * Génération du contenu Markdown de la fiche de triage (FR-005, FR-006,
 * FR-013). Enveloppe UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Fiche = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const ETIQUETTES_CATEGORIE = {
    phishing: 'Phishing',
    authentification_suspecte: 'Authentification suspecte',
    malware: 'Malware',
    exfiltration: 'Exfiltration de données',
    deni_de_service: 'Déni de service (DDoS)',
    elevation_privileges: 'Élévation de privilèges',
    vulnerabilite_exploitee: 'Vulnérabilité exploitée',
  };

  const ETIQUETTES_CLASSIFICATION = {
    vrai_positif: 'Vrai positif',
    faux_positif: 'Faux positif',
    a_investiguer: 'À investiguer',
  };

  function ligneEntites(entitesAffectees) {
    return entitesAffectees.map((e) => `- ${e.type} : ${e.identifiant}`).join('\n');
  }

  function ligneIndicateurs(indicateurs) {
    return indicateurs.map((i) => `- ${i.type} : ${i.valeur}`).join('\n');
  }

  function ligneActions(actionsRecommandees) {
    return actionsRecommandees.map((a) => `- ${a}`).join('\n');
  }

  function ligneAnalyseComplementaire(decision) {
    const lignes = [];
    if (decision.indicateursSelectionnes && decision.indicateursSelectionnes.length > 0) {
      lignes.push(
        `**Indicateurs jugés pertinents par l'étudiant** :\n${ligneIndicateurs(decision.indicateursSelectionnes)}`
      );
    }
    if (decision.actionChoisie) {
      lignes.push(`**Action choisie par l'étudiant** : ${decision.actionChoisie}`);
    }
    if (decision.entitePrioritaire) {
      lignes.push(`**Entité priorisée par l'étudiant** : ${decision.entitePrioritaire}`);
    }
    return lignes.length > 0 ? `\n${lignes.join('\n\n')}\n` : '';
  }

  function genererFicheMarkdown(alerte, decision) {
    const contenuMarkdown = `# Fiche de triage — ${ETIQUETTES_CATEGORIE[alerte.categorie]}

**Heure de l'alerte** : ${alerte.horodatage}

**Entités affectées** :
${ligneEntites(alerte.entitesAffectees)}

**Indicateurs** :
${ligneIndicateurs(alerte.indicateurs)}

**Classification retenue par l'étudiant** : ${ETIQUETTES_CLASSIFICATION[decision.classificationEtudiant]}

**Raison de la décision** : ${decision.raison}
${ligneAnalyseComplementaire(decision)}
**Classification de référence (auto-correction)** : ${ETIQUETTES_CLASSIFICATION[alerte.classificationReference]}

**Actions recommandées** :
${ligneActions(alerte.actionsRecommandees)}
`;

    return {
      alerteId: alerte.id,
      contenuMarkdown,
      genereeA: new Date().toISOString(),
    };
  }

  return { genererFicheMarkdown };
});
