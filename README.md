# Suite à donner

**Observatoire indépendant du sort réservé aux pétitions citoyennes déposées à
l'Assemblée nationale française.** Non affilié à l'Assemblée nationale.

🌐 **[suiteadonner.nucom.fr](https://suiteadonner.nucom.fr)**

Le site suit les pétitions déposées sur la [plateforme officielle](https://petitions.assemblee-nationale.fr),
du dépôt jusqu'à leur sort final, à partir des données ouvertes de data.gouv.fr
et des comptes rendus des débats publiés par la DILA.

## Ce que le site établit

- **Décision non publiée** — pétitions examinées par une commission puis
  classées sans qu'aucune motivation ne soit inscrite dans le champ officiel
  `decision_commission`. Constat brut tiré du jeu de données, sans inférence.
- **Statut non mis à jour** — pétitions dont la date limite de signature est
  passée mais que le jeu de données affiche toujours « en cours de signature ».
- **Recoupement thématique** — rapprochement entre une pétition close et les
  interventions prononcées en séance dans les douze mois suivants.

## Méthodologie

Quatre règles gouvernent tout le code de ce dépôt. Elles ne sont pas
négociables — voir [CONTRIBUTING.md](CONTRIBUTING.md) avant de proposer un
changement.

1. **Le CSV officiel de data.gouv.fr est la seule source canonique.** La
   plateforme des pétitions sert de contexte et de comparaison, jamais de
   référence.
2. **Aucune valeur n'est inventée.** Un champ absent reste `null`, il ne
   devient pas zéro.
3. **Aucune cause n'est inférée.** Les catégories dérivées se lisent dans le
   texte de décision et dans les dates, jamais déduites du champ `statut`
   (dont 890 lignes contredisent leur propre texte de décision).
4. **Un rapprochement pétition ↔ débat est toujours un recoupement
   thématique**, jamais un lien officiel : il n'existe aucun identifiant commun
   entre les deux corpus. Le site mesure d'abord le *silence* (aucune
   intervention sur une fenêtre explicite), affirmation vérifiable, plutôt que
   des corrélations positives fragiles.

## Architecture

| Couche | Techno | Rôle |
| --- | --- | --- |
| Front | [Next.js](https://nextjs.org) 16 (App Router) + React 19 | Rendu du site, ISR |
| Données | [Cloud Firestore](https://firebase.google.com/docs/firestore) | Collections `petitions`, `meta`, `reunions` — lecture publique, écriture interdite ([firestore.rules](firestore.rules)) |
| Recherche | [Algolia](https://www.algolia.com) | Index plein texte des pétitions |
| Hébergement | Firebase App Hosting | Build et runtime ([apphosting.yaml](apphosting.yaml)) |
| Audience | GA4 | Chargé uniquement après consentement explicite ([src/app/MesureAudience.tsx](src/app/MesureAudience.tsx)) |

Le pipeline de données vit dans [scripts/](scripts/) — des scripts Node sans
framework, abondamment commentés :

| Script | Commande | Rôle |
| --- | --- | --- |
| [verifier-coherence.mjs](scripts/verifier-coherence.mjs) | `npm run verifier` | Contrôles de cohérence sur le CSV canonique (fraîcheur, volume). Casse bruyamment plutôt que laisser passer des chiffres périmés. |
| [import-petitions.mjs](scripts/import-petitions.mjs) | `npm run import:petitions` | Vérifie, puis importe le CSV dans Firestore et synchronise l'index Algolia. `--dry-run` pour analyser sans écrire. |
| [fetch-debats.mjs](scripts/fetch-debats.mjs) | `npm run fetch:debats` | Aspire les comptes rendus intégraux des séances publiques (flux XML DILA) vers `.corpus/`. |
| [fetch-reunions.mjs](scripts/fetch-reunions.mjs) | `npm run fetch:reunions` | Extrait de l'agenda de l'Assemblée les réunions de commission où une pétition figure à l'ordre du jour. |
| [croiser-petitions-debats.mjs](scripts/croiser-petitions-debats.mjs) | `npm run croiser` | Croise pétitions closes et interventions en séance (sortie locale uniquement). |

La logique de lecture, normalisation et classification est centralisée dans
[scripts/lib/petitions-source.mjs](scripts/lib/petitions-source.mjs), partagée
entre l'import et les contrôles : une règle ne peut pas diverger entre ce qui
est importé et ce qui est testé. Son miroir TypeScript côté site est
[src/lib/petitions.ts](src/lib/petitions.ts).

## Démarrer en local

Prérequis : **Node.js ≥ 20.6** (les scripts utilisent `--env-file`) et npm.

```bash
git clone https://github.com/Clemsrec/suiteadonner.git
cd suiteadonner
npm install
cp .env.example .env.local
npm run dev
```

Le site tourne alors sur [http://localhost:3000](http://localhost:3000) avec
de vraies données : les valeurs par défaut de `.env.example` pointent vers le
projet Firebase de production, dont les règles n'autorisent que la **lecture**,
et vers la clé Algolia *Search* (publique, lecture seule). Aucun compte ni
credential n'est nécessaire pour développer sur le front.

L'**écriture** (import Firestore, synchro Algolia) est réservée aux
mainteneurs : elle exige des credentials Google Cloud sur le projet
(`gcloud auth application-default login`) et la clé Algolia *Admin*
(`ALGOLIA_ADMIN_KEY`), qui ne sont jamais commis dans ce dépôt.

## Sécurité

- **Clés côté client** : toutes les variables `NEXT_PUBLIC_*` (config Firebase,
  clé Algolia Search) sont publiques par conception — elles sont embarquées
  dans le bundle envoyé à chaque navigateur. La sécurité repose sur les
  [règles Firestore](firestore.rules) (lecture seule) et sur la nature
  lecture-seule de la clé Search.
- **En-têtes** : CSP stricte, HSTS, X-Frame-Options, Permissions-Policy —
  le tout documenté dans [next.config.ts](next.config.ts). Toute nouvelle
  intégration côté client doit être ajoutée à la CSP, sinon elle sera
  silencieusement bloquée.
- **Signalement d'une vulnérabilité** : voir [SECURITY.md](SECURITY.md).

## Contribuer

Les contributions sont bienvenues — corrections, améliorations du front,
enrichissement du pipeline de données, relecture méthodologique. Lisez
[CONTRIBUTING.md](CONTRIBUTING.md) : il décrit le setup, les conventions du
dépôt et surtout les règles méthodologiques que toute PR doit respecter.

## Licences

- **Code** : [MIT](LICENSE).
- **Données** : les pétitions proviennent du
  [jeu de données de l'Assemblée nationale](https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale)
  sur data.gouv.fr (Licence Ouverte 2.0) ; les comptes rendus des débats des
  [échanges DILA](https://echanges.dila.gouv.fr/OPENDATA/Debats/AN/) ;
  l'agenda des réunions de
  [data.assemblee-nationale.fr](https://data.assemblee-nationale.fr). Les
  données restent soumises aux licences de leurs producteurs.
- **Marque** : le nom « Suite à donner » et les logos ([public/logo/](public/logo/))
  ne sont pas couverts par la licence MIT et restent la propriété de l'éditeur.

Ce site est un projet indépendant. Il n'est ni affilié à, ni approuvé par
l'Assemblée nationale.
