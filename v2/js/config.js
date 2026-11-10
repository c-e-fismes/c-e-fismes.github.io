/* =================================================================
   CONFIGURATION CENTRALE
   C'est le seul fichier à modifier pour changer d'identifiants Google,
   de durées de cache ou d'emplacement des bibliothèques du défi.
   ================================================================ */
export const CONFIG = Object.freeze({
    /* Incrémenter à chaque changement de structure des données en cache (et dans sw.js : VERSION). */
    APP_VERSION: 'v7',

    /* Cache navigateur (localStorage) */
    CACHE_FRESH_MS: 2 * 60 * 1000,              /* < 2 min : aucune requête réseau */
    CACHE_MAX_STALE_MS: 7 * 24 * 60 * 60 * 1000, /* > 7 jours : donnée ignorée (sinon utilisée hors-ligne) */
    NETWORK_TIMEOUT_MS: 10000,
    TICK_MS: 30000,                              /* rafraîchissement des statuts (en direct, prochaine séance) */
    GAZETTE_NEW_DAYS: 45,                        /* une gazette est mise en avant sur l'accueil pendant ce nombre de jours après son ajout */
    TIMEZONE: 'Europe/Paris',

    /* Google Sheets (partagés en "Lecteur" pour toute personne disposant du lien) */
    SHEETS: {
        MEMBRES: '1wAC4LrcpOTTlObYt3kSricIqNRCVGWC3fgJQ0LiDe7M',
        EVENTS: '1-vEelbB9DDbJRFmJ0HYW-wCAwZau6DWirqaq6U-Zuww',
        PLANNING: '1-TRwpHJa93G5JyKkWjWAaIrj4-ip9QNwGx5RCG-HSuA'
    },
    /* Lecture des feuilles : fetch d'abord ; si cela échoue, repli automatique sur l'ancienne méthode JSONP.
       Recommandé : laisser à true (ne coûte rien, protège d'un changement côté Google). */
    SHEETS_JSONP_FALLBACK: true,

    /* Google Drive. La clé DOIT être restreinte dans Google Cloud Console :
       référents HTTP = votre domaine uniquement, et API = "Google Drive API" uniquement. */
    DRIVE: {
        API_KEY: 'AIzaSyDAuWBtbVPUXwI8e27RRYREgGu64u3HK74',
        PHOTOS_FOLDER: '1k9hHi9_s5hufPL1jxH9bxvmBbIZUsikb',
        POSTERS_FOLDER: '1iIfPZiGPyJokoDaqkc-oHsMz60c3cp9i',
        GAZETTE_FOLDER: '1xJNiT1oez2Ov3Ec3WHvTEnCQOG1F4oE-',
        /* Dossier racine des documents (sous-dossiers = catégories). Vide = liste d'exemple du HTML. */
        /* Dossier des photos mises en avant sur l'accueil (les 4 plus récentes). Vide = 4 dernières photos de la galerie. */
        HOME_PHOTOS_FOLDER: '',
        DOCUMENTS_FOLDER: '10MuqHP2My8Od49t6eebVoOTo_rokHraU'
    },

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
            image: 'https://fen2image.chessvision.ai/7Q/1pq2kp1/p2ppb2/8/4B1P1/3P4/PP3P2/K7',
            description: 'Trait aux Blancs.',
            line: ['Bg6', 'Kxg6', 'Qh5#'],
            solution: ['1. Fg6!!', 'Si 1… RxFg6 2. Dh5#', 'Si 1… Re7 2. De8#']
        }
    }
});
