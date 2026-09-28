// =====================================================================
// Teckel de Poche - DONNEES ET REGLAGES
// Toutes les tables et valeurs chiffrees du jeu sont ici : on equilibre le jeu
// sans toucher au moteur (js/game.js). Dans les textes, {nom} = nom du chien.
// =====================================================================
window.TDP = window.TDP || {};
TDP.data = {

  // ---------- sprites du chien (tenue -> poses disponibles, sinon repli sur "assis") ----------
  ASSETS: {
    neutre:    { debout:1, assis:1, allonge:1, endormi:1, marche:1, joyeux:1, triste:1, etonne:1 },
    mariniere: { debout:1, assis:1, allonge:1, endormi:1, marche:1, triste:1, etonne:1 },
    pull_rose: { assis:1, allonge:1, endormi:1, marche:1, joyeux:1 }
  },
  OUTFIT_LABEL: { neutre:"Sans tenue", mariniere:"Marinière", pull_rose:"Pull rose" },

  // ---------- pieces ----------
  // floorY = ligne ou le chien pose les pattes (% depuis le haut du decor). Nombre, ou {jour, nuit}
  // si les cadrages jour/nuit different. A recaler (et tester sur telephone) a chaque nouveau decor.
  ROOMS: {
    cuisine:     { label:"Cuisine",       need:"faim",     pose:"assis",   spotX:60, floorY:84 },
    chambre:     { label:"Chambre",       need:"jeu",      pose:"joyeux",  spotX:52, floorY:80 },
    salon:       { label:"Salon",         need:"sommeil",  pose:"endormi", spotX:26, floorY:77 },
    salledebain: { label:"Salle de bain", need:"proprete", pose:"assis",   spotX:53, floorY:80 }
  },
  ROOM_KEY_FOR_NEED: { faim:"cuisine", jeu:"chambre", sommeil:"salon", proprete:"salledebain" },
  ROOM_IMG_KEY: { salledebain:"sdb" },

  // ---------- echelle (voir CLAUDE.md, "Regles d'echelle et de cadre") ----------
  HORIZON_Y: 35, REF_Y: 80,

  // surfaces ou le chien peut monter : seat = ligne des pattes, depth = pieds du meuble au sol.
  FURNITURE_Y: {
    canape:  { seat:53, depth:58 },   // coussin du canape du salon
    lit:     { seat:60, depth:68.5 }, // couette de la chambre
    gamelle: { seat:73, depth:73 }    // gamelles de la cuisine (au sol, plus au fond que la ligne de marche)
  },

  // objets tactiles : at = {x,y,w,h,targetX} en % de l'IMAGE du decor (ou {jour,nuit}).
  // raise = nom d'un meuble (FURNITURE_Y) si le chien monte dessus.
  INTERACTIONS: {
    salon: [
      { at:{ x:64.5, y:68, w:14, h:10, targetX:60 },
        pose:"joyeux", act:"bite",
        thought:"Miam, les chaussons !", toast:"Coquin ! {nom} a filé mordiller tes chaussons." }
    ],
    chambre: [
      { at:{ x:49, y:55, w:36, h:20, targetX:49 },
        pose:"joyeux", raise:"lit",
        thought:"Le lit, mon endroit préféré !", toast:"{nom} a sauté sur le lit, tout content." }
    ]
  },

  // ---------- besoins et temps ----------
  NEED_KEYS: ["faim", "sommeil", "jeu", "proprete"],
  NEED_DECAY_PER_HOUR: { faim:10, jeu:12, sommeil:7, proprete:5 }, // 100 -> 0 en 10h / 8h / 14h / 20h
  OFFLINE_FLOOR: 20,        // jeu ferme : un besoin ne descend jamais sous 20 (sauf s'il y etait deja)
  OFFLINE_AFTER_MS: 120000, // un ecart de plus de 2 min entre deux ticks = retour de veille, traite comme hors ligne
  LOW_NEED: 20,             // sous ce seuil : pose triste + gains de pieces divises par 2
  LOW_NEED_COIN_FACTOR: 0.5,
  // pose au repos quand un besoin est tres bas. "triste" existe mais c'est un GROS PLAN de la tete
  // (cadrage different) : "allonge" en attendant un sprite triste en pied.
  LOW_NEED_POSE: "allonge",
  NIGHT_FROM_HOUR: 20, NIGHT_TO_HOUR: 7, // nuit reelle (heure du telephone)

  // ---------- missions de besoin ----------
  MISSION_DEFS: [
    { key:"faim", title:"Donner la gamelle", room:"Cuisine", icon:'<path d="M6 3v6a3 3 0 0 0 3 3v9M9 3v9M12 3v6a3 3 0 0 1-3 3M18 3c-1.5 3-1.5 9 0 12v6"/>', reward:[5,10], actMs:3000, actClass:"acting-faim", scene:"gamelle" },
    { key:"jeu", title:"Aller jouer", room:"Chambre", icon:'<circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/>', reward:[8,12], actMs:2200, actClass:"" },
    { key:"sommeil", title:"L'installer pour la sieste", room:"Salon", icon:'<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>', reward:[5,8], actMs:10000, actClass:"", scene:"canape", spotX:50, pose:"endormi" },
    { key:"proprete", title:"Lui donner un bain", room:"Salle de bain", icon:'<path d="M12 3c3 4 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 9 7 12 3Z"/>', reward:[6,12], actMs:3800, actClass:"", scene:"bain", spotX:50, pose:"assis" }
  ],
  MISSION_FULL_BELOW: 60,     // gain plein si le besoin etait sous 60 %
  MISSION_REDUCED_FACTOR: 0.25, // sinon 25 % du gain

  // ---------- missions quotidiennes (3 par jour, renouvelees a minuit, heure locale) ----------
  DAILY_COUNT: 3,
  DAILY_BONUS: 30,            // les 3 recuperees
  DAILY_POOL: [
    { id:"nourrir2", text:"Nourrir {nom} 2 fois",            event:"mission:faim",     target:2, reward:20 },
    { id:"bain",     text:"Donner un bain à {nom}",          event:"mission:proprete", target:1, reward:25 },
    { id:"sieste",   text:"Faire une sieste sur le canapé",  event:"mission:sommeil",  target:1, reward:20 },
    { id:"jouer2",   text:"Aller jouer 2 fois",              event:"mission:jeu",      target:2, reward:25 },
    { id:"calins3",  text:"Faire 3 câlins à {nom}",          event:"hug",              target:3, reward:20 },
    { id:"objets2",  text:"Toucher 2 objets du décor",       event:"interact",         target:2, reward:25 },
    { id:"coffre",   text:"Ouvrir le coffre du jour",        event:"coffre",           target:1, reward:30 }
  ],

  // ---------- betises (lot 5 a venir : version visuelle, observable / decouverte) ----------
  MISDEEDS: [
    { room:"salon", spotX:60, pose:"joyeux", thought:"J'ai un peu grignoté tes chaussons...", toast:"{nom} a filé mordiller tes chaussons pendant que tu ne regardais pas..." },
    { room:"salledebain", spotX:82, pose:"joyeux", thought:"Le rouleau de papier n'a pas survécu...", toast:"{nom} a déroulé tout le papier toilette pendant que tu ne regardais pas..." },
    { room:"cuisine", spotX:70, pose:"assis", thought:"J'ai un peu joué avec ma gamelle...", toast:"{nom} a renversé sa gamelle pendant que tu ne regardais pas..." }
  ],

  // ---------- economie ----------
  START_COINS: 15,
  // prix de la future boutique (lot 4) : x2 valide par l'utilisatrice
  OUTFIT_PRICE: { commune:[300,500], rare:[1000,1600], legendaire:null }, // legendaire = non achetable
  ROOM_PRICE: { jardin:1500, salledejeu:2500, bureau:4000 },

  // ---------- complicite ----------
  COMPLICITE: {
    maxLevel: 20,
    xpForLevel: function(level){ return 60 + 30 * (level - 1); }, // points pour passer du niveau `level` au suivant
    hugXp: 5, hugsPerDay: 5,
    firstVisitXp: 15,
    neglectXpPerDay: 10,        // par jour sans venir, dans le niveau en cours (on ne perd jamais un niveau)
    levelCoins: function(level){ return 10 * level; },
    outfitEvery: 5              // une tenue tous les 5 niveaux (a brancher quand les tenues arriveront)
  },
  // nouvelles bulles debloquees tous les 2 niveaux (index 0 = niveau 2, 1 = niveau 4, ...)
  LEVEL_THOUGHTS: [
    "Tu sens bon, toi.",
    "Je t'ai gardé une place sur le canapé.",
    "Quand tu n'es pas là, je t'attends derrière la porte.",
    "Tu es mon humain préféré.",
    "On forme une super équipe, hein ?",
    "Je rêve de toi quand je fais la sieste.",
    "Même la gamelle pleine, je préfère un câlin.",
    "Je te fais confiance, pour tout.",
    "Tu es ma maison.",
    "Pour toujours, d'accord ?"
  ],

  // ---------- personnalite ----------
  // chaque action nourrit un trait ; le trait dominant colore les bulles et s'affiche sur la fiche.
  TRAITS: {
    gourmand: { label:"Gourmand",     desc:"Ne dit jamais non à une croquette.",   from:"mission:faim",     thoughts:["On mange bientôt ?", "Je sens une odeur de croquettes..."] },
    joueur:   { label:"Joueur",       desc:"Toujours partant pour s'amuser.",      from:"mission:jeu",      thoughts:["On fait la course ?", "Tu as vu ma balle ?"] },
    dormeur:  { label:"Marmotte",     desc:"Champion de la sieste.",               from:"mission:sommeil",  thoughts:["Le canapé m'appelle...", "Encore cinq minutes..."] },
    propre:   { label:"Coquet",       desc:"Adore sentir bon la mousse.",          from:"mission:proprete", thoughts:["Je sens bon, hein ?", "J'aime bien être tout propre."] },
    calin:    { label:"Pot de colle", desc:"Ne te quitte pas d'une patte.",        from:"hug",              thoughts:["Encore un câlin ?", "Je t'aime fort."] },
    coquin:   { label:"Coquin",       desc:"Toujours une bêtise en tête.",         from:"misdeed",          thoughts:["Je n'ai RIEN fait.", "Hihi, tu ne devineras jamais..."] }
  },

  // ---------- bulles de pensee ----------
  THOUGHTS: {
    faim: ["J'ai tellement faim...", "Une petite croquette ?"],
    sommeil: ["Je suis épuisé...", "Un petit dodo me ferait du bien."],
    jeu: ["Je m'ennuie un peu.", "On joue ?"],
    proprete: ["Je sens le chien mouillé...", "Un petit bain ?"],
    sagesse: ["Je crois que j'ai fait une bêtise...", "Pardon pour tout à l'heure."],
    happy: ["Je suis trop bien avec toi !", "Woof !"],
    neutral: ["Woof.", "On est bien ici."],
    caught: ["Oups... tu m'as vu ?"],
    hug: ["Encore !", "J'adore les câlins !", "Hihi, ça chatouille !"]
  },

  // ---------- divers ----------
  DOG_NAME_MAX: 16,
  SUN_PATH: '<circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  MOON_PATH: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'
};
