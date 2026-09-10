// Lecture des comptes rendus de réunion de commission, et extraction de la
// décision prise sur une pétition. Importé par scripts/fetch-reunions.mjs.
//
// POURQUOI CE MODULE EXISTE
//
// L'agenda de l'Assemblée donne, pour chaque réunion, un champ `compteRenduRef`
// (« CRCANR5L17S2025PO419610N126 »). Cette référence ouvre le compte rendu
// intégral, où la décision de la commission est écrite en toutes lettres —
// alors que le champ `decision_commission` du fichier public reste vide.
//
// Constat du 10/09/2026, sur les 20 comptes rendus alors référencés : 6 des 8
// pétitions dont la décision est extractible ont un `decision_commission` vide.
// La n° 2760 va plus loin : le fichier la dit « rejetée car elle n'a pas
// atteint le nombre de signatures requis », le compte rendu du 08/04/2026 dit
// « La commission se prononce pour l'examen de la pétition n° 2760 ».
//
// LE PIÈGE, ET LES DEUX FILTRES QUI L'ÉVITENT
//
// Chercher « classement » dans le texte brut ramène des positions de groupes
// politiques — « le groupe Horizons et Indépendants se prononcera pour le
// classement des quatre pétitions » — et l'annonce de l'ordre du jour — « La
// Commission décide du classement OU de l'examen ». Ni l'une ni l'autre n'est
// une décision.
//
// 1. Filtre typographique. Les comptes rendus composent le récit procédural en
//    italique et les interventions en romain. Ne retenir que les paragraphes
//    italiques écarte toutes les positions de groupe.
// 2. Motif ancré et numéroté. La phrase doit commencer par « La commission »
//    (ou « La pétition n° X est donc classée ») et porter le numéro dans la
//    phrase même.
//
// CE QUE CE MODULE REFUSE DE FAIRE
//
// 18 phrases de décision ne nomment aucun numéro : « La commission adopte la
// proposition de classement de la pétition. » Les rattacher demanderait de
// suivre le fil de la discussion pour deviner de quelle pétition il s'agit —
// une inférence. On ne retourne rien pour elles : mieux vaut une lacune qu'une
// attribution douteuse.

// robots.txt de assemblee-nationale.fr impose `Crawl-delay: 30` à tous les
// agents. Le cache disque de fetch-reunions.mjs fait que ce délai n'est payé
// qu'à la première collecte d'un compte rendu donné.
export const CRAWL_DELAY_MS = 30_000;

// Les comptes rendus de commission (CRC) sont servis à cette adresse. Les
// comptes rendus de séance publique (CRS) y répondent 404 : ils relèvent du
// corpus DILA aspiré par scripts/fetch-debats.mjs.
export function urlCompteRendu(ref) {
  return `https://www.assemblee-nationale.fr/dyn/opendata/${ref}.html`;
}

export function estCompteRenduCommission(ref) {
  return typeof ref === "string" && ref.startsWith("CRCANR");
}

// --- Lecture du HTML ------------------------------------------------------

// Décodeur d'entités minimal. Les comptes rendus n'en utilisent qu'une
// poignée, dont &#xa0; entre « n° » et le numéro de pétition — sans ce
// décodage, aucun motif ne peut correspondre. On reste sans dépendance, comme
// les lecteurs ZIP et tar écrits à la main ailleurs dans scripts/.
const ENTITES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  rsquo: "’",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  deg: "°",
};

function decoderEntites(texte) {
  return texte.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (brut, corps) => {
    if (corps[0] === "#") {
      const code =
        corps[1] === "x" || corps[1] === "X"
          ? Number.parseInt(corps.slice(2), 16)
          : Number.parseInt(corps.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : brut;
    }
    return ENTITES[corps.toLowerCase()] ?? brut;
  });
}

function texteNu(fragment) {
  return decoderEntites(fragment.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

// Part du texte composée en italique, dans un paragraphe. Un paragraphe de
// récit procédural est intégralement en italique ; une intervention ne l'est
// que par endroits (une citation, un titre d'ouvrage). Le seuil laisse passer
// la ponctuation résiduelle en romain que la mise en page insère parfois.
const PART_ITALIQUE_MINIMALE = 0.8;

export function parasItaliques(html) {
  const paragraphes = [];
  for (const p of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const spans = [...p[1].matchAll(/<span([^>]*)>([\s\S]*?)<\/span>/gi)];
    if (!spans.length) continue;

    let italique = 0;
    let total = 0;
    for (const s of spans) {
      const longueur = texteNu(s[2]).length;
      total += longueur;
      if (/font-style\s*:\s*italic/i.test(s[1])) italique += longueur;
    }
    if (!total) continue;
    if (italique / total < PART_ITALIQUE_MINIMALE) continue;

    const texte = texteNu(p[1]);
    if (texte) paragraphes.push(texte);
  }
  return paragraphes;
}

// --- Extraction de la décision -------------------------------------------

// Les formes rencontrées dans les comptes rendus de la 17e législature. Chaque
// motif est ancré en début de phrase et exige le numéro de la pétition : c'est
// ce qui distingue une décision d'un avis ou d'une annonce d'ordre du jour.
//
// L'apostrophe est tantôt droite, tantôt typographique ; « commission » prend
// parfois une majuscule.
const A = "['’]";
const N = "n[°o]\\s*(\\d{3,5})";
const FORMES = [
  [new RegExp(`^La [Cc]ommission se prononce pour l${A}examen de la pétition ${N}`), "examen"],
  [new RegExp(`^La [Cc]ommission se prononce pour le classement de la pétition ${N}`), "classement"],
  [
    new RegExp(`^La [Cc]ommission adopte la proposition de classement de la pétition ${N}`),
    "classement",
  ],
  [
    new RegExp(`^La [Cc]ommission (?:décide de classer|classe)[^.]{0,80}?pétition ${N}`),
    "classement",
  ],
  [new RegExp(`^La pétition ${N} est donc classée`), "classement"],
];

// Les mêmes décisions, énoncées sans répéter le numéro : « La commission classe
// donc la pétition. » Elles ne sont retenues que lorsque le compte rendu ne
// traite que d'une seule pétition, nommée par son numéro (voir petitionUnique).
// Le singulier est exigé : « les propositions de classement des pétitions »
// désigne un lot, et le référent redevient indécidable.
const FORMES_SANS_NUMERO = [
  [new RegExp(`^La [Cc]ommission se prononce pour l${A}examen de la pétition\\s*\\.`), "examen"],
  [new RegExp(`^La [Cc]ommission se prononce pour le classement de la pétition\\s*\\.`), "classement"],
  [
    new RegExp(`^La [Cc]ommission adopte la proposition de classement de la pétition\\s*\\.`),
    "classement",
  ],
  [new RegExp(`^La [Cc]ommission (?:classe|décide de classer) (?:donc )?la pétition\\s*\\.`), "classement"],
  [new RegExp(`^La [Cc]ommission rejette l${A}examen de la pétition\\s*\\.`), "classement"],
];

// Tous les numéros de pétition que le compte rendu cite, quels qu'ils soient.
// Sert à vérifier qu'un document ne parle bien que d'une seule pétition avant
// de lui attribuer une décision qui ne la nomme pas.
export function numerosCites(html) {
  const corps = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "");
  return new Set(
    [...texteNu(corps).matchAll(/p[ée]titions?\s*n[°o]\s*(\d{3,5})/gi)].map((m) => m[1])
  );
}

// Une décision est parfois énoncée en deux temps dans le même paragraphe :
// « La commission rejette l'examen de la pétition pour une sortie des
// pesticides de synthèse. La pétition n° 3021 est donc classée. » Citer le
// paragraphe entier restitue le raisonnement ; au-delà de cette longueur, on
// s'en tient à la phrase, pour ne pas noyer la décision dans un compte rendu
// de débat.
const CITATION_PARAGRAPHE_MAX = 400;

function phrases(paragraphe) {
  return paragraphe
    .split(/(?<=\.)\s+/)
    .map((ph) => ph.trim())
    // « Puis, la commission se prononce… », « En conséquence, la pétition… » :
    // l'amorce de liaison masque l'ancrage sans rien changer au sens.
    .map((ph) => ph.replace(/^(?:Puis,?|Enfin,?|En conséquence,?)\s+/i, ""))
    .map((ph) => (ph ? ph[0].toUpperCase() + ph.slice(1) : ph))
    .filter(Boolean);
}

// Retourne [{ numero, sens, citation, referent }], une entrée par décision.
//
// `referent` dit comment le rattachement a été établi, et le site l'affiche :
//   « cite »   — la phrase de décision nomme elle-même la pétition ;
//   « unique » — elle ne la nomme pas, mais le compte rendu ne traite que
//                d'elle, et l'ordre du jour la désignait par son numéro.
//
// Le second cas ne s'ouvre que si l'appelant fournit `petitionUnique`, après
// avoir vérifié l'ordre du jour de la réunion. On revérifie ici sur le document
// lui-même : s'il cite un autre numéro, le référent cesse d'être unique et rien
// n'est retenu. Sans cette voie, la n° 5158 — 707 957 signatures, classée après
// un scrutin nominatif — resterait invisible, son compte rendu écrivant
// seulement « La commission classe donc la pétition. »
export function extraireDecisions(html, petitionUnique = null) {
  const cites = numerosCites(html);
  const referentUnique =
    petitionUnique && (cites.size === 0 || (cites.size === 1 && cites.has(petitionUnique)))
      ? petitionUnique
      : null;

  const decisions = [];
  for (const paragraphe of parasItaliques(html)) {
    if (!/p[ée]tition/i.test(paragraphe)) continue;

    for (const phrase of phrases(paragraphe)) {
      const citation = paragraphe.length <= CITATION_PARAGRAPHE_MAX ? paragraphe : phrase;

      let trouve = false;
      for (const [motif, sens] of FORMES) {
        const m = phrase.match(motif);
        if (!m) continue;
        decisions.push({ numero: m[1], sens, citation, referent: "cite" });
        trouve = true;
        break;
      }
      if (trouve || !referentUnique) continue;

      for (const [motif, sens] of FORMES_SANS_NUMERO) {
        if (!motif.test(phrase)) continue;
        decisions.push({ numero: referentUnique, sens, citation, referent: "unique" });
        break;
      }
    }
  }
  // Un même compte rendu peut rappeler une décision déjà énoncée. On garde une
  // seule entrée par pétition, en faisant primer celles qui citent le numéro
  // sur celles qui reposent sur l'unicité du référent.
  const parNumero = new Map();
  for (const d of [...decisions.filter((d) => d.referent === "cite"), ...decisions]) {
    if (!parNumero.has(d.numero)) parNumero.set(d.numero, d);
  }
  return [...parNumero.values()];
}
