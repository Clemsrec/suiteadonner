// Source unique de vérité pour lire, normaliser et classer le jeu de données
// des pétitions. Importé à la fois par l'import Firestore et par les tests de
// cohérence, pour qu'aucune règle ne puisse diverger entre les deux.
//
// PRINCIPE DIRECTEUR
//
// Le CSV publié sur data.gouv.fr est la seule source canonique. La plateforme
// petitions.assemblee-nationale.fr sert de contexte et de comparaison, jamais
// de référence. Aucune valeur n'est inventée : un champ absent reste `null`,
// il ne devient pas zéro. Aucune cause n'est inférée : on constate.
//
// Le champ `statut` du CSV n'est pas une source de vérité fiable — 890
// pétitions y sont marquées « classee » alors que leur propre texte de décision
// indique un classement d'office faute de signatures. Les catégories dérivées
// se lisent donc dans le texte de décision et dans les dates. `statut` reste
// conservé tel quel, à titre de donnée brute comparable.

// Ressource CSV déclarée par le jeu de données officiel. Le lien /api/…/r/<id>
// est l'adresse stable : elle survit aux renommages du fichier sous-jacent.
//
// ATTENTION : d'autres miroirs de ce fichier circulent, notamment
// object.files.data.gouv.fr/data-pipeline-open/an_petitions/petitions.csv, qui
// était en retard d'un mois lors de notre vérification du 27/07/2026 (3 819
// lignes contre 4 002). Ne pas y basculer sans revérifier la fraîcheur.
export const CSV_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/c94c9dfe-23eb-45aa-acd1-7438c4e977db";
export const DATASET_URL =
  "https://www.data.gouv.fr/datasets/petitions-de-lassemblee-nationale";

// Seuil de signatures en dessous duquel une pétition est classée d'office.
// Valeur lue sur la plateforme officielle, cohérente avec les textes de
// décision du fichier.
export const SEUIL_SIGNATURES = 10000;

// Une date de clôture partagée par au moins ce nombre de pétitions n'est pas
// une échéance individuelle. On constate le regroupement ; on n'en infère
// aucune cause.
export const SEUIL_CLOTURE_GROUPEE = 100;

// --- Normalisation --------------------------------------------------------

// Le fichier mêle apostrophes droites et typographiques (284 contre 2 072 dans
// le seul champ `commission`), espaces insécables et marques d'ordre d'octets.
// Sans ce nettoyage, deux libellés identiques à l'œil comptent pour deux.
export function normaliserTexte(valeur) {
  if (valeur === undefined || valeur === null) return "";
  return valeur
    .replace(/﻿/g, "")
    .replace(/[   ]/g, " ")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// `nb_votes` est un flottant textuel (« 8.0 ») et 22 lignes sont vides.
// Renvoyer 0 pour une valeur absente reviendrait à affirmer « zéro soutien »
// là où le fichier ne dit rien : on renvoie null.
export function parseNombre(valeur) {
  const brut = (valeur ?? "").trim();
  if (!brut) return null;
  const n = Number.parseFloat(brut);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Les dates sont en ISO strict dans tout le fichier (aucune anomalie relevée
// sur 4 002 lignes). On valide plutôt que de faire confiance.
export function parseDate(valeur) {
  const brut = (valeur ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(brut) ? brut : null;
}

// --- Règles de classification --------------------------------------------

export const MOTIFS = {
  SEUIL: "seuil", // le texte invoque le seuil de signatures non atteint
  CONSTAT: "constat", // le texte constate le classement sans énoncer de motif
  ABSENT: "absent", // recueil terminé, aucun texte
  SANS_OBJET: "sans_objet", // recueil en cours, aucune décision attendue
};

// R2 — Motif du classement. Le motif lui-même est toujours lu dans le texte,
// jamais déduit du statut. Le statut n'intervient que pour trancher un cas de
// bord : distinguer « aucune décision publiée » de « aucune décision attendue ».
//
// Ce cas de bord est réel : la pétition n°6255 est déclarée « classee », n'a
// aucun texte de décision et n'a aucune date limite dans le fichier. Fondée sur
// les seules dates, la règle la rangeait en « recueil en cours, sans objet »,
// ce qui est faux — une pétition classée a vu son sort décidé. Le compteur
// affiché (269) et la requête alimentant la liste (268) divergeaient d'autant.
const STATUTS_DECIDES = new Set(["classee", "archivee", "expiree"]);

export function motifClassement(decisionTexte, recueilTermine, statutSource = "") {
  const t = decisionTexte.toLowerCase();
  if (t) {
    if (t.includes("office") || t.includes("n'a pas atteint le nombre de signatures")) {
      return MOTIFS.SEUIL;
    }
    return MOTIFS.CONSTAT;
  }
  const decidee = recueilTermine || STATUTS_DECIDES.has(statutSource);
  return decidee ? MOTIFS.ABSENT : MOTIFS.SANS_OBJET;
}

// --- Lecture d'une ligne --------------------------------------------------

export function mapLigne(row, aujourdhui) {
  const decisionTexte = normaliserTexte(row.decision_commission);
  const dateLimiteVote = parseDate(row.date_limite_vote);
  const nbVotes = parseNombre(row.nb_votes);
  const statutSource = normaliserTexte(row.statut);

  // R1 — le recueil est terminé si la date limite est passée. Fondé sur les
  // dates seules : le champ `statut` n'intervient pas.
  const recueilTermine = Boolean(dateLimiteVote && dateLimiteVote < aujourdhui);

  return {
    identifiant: normaliserTexte(row.identifiant),
    titre: normaliserTexte(row.titre),
    description: normaliserTexte(row.description),
    url: normaliserTexte(row.url),
    datePublication: parseDate(row.date_publication),
    dateLimiteVote,
    nbVotes,
    statutSource,
    commissionSource: normaliserTexte(row.commission) || null,
    legislature: normaliserTexte(row.legislature) || null,
    decisionTexte: decisionTexte || null,

    recueilTermine,
    motifClassement: motifClassement(decisionTexte, recueilTermine, statutSource),
    // R3 — null et non false quand le nombre de signatures est inconnu :
    // on ne peut pas dire qu'une pétition n'a pas atteint un seuil si on
    // ignore combien elle a recueilli.
    seuilAtteint: nbVotes === null ? null : nbVotes >= SEUIL_SIGNATURES,
    // R5 — écart entre ce que dit le statut et ce que disent les dates.
    // Signalé, jamais corrigé.
    ecartStatutDates: statutSource === "ouverte" && recueilTermine,
    // R4, renseigné au second passage (nécessite l'ensemble du jeu).
    clotureGroupee: false,
  };
}

// R4 — Clôture groupée : seconde passe, car la règle dépend de la
// distribution complète des dates.
export function marquerCloturesGroupees(petitions) {
  const compte = new Map();
  for (const p of petitions) {
    if (!p.recueilTermine || !p.dateLimiteVote) continue;
    compte.set(p.dateLimiteVote, (compte.get(p.dateLimiteVote) ?? 0) + 1);
  }
  const groupees = new Map(
    [...compte].filter(([, n]) => n >= SEUIL_CLOTURE_GROUPEE)
  );
  for (const p of petitions) {
    p.clotureGroupee = Boolean(p.dateLimiteVote && groupees.has(p.dateLimiteVote));
  }
  const plusGrosse = [...groupees].sort((a, b) => b[1] - a[1])[0] ?? null;
  return {
    dates: [...groupees].sort((a, b) => b[1] - a[1]),
    dateLaPlusGrosse: plusGrosse?.[0] ?? null,
    nbLaPlusGrosse: plusGrosse?.[1] ?? 0,
  };
}

export function lirePetitions(records, aujourdhui) {
  const petitions = records
    .map((r) => mapLigne(r, aujourdhui))
    .filter((p) => p.identifiant);
  const clotures = marquerCloturesGroupees(petitions);
  return { petitions, clotures };
}

// --- Agrégats -------------------------------------------------------------

export function calculerStats(petitions, clotures, aujourdhui) {
  const s = {
    calculeLe: aujourdhui,
    sourceCsv: CSV_URL,
    total: petitions.length,

    // Statuts bruts du fichier, conservés pour comparaison.
    ouverte: 0,
    archivee: 0,
    classee: 0,
    expiree: 0,

    // Catégories dérivées.
    recueilTermine: 0,
    seuilAtteint: 0,
    signaturesInconnues: 0,
    motifSeuil: 0,
    motifConstat: 0,
    motifAbsent: 0,
    motifSansObjet: 0,
    ecartStatutDates: 0,
    signaturesEcartStatutDates: 0,
    clotureGroupee: 0,
    dateClotureMasse: clotures.dateLaPlusGrosse,
    nbClotureMasse: clotures.nbLaPlusGrosse,

    // Le cœur du constat : parmi les pétitions classées sans que le motif du
    // seuil soit invoqué, combien n'ont aucune décision publiée.
    classeesHorsSeuil: 0,
    classeesHorsSeuilSansTexte: 0,
    signaturesClasseesSansTexte: 0,

    formulationsDistinctes: 0,
    textesDecision: 0,
    signaturesTotal: 0,
  };

  const formulations = new Set();

  for (const p of petitions) {
    if (s[p.statutSource] !== undefined) s[p.statutSource] += 1;
    if (p.recueilTermine) s.recueilTermine += 1;
    if (p.seuilAtteint === true) s.seuilAtteint += 1;
    if (p.nbVotes === null) s.signaturesInconnues += 1;
    else s.signaturesTotal += p.nbVotes;

    if (p.motifClassement === MOTIFS.SEUIL) s.motifSeuil += 1;
    if (p.motifClassement === MOTIFS.CONSTAT) s.motifConstat += 1;
    if (p.motifClassement === MOTIFS.ABSENT) s.motifAbsent += 1;
    if (p.motifClassement === MOTIFS.SANS_OBJET) s.motifSansObjet += 1;

    if (p.ecartStatutDates) {
      s.ecartStatutDates += 1;
      s.signaturesEcartStatutDates += p.nbVotes ?? 0;
    }
    if (p.clotureGroupee) s.clotureGroupee += 1;

    if (p.decisionTexte) {
      s.textesDecision += 1;
      formulations.add(p.decisionTexte);
    }

    if (p.statutSource === "classee" && p.motifClassement !== MOTIFS.SEUIL) {
      s.classeesHorsSeuil += 1;
      if (!p.decisionTexte) {
        s.classeesHorsSeuilSansTexte += 1;
        s.signaturesClasseesSansTexte += p.nbVotes ?? 0;
      }
    }
  }

  s.formulationsDistinctes = formulations.size;
  return s;
}
