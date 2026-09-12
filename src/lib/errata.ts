// Les erreurs que ce site a affichées, et ce qu'elles sont devenues.
//
// POURQUOI CE FICHIER EXISTE
//
// La méthodologie promet que toute erreur « sera corrigée et signalée
// publiquement ». Cette promesse n'était tenue nulle part : rien, sur le site,
// ne permettait de savoir ce qui avait été affiché de faux, ni quand. Un
// observatoire qui reproche à l'Assemblée de ne pas publier ses décisions ne
// peut pas corriger les siennes en silence.
//
// CE QU'ON Y INSCRIT
//
// Uniquement ce qui a été AFFICHÉ et qu'un visiteur a pu lire. Les bugs
// internes, les refactorisations et les erreurs rattrapées avant publication
// n'y ont pas leur place — cette page dit ce qui a été dit, pas comment le
// code a évolué.
//
// Chaque entrée porte la phrase fautive telle quelle. La recopier fait mal,
// et c'est le but : une correction qui ne cite pas ce qu'elle corrige demande
// encore qu'on lui fasse confiance.

export type Erratum = {
  /** Date de la correction, au format AAAA-MM-JJ. */
  date: string;
  /** Où la phrase était affichée. */
  ou: string;
  /** Ce que le site affirmait, mot pour mot. */
  affirmait: string;
  /** Pourquoi c'était faux ou trompeur. */
  pourquoi: string;
  /** Ce qu'il dit désormais. */
  corrige: string;
  /** Ce qui empêche cette erreur de revenir, quand un garde-fou a été posé. */
  gardeFou?: string;
};

// Du plus récent au plus ancien.
export const ERRATA: Erratum[] = [
  {
    date: "2026-09-12",
    ou: "Accueil, section « Comment nous travaillons »",
    affirmait:
      "Nous avons vérifié la page officielle de ces pétitions : elle affiche la date limite et le statut « Acceptées », et n'emploie jamais la formule « en cours de signature ».",
    pourquoi:
      "Rien n'enregistrait cette vérification : ni sa date, ni les pages ouvertes, ni ce qui y avait été lu. Une vérification qu'un lecteur ne peut pas rejouer n'est pas une vérification, et la formule « ces pétitions » laissait entendre qu'elles avaient toutes été relevées.",
    corrige:
      "L'accueil donne la date du relevé et le lien vers chacune des pages ouvertes, avec le statut et la date limite qui y figuraient. Le lecteur peut les rouvrir et comparer.",
    gardeFou:
      "Le relevé vit dans les données, avec sa date et ses liens ; le compte affiché vient de ce relevé, non du nombre de pétitions concernées.",
  },
  {
    date: "2026-09-12",
    ou: "Page empreinte carbone",
    affirmait: "Notre hébergeur ne publie pas de relevé de consommation.",
    pourquoi:
      "Nous n'avons jamais établi ce que l'hébergeur publie ou non. Nous constations notre propre absence de données et l'attribuions à un tiers.",
    corrige:
      "La page dit que nous ne disposons d'aucun relevé de nos serveurs et que nous n'en avons trouvé aucun publié par site hébergé. L'absence porte sur notre recherche, pas sur l'hébergeur.",
  },
  {
    date: "2026-09-12",
    ou: "Accueil, section « Comment nous travaillons »",
    affirmait:
      "Les échanges, les arguments et le sens du vote ne figurent pas dans les données que nous exploitons.",
    pourquoi:
      "Le site lisait déjà les comptes rendus de commission et publiait le sens des votes qu'ils portent. La page de méthodologie le disait, l'accueil affirmait encore le contraire.",
    corrige:
      "L'accueil dit que le compte rendu, quand il existe et qu'il nomme la pétition, donne la décision. Il nomme aussi les deux limites qui restent : les classements d'office en bloc, dont la liste n'est presque jamais jointe, et les motivations d'un vote.",
  },
  {
    date: "2026-09-12",
    ou: "Mentions légales",
    affirmait: "Le site ne requiert aucune inscription, ne comporte aucun formulaire.",
    pourquoi:
      "Le champ de recherche est un formulaire, et il transmet la requête du visiteur à un service tiers. La politique de confidentialité, elle, était exacte : elle visait les formulaires de contact, d'inscription et de commentaire.",
    corrige:
      "Les mentions légales nomment ce formulaire : la recherche est le seul du site, et sa requête part sans être conservée.",
    gardeFou:
      "Un contrôle vérifie qu'aucune balise de formulaire n'apparaît ailleurs que dans le champ de recherche.",
  },
  {
    date: "2026-09-12",
    ou: "Fiche d'une pétition, et accueil",
    affirmait: "Examen voté, rapport attendu depuis 5 mois.",
    pourquoi:
      "Cette pétition était encore ouverte à la signature jusqu'en juin 2029. Compter un délai d'attente y suggérait un retard de l'Assemblée que rien n'établissait.",
    corrige:
      "Le délai n'est compté que sur les pétitions dont le recueil est clos. Pour les autres, la fiche dit que l'examen a été voté, que le recueil court toujours, et qu'aucun rapport n'a été trouvé.",
    gardeFou:
      "L'état d'une pétition est qualifié dans une seule fonction, qui voit tous ses champs à la fois.",
  },
  {
    date: "2026-09-11",
    ou: "Accueil, page des passages en commission",
    affirmait: "266 pétitions classées d'office.",
    pourquoi:
      "Deux des trois séances relevées n'énonçaient pas un classement mais une proposition de rapporteur — « je vous propose de classer d'office ces 212 pétitions ». Le site présentait comme acquis ce qui était proposé.",
    corrige:
      "Chaque séance indique sa nature : classement constaté, ou proposé. La mention « (Assentiment.) » est rapportée quand le compte rendu la porte, sans en tirer de vote.",
  },
  {
    date: "2026-09-11",
    ou: "Accueil, méthodologie, fiches",
    affirmait: "Le seuil de 10 000 signatures, en dessous duquel une pétition est classée d'office.",
    pourquoi:
      "Ce seuil n'est pas unique. Les textes de décision du fichier l'énoncent eux-mêmes, et il varie : cinq mille signatures pour la commission des lois, dix mille pour les affaires sociales. Douze pétitions avaient atteint le seuil qui leur était opposé tout en étant présentées comme sous le seuil.",
    corrige:
      "Le site lit le seuil dans le texte de décision de chaque pétition, et ne le déduit jamais de sa commission. Quand aucun texte ne l'énonce, il s'en tient au nombre de signatures.",
  },
  {
    date: "2026-09-11",
    ou: "Accueil, pages de constat, index",
    affirmait: "Ces pétitions ont été examinées par une commission, puis classées.",
    pourquoi:
      "Cette liste est établie sur un statut « classée » et un champ de décision vide. Rien n'y atteste qu'un examen ait eu lieu — la méthodologie du site s'interdit d'ailleurs explicitement d'écrire « classée après examen ».",
    corrige:
      "Le site dit que le fichier les donne pour classées sans motivation, et qu'il ignore si une commission les a examinées.",
  },
  {
    date: "2026-09-11",
    ou: "Accueil, page des rapports",
    affirmait: "Une seule suite écrite, argumentée et signée : le rapport n° 2069.",
    pourquoi:
      "Les corpus n'étaient lus que pour la législature en cours, alors que le fichier des pétitions en couvre trois. Deux autres rapports existaient, sur des pétitions bien présentes dans le fichier : le congé maternité et l'autoroute A69.",
    corrige:
      "Les deux législatures que l'Assemblée publie sont lues, et le périmètre est affiché à côté des chiffres qu'il borne.",
    gardeFou: "Le périmètre est un champ des données, plus une phrase écrite dans la page.",
  },
  {
    date: "2026-09-11",
    ou: "Politique de cookies, page empreinte carbone",
    affirmait:
      "Deux services extérieurs sont sollicités depuis votre navigateur. Ces appels transmettent nécessairement votre adresse IP.",
    pourquoi:
      "Les données de pétitions sont lues par le serveur, jamais par le navigateur du visiteur. Le site se déclarait plus indiscret qu'il ne l'est.",
    corrige:
      "Seule la recherche part du navigateur. La politique le dit, et précise que l'adresse IP n'est pas transmise à la base de données.",
  },
  {
    date: "2026-09-11",
    ou: "Politique de cookies, politique de confidentialité",
    affirmait: "Cookies de mesure d'audience conservés 13 mois.",
    pourquoi:
      "Le script de mesure les posait pour deux ans, sa valeur par défaut : la durée annoncée n'était appliquée nulle part.",
    corrige: "La durée de treize mois est désormais déclarée explicitement au chargement du script.",
  },
  {
    date: "2026-09-11",
    ou: "Politique de cookies",
    affirmait: "Le retrait supprime immédiatement les cookies de mesure d'audience déjà déposés.",
    pourquoi:
      "Les cookies étaient bien effacés, mais le script de mesure restait actif dans la page et les reposait au premier événement suivant.",
    corrige:
      "Le retrait désactive la mesure elle-même avant d'effacer les cookies ; elle ne repart pas tant que le consentement n'est pas redonné.",
  },
  {
    date: "2026-09-11",
    ou: "Mentions légales",
    affirmait: "Le site n'utilise ni service d'authentification, ni stockage de fichiers, ni outil de mesure d'audience.",
    pourquoi:
      "Une mesure d'audience existait depuis la même mise à jour que cette phrase. La page se contredisait elle-même quelques paragraphes plus bas.",
    corrige:
      "Les mentions légales déclarent cette mesure et renvoient à la politique de cookies, qui en décrit le fonctionnement et le consentement.",
  },
  {
    date: "2026-09-11",
    ou: "Page des passages en commission, fiches",
    affirmait: "Les deux sources officielles ne disent pas la même chose.",
    pourquoi:
      "Le site n'a jamais comparé les deux textes : la phrase se déclenchait dès qu'un compte rendu et le fichier en portaient chacun un, qu'ils divergent ou non.",
    corrige:
      "Le site constate que deux textes officiels portent sur la même pétition, les reproduit côte à côte, et laisse le lecteur les comparer.",
  },
  {
    date: "2026-09-11",
    ou: "Accueil, page des passages en commission",
    affirmait:
      "Le compte rendu annonce un effectif, jamais la liste des pétitions concernées.",
    pourquoi:
      "Un compte rendu sur les trente-quatre lus joint cette liste, en tableau, avec l'objet, la date de dépôt et le nombre de signatures de vingt-trois pétitions.",
    corrige:
      "Le site dit que cette liste est jointe rarement, et non jamais. Il ne la reconstitue pas par recoupement : ce serait une désignation de son fait.",
  },
  {
    date: "2026-09-11",
    ou: "Page des passages en commission",
    affirmait: "0 soutiens, pour une pétition dont le fichier ne renseigne pas ce nombre.",
    pourquoi:
      "Écrire zéro affirme « aucun soutien » là où la source ne dit rien — ce que la méthodologie du site interdit explicitement.",
    corrige: "La carte indique que le nombre de soutiens n'est pas renseigné.",
  },
];
