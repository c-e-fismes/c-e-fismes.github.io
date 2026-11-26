/* =================================================================
   CONFIGURATION CENTRALE
   C'est le seul fichier à modifier pour changer d'identifiants Google,
   de durées de cache ou d'emplacement des bibliothèques du défi.
   ================================================================ */
export const CONFIG = Object.freeze({
    /* Incrémenter à chaque changement de structure des données en cache (et dans sw.js : VERSION). */
    APP_VERSION: 'v1',

    /* Cache navigateur (localStorage) */
    CACHE_FRESH_MS: 2 * 60 * 1000,              /* < 2 min : aucune requête réseau */
    CACHE_MAX_STALE_MS: 7 * 24 * 60 * 60 * 1000, /* > 7 jours : donnée ignorée (sinon utilisée hors-ligne) */
    NETWORK_TIMEOUT_MS: 10000,
    TICK_MS: 30000,                              /* rafraîchissement des statuts (en direct, prochaine séance) */
    GAZETTE_NEW_DAYS: 30,                        /* l'étiquette "Nouveau" reste sur la dernière gazette pendant ce nombre de jours après son ajout */
    TIMEZONE: 'Europe/Paris',

    /* Classeur Google Sheets unique (partagé en "Lecteur" pour toute personne disposant du lien).
       Les onglets lus sont : Parametres, Membres, Evenements et Planning. */
    SHEETS: {
        UNIQUE: '10Burhj_vxCO8Em-75PHbGBLsf34eWiqELEP2Ft9Rl34'
    },
    /* Lecture des feuilles : fetch d'abord ; si cela échoue, repli automatique sur l'ancienne méthode JSONP.
       Recommandé : laisser à true (ne coûte rien, protège d'un changement côté Google). */
    SHEETS_JSONP_FALLBACK: true,

    /* Service Google Apps Script : fournit les fichiers Drive au site.
       Aucune clé API n'est exposée dans le navigateur. */
    API_PROXY_URL: 'https://script.google.com/macros/s/AKfycbwtNJOAUfOvoV4EZceL4ZvMAb6M2R6o8C9yu5snrnruJKqCO5jzK_dSNDc3lFryfZT0YQ/exec',

    /* Valeurs de secours si l'onglet "Parametres" est momentanément indisponible. */
    PARAMETRES_DEFAUT: Object.freeze({
        nomClub: 'Cercle d\'Échecs de Fismes',
        email: 'cercle.echecs.fismes@gmail.com',
        telephone: '06 27 15 02 51',
        adresse: 'Route nationale (ancien camping), 51170 Fismes',
        adherentsDepuisCreation: '419',
        facebook: '',
        /* Le club n'a pas encore de compte : on affiche celui de la Ligue Grand Est. */
        instagram: 'https://www.instagram.com/grandestechecs/',
        ffeClub: 'https://echecs.asso.fr/FicheClub.aspx?Ref=3111',
        maps: 'https://maps.google.com/maps?q=route%20nationale%2C%2051170%20Fismes&output=embed'
    }),

    /* Défi du jour jouable : bibliothèques à déposer dans /vendor (voir README) */
    PUZZLE: {
        API_URL: 'https://api.chess.com/pub/puzzle',
        VENDOR: {
            CHESS: 'vendor/chess.js/chess.js',
            CHESSGROUND: 'vendor/chessground/chessground.js',
            CSS: [
                'vendor/chessground/chessground.base.css',
                'vendor/chessground/chessground.brown.css',
                'vendor/chessground/chessground.cburnett.css'
            ]
        },
        /* Problème de secours si l'API Chess.com est indisponible */
        FALLBACK: {
            fen: '7Q/1pq2kp1/p2ppb2/8/4B1P1/3P4/PP3P2/K7 w - - 0 1',
            description: 'Trait aux Blancs.',
            line: ['Bg6', 'Kxg6', 'Qh5#'],
            solution: ['1. Fg6!!', 'Si 1… RxFg6 2. Dh5#', 'Si 1… Re7 2. De8#']
        }
    }
});
