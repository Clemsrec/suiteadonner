// Empreinte carbone de la consultation : configuration du site et mise en forme
// française.
//
// La collecte elle-même — observateur de performance, frise d'attribution des
// ressources aux routes, classification des transferts, entrée de navigation —
// vit désormais dans `carbone-cost/browser`, dérivée de la version qui
// occupait ce fichier. Ne la réimplémente pas ici : les cas limites (ressource
// opaque, ressource en cache, réponse vide légitime, navigation douce) y sont
// couverts par des tests, ce qui n'était pas le cas de l'original.
//
// Ce qui reste vrai et doit le rester : rien n'est transmis à qui que ce soit,
// et rien n'est écrit dans le navigateur. Le relevé vit en mémoire de l'onglet
// et disparaît avec lui. La politique de cookies affirme qu'une seule entrée
// est écrite sans consentement — le choix de la bannière — et cette mesure ne
// doit jamais contredire cette affirmation.
import type { WebPageviewEvent } from "carbone-cost";

// Hébergement de l'application, relevé sur l'infrastructure — voir LEGAL dans
// src/lib/site.ts, qui documente les mêmes régions pour les mentions légales.
//
// `vert` déclare l'hébergeur comme alimenté en énergie renouvelable : Google
// Cloud figure dans l'annuaire des hébergeurs verts de The Green Web
// Foundation. C'est une déclaration de l'hébergeur, pas une mesure — et depuis
// la version 2 du modèle, elle ne réduit que le fonctionnement du centre de
// données, soit environ 18 % du total. La page /empreinte-carbone affiche ce
// pourcentage en le redéduisant de la bibliothèque, jamais en le recopiant.
export const HEBERGEMENT = {
  fournisseur: "firebase-app-hosting",
  region: "europe-west4",
  vert: true,
} as const;

// Formats français. Les champs `*Display` de carbone-cost acceptent désormais
// une locale, mais ils s'arrêtent à une décimale et ne connaissent pas le seuil
// « < 0,001 g » dont le badge a besoin : on garde donc une mise en forme
// maison pour les grammes, et on délègue les équivalents.
//
// Le signe « ≈ » fait partie du format — ces valeurs sont toujours des
// estimations — et un seuil « < 0,001 g » ne doit pas se retrouver précédé
// d'un « ≈ » ajouté par l'appelant, d'où la centralisation ici.
export function formatGrammes(grammes: number): string {
  if (grammes <= 0) return "0 g";
  if (grammes < 0.001) return "< 0,001 g";
  const decimales = grammes < 0.01 ? 4 : grammes < 1 ? 3 : 2;
  return `≈ ${grammes.toLocaleString("fr-FR", { maximumFractionDigits: decimales })} g`;
}

// Les équivalents (km de train, charges de téléphone) tombent vite sous le
// seuil du lisible. Afficher « 0 km » suggérerait un coût nul, ce qui est faux.
export function formatEquivalent(valeur: number): string {
  if (valeur <= 0) return "0";
  if (valeur < 0.01) return "< 0,01";
  return valeur.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

export function formatOctets(octets: number): string {
  if (octets < 1024) return `${octets.toLocaleString("fr-FR")} o`;
  if (octets < 1024 * 1024) {
    return `${(octets / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
  }
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Mo`;
}

export function octetsTotal(evenements: WebPageviewEvent[]): number {
  return evenements.reduce((somme, e) => somme + e.input.bytesTransferred, 0);
}

// Une origine tierce n'est pas montrable telle quelle à un visiteur :
// « firestore.googleapis.com » ne lui dit rien. On nomme les services que ce
// site appelle réellement, et on retombe sur le nom d'hôte pour le reste —
// jamais sur l'URL complète, qui peut porter des paramètres.
const SERVICES: Record<string, string> = {
  "firestore.googleapis.com": "Cloud Firestore",
  "algolia.net": "Algolia",
  "algolianet.com": "Algolia",
};

export function nommerOrigine(origine: string): string {
  let hote = origine;
  try {
    hote = new URL(origine).hostname;
  } catch {
    // Déjà un nom d'hôte, ou une valeur inattendue : on la garde telle quelle.
  }
  for (const [suffixe, nom] of Object.entries(SERVICES)) {
    if (hote === suffixe || hote.endsWith(`.${suffixe}`)) return nom;
  }
  return hote;
}
