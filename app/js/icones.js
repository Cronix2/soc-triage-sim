'use strict';

/*
 * Jeu d'icônes SVG en ligne (pas d'emoji, pas de police d'icônes externe —
 * cohérent avec la contrainte « sans réseau »). Chaque icône utilise
 * `currentColor`, donc elle hérite automatiquement de la couleur du texte
 * du bouton qui la contient, dans les deux thèmes.
 */
(function (root) {
  const attributs = 'viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"';
  const traitBase = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  // Icônes bitmap 16x16 en aplats de pixels carrés (pas d'anticrénelage,
  // `shape-rendering="crispEdges"`) : réservées au bureau simulé (chasse
  // aux menaces, résolution d'incident) pour un rendu façon écran LCD
  // monochrome, distinct des icônes au trait utilisées ailleurs dans
  // l'app. Grille 16x16 (plutôt que 8x8) pour un rendu plus détaillé,
  // moins « en blocs » à taille égale — même esprit qu'un sprite façon
  // console 16 bits plutôt qu'un pictogramme 8 bits. `motif` est un
  // tableau de 16 chaînes de 16 caractères, '1' = pixel allumé.
  function pixelIcone(motif) {
    const cote = motif.length;
    const rects = [];
    motif.forEach((ligne, y) => {
      for (let x = 0; x < ligne.length; x += 1) {
        if (ligne[x] === '1') {
          rects.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
        }
      }
    });
    return `<svg viewBox="0 0 ${cote} ${cote}" width="22" height="22" aria-hidden="true" focusable="false" fill="currentColor" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  }

  const Icones = {
    soleil: `<svg ${attributs} ${traitBase}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`,
    lune: `<svg ${attributs} ${traitBase}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>`,
    loupe: `<svg ${attributs} ${traitBase}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
    messages: `<svg ${attributs} ${traitBase}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    telechargement: `<svg ${attributs} ${traitBase}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`,
    coche: `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
    croix: `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    fermer: `<svg ${attributs} ${traitBase}><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    lecture: `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    sortie: `<svg ${attributs} ${traitBase}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    ecran: `<svg ${attributs} ${traitBase}><rect x="2" y="4" width="20" height="14" rx="1"/><path d="M8 20h8M12 18v2"/></svg>`,
    terminal: `<svg ${attributs} ${traitBase}><rect x="2" y="4" width="20" height="16" rx="1"/><path d="M6 9l4 3-4 3M12 15h6"/></svg>`,
    oeil: `<svg ${attributs} ${traitBase}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    ampoule: `<svg ${attributs} ${traitBase}><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>`,
    bouclier: `<svg ${attributs} ${traitBase}><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/></svg>`,
    utilisateurs: `<svg ${attributs} ${traitBase}><circle cx="9" cy="8" r="3"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><circle cx="17" cy="8" r="2.5"/><path d="M16 14.2c2.7.5 4.5 2.6 4.5 5.8"/></svg>`,
    cle: `<svg ${attributs} ${traitBase}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L2 19l3 3 7.3-7.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8Z"/></svg>`,
    pixelParefeu: pixelIcone([
      '0001111111110000',
      '0111111111111110',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '0111111111111110',
      '0111111111111110',
      '0011111111111100',
      '0011111111111100',
      '0001111111110000',
      '0000111111110000',
      '0000011111100000',
      '0000001111000000',
      '0000000110000000',
    ]),
    pixelAntivirus: pixelIcone([
      '0000000000000000',
      '0000000000000000',
      '0001111111110000',
      '0111111111111110',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '0111111111111110',
      '0001111111110000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelGroupe: pixelIcone([
      '0000000000000000',
      '0000000000000000',
      '0001110000111000',
      '0001110000111000',
      '0000000000000000',
      '0111111001111110',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '0111111111111110',
      '0001111111110000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelCorrectifs: pixelIcone([
      '0000000000000011',
      '0000000000000111',
      '0000000000001110',
      '0000000000011100',
      '0000000000111000',
      '0000000001110000',
      '0000000011100000',
      '0000000111000000',
      '0000001110000000',
      '0000011100000000',
      '0000111000000000',
      '0001110000000000',
      '0011100000000000',
      '0111000000000000',
      '1110000000000000',
      '1100000000000000',
    ]),
    pixelSiem: pixelIcone([
      '1111111111111111',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1111111111111111',
      '0000001111000000',
      '0000011111100000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelTerminal: pixelIcone([
      '1111111111111111',
      '1000000000000001',
      '1000000000000001',
      '1001000000000001',
      '1000100000000001',
      '1000010000000001',
      '1000100000000001',
      '1001000000000001',
      '1001111111000001',
      '1111111111111111',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelOeil: pixelIcone([
      '0000000000000000',
      '0000000000000000',
      '0000011111100000',
      '0001111111111000',
      '0011111111111100',
      '0111111111111110',
      '0111111001111110',
      '0111110000111110',
      '0111111001111110',
      '0011111111111100',
      '0001111111111000',
      '0000011111100000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelAmpoule: pixelIcone([
      '0000001111000000',
      '0000111111110000',
      '0001111111111000',
      '0011111111111100',
      '0011111111111100',
      '0011111111111100',
      '0001111111111000',
      '0000111111110000',
      '0000011111100000',
      '0000000000000000',
      '0000011111100000',
      '0000000000000000',
      '0000011111100000',
      '0000001111000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelAnnuaire: pixelIcone([
      '1111111111111111',
      '1100000000000001',
      '1100000000000001',
      '1101111111111001',
      '1100000000000001',
      '1101111111111001',
      '1100000000000001',
      '1101111111111001',
      '1100000000000001',
      '1111111111111111',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelDossier: pixelIcone([
      '0111111000000000',
      '0111111100000000',
      '1111111111111111',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1000000000000001',
      '1111111111111111',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelDialogue: pixelIcone([
      '0001111111111000',
      '0111111111111110',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '0111111111111110',
      '0001111111111000',
      '0011110000000000',
      '0111000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
    pixelFichier: pixelIcone([
      '0001111111000000',
      '0001111111100000',
      '0001111111110000',
      '0001000000010000',
      '0001011111010000',
      '0001000000010000',
      '0001011111010000',
      '0001000000010000',
      '0001011111010000',
      '0001000000010000',
      '0001000000010000',
      '0001111111110000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
      '0000000000000000',
    ]),
  };

  function balise(nomIcone, classeSupplementaire) {
    const svg = Icones[nomIcone] || '';
    const classe = classeSupplementaire ? `icone ${classeSupplementaire}` : 'icone';
    return `<span class="${classe}">${svg}</span>`;
  }

  Icones.balise = balise;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Icones;
  } else {
    root.Icones = Icones;
  }
})(typeof self !== 'undefined' ? self : this);
