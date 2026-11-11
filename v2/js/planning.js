/* =================================================================
   PLANNING DES SÉANCES (Google Sheet) + mode vacances + séance "en direct"
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$, h, normalizeText, parisParts, parisToTimestamp, renderState, emit } from './utils.js';
import { loadWithCache } from './cache.js';
import { fetchSheet, tableRows, cellValue, parseTimeCell } from './sheets.js';

const DAYS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const DEFAULT_DURATION_MIN = 180; /* durée supposée si l'heure de fin n'est pas renseignée */

let planning = [];
let vacation = false;

export const isVacationMode = () => vacation;

const fmt = (t) => `${t.h}h${String(t.m).padStart(2, '0')}`;

/* Transforme la feuille en données simples et sérialisables */
async function fetchPlanning() {
    const table = await fetchSheet(CONFIG.SHEETS.PLANNING, { headers: 0 });
    const items = [];
    let vacationFlag = false;

    tableRows(table).forEach((cells, index) => {
        if (index === 0 && cells[7]) {
            const flag = cellValue(cells[7]).toUpperCase();
            if (flag.includes('VACANCES:OUI') || flag === 'OUI') vacationFlag = true;
        }
        if (cells.length < 5) return;

        const jour = cellValue(cells[0]);
        const start = parseTimeCell(cells[1]);
        const end = parseTimeCell(cells[2]);
        if (!jour || !start) return;

        const debutMin = start.h * 60 + start.m;
        const finMin = end ? end.h * 60 + end.m : null;
        items.push({
            jour,
            jourNum: DAYS[normalizeText(jour)] ?? 1,
            debutMin,
            finMin,
            horaire: end ? `${fmt(start)} - ${fmt(end)}` : fmt(start),
            commune: cellValue(cells[3]),
            lieu: cellValue(cells[4])
        });
    });
    return { items, vacation: vacationFlag };
}

function renderTable() {
    const tbody = $('#planningTableBody');
    if (!tbody) return;
    tbody.replaceChildren(...planning.map((item) => h('tr', {},
        h('td', { class: 'cell-strong' }, item.jour),
        h('td', {}, item.horaire),
        h('td', {}, item.commune),
        h('td', {}, item.lieu)
    )));
    updatePlanningStatus();
}

function applyVacation() {
    $('#vacationAlertBanner')?.classList.toggle('hidden', !vacation);
    $('#planningWrapperContainer')?.classList.toggle('planning-table-disabled', vacation);
    emit('planning:vacation', { vacation });
    updatePlanningStatus();
}

/* Occurrences réelles (avec dates) des séances hebdomadaires autour de maintenant :
   { previous, current, after } ; current.status = 'live' (en cours) ou 'next' (à venir). null sans données. */
export function getSessionTriplet(now = Date.now()) {
    if (planning.length === 0) return null;
    const today = parisParts(new Date(now));
    const occurrences = [];
    for (let offset = -8; offset <= 14; offset++) {
        const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        const [year, month, day, weekday] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay()];
        for (const item of planning) {
            if (item.jourNum !== weekday) continue;
            const start = parisToTimestamp(year, month, day, Math.floor(item.debutMin / 60), item.debutMin % 60);
            const length = (item.finMin ?? item.debutMin + DEFAULT_DURATION_MIN) - item.debutMin;
            occurrences.push({ start, end: start + Math.max(length, 30) * 60000, item });
        }
    }
    occurrences.sort((a, b) => a.start - b.start);
    const index = occurrences.findIndex((o) => o.end >= now);
    if (index < 0) return null;
    const current = occurrences[index];
    return { previous: occurrences[index - 1] ?? null, current: { ...current, status: current.start <= now ? 'live' : 'next' }, after: occurrences[index + 1] ?? null };
}

/* Séance en cours ("live") ou prochaine séance ; null en mode vacances ou sans données */
export function getNextSession() {
    if (vacation || planning.length === 0) return null;
    const now = parisParts();
    const nowMin = now.hour * 60 + now.minute;
    let index = -1;
    let status = 'pending';

    planning.forEach((item, i) => {
        const end = item.finMin ?? item.debutMin + DEFAULT_DURATION_MIN;
        if (item.jourNum === now.weekday && nowMin >= item.debutMin && nowMin <= end) { index = i; status = 'live'; }
    });

    if (index === -1) {
        let best = Infinity;
        planning.forEach((item, i) => {
            let gapDays = item.jourNum - now.weekday;
            if (gapDays < 0 || (gapDays === 0 && item.debutMin <= nowMin)) gapDays += 7;
            const gap = gapDays * 1440 + (item.debutMin - nowMin);
            if (gap < best) { best = gap; index = i; }
        });
    }
    return index === -1 ? null : { index, status, item: planning[index] };
}

/* Met en évidence la séance en cours ("En direct") ou la prochaine. Appelée chaque minute. */
export function updatePlanningStatus() {
    const rows = $$('#planningTableBody tr');
    rows.forEach((row) => {
        row.classList.remove('seance-active-row');
        row.querySelector('.table-badge')?.remove();
    });
    if (rows.length === planning.length) {
        const next = getNextSession();
        if (next) {
            const row = rows[next.index];
            row.classList.add('seance-active-row');
            row.lastElementChild?.append(
                next.status === 'live'
                    ? h('span', { class: 'table-badge live' }, 'En direct')
                    : h('span', { class: 'table-badge pending' }, 'Prochaine séance')
            );
        }
    }
    emit('planning:status');
}

export async function loadPlanning({ force = false } = {}) {
    await loadWithCache('planning', fetchPlanning, {
        force,
        onData: (data) => {
            planning = data.items;
            vacation = data.vacation;
            renderTable();
            applyVacation();
        },
        onError: () => renderState($('#planningTableBody'), 'Impossible de charger le planning pour le moment.', { error: true, retry: () => loadPlanning({ force: true }), colspan: 4 })
    });
}
