/* =================================================================
   UTILITAIRES PARTAGÉS
   ================================================================ */
import { CONFIG } from './config.js';

/* Icône du jeu d'icônes intégré à index.html (symboles #i-...) */
export function icon(name, className = 'icon') {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(NS, 'use');
    use.setAttribute('href', `#i-${name}`);
    svg.append(use);
    return svg;
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/* Création d'éléments DOM sans innerHTML : tout texte est inséré tel quel (aucun risque d'injection). */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') el.className = value;
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
        else el.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
}

/* localStorage protégé : ne lève jamais d'exception (navigation privée, cookies bloqués...). */
export const safeStorage = {
    getItem(key) { try { return localStorage.getItem(key); } catch { return null; } },
    setItem(key, value) { try { localStorage.setItem(key, value); } catch { /* ignoré */ } },
    removeItem(key) { try { localStorage.removeItem(key); } catch { /* ignoré */ } },
    keys() { try { return Object.keys(localStorage); } catch { return []; } }
};

export const normalizeText = (value) =>
    String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export function debounce(fn, delay = 200) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Retourne une URL https valide (ou '' si invalide). Un domaine peut être imposé via `hosts`. */
export function safeUrl(value, hosts = null) {
    try {
        const url = new URL(String(value).trim());
        if (url.protocol === 'http:') url.protocol = 'https:';
        if (url.protocol !== 'https:') return '';
        if (hosts && !hosts.some((host) => url.hostname === host || url.hostname.endsWith('.' + host))) return '';
        return url.href;
    } catch { return ''; }
}

export async function fetchWithTimeout(url, options = {}, timeout = CONFIG.NETWORK_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

export function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
    return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/* Message d'état (chargement, erreur, vide) avec bouton "Réessayer" optionnel. */
export function renderState(target, message, { error = false, retry = null, colspan = 1 } = {}) {
    if (!target) return;
    const box = h('div', { class: `state-message${error ? ' is-error' : ''}`, role: error ? 'alert' : 'status' },
        message,
        retry && h('div', {}, h('button', { type: 'button', class: 'btn btn-small', onclick: retry }, 'Réessayer'))
    );
    if (target.tagName === 'TBODY') target.replaceChildren(h('tr', {}, h('td', { colspan }, box)));
    else if (target.tagName === 'UL') target.replaceChildren(h('li', {}, box));
    else target.replaceChildren(box);
}

/* -----------------------------------------------------------------
   Heure de Paris : le club est local, tous les visiteurs voient les
   horaires et statuts "en direct" selon l'heure de Fismes.
   ----------------------------------------------------------------- */
const parisFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CONFIG.TIMEZONE, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
});
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function parisParts(date = new Date()) {
    const p = {};
    for (const { type, value } of parisFormatter.formatToParts(date)) p[type] = value;
    return {
        year: +p.year, month: +p.month, day: +p.day,
        hour: +p.hour, minute: +p.minute, second: +p.second,
        weekday: WEEKDAYS[p.weekday]
    };
}

/* Convertit une heure "murale" de Paris en timestamp (gère l'heure d'été/hiver). */
export function parisToTimestamp(year, month, day, hour = 0, minute = 0) {
    const wanted = Date.UTC(year, month - 1, day, hour, minute);
    let ts = wanted;
    for (let i = 0; i < 2; i++) {
        const p = parisParts(new Date(ts));
        ts += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    }
    return ts;
}

/* Bus d'événements minimaliste entre modules. */
export const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
export const on = (name, handler) => document.addEventListener(name, handler);
