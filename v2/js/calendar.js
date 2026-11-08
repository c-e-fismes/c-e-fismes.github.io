/* =================================================================
   CALENDRIER MENSUEL (colonne latérale ; repliable sur mobile)
   Jours avec événement = boutons accessibles au clavier ; info-bulle au survol / focus / toucher.
   ================================================================ */
import { $, h, icon, emit, on, parisParts } from './utils.js';
import { getEvents } from './events.js';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const view = { year: 0, month: 0 }; /* month : 0-11 */
let tooltip = null;
let tooltipFor = null;

const isTouch = () => window.matchMedia('(pointer: coarse)').matches;

function hideTooltip() {
    tooltip?.remove();
    document.querySelector('[aria-describedby="calendarTooltip"]')?.removeAttribute('aria-describedby');
    tooltip = null;
    tooltipFor = null;
}

function showTooltip(target, dayEvents, iso) {
    hideTooltip();
    tooltip = h('div', { class: 'calendar-custom-tooltip', id: 'calendarTooltip', role: 'tooltip' },
        ...dayEvents.map((e) => h('div', { class: 'calendar-tooltip-item' },
            h('div', { class: 'calendar-tooltip-title' }, e.titre),
            h('div', { class: 'calendar-tooltip-details' }, `${e.rawTime} · ${e.lieu}`)
        )),
        isTouch() && h('div', { class: 'calendar-tooltip-action' },
            h('button', {
                type: 'button', class: 'calendar-tooltip-btn',
                onclick: (event) => { event.stopPropagation(); hideTooltip(); emit('events:focus', { iso }); }
            }, "Voir l'événement ", icon('arrow')))
    );
    document.body.append(tooltip);
    target.setAttribute('aria-describedby', 'calendarTooltip');
    tooltipFor = iso;

    const rect = target.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    let left = rect.left + window.scrollX + rect.width / 2 - width / 2;
    left = Math.min(Math.max(left, window.scrollX + 8), window.scrollX + document.documentElement.clientWidth - width - 8);
    let top = rect.top + window.scrollY - height - 10;
    if (top < window.scrollY + 8) top = rect.bottom + window.scrollY + 10;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function render() {
    const grid = $('#calendarDaysGrid');
    $('#calendarMonthYear').textContent = `${MONTHS[view.month]} ${view.year}`;
    hideTooltip();

    const firstDay = (new Date(view.year, view.month, 1).getDay() + 6) % 7; /* lundi = 0 */
    const totalDays = new Date(view.year, view.month + 1, 0).getDate();
    const today = parisParts();
    const events = getEvents();
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(h('div', { class: 'cal-empty' }));

    for (let day = 1; day <= totalDays; day++) {
        const iso = `${view.year}-${String(view.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEvents = events.filter((e) => e.iso === iso);
        const isToday = today.year === view.year && today.month === view.month + 1 && today.day === day;

        if (dayEvents.length === 0) {
            cells.push(h('div', { class: `cal-day${isToday ? ' is-today' : ''}` }, h('span', {}, day)));
            continue;
        }

        const label = `${day} ${MONTHS[view.month].toLowerCase()} : ${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}`;
        const button = h('button', { type: 'button', class: `cal-day has-event${isToday ? ' is-today' : ''}`, 'aria-label': label },
            h('span', {}, day), h('span', { class: 'cal-dot', 'aria-hidden': 'true' }));

        button.addEventListener('mouseenter', () => { if (!isTouch()) showTooltip(button, dayEvents, iso); });
        button.addEventListener('mouseleave', () => { if (!isTouch()) hideTooltip(); });
        button.addEventListener('focus', () => { if (!isTouch()) showTooltip(button, dayEvents, iso); });
        button.addEventListener('blur', () => { if (!isTouch()) hideTooltip(); });
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            if (isTouch() && tooltipFor !== iso) { showTooltip(button, dayEvents, iso); return; }
            hideTooltip();
            emit('events:focus', { iso });
            if (window.matchMedia('(max-width: 850px)').matches) closeMobileCalendar();
        });
        cells.push(button);
    }
    grid.replaceChildren(...cells);
}

function changeMonth(direction) {
    /* Calcul explicite (et non setMonth sur une date) : évite de sauter un mois le 29, 30 ou 31 */
    const index = view.year * 12 + view.month + direction;
    view.year = Math.floor(index / 12);
    view.month = index % 12;
    render();
}

function closeMobileCalendar() {
    $('#calendarCard').classList.remove('is-open');
    $('#calendarToggle').setAttribute('aria-expanded', 'false');
}

export function initCalendar() {
    const now = parisParts();
    view.year = now.year;
    view.month = now.month - 1;

    $('#calendarPrev').addEventListener('click', () => changeMonth(-1));
    $('#calendarNext').addEventListener('click', () => changeMonth(1));
    $('#calendarToggle').addEventListener('click', () => {
        const open = $('#calendarCard').classList.toggle('is-open');
        $('#calendarToggle').setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', (event) => {
        if (tooltip && !event.target.closest('.cal-day') && !event.target.closest('.calendar-custom-tooltip')) hideTooltip();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTooltip(); });
    window.addEventListener('scroll', hideTooltip, { passive: true });

    on('events:updated', render);
    render();
}
