import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Firebase App Hosting désactive l'optimisation next/image par défaut —
  // si des <Image> sont ajoutées, mettre images.unoptimized: false explicitement.
};

export default nextConfig;
