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
//
// DEUX PROMESSES QUE LE MONTAGE SEUL NE TENAIT PAS
//
// 1. La politique annonce des cookies conservés treize mois. gtag.js les pose
//    par défaut pour deux ans, et <GoogleAnalytics> ne transmet que `gaId` :
//    la durée est donc redéclarée explicitement après chargement.
// 2. La politique annonce qu'un retrait supprime les cookies déjà déposés.
//    Démonter le composant retire les balises mais laisse tourner le runtime
//    gtag déjà exécuté, qui repose ses cookies au premier évènement suivant.
//    On arme donc l'interrupteur officiel `ga-disable-<id>` et on repasse le
//    consentement en « denied » avant l'effacement.

// Treize mois, plafond recommandé par la CNIL pour un traceur de mesure
// d'audience — exprimé en secondes, comme l'attend gtag.
const DUREE_COOKIE_SECONDES = 395 * 24 * 60 * 60;

// `gtag` n'est pas typé par @next/third-parties, et `dataLayer` l'est déjà :
// on n'accède donc à la fonction que par une lecture ponctuelle et typée.
type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | undefined {
  return (window as unknown as { gtag?: Gtag }).gtag;
}

function appliquerDureeCookie() {
  gtag()?.("config", GA_MESURE_ID, { cookie_expires: DUREE_COOKIE_SECONDES });
}

function couperMesure() {
  // Interrupteur documenté par Google : une fois posé, gtag.js n'émet plus
  // rien pour cette propriété, y compris depuis le runtime déjà chargé.
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_MESURE_ID}`] = true;
  gtag()?.("consent", "update", { analytics_storage: "denied" });
}
export default function MesureAudience() {
  // undefined = pas encore lu (rendu serveur et première passe d'hydratation),
  // null = aucun choix enregistré → bannière.
  const [choix, setChoix] = useState<ChoixConsentement | null | undefined>(undefined);

  useEffect(() => {
    const synchroniser = () => {
      const nouveau = lireChoix();
      // gtag n'existe qu'une fois le script chargé : on redit la durée à
      // chaque synchronisation, et une fois le chargement terminé.
      if (nouveau === "accepte") {
        appliquerDureeCookie();
        window.setTimeout(appliquerDureeCookie, 1500);
      }
      // Le retrait passe par « refuse » ou par l'effacement du choix : dans les
      // deux cas la mesure doit cesser sur-le-champ, sans rechargement.
      else couperMesure();
      setChoix(nouveau);
    };
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
