/* =================================================================
   LECTURE DES GOOGLE SHEETS (API "gviz", feuilles publiques en lecture)
   Méthode principale : fetch (aucun code externe exécuté).
   Repli optionnel : JSONP (voir CONFIG.SHEETS_JSONP_FALLBACK).
   ================================================================ */
import { CONFIG } from './config.js';
import { fetchWithTimeout } from './utils.js';

function buildUrl(sheetId, { sheet, headers } = {}, tqx = 'out:json') {
    const params = new URLSearchParams({ tqx });
    if (sheet) params.set('sheet', sheet);
    if (headers !== undefined) params.set('headers', String(headers));
    return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?${params}`;
}

/* La réponse Google est un appel de fonction enveloppant du JSON : setResponse({...}); on en extrait le JSON. */
export function parseGviz(text) {
    const start = text.indexOf('(');
    const end = text.lastIndexOf(')');
    if (start < 0 || end <= start) throw new Error('Réponse Google Sheets invalide');
    const json = JSON.parse(text.slice(start + 1, end));
    if (json.status === 'error' || !json.table) {
        throw new Error(json.errors?.[0]?.detailed_message || 'Feuille inaccessible');
    }
    return json.table;
}

let jsonpCounter = 0;
function fetchJsonp(sheetId, options) {
    return new Promise((resolve, reject) => {
        const callback = `__cceSheet${++jsonpCounter}`;
        const script = document.createElement('script');
        const cleanup = () => { delete window[callback]; script.remove(); clearTimeout(timer); };
        const timer = setTimeout(() => { cleanup(); reject(new Error('Délai dépassé')); }, CONFIG.NETWORK_TIMEOUT_MS);
        window[callback] = (data) => {
            cleanup();
            if (data?.table) resolve(data.table); else reject(new Error('Feuille inaccessible'));
        };
        script.onerror = () => { cleanup(); reject(new Error('Chargement impossible')); };
        script.src = buildUrl(sheetId, options, `responseHandler:${callback}`);
        document.head.appendChild(script);
    });
}

export async function fetchSheet(sheetId, options = {}) {
    try {
        const response = await fetchWithTimeout(buildUrl(sheetId, options));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return parseGviz(await response.text());
    } catch (error) {
        if (!CONFIG.SHEETS_JSONP_FALLBACK) throw error;
        return fetchJsonp(sheetId, options);
    }
}

/* Aides de lecture des cellules ({v: valeur, f: valeur formatée} ou null) */
export const cellValue = (cell) => (cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : '');
export const cellText = (cell) => {
    if (!cell) return '';
    if (cell.v !== null && cell.v !== undefined) return String(cell.v).trim();
    if (cell.f !== null && cell.f !== undefined) return String(cell.f).trim();
    return '';
};
export const tableRows = (table) => (table?.rows ?? []).map((row) => row?.c ?? []);

/* Lit une heure dans une cellule : texte formaté ("20:00"), tableau [h, m] (type heure) ou "Date(1899,11,30,20,0,0)". */
export function parseTimeCell(cell) {
    if (!cell) return null;
    const pattern = /(\d{1,2})\s*[:hH]\s*(\d{2})/;
    const formatted = cell.f !== null && cell.f !== undefined ? String(cell.f).trim() : '';
    let match = formatted.match(pattern);
    if (match) {
        let hour = +match[1];
        if (/pm/i.test(formatted) && hour < 12) hour += 12;
        if (/am/i.test(formatted) && hour === 12) hour = 0;
        return { h: hour, m: +match[2] };
    }
    const value = cell.v;
    if (Array.isArray(value)) return { h: +value[0] || 0, m: +value[1] || 0 };
    if (typeof value === 'string') {
        const date = value.match(/^Date\(\d+,\d+,\d+,(\d+),(\d+)/);
        if (date) return { h: +date[1], m: +date[2] };
        match = value.match(pattern);
        if (match) return { h: +match[1], m: +match[2] };
    }
    return null;
}
