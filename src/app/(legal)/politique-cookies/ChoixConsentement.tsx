"use client";

import { useEffect, useState } from "react";
import styles from "../../consentement.module.css";
import {
  EVENEMENT_CONSENTEMENT,
  lireChoix,
  retirerChoix,
  type ChoixConsentement as Choix,
} from "@/lib/consentement";

const LIBELLES: Record<Choix, string> = {
  accepte: "vous avez accepté la mesure d'audience.",
  refuse: "vous avez refusé la mesure d'audience.",
};

// Affiche le choix en vigueur et permet de le retirer : le retrait supprime
// les cookies déjà posés et fait réapparaître la bannière, sur cette page
// même — le visiteur constate l'effet immédiatement.
export default function ChoixConsentement() {
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);

  useEffect(() => {
    const synchroniser = () => setChoix(lireChoix());
    synchroniser();
    window.addEventListener(EVENEMENT_CONSENTEMENT, synchroniser);
    return () => window.removeEventListener(EVENEMENT_CONSENTEMENT, synchroniser);
  }, []);

  if (choix === undefined) return null;

  if (choix === null) {
    return (
      <p>
        <strong>Choix en vigueur :</strong>{" "}
        aucun choix enregistré. La bannière de consentement
        est affichée en bas de cette page ; sans réponse de votre part, aucun traceur
        n&apos;est déposé.
      </p>
    );
  }

  return (
    <>
      <p>
        <strong>Choix en vigueur :</strong> {LIBELLES[choix]}
      </p>
      <button type="button" className={styles.gerer} onClick={() => retirerChoix()}>
        Modifier mon choix
      </button>
    </>
  );
}
