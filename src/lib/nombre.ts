// Séparateur de milliers : l'espace insécable ordinaire (U+00A0) plutôt que
// l'espace fine (U+202F) que produit Intl en français. Dans les polices du
// site, l'espace fine fait moins de 2 px à taille de texte : « 3 519 395 »
// se lisait « 3519395 » sur les grands chiffres de l'accueil.
const ESPACE_FINE = /\u202f/g;
const ESPACE_INSECABLE = "\u00a0";

export function nombre(valeur: number, options?: Intl.NumberFormatOptions): string {
  return valeur.toLocaleString("fr-FR", options).replace(ESPACE_FINE, ESPACE_INSECABLE);
}
