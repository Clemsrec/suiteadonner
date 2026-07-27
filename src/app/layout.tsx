import type { Metadata } from "next";
import "./globals.css";

const SITE_URL = "https://suiteadonner.nucom.fr";
const TITRE = "Suite à donner — Observatoire des pétitions citoyennes";
const DESCRIPTION =
  "Ce que deviennent réellement les pétitions déposées à l'Assemblée nationale, à partir des données ouvertes.";

export const metadata: Metadata = {
  // Sans metadataBase, les champs d'URL relatifs (Open Graph, canonique) ne
  // peuvent pas être résolus en URLs absolues — Next lève une erreur de build.
  metadataBase: new URL(SITE_URL),
  title: TITRE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: "/",
    siteName: "Suite à donner",
    title: TITRE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITRE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
