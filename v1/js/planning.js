/* =================================================================
   PLANNING DES SÉANCES (Google Sheet) + mode vacances + séance "en direct"
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$, h, normalizeText, parisParts, renderState, emit } from './utils.js';
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

/* Met en évidence la séance en cours ("En direct") ou la prochaine. Appelée chaque minute. */
export function updatePlanningStatus() {
    const rows = $$('#planningTableBody tr');
    rows.forEach((row) => {
        row.classList.remove('seance-active-row');
        row.querySelector('.table-badge')?.remove();
    });
    if (vacation || rows.length === 0 || rows.length !== planning.length) return;

    const now = parisParts();
    const nowMin = now.hour * 60 + now.minute;
    let target = -1;
    let status = 'pending';

    planning.forEach((item, index) => {
        const end = item.finMin ?? item.debutMin + DEFAULT_DURATION_MIN;
        if (item.jourNum === now.weekday && nowMin >= item.debutMin && nowMin <= end) { target = index; status = 'live'; }
    });

    if (target === -1) {
        let best = Infinity;
        planning.forEach((item, index) => {
            let gapDays = item.jourNum - now.weekday;
            if (gapDays < 0 || (gapDays === 0 && item.debutMin <= nowMin)) gapDays += 7;
            const gap = gapDays * 1440 + (item.debutMin - nowMin);
            if (gap < best) { best = gap; target = index; }
        });
    }

    if (target !== -1) {
        const row = rows[target];
        row.classList.add('seance-active-row');
        row.lastElementChild?.append(
            status === 'live'
                ? h('span', { class: 'table-badge live' }, '🔴 En direct')
                : h('span', { class: 'table-badge pending' }, 'Prochaine séance')
        );
    }
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
