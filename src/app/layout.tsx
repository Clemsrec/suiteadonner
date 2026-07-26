import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suite à donner — Observatoire des pétitions citoyennes",
  description:
    "Ce que deviennent réellement les pétitions déposées à l'Assemblée nationale, à partir des données ouvertes.",
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
