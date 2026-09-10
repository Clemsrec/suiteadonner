// Repérage des rapports de commission portant sur une pétition, dans le jeu
// « dossiers législatifs » de l'Assemblée. Importé par scripts/fetch-reunions.mjs.
//
// POURQUOI CE MODULE EXISTE
//
// Une commission qui décide d'examiner une pétition, plutôt que de la classer,
// nomme des rapporteurs puis publie un rapport. C'est la seule suite écrite,
// argumentée et signée qu'une pétition puisse recevoir — et elle est absente de
// tout ce que le site lisait jusqu'ici : le fichier de data.gouv.fr l'ignore,
// la plateforme des pétitions n'en dit rien sur la fiche de la pétition, et
// l'agenda des réunions ne connaît que les séances.
//
// Exemple vérifié le 10/09/2026 : la pétition n° 3014 (2 131 368 signatures) a
// donné le rapport n° 2069, déposé le 10 novembre 2025 par la commission des
// affaires économiques. Rien, sur la plateforme où elle a été signée, n'y
// renvoie.
//
// LE RATTACHEMENT
//
// Il n'existe pas de champ reliant un rapport à une pétition, mais le titre du
// document la nomme par son numéro : « rapport déposé en application de
// l'article 148 du règlement […] sur la pétition n° 3014 du 10 juillet 2025 ».
// Le lien reste donc du même ordre que les autres rapprochements publiés : c'est
// l'Assemblée qui désigne, dans un document officiel, pas nous qui déduisons.
//
// Source : https://data.assemblee-nationale.fr/travaux-parlementaires/dossiers-legislatifs
//          Dossiers_Legislatifs.json.zip, régénéré quotidiennement.

export const DOSSIERS_URL =
  "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip";

// Même adresse que les comptes rendus : l'uid du document suffit à ouvrir son
// texte intégral. Les motifs par commission (/dyn/17/rapports/cion-eco/…)
// exigent de connaître le sigle de la commission et un suffixe de type de
// rapport, tous deux non dérivables de façon sûre.
export function urlRapport(uid) {
  return `https://www.assemblee-nationale.fr/dyn/opendata/${uid}.html`;
}

// Les documents parlementaires sont classés par espèce et sous-type. Les deux
// portent le code PETITION pour un rapport sur pétition ; on teste les deux,
// l'un des deux ayant pu être omis.
function estRapportSurPetition(doc) {
  const classification = doc?.classification ?? {};
  return (
    classification.sousType?.code === "PETITION" ||
    classification.famille?.espece?.code === "PETITION"
  );
}

const NUMERO_PETITION = /p[ée]tition\s*n[°o]\s*(\d{3,5})/i;

// Le numéro du rapport se lit dans son uid : RAPPANR5L17B2069 → 2069.
const NUMERO_RAPPORT = /B(\d+)$/;

/**
 * Retourne { numeroPetition, uid, numero, dateDepot, titre, url } si ce
 * document est un rapport de commission portant sur une pétition nommée par
 * son numéro, sinon null. Un rapport dont le titre ne cite aucun numéro n'est
 * pas retenu : sans lui, le rattachement reposerait sur une ressemblance.
 */
export function lireRapport(json) {
  const doc = json?.document ?? json;
  if (!doc || !estRapportSurPetition(doc)) return null;

  const titre = doc.titres?.titrePrincipal ?? "";
  const numeroPetition = titre.match(NUMERO_PETITION)?.[1] ?? null;
  if (!numeroPetition) return null;

  const uid = doc.uid ?? null;
  if (!uid) return null;

  const chrono = doc.cycleDeVie?.chrono ?? {};
  // Le dépôt fait foi : c'est la date à laquelle le rapport existe
  // officiellement, avant même sa mise en ligne.
  const dateDepot = (chrono.dateDepot ?? chrono.dateCreation ?? "").slice(0, 10) || null;

  return {
    numeroPetition,
    uid,
    numero: uid.match(NUMERO_RAPPORT)?.[1] ?? null,
    dateDepot,
    titre: titre.replace(/\s+/g, " ").trim(),
    url: urlRapport(uid),
  };
}
