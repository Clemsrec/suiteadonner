# Suite à donner

**Observatoire indépendant du sort réservé aux pétitions citoyennes déposées à
l'Assemblée nationale française.** Non affilié à l'Assemblée nationale.

🌐 **[suiteadonner.nucom.fr](https://suiteadonner.nucom.fr)**

Le site suit les pétitions déposées sur la [plateforme officielle](https://petitions.assemblee-nationale.fr),
du dépôt jusqu'à leur sort final, à partir du fichier de données ouvertes publié
sur data.gouv.fr, de l'agenda des réunions de commission, des comptes rendus que
ces réunions produisent et des rapports déposés au terme d'un examen. Le corpus
DILA des débats en séance sert à des recoupements thématiques que le site ne
publie pas — voir la règle 4.

## Ce que le site établit

- **Décision non publiée** — pétitions que le fichier donne pour classées sans
  qu'aucune motivation ne soit inscrite dans le champ officiel
  `decision_commission`. Constat brut tiré du jeu de données, sans inférence :
  rien n'y atteste qu'une commission les ait examinées.
- **Statut non mis à jour** — pétitions dont la date limite de signature est
  passée mais que le jeu de données affiche toujours « en cours de signature ».
- **Décision lue au compte rendu** — la commission a voté le classement ou
  l'examen d'une pétition en la nommant par son numéro, et l'a écrit dans le
  compte rendu publié de sa réunion. La phrase est reproduite intégralement, avec
  le lien vers le texte officiel — y compris quand le champ
  `decision_commission` du fichier reste vide, ou dit autre chose.
- **Examen voté, aucun rapport trouvé** — la commission s'est prononcée pour
  l'examen d'une pétition et nous n'avons trouvé aucun rapport. Le délai n'est
  compté que si le recueil est clos : une pétition encore ouverte à la signature
  n'attend rien, et y afficher un compteur suggérerait un retard que rien
  n'établit.
- **Rapport de commission** — la suite écrite d'un examen : un rapport déposé,
  numéroté et signé. Aucun champ ne le relie à la pétition ; son intitulé
  officiel la nomme par son numéro, et c'est ce lien-là qui est retenu. Ni le
  fichier de data.gouv.fr ni la fiche de la pétition sur la plateforme n'y
  renvoient.
- **Classement d'office en bloc** — une commission traite en une séance toutes
  les pétitions de son ressort restées six mois sous le seuil qu'elle a fixé,
  sans en nommer aucune dans sa décision. Le site relève la date, l'effectif
  annoncé, la phrase qui l'énonce et sa nature — classement constaté, ou proposé
  par un rapporteur. Le compte rendu joint rarement la liste des pétitions
  concernées : un seul des trente-quatre lus le fait, en tableau (objet, date de
  dépôt, nombre de signatures). Le site ne reconstitue pas cette liste par
  recoupement — ce serait un rapprochement de son fait, pas une désignation de
  la commission.
- **Recoupement thématique** — rapprochement entre une pétition close et les
  interventions prononcées en séance dans les douze mois suivants.

**Le seuil n'est pas le même pour toutes les commissions.** Les textes de
décision l'énoncent eux-mêmes, en renvoyant le plus souvent à une décision du
bureau de la commission saisie : cinq mille signatures en six mois pour la
commission des lois, dix mille pour les affaires sociales. Sur 1 560 textes,
811 énoncent cinq mille et 688 dix mille. Le site lit le seuil dans le texte de
la pétition et ne le déduit jamais de sa commission.

**Périmètre.** Le fichier des pétitions couvre trois législatures. Les réunions,
comptes rendus et rapports ne sont lus que pour les législatures 17 et 16 :
l'Assemblée ne publie pas ces corpus, à cette adresse, pour 2017-2022. Les
totaux de commission portent donc sur ce périmètre, et le site le déclare —
lire un sous-ensemble sans le dire produisait « un seul rapport publié » là où
il y en a trois.

**Corrections.** Les erreurs que le site a affichées sont publiées sur
[/corrections](https://suiteadonner.nucom.fr/corrections), avec la phrase
fautive, la raison et ce qui la remplace. Le contenu vit dans
[src/lib/errata.ts](src/lib/errata.ts) : une correction visible par un visiteur
s'y inscrit, les bugs internes n'y ont pas leur place. `npm run verifier:errata`
retrouve chaque phrase citée dans l'historique du dépôt et refuse celles qui n'y
figurent pas — une erreur qu'on ne peut pas retrouver est une erreur inventée.

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
   (plusieurs centaines de lignes contredisent leur propre texte de décision ;
   `npm run verifier` en donne le compte à jour).
4. **Un rapprochement pétition ↔ débat est toujours un recoupement
   thématique**, jamais un lien officiel : il n'existe aucun identifiant commun
   entre les deux corpus. Le site mesure d'abord le *silence* (aucune
   intervention sur une fenêtre explicite), affirmation vérifiable, plutôt que
   des corrélations positives fragiles. Font seules exception les réunions de
   commission, où c'est l'Assemblée qui désigne : un numéro ou un titre cité à
   l'ordre du jour, ou un numéro cité dans le compte rendu de la réunion.

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
| [verifier-affirmations.mjs](scripts/verifier-affirmations.mjs) | `npm run verifier:textes` | Lit le HTML produit par le build et casse dès qu'une phrase nouvelle porte un absolu sans être déclarée avec ce qui la fonde. Vérifie les preuves : une promesse dont le code cesse d'être porteur nomme la phrase devenue fausse. |
| [verifier-errata.mjs](scripts/verifier-errata.mjs) | `npm run verifier:errata` | Retrouve dans l'historique git chaque phrase citée sur `/corrections`. Refuse un erratum dont la phrase n'a jamais été affichée. |
| [verifier-tiers.mjs](scripts/verifier-tiers.mjs) | `npm run verifier:tiers` | Compare les domaines tiers autorisés par la CSP à ceux déclarés dans [src/lib/tiers.ts](src/lib/tiers.ts), que lisent les pages légales. Casse dans les deux sens. |
| [import-petitions.mjs](scripts/import-petitions.mjs) | `npm run import:petitions` | Vérifie, puis importe le CSV dans Firestore et synchronise l'index Algolia. `--dry-run` pour analyser sans écrire. |
| [fetch-debats.mjs](scripts/fetch-debats.mjs) | `npm run fetch:debats` | Aspire les comptes rendus intégraux des séances publiques (flux XML DILA) vers `.corpus/`. |
| [fetch-reunions.mjs](scripts/fetch-reunions.mjs) | `npm run fetch:reunions` | Extrait de l'agenda de l'Assemblée les réunions de commission où une pétition figure à l'ordre du jour, lit les comptes rendus de ces réunions et en tire la décision votée, relève les classements d'office en bloc, et rattache les rapports déposés au terme d'un examen. `--push` pour écrire dans Firestore. |
| [croiser-petitions-debats.mjs](scripts/croiser-petitions-debats.mjs) | `npm run croiser` | Croise pétitions closes et interventions en séance (sortie locale uniquement). |

La logique de lecture, normalisation et classification est centralisée dans
[scripts/lib/petitions-source.mjs](scripts/lib/petitions-source.mjs), partagée
entre l'import et les contrôles : une règle ne peut pas diverger entre ce qui
est importé et ce qui est testé. Son miroir TypeScript côté site est
[src/lib/petitions.ts](src/lib/petitions.ts).

La lecture des comptes rendus de commission vit dans
[scripts/lib/comptes-rendus.mjs](scripts/lib/comptes-rendus.mjs). Son en-tête
documente les deux filtres qui évitent de prendre l'avis d'un groupe politique
ou l'annonce d'un ordre du jour pour une décision : ne retenir que les
paragraphes composés en italique — la convention typographique du récit
procédural — puis, parmi eux, les seules phrases où la commission cite le numéro
de la pétition. Sans numéro dans la phrase, rien n'est publié — sauf lorsque le
compte rendu ne traite que d'une seule pétition, nommée par son numéro à l'ordre
du jour et seule citée dans le document : le référent est alors unique, et le
site l'indique sous la citation.

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
