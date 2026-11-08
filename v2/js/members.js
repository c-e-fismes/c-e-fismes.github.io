/* =================================================================
   CLASSEMENT ET PROFILS DES JOUEURS (Google Sheet "Membres")
   Tri par colonne (accessible au clavier), recherche par nom, statistiques du club.
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$, h, icon, emit, debounce, normalizeText, renderState } from './utils.js';
import { loadWithCache } from './cache.js';
import { fetchSheet, tableRows, cellValue } from './sheets.js';

const NUMERIC = ['classique', 'rapide', 'blitz'];
let members = [];
let sort = { column: 'nomPrenom', order: 'asc' };
let query = '';

const toNumber = (value) => parseInt(String(value).replace(/\s/g, ''), 10) || 0;
const hasFide = (id) => !['', 'N/A', '-'].includes(String(id).trim().toUpperCase());
/* Identifiant FIDE exploitable pour construire un lien (numérique) */
const isFideLinkable = (id) => hasFide(id) && /^\d+$/.test(String(id).trim());
const isFeminine = (genre) => ['F', 'FEMININE', 'FEMININ', 'FEMME'].includes(normalizeText(genre).toUpperCase());
const clean = (cell) => cellValue(cell).replace(/^["']|["']$/g, '').trim();

async function fetchMembers() {
    const table = await fetchSheet(CONFIG.SHEETS.MEMBRES, { sheet: 'Membres' });
    return tableRows(table)
        .filter((cells) => cells.length > 0)
        .map((c) => ({
            nomPrenom: clean(c[0]),
            classique: clean(c[1]) || '0',
            rapide: clean(c[2]) || '0',
            blitz: clean(c[3]) || '0',
            categorie: clean(c[4]),
            genre: clean(c[5]),
            fideId: clean(c[6])
        }))
        .filter((m) => m.nomPrenom !== '');
}

/* Liste affichée = filtre par nom puis tri (sans modifier la liste d'origine) */
function visibleMembers() {
    const needle = normalizeText(query);
    const list = needle ? members.filter((m) => normalizeText(m.nomPrenom).includes(needle)) : [...members];
    const numeric = NUMERIC.includes(sort.column);
    list.sort((a, b) => {
        if (numeric) {
            const diff = toNumber(a[sort.column]) - toNumber(b[sort.column]);
            return sort.order === 'asc' ? diff : -diff;
        }
        const result = String(a[sort.column]).trim().localeCompare(String(b[sort.column]).trim(), 'fr', { sensitivity: 'base' });
        return sort.order === 'asc' ? result : -result;
    });
    return list;
}

function renderRows() {
    const tbody = $('#membersTableBody');
    const list = visibleMembers();
    if (members.length > 0 && list.length === 0) {
        renderState(tbody, 'Aucun membre ne correspond à votre recherche.', { colspan: 7 });
        return;
    }
    tbody.replaceChildren(...list.map((m) => {
        const linkable = isFideLinkable(m.fideId);
        const fide = linkable
            ? h('a', { href: `https://ratings.fide.com/profile/${m.fideId}`, target: '_blank', rel: 'noopener noreferrer', class: 'table-fide-btn' }, icon('link'), ' Fiche FIDE')
            : null;
        return h('tr', {},
            h('td', { 'data-label': 'Nom Prénom' }, linkable
                /* Onglet "Calculations" de la fiche FIDE : parties, adversaires et variations de classement */
                ? h('a', { href: `https://ratings.fide.com/profile/${m.fideId}/calculations`, target: '_blank', rel: 'noopener noreferrer', class: 'member-link',
                           title: 'Voir les derniers résultats (site de la FIDE)', 'aria-label': `Derniers résultats de ${m.nomPrenom} sur le site de la FIDE (nouvel onglet)` },
                    h('strong', {}, m.nomPrenom), h('span', { class: 'member-link-icon', 'aria-hidden': 'true' }, ' ↗'))
                : h('strong', {}, m.nomPrenom)),
            h('td', { class: 'cell-center', 'data-label': 'Classique' }, m.classique),
            h('td', { class: 'cell-center', 'data-label': 'Rapide' }, m.rapide),
            h('td', { class: 'cell-center', 'data-label': 'Blitz' }, m.blitz),
            h('td', { class: 'cell-center', 'data-label': 'Catégorie' }, m.categorie),
            h('td', { class: 'cell-center', 'data-label': 'F/M' }, m.genre),
            h('td', { class: 'cell-center', 'data-label': 'Profil International' }, fide)
        );
    }));
}

function renderSortState() {
    $$('#membersTable thead th').forEach((th) => {
        const button = $('[data-sort]', th);
        const icon = $('.sort-icon', th);
        const active = button && button.dataset.sort === sort.column;
        if (active) th.setAttribute('aria-sort', sort.order === 'desc' ? 'descending' : 'ascending');
        else th.removeAttribute('aria-sort');
        if (icon) {
            icon.textContent = active ? (sort.order === 'desc' ? '▼' : '▲') : '';
            icon.classList.toggle('is-active', Boolean(active));
        }
    });
}

function sortBy(column) {
    const numeric = NUMERIC.includes(column);
    if (sort.column === column) {
        if (numeric && sort.order === 'desc') sort = { column: 'nomPrenom', order: 'asc' };
        else sort.order = sort.order === 'asc' ? 'desc' : 'asc';
    } else {
        sort = { column, order: numeric ? 'desc' : 'asc' };
    }
    renderSortState();
    renderRows();
}

function updateStats() {
    const total = members.length;
    if (total === 0) return;
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    const feminines = members.filter((m) => isFeminine(m.genre)).length;
    const fideCount = members.filter((m) => hasFide(m.fideId)).length;

    let maxElo = 0;
    const rapids = [];
    for (const m of members) {
        const [classic, rapid, blitz] = [toNumber(m.classique), toNumber(m.rapide), toNumber(m.blitz)];
        maxElo = Math.max(maxElo, classic, rapid, blitz);
        if (rapid > 0) rapids.push(rapid);
    }
    const top5 = rapids.sort((a, b) => b - a).slice(0, 5);
    const average = top5.length ? Math.round(top5.reduce((sum, v) => sum + v, 0) / top5.length) : 0;

    setText('stat-total-membres', total);
    setText('stat-feminines', `${Math.round((feminines / total) * 100)}%`);
    setText('stat-joueurs-fide', fideCount);
    setText('stat-top-elo', maxElo > 0 ? maxElo : '-');
    setText('stat-niveau-moyen', average > 0 ? average : '-');
}

function initSearch() {
    const toggle = $('#searchToggle');
    const box = $('#searchContainer');
    const input = $('#nameSearchInput');

    const setOpen = (open) => {
        box.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) input.focus();
        else { input.value = ''; query = ''; renderRows(); toggle.focus(); }
    };
    toggle.addEventListener('click', () => setOpen(box.hidden));
    input.addEventListener('input', debounce(() => { query = input.value; renderRows(); }, 150));
    input.addEventListener('keydown', (event) => { if (event.key === 'Escape') setOpen(false); });
}

export async function loadMembers({ force = false } = {}) {
    await loadWithCache('membres', fetchMembers, {
        force,
        onData: (data) => {
            members = data;
            $('#membersResultsTip').hidden = !members.some((m) => isFideLinkable(m.fideId));
            renderSortState(); renderRows(); updateStats(); emit('stats:updated');
        },
        onError: () => renderState($('#membersTableBody'),
            'Impossible de charger la liste des membres pour le moment. Veuillez réessayer ultérieurement.',
            { error: true, retry: () => loadMembers({ force: true }), colspan: 7 })
    });
}

export function initMembers() {
    $$('#membersTable [data-sort]').forEach((button) => button.addEventListener('click', () => sortBy(button.dataset.sort)));
    initSearch();
    loadMembers();
}
