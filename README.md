# SOC // TRIAGE

Entraînement au tri d'alertes de sécurité pour un poste de SOC (Security Operations Center). Application web statique, entièrement en français, sans backend, sans compte et sans connexion réseau : tout tourne dans le navigateur, à partir de données fictives générées aléatoirement.

## Fonctionnement

Une session type :

1. **Configurer** un **Rôle** et une **Difficulté**, indépendants l'un de l'autre.
2. **Trier** les alertes qui arrivent au fil de la session : consulter le détail (indicateurs, entités affectées, éléments techniques complémentaires), puis classer chaque alerte (Vrai positif / Faux positif / À investiguer) en justifiant sa décision.
3. Selon le Rôle, poursuivre avec la **résolution d'incident** et/ou la **chasse aux menaces**.
4. Consulter l'**écran de correction** : note, corrigé détaillé alerte par alerte, et rapport complet exportable en JSON.

Aucun verdict n'est jamais révélé au moment de la décision — la correction n'apparaît qu'en fin de session, comme un vrai retour d'expérience.

### Rôle — quel travail est demandé

| Rôle | Activité |
| --- | --- |
| **Tuto** | Visite guidée scénarisée, sans limite de temps, qui présente tous les écrans et explique les deux axes ci-dessous. |
| **LVL1** | Tri des alertes uniquement. |
| **LVL2** | Tri, puis résolution d'incident : chaque alerte classée Vrai positif devient un correctif à traiter dans un petit poste de travail simulé (pare-feu, antivirus, politique de groupe, gestionnaire de correctifs). |
| **LVL3** | Tri (sans l'option « À investiguer » — dernier échelon, on tranche toujours), résolution d'incident, et **chasse aux menaces** en parallèle : un bureau simulé (SIEM, terminal, annuaire, explorateur de fichiers, pare-feu) où quelques signaux réels sont noyés parmi des lignes bénignes, à débusquer avec un signalement confirmé (« Eureka ») ou une révélation temporaire à charges limitées (« Vision de l'expert »). |

### Difficulté — à quel point c'est exigeant

Indépendante du Rôle : module le nombre de champs à remplir par alerte (classification + raison en Facile, jusqu'à + indicateurs pertinents + action recommandée + entité prioritaire en Difficile), le rythme d'apparition des alertes, et le nombre de pièges dans les exercices de résolution d'incident et de chasse aux menaces.

## Démarrer

Aucune installation n'est nécessaire : ouvrir `app/index.html` dans un navigateur suffit.

Pour le servir via un serveur local plutôt qu'en `file://` (au choix, selon ce qui est disponible) :

```bash
python3 -m http.server 8000 --directory app
# ou
npx serve app
```

puis ouvrir `http://localhost:8000`.

## Tests

Logique métier testée avec le module `node:test` intégré à Node.js (aucune dépendance externe) :

```bash
npm test
```

## Stack technique

- HTML / CSS / JavaScript vanilla — aucun framework, aucune dépendance, aucun outil de build.
- Modules JS en enveloppe UMD, utilisables à la fois dans le navigateur (`<script>`) et sous Node (`require`) pour les tests.
- Aucun appel réseau : génération procédurale des alertes, exports (fiche Markdown, rapport JSON) en local uniquement.

## Structure du dépôt

```
app/
  index.html        Page unique de l'application
  css/style.css      Feuille de style (thèmes clair/sombre + thème du bureau simulé)
  js/                Modules JS (un fichier par domaine : alertes, triage, chasse, remédiation, tutoriel...)
tests/               Tests unitaires (node:test) de la logique métier pure
```

## Licence

Voir [LICENSE](./LICENSE) (MIT).
