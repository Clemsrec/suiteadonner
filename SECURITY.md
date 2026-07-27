# Politique de sécurité

## Signaler une vulnérabilité

Écrivez à **clement@nucom.fr** avec une description du problème et, si
possible, les étapes pour le reproduire. Merci de ne pas ouvrir d'issue
publique pour une vulnérabilité exploitable avant qu'un correctif soit déployé.

Ce projet est maintenu bénévolement : pas de programme de récompense, mais une
réponse rapide et un crédit dans les notes de version si vous le souhaitez.

## Périmètre

- Le site [suiteadonner.nucom.fr](https://suiteadonner.nucom.fr) et le code de
  ce dépôt.
- Les règles Firestore ([firestore.rules](firestore.rules)) : toute écriture
  qui réussirait depuis un client serait une vulnérabilité.

## Hors périmètre

- Les clés présentes dans le dépôt ou dans le bundle client
  (`NEXT_PUBLIC_FIREBASE_*`, clé Algolia Search) : elles sont publiques par
  conception. La barrière de sécurité est côté règles et permissions.
- La disponibilité des sources amont (data.gouv.fr, DILA,
  data.assemblee-nationale.fr).
