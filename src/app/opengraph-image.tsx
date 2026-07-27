import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const alt =
  "Suite à donner — observatoire indépendant des pétitions citoyennes déposées à l'Assemblée nationale";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// AUCUN CHIFFRE SUR CETTE IMAGE, DÉLIBÉRÉMENT.
//
// Les réseaux sociaux mettent les cartes Open Graph en cache pendant des mois :
// un compteur exact au moment du build continuerait de s'afficher longtemps
// après être devenu faux, sans qu'on puisse le corriger. Sur un site dont tout
// l'argument est l'exactitude vérifiable, c'est un risque qu'on ne prend pas.
// La carte dit donc ce que fait le site, pas ce qu'il a mesuré tel jour.

// Le symbole du site : cercle pointillé (procédure interrompue) traversé d'une
// ligne pleine (la ligne restée blanche). Passé en data URI car le moteur de
// rendu des images n'accepte pas les variables CSS du site.
const MARQUE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="12" fill="none" stroke="#e8eff1" stroke-width="2.4"
          stroke-dasharray="4.2 3.34" stroke-dashoffset="2.1"/>
  <line x1="10.5" y1="16" x2="21.5" y2="16" stroke="#7fa6d1" stroke-width="2.2"/>
</svg>`;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f171b",
          color: "#e8eff1",
          padding: "68px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={`data:image/svg+xml;base64,${Buffer.from(MARQUE).toString("base64")}`}
            width={92}
            height={92}
            alt=""
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 56, fontWeight: 700, letterSpacing: -0.5 }}>{SITE_NAME}</div>
            <div style={{ fontSize: 22, color: "#9fb1b8", letterSpacing: 2, marginTop: 4 }}>
              OBSERVATOIRE DES PÉTITIONS CITOYENNES
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: "6px solid #7fa6d1",
            paddingLeft: 28,
          }}
        >
          <div style={{ fontSize: 46, lineHeight: 1.25, fontWeight: 600 }}>
            Que devient votre pétition après la signature&nbsp;?
          </div>
          <div style={{ fontSize: 26, color: "#9fb1b8", lineHeight: 1.4, marginTop: 18 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 21,
            color: "#6e7f86",
            borderTop: "1px solid rgba(232,239,241,0.16)",
            paddingTop: 22,
          }}
        >
          <span>{SITE_URL.replace("https://", "")}</span>
          <span>Projet indépendant, non affilié à l&apos;Assemblée nationale</span>
        </div>
      </div>
    ),
    size
  );
}
