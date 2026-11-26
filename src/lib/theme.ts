// Thème choisi par le visiteur avec le bouton de l'en-tête. Seuls « clair » et
// « sombre » sont écrits dans le navigateur ; « auto » efface l'entrée, si
// bien qu'un visiteur qui ne touche pas au bouton n'a rien d'enregistré. La
// politique de cookies décrit cette entrée : la changer ici impose de la
// changer là-bas.
export const CLE_THEME = "suiteadonner-theme";

export type ChoixTheme = "clair" | "sombre" | "auto";

export function lireTheme(): ChoixTheme {
  try {
    const valeur = window.localStorage.getItem(CLE_THEME);
    return valeur === "clair" || valeur === "sombre" ? valeur : "auto";
  } catch {
    return "auto";
  }
}

export function appliquerTheme(choix: ChoixTheme): void {
  const racine = document.documentElement;
  if (choix === "auto") delete racine.dataset.theme;
  else racine.dataset.theme = choix;
  try {
    if (choix === "auto") window.localStorage.removeItem(CLE_THEME);
    else window.localStorage.setItem(CLE_THEME, choix);
  } catch {
    // Stockage inaccessible (navigation privée stricte) : le choix vaut pour
    // cette page seulement.
  }
}

// Exécuté dans <head> avant le premier affichage : sans lui, une page choisie
// « sombre » s'afficherait un instant en clair.
export const SCRIPT_THEME_INITIAL = `try{var t=localStorage.getItem(${JSON.stringify(CLE_THEME)});if(t==="clair"||t==="sombre")document.documentElement.dataset.theme=t}catch(e){}`;
