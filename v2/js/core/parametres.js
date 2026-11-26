/* =================================================================
   PARAMÈTRES DU SITE (onglet "Parametres" du classeur unique)
   Coordonnées, réseaux sociaux, statistique historique et date
   d'actualisation. Valeurs de secours : voir CONFIG.PARAMETRES_DEFAUT.
   ================================================================ */
import { CONFIG } from './config.js';
import { $, safeUrl, safeMailto, safeTel, emit } from './utils.js';
import { fetchSheet, tableRows, cellValue } from './sheets.js';
import { loadWithCache } from './cache.js';

const DEFAULTS = CONFIG.PARAMETRES_DEFAUT;

/* Certains tableaux contiennent des entités HTML (par exemple &amp; dans une URL). */
const nettoyer = (valeur) => String(valeur ?? '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .trim();

let parametres = { ...DEFAULTS };

async function fetchParametres() {
    /* headers:1 est indispensable : sans lui, Google traite les premières
       lignes "clé/valeur" comme des en-têtes et les supprime des données. */
    const table = await fetchSheet(CONFIG.SHEETS.UNIQUE, { sheet: 'Parametres', headers: 1 });
    const resultat = {};
    for (const cellules of tableRows(table)) {
        const cle = nettoyer(cellValue(cellules[0]));
        if (cle) resultat[cle] = nettoyer(cellValue(cellules[1]));
    }
    return resultat;
}

function setTexte(selecteur, valeur) {
    const element = $(selecteur);
    if (element) element.textContent = valeur;
}

function setLien(selecteur, href, libelle) {
    const element = $(selecteur);
    if (!element) return;
    const parent = element.closest('p');
    if (!href) { if (parent) parent.hidden = true; return; }
    if (parent) parent.hidden = false;
    element.href = href;
    if (libelle) element.textContent = libelle;
}

function setReseau(selecteur, url, libelle, domaines) {
    const element = $(selecteur);
    if (!element) return;
    const href = safeUrl(url, domaines);
    if (!href) { element.hidden = true; return; }
    element.hidden = false;
    element.href = href;
    element.title = libelle;
    element.setAttribute('aria-label', `${libelle} (nouvel onglet)`);
}

function appliquer() {
    const { nomClub, email, telephone, adresse, adherentsDepuisCreation,
        facebook, instagram, ffeClub, maps } = parametres;

    $('.brand')?.setAttribute('aria-label', nomClub);
    setTexte('#contactAdresse', adresse);
    setLien('#contactEmailLink', safeMailto(email), email);
    setLien('#contactTelephone', safeTel(telephone), telephone);
    setLien('#contactFfe', safeUrl(ffeClub), 'page sur la FFE');

    const carte = safeUrl(maps, ['google.com']);
    const frame = $('#mapFrame');
    if (frame && carte) frame.dataset.src = carte;

    setReseau('#socialFacebook', facebook, 'Facebook du club', ['facebook.com', 'fb.com']);
    setReseau('#socialInstagram', instagram, 'Instagram de la Ligue Grand Est', ['instagram.com']);

    const statistique = $('#stat-adherents-creation');
    if (statistique && /^\d+$/.test(adherentsDepuisCreation)) {
        statistique.textContent = adherentsDepuisCreation;
    }

}

export const getParametres = () => ({ ...parametres });

export async function loadParametres({ force = false } = {}) {
    await loadWithCache('parametres', fetchParametres, {
        force,
        onData: (donnees) => {
            parametres = { ...DEFAULTS, ...donnees };
            appliquer();
            emit('parametres:updated');
        },
        onError: () => appliquer()
    });
    appliquer();
}
