"use client";

import Link from "next/link";
import { formatForDisplay } from "carbone-cost";
import styles from "./empreinte.module.css";
import { formatGrammes, formatOctets, octetsTotal } from "@/lib/empreinte";
import { useEmpreinte } from "./useEmpreinte";

// Badge de pied de page : ce que votre consultation a coûté, calculé chez vous.
//
// Composant maison plutôt que le <CarbonBadge> du paquet : celui-ci ne passe à
// son rendu personnalisé que les grammes, la catégorie et un équivalent, alors
// que ce badge affiche aussi le nombre de pages et les octets reçus. Le hook,
// lui, est bien celui du paquet — c'est la collecte qui compte, pas le balisage.
export default function EmpreinteCarbone() {
  const { events, session, mesure } = useEmpreinte();

  if (!mesure) return null;

  const page = formatForDisplay(events[events.length - 1].result);
  const octets = octetsTotal(events);

  return (
    <Link className={styles.badge} href="/empreinte-carbone">
      <span className={styles.pastille} data-niveau={page.category} aria-hidden="true" />
      <span>
        Cette visite&nbsp;: <strong>{formatGrammes(session.totalGrams)}</strong> CO
        <sub>2</sub>e
      </span>
      <span className={styles.detail}>
        {session.totalViews}&nbsp;
        {session.totalViews > 1 ? "pages" : "page"} · {formatOctets(octets)}
      </span>
    </Link>
  );
}
