#!/usr/bin/env node
// Croise les pétitions citoyennes de l'Assemblée nationale avec les comptes
// rendus de séance publique aspirés par scripts/fetch-debats.mjs.
//
// PARTI PRIS MÉTHODOLOGIQUE — à lire avant de toucher aux seuils.
//
// Il n'existe aucun identifiant commun entre une pétition et un débat. Tout
// rapprochement est donc un recoupement thématique, jamais un lien officiel.
// Un recoupement POSITIF est fragile : le vocabulaire politique est générique,
// et « pétition sur le pouvoir d'achat » ↔ « débat sur le pouvoir d'achat » ne
// prouve rien. On construit donc le produit sur la mesure INVERSE, beaucoup
// plus robuste : le silence.
//
//   « 707 957 signatures. Clôturée le 15 avril 2026. Dans les 12 mois qui
//     suivent : 0 intervention en séance contenant ces termes. Voici la
//     recherche exacte que nous avons lancée. »
//
// Cette affirmation ne demande qu'un bon RAPPEL (élargir les termes est facile),
// pas une bonne PRÉCISION (difficile). Elle se vérifie et ne se conteste pas.
// Un recoupement positif est donc rapporté comme un simple compteur avec ses
// citations, jamais comme une causalité.
//
// Usage :
//   node scripts/croiser-petitions-debats.mjs                  # toutes les pétitions classées à fort soutien
//   node scripts/croiser-petitions-debats.mjs --petition 5158  # un cas précis, en mode verbeux
//   node scripts/croiser-petitions-debats.mjs --seuil 5000     # abaisse le seuil de signatures
//
// Sortie : .corpus/recoupements.json — LOCAL UNIQUEMENT.
//
// Ces rapprochements sont thématiques, donc indiciaires. Le site affirme ne pas
// les publier : ils ne doivent donc être écrits nulle part de public. L'option
// --push a été retirée le 27/07/2026, après avoir constaté que la collection
// Firestore `recoupements` était lisible publiquement alors que rien ne la
// consommait — ce qui contredisait directement ce qu'on écrit aux visiteurs.

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

const CORPUS_DIR = path.resolve(".corpus");
const DATASET_URL =
  "https://www.data.gouv.fr/api/1/datasets/r/c94c9dfe-23eb-45aa-acd1-7438c4e977db";

// Fenêtre d'observation après la clôture de la pétition. Asymétrique à dessein :
// ce qui s'est dit AVANT ne doit rien à la pétition, seul l'après est un signal.
const FENETRE_MOIS = 12;

// Une pétition n'est retenue que si elle a été examinée puis classée avec un
// soutien massif — c'est là que le silence devient une information.
const SEUIL_SIGNATURES_DEFAUT = 5000;

const args = process.argv.slice(2);
const opt = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : null;
};
const petitionCible = opt("petition");
const seuilSignatures = Number(opt("seuil") ?? SEUIL_SIGNATURES_DEFAUT);

// --- Normalisation lexicale ----------------------------------------------

// Mots vides français + vocabulaire parlementaire omniprésent (« amendement »,
// « assemblée », « gouvernement »…). Ces derniers apparaissent dans presque
// toutes les séances : les garder ferait matcher n'importe quoi.
const MOTS_VIDES = new Set(
  `alors ainsi aucun aussi autre avant avec avoir beaucoup bien cela cette ceux chaque comme dans depuis deux dont elle elles encore entre etre faire fait faut leur leurs mais meme moins notre nous parce plus pour pouvoir prendre quand quelle quelles quels sans selon sont sous suis tous tout toute toutes tres trop vers votre vous
   amendement amendements article articles assemblee commission commissions depute deputes discussion gouvernement groupe legislature loi lois madame mesdames message ministre monsieur parlement parlementaire petition petitions president presidente proposition rapporteur scrutin seance senat texte vote votes
   annee citoyen citoyens droit droits france francais francaise mesure mesures national nationale place point politique projet question questions situation travail`
    .split(/\s+/)
    .filter(Boolean)
);

function normaliser(texte) {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

// Racinisation minimale : on ne cherche pas la justesse linguistique, seulement
// à ce que « pesticide » et « pesticides » tombent dans le même seau.
function raciniser(mot) {
  return mot
    .replace(/(aux)$/, "al")
    .replace(/(s|x)$/, "");
}

function jetons(texte) {
  return normaliser(texte)
    .split(" ")
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m))
    .map(raciniser)
    .filter((m) => m.length >= 4);
}

// Détecte les noms propres d'une pétition : un mot capitalisé ailleurs qu'en
// début de phrase. « Yadan », « Duplomb », « Arcom » sont des entités nommées ;
// « assimilant » ou « amalgame » sont des mots rares du langage courant. La
// distinction est décisive : seule une entité nommée justifie de conclure à un
// rapprochement sur un terme unique.
function nomsPropres(texte) {
  const propres = new Set();
  for (const m of texte.matchAll(/([.!?:;»]\s+|^)?([A-ZÀ-Ý][a-zà-ÿ']{3,})/g)) {
    if (m[1] !== undefined) continue; // début de phrase : capitale non signifiante
    propres.add(raciniser(normaliser(m[2]).trim()));
  }
  return propres;
}

// --- Chargement des données ----------------------------------------------

async function chargerCorpus() {
  const fichiers = (await readdir(CORPUS_DIR)).filter(
    (f) => f.startsWith("debats-") && f.endsWith(".jsonl")
  );
  if (!fichiers.length) {
    throw new Error("Corpus vide — lance d'abord `node scripts/fetch-debats.mjs`.");
  }
  const interventions = [];
  for (const f of fichiers) {
    const brut = await readFile(path.join(CORPUS_DIR, f), "utf8");
    for (const ligne of brut.split("\n")) {
      if (ligne.trim()) interventions.push(JSON.parse(ligne));
    }
  }
  console.log(`Corpus : ${interventions.length} interventions (${fichiers.join(", ")})`);
  return interventions;
}

async function chargerPetitions() {
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`Téléchargement des pétitions échoué : ${res.status}`);
  const lignes = parse(await res.text(), {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
  });
  return lignes.map((r) => ({
    identifiant: r.identifiant.trim(),
    titre: r.titre.trim(),
    description: r.description.trim(),
    nbVotes: Number.parseFloat(r.nb_votes) || 0,
    statut: r.statut.trim(),
    statutLabel: r.statut.trim() === "ouverte" ? "en cours de signature (statut non mis à jour)" : r.statut.trim(),
    dateCloture: r.date_limite_vote?.trim() || null,
    commission: r.commission.trim(),
    decisionCommission: r.decision_commission.trim(),
    url: r.url.trim(),
  }));
}

// --- Index inversé --------------------------------------------------------

// Chaque terme pointe vers les interventions qui le contiennent. Construit une
// fois pour tout le corpus, puis réutilisé pour chaque pétition.
function construireIndex(interventions) {
  const index = new Map();
  interventions.forEach((it, i) => {
    const vus = new Set(jetons(`${it.sujet ?? ""} ${it.texte}`));
    for (const terme of vus) {
      let postings = index.get(terme);
      if (!postings) index.set(terme, (postings = []));
      postings.push(i);
    }
  });
  return index;
}

// --- Sélection des termes de recherche -----------------------------------

// On retient les termes de la pétition les plus DISCRIMINANTS, c'est-à-dire les
// plus rares dans le corpus parlementaire. « Yadan » vaut mille fois « sécurité ».
// Un terme absent du corpus est écarté du scoring mais conservé dans le rapport :
// c'est en soi une information (le mot n'a jamais été prononcé).
function choisirTermes(petition, index, nbInterventions, maxTermes = 6) {
  // Le titre porte le sujet ; la description est du texte libre où l'on trouve
  // des digressions, des fautes de frappe et des verbes conjugués rares
  // (« détruise », « voyez ») dont l'IDF élevé ne reflète aucune spécificité
  // thématique. On les traite donc différemment.
  const duTitre = new Set(jetons(petition.titre));
  const compte = new Map();
  for (const t of duTitre) compte.set(t, true);
  for (const t of jetons(petition.description)) if (!compte.has(t)) compte.set(t, false);

  const candidats = [...compte.entries()]
    .map(([terme, estDuTitre]) => {
      const df = index.get(terme)?.length ?? 0;
      return {
        terme,
        df,
        estDuTitre,
        // IDF classique : rare dans le corpus = fort pouvoir discriminant.
        idf: Math.log((nbInterventions + 1) / (df + 1)),
      };
    })
    // Un terme du titre est retenu même s'il n'apparaît qu'une fois dans tout le
    // corpus — c'est justement le cas « fibromyalgie » (1 occurrence sur 120 000),
    // qui est l'information. Un terme de la description doit au contraire avoir
    // une assise minimale pour ne pas être un hapax sans valeur.
    .filter((c) => c.estDuTitre || c.df >= 5);

  const absents = candidats.filter((c) => c.df === 0).map((c) => c.terme);
  const retenus = candidats
    .filter((c) => c.df > 0)
    // Seuil de bruit de fond. Calibré empiriquement : à 5 % « contre » (4,7 %)
    // passait ; à 1 % c'étaient « avenir », « qualité », « compétence » (~0,85 %)
    // qui faisaient gonfler les compteurs à 900 mentions sans rien vouloir dire.
    // À 0,3 % il ne reste que du vocabulaire réellement thématique.
    .filter((c) => c.df / nbInterventions < 0.003)
    // Les termes du titre passent avant tout ceux de la description.
    .sort((a, b) => b.estDuTitre - a.estDuTitre || b.idf - a.idf)
    .slice(0, maxTermes);

  return { retenus, absents };
}

// --- Mesure du silence ----------------------------------------------------

// GARDE-FOU CENTRAL : la fenêtre théorique de 12 mois dépasse souvent la
// couverture du corpus. Une pétition clôturée il y a six jours n'a pas été
// « ignorée pendant douze mois » — on n'en sait tout simplement rien encore.
// Annoncer un silence sur des données absentes est exactement le genre d'erreur
// qui discrédite définitivement le propos. On tronque donc la fenêtre à ce
// qu'on a réellement observé, et on refuse de conclure en dessous de 25 %.
const COUVERTURE_MINIMALE = 0.25;

function fenetre(dateCloture, finCorpus) {
  const debut = new Date(dateCloture);
  const finTheorique = new Date(debut);
  finTheorique.setMonth(finTheorique.getMonth() + FENETRE_MOIS);

  const iso = (d) => d.toISOString().slice(0, 10);
  // Une pétition peut être clôturée APRÈS la dernière séance dont on dispose :
  // la borne haute passerait alors avant la borne basse et on afficherait une
  // fenêtre qui se termine avant de commencer. On plancher à `debut`, et on
  // signale explicitement le cas plutôt que de le maquiller en fenêtre vide.
  const finCorpusMs = new Date(finCorpus).getTime();
  const posterieureAuCorpus = debut.getTime() > finCorpusMs;
  const finObservee = new Date(
    Math.max(debut.getTime(), Math.min(finTheorique.getTime(), finCorpusMs))
  );
  const jours = (a, b) => Math.max(0, (b - a) / 86400000);
  const couverture = jours(debut, finObservee) / jours(debut, finTheorique);

  return {
    debut: iso(debut),
    fin: iso(finObservee),
    finTheorique: iso(finTheorique),
    joursObserves: Math.round(jours(debut, finObservee)),
    // Trois décimales, et non deux : à deux, une couverture de 24,93 % était
    // stockée « 0.25 » alors que `concluant` restait faux — le document
    // Firestore se contredisait lui-même.
    couverture: Number(couverture.toFixed(3)),
    posterieureAuCorpus,
    concluant: couverture >= COUVERTURE_MINIMALE,
  };
}

// DEUX SEUILS, PARCE QU'ON RÉPOND À DEUX QUESTIONS OPPOSÉES.
//
// « Le Parlement n'en a jamais parlé » exige un fort RAPPEL : rater une mention
// réelle et annoncer un silence qui n'existe pas est l'erreur qui détruit la
// crédibilité. On l'évalue donc avec la recherche la plus LARGE possible —
// une seule occurrence d'un seul terme discriminant suffit à casser le silence.
//
// « Voici ce qui s'est dit » exige une forte PRÉCISION : les citations affichées
// doivent être irréprochables. On les sélectionne avec la règle STRICTE.
//
// Une pétition peut donc légitimement être « non silencieuse » et n'avoir aucun
// extrait affichable : cela veut dire que le sujet a été effleuré sans être
// débattu. C'est une information, pas une incohérence.
function estStricte(termesTrouves, nbInterventions, propres, sujetJetons) {
  if (termesTrouves.length >= 2) return true;
  // Un terme unique ne passe que si c'est une entité nommée très rare ET
  // qu'elle figure dans l'intitulé de la section : le débat porte alors sur le
  // sujet, il ne le mentionne pas au passage. Sans cette condition, « Yadan »
  // matchait Mme Caroline Yadan défendant un amendement sur la défense, et
  // « Juif » (capitalisé en français) matchait un débat sur l'école privée.
  const [t] = termesTrouves;
  return (
    propres.has(t.terme) && t.df / nbInterventions < 0.001 && sujetJetons.includes(t.terme)
  );
}

function croiser(petition, interventions, index, finCorpus) {
  const n = interventions.length;
  const { retenus, absents } = choisirTermes(petition, index, n);
  const propres = nomsPropres(`${petition.titre} ${petition.description}`);
  const fen = fenetre(petition.dateCloture, finCorpus);
  const { debut, fin } = fen;

  // Union des postings des termes retenus, restreinte à la fenêtre temporelle.
  const parIntervention = new Map();
  for (const t of retenus) {
    for (const i of index.get(t.terme)) {
      const date = interventions[i].date;
      if (!date || date < debut || date > fin) continue;
      let acc = parIntervention.get(i);
      if (!acc) parIntervention.set(i, (acc = []));
      acc.push(t);
    }
  }

  // Mesure large : tout ce qui touche de près ou de loin au sujet. Sert à
  // établir — ou à réfuter — le silence.
  const large = [...parIntervention.keys()];

  const correspondances = [...parIntervention.entries()]
    .map(([i, termes]) => {
      const it = interventions[i];
      const sujetJetons = jetons(it.sujet ?? "");
      // Un terme rare présent jusque dans l'intitulé de la section, c'est un
      // débat consacré au sujet — pas une mention en passant.
      const forte = termes.some((t) => t.df / n < 0.001 && sujetJetons.includes(t.terme));
      return {
        ...it,
        termes: termes.map((t) => t.terme),
        forte,
        strict: estStricte(termes, n, propres, sujetJetons),
        score: termes.reduce((s, t) => s + t.idf, 0) * (forte ? 2 : 1),
      };
    })
    .filter((c) => c.strict)
    .sort((a, b) => b.score - a.score);

  return {
    identifiant: petition.identifiant,
    titre: petition.titre,
    nbVotes: petition.nbVotes,
    statut: petition.statut,
    dateCloture: petition.dateCloture,
    commission: petition.commission,
    decisionCommission: petition.decisionCommission,
    url: petition.url,
    // Tout ce qu'il faut pour que n'importe qui refasse la recherche à la main.
    recherche: {
      fenetre: fen,
      termes: retenus.map((t) => ({ terme: t.terme, occurrences: t.df })),
      termesJamaisPrononces: absents,
      corpusTaille: n,
    },
    // nbMentions : recherche large — c'est ce chiffre, et lui seul, qui fonde
    // l'affirmation de silence. nbInterventions : recherche stricte, ce qu'on
    // se permet de citer.
    nbMentions: large.length,
    nbInterventions: correspondances.length,
    nbForte: correspondances.filter((c) => c.forte).length,
    // Le silence ne peut être affirmé que si la fenêtre a été suffisamment
    // observée. Sinon : « trop tôt pour le dire », qui est une réponse honnête.
    silence: fen.concluant && large.length === 0,
    verdict: fen.posterieureAuCorpus
      ? "hors-corpus"
      : !fen.concluant
        ? "premature"
        : large.length === 0
          ? "silence"
          : "mentions",
    extraits: correspondances.slice(0, 5).map((c) => ({
      date: c.date,
      orateur: c.orateur,
      sujet: c.sujet,
      termes: c.termes,
      forte: c.forte,
      citation: c.texte.slice(0, 400),
      idsyceron: c.idsyceron,
    })),
  };
}

// --- Rapport --------------------------------------------------------------

function afficher(r, verbeux) {
  const votes = r.nbVotes.toLocaleString("fr-FR");
  const f = r.recherche.fenetre;
  const verdict =
    f.posterieureAuCorpus
      ? `HORS CORPUS — clôturée après la dernière séance disponible`
      : r.verdict === "premature"
        ? `TROP TÔT — ${f.joursObserves} j observés seulement (${r.nbMentions} mention(s))`
        : r.verdict === "silence"
          ? `SILENCE — 0 mention`
          : `${r.nbMentions} mention(s), dont ${r.nbInterventions} citable(s)`;
  console.log(`\n[${r.identifiant}] ${r.titre}`);
  console.log(`  ${votes} signatures · clôturée le ${r.dateCloture} · ${verdict}`);
  if (r.statut === "ouverte") {
    console.log(`  ⚠ statut officiel toujours « en cours de signature »`);
  }
  if (f.posterieureAuCorpus) {
    console.log(`  aucune séance postérieure au ${f.debut} dans le corpus — relancer fetch:debats`);
  } else {
    // Arrondi par défaut : à Math.round, une couverture de 24,9 % s'affichait
    // « 25 % » juste à côté du verdict « TROP TÔT », qui se déclenche sous 25 %.
    console.log(
      `  fenêtre ${f.debut} → ${f.fin} (${Math.floor(f.couverture * 100)} % des ${FENETRE_MOIS} mois visés)`
    );
  }
  console.log(
    `  termes : ${r.recherche.termes.map((t) => `${t.terme}(${t.occurrences})`).join(", ") || "aucun"}`
  );
  if (r.recherche.termesJamaisPrononces.length) {
    console.log(`  jamais prononcés : ${r.recherche.termesJamaisPrononces.join(", ")}`);
  }
  if (!r.decisionCommission) console.log(`  décision de la commission : (vide)`);
  if (verbeux) {
    for (const e of r.extraits) {
      console.log(`\n  — ${e.date} · ${e.orateur} · ${e.sujet}${e.forte ? " ★" : ""}`);
      console.log(`    [${e.termes.join(", ")}] « ${e.citation} »`);
    }
  }
}

async function main() {
  const [interventions, petitions] = await Promise.all([chargerCorpus(), chargerPetitions()]);
  const index = construireIndex(interventions);
  console.log(`Index : ${index.size} termes distincts`);

  const couverture = interventions.reduce(
    (acc, it) => ({
      min: !acc.min || it.date < acc.min ? it.date : acc.min,
      max: !acc.max || it.date > acc.max ? it.date : acc.max,
    }),
    { min: null, max: null }
  );
  console.log(`Couverture temporelle : ${couverture.min} → ${couverture.max}`);

  // On cible les pétitions dont le recueil de signatures est TERMINÉ, et non
  // celles dont le statut officiel dit « classée ». Les deux ne coïncident pas :
  // la pétition la plus signée de la plateforme (Duplomb, 2,1 millions) est
  // toujours affichée « en cours de signature » huit mois après sa date limite.
  // Filtrer sur le statut la faisait disparaître de toute l'analyse.
  // Les `archivee` sont exclues : ce sont les classements d'office pour seuil
  // non atteint, où l'absence de suite n'a rien de remarquable.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const cibles = petitions.filter((p) => {
    if (!p.dateCloture) return false;
    if (petitionCible) return p.identifiant === petitionCible;
    return (
      p.dateCloture < aujourdhui &&
      p.statut !== "archivee" &&
      p.nbVotes >= seuilSignatures
    );
  });

  if (!cibles.length) {
    console.log("Aucune pétition ne correspond aux critères.");
    return;
  }

  const resultats = cibles
    .map((p) => croiser(p, interventions, index, couverture.max))
    .sort((a, b) => b.nbVotes - a.nbVotes);

  for (const r of resultats) afficher(r, Boolean(petitionCible));

  const par = (v) => resultats.filter((r) => r.verdict === v).length;
  const horsCorpus = par("hors-corpus");
  console.log(
    `\n${resultats.length} pétitions examinées · ${par("silence")} silencieuses · ` +
      `${par("mentions")} avec mentions · ${par("premature")} trop récentes pour conclure` +
      (horsCorpus ? ` · ${horsCorpus} clôturée(s) après la fin du corpus` : "") +
      "."
  );

  const sortie = path.join(CORPUS_DIR, "recoupements.json");
  await writeFile(sortie, JSON.stringify({ couverture, fenetreMois: FENETRE_MOIS, resultats }, null, 2));
  console.log(`→ ${sortie}`);

}

main().catch((err) => {
  console.error("Échec du croisement :", err);
  process.exitCode = 1;
});
