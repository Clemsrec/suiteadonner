"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./consentement.module.css";
import { GA_MESURE_ID } from "@/lib/site";
import {
  EVENEMENT_CONSENTEMENT,
  enregistrerChoix,
  lireChoix,
  type ChoixConsentement,
} from "@/lib/consentement";

// Mesure d'audience subordonnée au consentement : tant que le visiteur n'a
// pas cliqué « Accepter », rien n'est chargé — aucune requête vers Google,
// aucun cookie. Le refus et l'absence de choix produisent le même résultat,
// seule la bannière disparaît. La politique de cookies décrit ce
// fonctionnement au visiteur ; toute évolution ici doit y être répercutée.
export default function MesureAudience() {
  // undefined = pas encore lu (rendu serveur et première passe d'hydratation),
  // null = aucun choix enregistré → bannière.
  const [choix, setChoix] = useState<ChoixConsentement | null | undefined>(undefined);

  useEffect(() => {
    const synchroniser = () => setChoix(lireChoix());
    synchroniser();
    // La page politique-cookies permet de retirer son choix : l'événement
    // ré-affiche la bannière sans rechargement.
    window.addEventListener(EVENEMENT_CONSENTEMENT, synchroniser);
    return () => window.removeEventListener(EVENEMENT_CONSENTEMENT, synchroniser);
  }, []);

  if (choix === undefined) return null;

  if (choix === "accepte") return <GoogleAnalytics gaId={GA_MESURE_ID} />;

  if (choix === "refuse") return null;

  return (
    <section className={styles.banniere} aria-label="Consentement à la mesure d'audience">
      <div className={styles.contenu}>
        <p className={styles.texte}>
          <strong>Mesure d&apos;audience.</strong>{" "}
          Ce site souhaite utiliser Google Analytics
          pour compter les visites. Accepter dépose des cookies dans votre navigateur et
          transmet des données de navigation à Google. Refuser n&apos;a aucune conséquence sur
          la consultation du site.{" "}
          <Link className={styles.lien} href="/politique-cookies">
            En savoir plus
          </Link>
        </p>
        <div className={styles.boutons}>
          <button type="button" className={styles.bouton} onClick={() => enregistrerChoix("refuse")}>
            Refuser
          </button>
          <button type="button" className={styles.bouton} onClick={() => enregistrerChoix("accepte")}>
            Accepter
          </button>
        </div>
      </div>
    </section>
  );
}
