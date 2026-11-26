/* =================================================================
   PLANNING DES SÉANCES (Google Sheet) + mode vacances + séance "en direct"
   ================================================================ */
import { CONFIG } from '../core/config.js';
import { $, $$, h, normalizeText, parisParts, parisToTimestamp, renderState, emit } from '../core/utils.js';
import { loadWithCache } from '../core/cache.js';
import { fetchSheet, tableRows, cellValue, parseTimeCell } from '../core/sheets.js';
import { holidayName } from '../core/holidays.js';

const DAYS = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const DEFAULT_DURATION_MIN = 180; /* durée supposée si l'heure de fin n'est pas renseignée */

let planning = [];
let vacation = false;

export const isVacationMode = () => vacation;

const fmt = (t) => `${t.h}h${String(t.m).padStart(2, '0')}`;

/* Transforme la feuille en données simples et sérialisables */
async function fetchPlanning() {
    const table = await fetchSheet(CONFIG.SHEETS.UNIQUE, { sheet: 'Planning', headers: 0 });
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

/* Occurrences réelles (avec dates) des séances hebdomadaires autour de maintenant.
   Chaque occurrence porte `holiday` (nom du jour férié) si elle tombe un jour férié. */
function buildOccurrences(now) {
    const today = parisParts(new Date(now));
    const list = [];
    for (let offset = -8; offset <= 14; offset++) {
        const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        const [year, month, day, weekday] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCDay()];
        const holiday = holidayName(year, month, day);
        planning.forEach((item, index) => {
            if (item.jourNum !== weekday) return;
            const start = parisToTimestamp(year, month, day, Math.floor(item.debutMin / 60), item.debutMin % 60);
            const length = (item.finMin ?? item.debutMin + DEFAULT_DURATION_MIN) - item.debutMin;
            list.push({ start, end: start + Math.max(length, 30) * 60000, item, index, holiday });
        });
    }
    return list.sort((a, b) => a.start - b.start);
}

/* Séances précédente, prochaine (ou en cours) et suivante : les jours fériés sont ignorés.
   { previous, current, after } ; current.status = 'live' ou 'next'. null sans données. */
export function getSessionTriplet(now = Date.now()) {
    if (planning.length === 0) return null;
    const held = buildOccurrences(now).filter((o) => !o.holiday);
    const index = held.findIndex((o) => o.end >= now);
    if (index < 0) return null;
    const current = held[index];
    return { previous: held[index - 1] ?? null, current: { ...current, status: current.start <= now ? 'live' : 'next' }, after: held[index + 1] ?? null };
}

/* Séance en cours ("live") ou prochaine séance réellement tenue ; null en mode vacances ou sans données */
export function getNextSession() {
    if (vacation) return null;
    const triplet = getSessionTriplet();
    return triplet ? { index: triplet.current.index, status: triplet.current.status, item: triplet.current.item } : null;
}

/* Pour chaque ligne du planning : jour férié concerné si sa PROCHAINE occurrence tombe un jour férié */
function upcomingHolidays(now = Date.now()) {
    const flags = new Map();
    for (const occurrence of buildOccurrences(now)) {
        if (occurrence.end < now || flags.has(occurrence.index)) continue;
        flags.set(occurrence.index, occurrence.holiday ? { name: occurrence.holiday, start: occurrence.start } : null);
    }
    return flags;
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });
const longDate = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' });

/* Met en évidence la séance en cours ("En direct") ou la prochaine ; grise les séances fériées. Appelée chaque minute. */
export function updatePlanningStatus() {
    const rows = $$('#planningTableBody tr');
    rows.forEach((row) => {
        row.classList.remove('seance-active-row', 'seance-holiday-row');
        row.querySelectorAll('.table-badge').forEach((badge) => badge.remove());
    });
    if (rows.length === planning.length && planning.length > 0) {
        if (!vacation) {
            upcomingHolidays().forEach((holiday, index) => {
                if (!holiday) return;
                rows[index].classList.add('seance-holiday-row');
                rows[index].lastElementChild?.append(h('span', { class: 'table-badge holiday', title: `Jour férié : ${holiday.name} (${longDate.format(holiday.start)})` },
                    `Férié · ${shortDate.format(holiday.start).replace('.', '')}`));
            });
        }
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
