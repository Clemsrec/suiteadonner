"use client";

import { usePathname } from "next/navigation";
import { useCarbon, type UseCarbonResult } from "carbone-cost/react";
import { HEBERGEMENT } from "@/lib/empreinte";

// Point d'entrée unique de la mesure côté site.
//
// Le badge de pied de page et la page de détail appellent tous deux ce hook :
// passer par lui garantit qu'ils déclarent le même hébergement et affichent
// donc le même chiffre. `useCarbon` partage un collecteur unique entre tous
// ses appelants — plusieurs badges montés en même temps ne comptent pas
// plusieurs fois.
//
// La route est poussée, pas lue : `usePathname()` bascule au rendu React, et
// un collecteur qui l'interrogerait à l'arrivée des ressources la lirait à des
// instants arbitraires.
export function useEmpreinte(): UseCarbonResult & { mesure: boolean } {
  const empreinte = useCarbon({
    route: usePathname(),
    greenHosting: HEBERGEMENT.vert,
  });

  // Une route est ouverte dès le premier rendu, avant qu'aucune ressource ne
  // soit arrivée : `events` n'est donc pas vide pour autant qu'on ait mesuré
  // quoi que ce soit. Mieux vaut ne rien afficher qu'un zéro trompeur.
  const mesure = empreinte.events.some((e) => e.input.bytesTransferred > 0);

  return { ...empreinte, mesure };
}
