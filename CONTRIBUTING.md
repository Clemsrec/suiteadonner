# Contribuer à Suite à donner

Merci de votre intérêt ! Ce document décrit comment proposer une contribution
et les règles que toute PR doit respecter.

## Les règles méthodologiques d'abord

Ce site publie des affirmations vérifiables sur des données publiques. Sa
crédibilité repose sur quatre règles, appliquées partout dans le code. Une PR
qui les enfreint sera refusée même si le code est excellent.

1. **Source canonique unique.** Le CSV officiel de data.gouv.fr
   (`CSV_URL` dans [scripts/lib/petitions-source.mjs](scripts/lib/petitions-source.mjs))
   est la seule référence. Ne basculez jamais vers un miroir sans vérifier sa
   fraîcheur — un miroir en retard d'un mois a déjà été observé.
2. **Aucune valeur inventée.** Un champ absent reste `null`. Il ne devient
   jamais `0`, ni une chaîne vide, ni une valeur par défaut « raisonnable ».
3. **Aucune cause inférée.** On constate ce que le jeu de données contient,
   on n'interprète pas. Les libellés affichés décrivent des faits vérifiables
   (« Aucune décision publiée »), jamais des intentions.
4. **Recoupement ≠ lien officiel.** Il n'existe aucun identifiant commun entre
   une pétition et un débat parlementaire. Tout rapprochement est thématique et
   doit être présenté comme tel. Seules constituent une correspondance certaine
   les réunions de commission où l'Assemblée désigne elle-même la pétition, par
   l'une de ces trois voies : un numéro cité à l'ordre du jour, un titre exact
   cité à l'ordre du jour, ou un numéro cité dans le compte rendu de la réunion.
   La même exigence vaut pour toute décision citée : sans numéro de pétition
   dans la phrase même, on n'affiche rien — deviner le référent en suivant le
   fil du débat serait une déduction. Seule exception, vérifiable et vérifiée
   par le code : si l'ordre du jour ne désigne qu'une pétition par son numéro
   et que le compte rendu n'en cite aucune autre, le référent est unique et
   non supposé. La provenance est alors affichée sous la citation.

Ces règles sont détaillées dans les commentaires d'en-tête des scripts —
lisez-les avant de modifier un seuil ou une classification.

## Setup

```bash
git clone https://github.com/Clemsrec/suiteadonner.git
cd suiteadonner
npm install
cp .env.example .env.local
npm run dev
```

Aucun credential n'est nécessaire : les valeurs publiques de `.env.example`
donnent un accès en lecture seule aux données de production. Voir le
[README](README.md#démarrer-en-local) pour le détail.

## Avant d'ouvrir une PR

```bash
npm run lint             # ESLint
npm run verifier         # contrôles de cohérence sur le CSV canonique
npm run build            # le site doit compiler
npm run verifier:textes  # affirmations absolues affichées (nécessite le build)
npm run verifier:errata  # chaque erratum retrouvé dans l'historique du dépôt
```

`verifier:textes` lit le HTML produit, pas le code : une phrase coupée par des
balises passe inaperçue dans le JSX. Il casse dès qu'une phrase nouvelle porte un
absolu — « jamais », « toujours », « aucun », « le seul » — sans être déclarée
dans [scripts/affirmations-connues.json](scripts/affirmations-connues.json).

Les entrées portant un champ `preuve` sont vérifiées dans le code : le contrôle
ouvre le fichier cité et y cherche la chaîne déclarée. Une promesse dont le code
cesse d'être porteur casse le contrôle, en nommant la phrase devenue fausse.

Trois natures d'absolu, et une seule se passe de preuve :

- **Sur notre comportement** — « nous n'écrivons jamais 0 ». Légitime *si le code
  le garantit* : l'entrée porte alors une `preuve`. Sans elle, la justification
  reste une parole, et le contrôle la compte comme telle
  (`npm run verifier:textes -- --parole` les nomme ; ce compte doit rester à zéro).
- **Sur l'Assemblée, la procédure, le monde** — « le compte rendu ne publie
  jamais ». Interdit sauf source citée, ou borné : « sur les trente-quatre
  comptes rendus que nous avons lus ».
- **Sur l'éditeur lui-même** — non-affiliation, engagement juridique, promesse
  d'avenir. Aucun code ne peut l'établir ; lui inventer une preuve déguiserait
  une parole assumée en vérification. Ces phrases sont déclarées
  `fonde: "editeur"` et comptées à part.

`verifier:errata` applique la même exigence à la page des corrections : chaque
erratum porte une `empreinte`, un fragment de la phrase fautive tel qu'il
figurait dans le code, et le contrôle le retrouve dans un commit passé. Une
erreur qu'on ne retrouve pas dans l'historique est une erreur inventée — c'est
ainsi que quatre entrées qui paraphrasaient au lieu de citer ont été trouvées.

- **Petites PR.** Une PR = un sujet. Pour un changement structurant (nouvelle
  page, nouveau champ dérivé, nouvelle source de données), ouvrez d'abord une
  issue pour en discuter.
- **Décrivez le constat**, pas seulement le code : quelle donnée, quelle règle,
  quel comportement observable change.

## Conventions du dépôt

- **Langue** : le code, les commentaires et les libellés sont en français.
  Les commentaires expliquent le *pourquoi* (contraintes, décisions), pas le
  *quoi* — regardez les scripts existants pour le ton.
- **Logique partagée** : toute règle de lecture ou de classification des
  pétitions vit dans `scripts/lib/petitions-source.mjs` (et son miroir de
  types [src/lib/petitions.ts](src/lib/petitions.ts)), jamais dupliquée
  ailleurs. L'import et les contrôles de cohérence doivent utiliser le même
  code.
- **CSP** : toute nouvelle ressource externe appelée depuis le navigateur doit
  être ajoutée à la CSP dans [next.config.ts](next.config.ts), sinon elle sera
  silencieusement bloquée.
- **Next.js** : la version utilisée comporte des changements de rupture par
  rapport aux versions que vous connaissez peut-être. En cas de doute,
  consultez la doc embarquée dans `node_modules/next/dist/docs/`. Piège
  connu : un nœud texte JSX contenant `&apos;` perd son espace de tête à la
  compilation — utilisez `{" "}` explicitement.
- **Pas de données personnelles** : le site n'a ni compte, ni formulaire, ni
  cookie sans consentement. Toute contribution doit préserver cette propriété.

## Écriture dans Firestore / Algolia

L'import des données (`npm run import:petitions`, `npm run fetch:reunions -- --push`)
est réservé aux mainteneurs : il exige des credentials Google Cloud sur le
projet et la clé Algolia Admin. Pour tester une modification du pipeline,
utilisez les modes locaux : `--dry-run` pour l'import, et les sorties
`.corpus/` des autres scripts.

## Signaler un problème de données

Si un chiffre affiché par le site vous paraît faux, ouvrez une issue en citant
la pétition concernée et la source qui la contredit (lien data.gouv.fr ou
plateforme officielle). La correction commence toujours par identifier si
l'écart vient du jeu de données amont ou de nos règles de classification.
