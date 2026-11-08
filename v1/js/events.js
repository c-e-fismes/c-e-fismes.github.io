/* =================================================================
   ÉVÉNEMENTS (Google Sheet) : liste filtrable, affiches (Drive), état
   Le calendrier et le compte à rebours s'abonnent à l'événement "events:updated".
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$, h, emit, on, parisParts, parisToTimestamp, renderState, safeUrl, prefersReducedMotion } from './utils.js';
import { loadWithCache } from './cache.js';
import { fetchSheet, tableRows, cellValue, cellText, parseTimeCell } from './sheets.js';
import { isDriveConfigured, listFiles, childrenQuery, imageUrl } from './drive.js';
import { openLightbox } from './lightbox.js';
import { downloadIcs } from './ics.js';

const THREE_HOURS = 3 * 60 * 60 * 1000;

let events = [];
let status = 'loading'; /* loading | ready | error */
let posterMap = null;   /* nom de fichier -> id Drive */
let posterRequested = false;
let selectedYear = null;
let initialScrollDone = false;
let lastSignature = '';

export const getEvents = () => events;
export const getEventsStatus = () => status;

/* État d'un événement à l'instant donné */
export function eventStatus(event, now = Date.now()) {
    if (now > event.end) return 'past';
    if (now >= event.start) return 'live';
    return 'upcoming';
}

/* ------------------------------ Lecture de la feuille ------------------------------ */
const looksLikeTime = (cell) => {
    if (!cell) return false;
    if (Array.isArray(cell.v)) return true;
    const text = String(cell.f ?? cell.v ?? '');
    return text.includes(':') || /^Date\(\d+,\d+,\d+,\d+/.test(text);
};

function parseEvents(table) {
    const list = [];
    for (const cells of tableRows(table)) {
        if (cells.length < 5) continue;

        /* Deux dispositions de colonnes sont prises en charge (avec ou sans heure de fin) */
        /* Heure de fin présente si la 3e colonne ressemble à une heure, ou si elle est vide dans une feuille d'au moins 10 colonnes */
        const hasEndColumn = looksLikeTime(cells[2]) || (!cellText(cells[2]) && cells.length >= 10);
        const col = hasEndColumn
            ? { end: 2, type: 3, titre: 4, lieu: 5, cadence: 6, rondes: 7, commentaire: 8, affiche: 9, resultats: 10 }
            : { end: -1, type: 2, titre: 3, lieu: 4, cadence: 5, rondes: 6, commentaire: 7, affiche: 8, resultats: 9 };

        let rawDate = cellValue(cells[0]);
        if (!rawDate || rawDate.toLowerCase() === 'date' || !cellValue(cells[1])) continue;

        let year, month, day;
        if (rawDate.includes('/')) {
            [day, month, year] = rawDate.split('/').map((n) => parseInt(n, 10));
        } else if (/^Date\(/.test(rawDate)) {
            const parts = rawDate.match(/\d+/g);
            if (!parts || parts.length < 3) continue;
            year = +parts[0]; month = +parts[1] + 1; day = +parts[2];
            rawDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        } else continue;
        if (![year, month, day].every(Number.isFinite) || month < 1 || month > 12 || day < 1 || day > 31) continue;

        const startTime = parseTimeCell(cells[1]) ?? { h: 0, m: 0 };
        const start = parisToTimestamp(year, month, day, startTime.h, startTime.m);
        let end = start + THREE_HOURS;
        if (col.end !== -1) {
            const endTime = parseTimeCell(cells[col.end]);
            if (endTime && (endTime.h !== 0 || endTime.m !== 0)) {
                end = parisToTimestamp(year, month, day, endTime.h, endTime.m);
                if (end < start) end += 24 * 60 * 60 * 1000;
            }
        }

        list.push({
            start, end,
            iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            year: String(year),
            rawDate,
            rawTime: `${String(startTime.h).padStart(2, '0')}h${String(startTime.m).padStart(2, '0')}`,
            type: cellText(cells[col.type]).toLowerCase(),
            titre: cellText(cells[col.titre]),
            lieu: cellText(cells[col.lieu]),
            cadence: cellText(cells[col.cadence]),
            rondes: cellText(cells[col.rondes]),
            commentaire: cellText(cells[col.commentaire]),
            lienAffiche: cellText(cells[col.affiche]),
            lienResultats: safeUrl(cellText(cells[col.resultats])) /* page FFE, PDF Drive... : adresse https collée par l'administrateur */
        });
    }
    return list.sort((a, b) => a.start - b.start);
}

async function fetchEvents() {
    return parseEvents(await fetchSheet(CONFIG.SHEETS.EVENTS));
}

/* ------------------------------ Affiches ------------------------------ */
async function ensurePosterMap() {
    if (posterRequested || !isDriveConfigured()) return;
    posterRequested = true;
    await loadWithCache('posters', async () => {
        const files = await listFiles({
            query: childrenQuery(CONFIG.DRIVE.POSTERS_FOLDER, "mimeType contains 'image/'"),
            fields: 'id,name'
        });
        return Object.fromEntries(files.map((file) => [file.name, file.id]));
    }, {
        onData: (map) => { posterMap = map; render(true); }
    });
}

/* Retourne { thumb, full } ou null */
function posterSources(event) {
    const value = (event.lienAffiche || '').trim();
    if (!value) return null;
    if (/^https?:/i.test(value)) {
        const url = safeUrl(value);
        return url ? { thumb: url, full: url } : null;
    }
    const id = posterMap?.[value];
    return id ? { thumb: imageUrl(id, 320), full: imageUrl(id, 1600) } : null;
}

/* ------------------------------ Affichage ------------------------------ */
function buildCard(event, state) {
    const typeBadge = event.type === 'cours'
        ? h('span', { class: 'badge badge--cours' }, '📚 Cours')
        : h('span', { class: 'badge badge--tournoi' }, '🏆 Tournoi');
    const statusBadge = state === 'live'
        ? h('span', { class: 'badge badge--live' }, '🔴 En cours')
        : state === 'past'
            ? h('span', { class: 'badge badge--past' }, 'Terminé')
            : h('span', { class: 'badge badge--upcoming' }, 'À venir');

    const info = h('div', { class: 'event-info-col' },
        h('h3', { class: 'event-heading' }, statusBadge, typeBadge, h('span', { class: 'event-title-text' }, event.titre)),
        h('p', {}, '📅 ', h('strong', {}, 'Date :'), ` Le ${event.rawDate} à ${event.rawTime}`),
        h('p', {}, '📍 ', h('strong', {}, 'Lieu :'), ` ${event.lieu}`),
        event.cadence && h('p', {}, '⏳ ', h('strong', {}, 'Cadence :'), ` ${event.cadence}`),
        event.rondes && h('p', {}, '🔄 ', h('strong', {}, 'Nombre de rondes :'), ` ${event.rondes}`)
    );

    const poster = posterSources(event);
    let posterColumn = null;
    if (poster) {
        const img = h('img', { src: poster.thumb, alt: `Affiche : ${event.titre}`, loading: 'lazy', class: 'event-poster-thumb' });
        posterColumn = h('div', { class: 'event-poster-col' },
            h('button', {
                type: 'button', class: 'poster-btn', 'aria-label': `Agrandir l'affiche : ${event.titre}`,
                onclick: () => openLightbox([poster.full], 0, [`Affiche : ${event.titre}`])
            }, img));
        img.addEventListener('error', () => { posterColumn.hidden = true; });
    }

    return h('article', {
        class: `card event-card${state === 'past' ? ' is-past' : ''}`,
        'data-date': event.iso, 'data-year': event.year, 'data-status': state
    },
        h('div', { class: 'event-content-flex' }, info, posterColumn),
        event.commentaire && h('p', { class: 'event-comment-text' }, '💬 ', event.commentaire),
        buildActions(event, state)
    );
}

/* Événement à venir ou en cours : "Ajouter à mon agenda" ; événement passé avec lien : "Résultats" */
function buildActions(event, state) {
    if (state !== 'past') {
        return h('div', { class: 'event-actions' },
            h('button', { type: 'button', class: 'btn btn-small btn-dark', onclick: () => downloadIcs(event) }, '📅 Ajouter à mon agenda'));
    }
    if (!event.lienResultats) return null;
    return h('div', { class: 'event-actions' },
        h('a', { href: event.lienResultats, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-small',
                 'aria-label': `Voir les résultats : ${event.titre} (nouvel onglet)` }, '📊 Résultats'));
}

function buildYearOptions() {
    const select = $('#yearSelect');
    const years = [...new Set(events.map((e) => e.year))].sort();
    const current = String(parisParts().year);
    const wanted = selectedYear && (selectedYear === 'all' || years.includes(selectedYear))
        ? selectedYear : (years.includes(current) ? current : 'all');
    select.replaceChildren(
        h('option', { value: 'all' }, 'Toutes les années'),
        ...years.map((year) => h('option', { value: year }, year))
    );
    select.value = wanted;
    selectedYear = wanted;
}

function applyFilters() {
    const year = $('#yearSelect').value;
    const hidePast = $('#hidePastCheckbox').checked;
    let visible = 0;
    $$('#eventsGrid .event-card').forEach((card) => {
        const show = (year === 'all' || card.dataset.year === year) && !(hidePast && card.dataset.status === 'past');
        card.hidden = !show;
        if (show) visible++;
    });
    $('#eventsEmpty').hidden = visible > 0 || events.length === 0;
}

export function render(force = false) {
    const grid = $('#eventsGrid');
    if (status === 'error') return;
    if (events.length === 0) {
        renderState(grid, status === 'loading' ? 'Chargement du calendrier en cours...' : 'Aucun événement enregistré.');
        return;
    }
    const now = Date.now();
    const states = events.map((e) => eventStatus(e, now));
    const signature = events.map((e, i) => `${e.iso}${e.titre}${states[i]}${e.lienResultats}${posterSources(e)?.thumb ?? ''}`).join('|');
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    buildYearOptions();
    grid.replaceChildren(...events.map((e, i) => buildCard(e, states[i])));
    applyFilters();
    maybeInitialScroll();
}

/* Au premier affichage de l'onglet, amène le prochain événement de l'année à l'écran (une seule fois). */
function maybeInitialScroll() {
    if (initialScrollDone || events.length === 0 || !$('#evenements').classList.contains('active')) return;
    const year = String(parisParts().year);
    const next = events.find((e) => e.year === year && eventStatus(e) !== 'past');
    initialScrollDone = true;
    if (!next) return;
    const card = $(`#eventsGrid .event-card[data-date="${next.iso}"]:not([hidden])`);
    if (card) setTimeout(() => card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }), 250);
}

/* Appelé par le calendrier : affiche et met en évidence la carte d'une date */
function focusDate(iso) {
    const target = events.find((e) => e.iso === iso);
    if (!target) return;
    const hidePast = $('#hidePastCheckbox');
    if (eventStatus(target) === 'past' && hidePast.checked) hidePast.checked = false;
    const select = $('#yearSelect');
    if (select.value !== 'all' && select.value !== target.year) { select.value = target.year; selectedYear = target.year; }
    applyFilters();
    const card = $(`#eventsGrid .event-card[data-date="${iso}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    card.classList.add('is-flash');
    setTimeout(() => card.classList.remove('is-flash'), 1600);
}

export async function loadEvents({ force = false } = {}) {
    await loadWithCache('events', fetchEvents, {
        force,
        onData: (data) => {
            events = data;
            status = 'ready';
            if (events.some((e) => e.lienAffiche && !/^https?:/i.test(e.lienAffiche))) ensurePosterMap();
            render();
            emit('events:updated');
        },
        onError: () => {
            status = 'error';
            renderState($('#eventsGrid'), 'Impossible de charger le calendrier pour le moment.', { error: true, retry: () => loadEvents({ force: true }) });
            emit('events:updated');
        }
    });
}

export function initEvents() {
    $('#yearSelect').addEventListener('change', (e) => { selectedYear = e.target.value; applyFilters(); });
    $('#hidePastCheckbox').addEventListener('change', applyFilters);
    on('events:focus', (e) => focusDate(e.detail.iso));
    on('section:show', (e) => { if (e.detail.id === 'evenements') maybeInitialScroll(); });
    loadEvents();
}
