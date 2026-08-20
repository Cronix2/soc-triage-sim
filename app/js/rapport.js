'use strict';

/*
 * Rapport JSON complet de la session, téléchargeable depuis l'écran de
 * correction : reprend chaque alerte, ses détails, la décision de
 * l'étudiant et le verdict, pour une relecture hors-ligne approfondie
 * (retour utilisateur : le contexte de mission ne suffit pas toujours à
 * lui seul à trancher — ce rapport sert de support de révision complet).
 * Enveloppe UMD, cf. app/js/alertes.js.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Rapport = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function genererRapportSession(session, decisions, resultatRemediation, resultatChasse) {
    const alertes = session.alertesApparues.map((alerte) => {
      const decision = decisions.find((d) => d.alerteId === alerte.id) || null;

      return {
        id: alerte.id,
        categorie: alerte.categorie,
        horodatage: alerte.horodatage,
        description: alerte.description,
        entitesAffectees: alerte.entitesAffectees,
        indicateurs: alerte.indicateurs,
        detailsSupplementaires: alerte.detailsSupplementaires,
        analysesIndicateurs: alerte.analysesIndicateurs,
        employeContact: alerte.employeContact,
        conversationEmploye: alerte.conversationEmploye,
        actionsRecommandees: alerte.actionsRecommandees,
        classificationReference: alerte.classificationReference,
        decisionEtudiant: decision
          ? {
              classification: decision.classificationEtudiant,
              raison: decision.raison,
              indicateursSelectionnes: decision.indicateursSelectionnes || null,
              actionChoisie: decision.actionChoisie || null,
              entitePrioritaire: decision.entitePrioritaire || null,
              horodatage: decision.horodatageDecision,
            }
          : null,
        estCorrecte: decision ? decision.classificationEtudiant === alerte.classificationReference : null,
      };
    });

    const classees = alertes.filter((a) => a.decisionEtudiant !== null);

    return {
      genereLe: new Date().toISOString(),
      session: {
        role: session.role || null,
        difficulte: session.difficulte || null,
        dureeConfigureeSecondes: session.dureeConfigureeSecondes,
        debutA: session.debutA ? new Date(session.debutA).toISOString() : null,
        finA: session.finA ? new Date(session.finA).toISOString() : null,
        entreprise: session.entreprise || null,
      },
      resume: {
        totalAlertes: alertes.length,
        totalClassees: classees.length,
        correctes: classees.filter((a) => a.estCorrecte === true).length,
      },
      alertes,
      // Résultats des mini-jeux LVL2/LVL3 (FR-054 à FR-062), absents pour
      // les sessions qui ne les proposent pas (LVL1, Tuto).
      exercices: {
        remediation: resultatRemediation || null,
        chasse: resultatChasse || null,
      },
    };
  }

  return { genererRapportSession };
});
