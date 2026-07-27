// Mémorisation du choix de consentement à la mesure d'audience.
//
// Le choix (acceptation OU refus) est conservé en localStorage — pas en cookie,
// pour qu'aucune requête ne le transporte — et expire après six mois, durée
// recommandée par la CNIL avant de reposer la question. Cette entrée est le
// seul stockage navigateur du site hors consentement : elle est strictement
// nécessaire à la mémorisation du choix, donc exemptée de consentement, et la
// politique de cookies la documente nommément. Renommer la clé impose de
// mettre à jour cette page.
export type ChoixConsentement = "accepte" | "refuse";

export const CLE_CONSENTEMENT = "suiteadonner-consentement-audience";
export const EVENEMENT_CONSENTEMENT = "suiteadonner:consentement";

const VALIDITE_MOIS = 6;

export function lireChoix(): ChoixConsentement | null {
  try {
    const brut = window.localStorage.getItem(CLE_CONSENTEMENT);
    if (!brut) return null;
    const enregistre = JSON.parse(brut) as { choix?: unknown; date?: unknown };
    if (enregistre.choix !== "accepte" && enregistre.choix !== "refuse") return null;
    const expiration = new Date(String(enregistre.date));
    expiration.setMonth(expiration.getMonth() + VALIDITE_MOIS);
    if (Number.isNaN(expiration.getTime()) || expiration < new Date()) {
      window.localStorage.removeItem(CLE_CONSENTEMENT);
      return null;
    }
    return enregistre.choix;
  } catch {
    // localStorage inaccessible (navigation privée stricte, quota…) : on se
    // comporte comme si aucun choix n'était enregistré, donc sans traceur.
    return null;
  }
}

export function enregistrerChoix(choix: ChoixConsentement): void {
  try {
    window.localStorage.setItem(
      CLE_CONSENTEMENT,
      JSON.stringify({ choix, date: new Date().toISOString() }),
    );
  } catch {
    // Sans stockage possible, le choix ne vaut que pour la page en cours.
  }
  window.dispatchEvent(new Event(EVENEMENT_CONSENTEMENT));
}

// Retrait du consentement : oubli du choix et suppression immédiate des
// cookies déjà posés par Google Analytics (_ga, _ga_*). La suppression est
// tentée sur chaque niveau de domaine car gtag pose ses cookies sur le
// domaine le plus large possible (ex. .nucom.fr).
export function retirerChoix(): void {
  try {
    window.localStorage.removeItem(CLE_CONSENTEMENT);
  } catch {
    // Rien à oublier si le stockage est inaccessible.
  }
  const expiration = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const segments = window.location.hostname.split(".");
  for (const nom of document.cookie.split(";").map((c) => c.split("=")[0]?.trim() ?? "")) {
    if (nom !== "_ga" && !nom.startsWith("_ga_")) continue;
    document.cookie = `${nom}=; ${expiration}; path=/`;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const domaine = segments.slice(i).join(".");
      document.cookie = `${nom}=; ${expiration}; path=/; domain=${domaine}`;
      document.cookie = `${nom}=; ${expiration}; path=/; domain=.${domaine}`;
    }
  }
  window.dispatchEvent(new Event(EVENEMENT_CONSENTEMENT));
}
