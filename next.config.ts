import type { NextConfig } from "next";

// Le site sert des données publiques : pas de compte, pas de formulaire, pas de
// cookie. La surface d'attaque se limite donc à l'injection de contenu et au
// détournement d'affichage — c'est ce que verrouille la CSP.
//
// Domaines tiers réellement appelés depuis le navigateur :
//   *.googleapis.com / *.firebaseio.com  → lecture Firestore (SDK client)
//   *.algolia.net / *.algolianet.com     → recherche plein texte
// Toute nouvelle intégration côté client devra être ajoutée ici, sinon elle
// sera silencieusement bloquée par le navigateur.
// React s'appuie sur eval() en développement pour reconstruire les piles
// d'appels et alimenter les outils de debug ; il ne l'utilise jamais en
// production. Sans cette exception, la page ne rend plus du tout en `next dev`.
const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

const CSP = [
  "default-src 'self'",
  // Next injecte ses scripts d'hydratation en inline ; 'unsafe-inline' reste
  // nécessaire tant qu'un nonce n'est pas mis en place via un middleware.
  `script-src 'self' 'unsafe-inline'${devEval}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.algolia.net https://*.algolianet.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // frame-ancestors couvre déjà le clickjacking sur les navigateurs récents ;
  // X-Frame-Options couvre les plus anciens.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aucune de ces API n'est utilisée : on les refuse explicitement.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // HSTS : valable parce que Firebase App Hosting ne sert jamais en clair.
  // `preload` engage durablement le domaine — à retirer si suiteadonner.nucom.fr
  // devait un jour répondre en HTTP.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Firebase App Hosting désactive l'optimisation next/image par défaut —
  // si des <Image> sont ajoutées, mettre images.unoptimized: false explicitement.

  // N'annonce pas la pile technique dans chaque réponse.
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
