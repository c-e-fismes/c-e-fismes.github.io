/* =================================================================
   COMPTE À REBOURS DU PROCHAIN ÉVÉNEMENT (bandeau d'accueil)
   Visible seulement si : pas de vacances ET un événement à venir (ou chargement en cours).
   ================================================================ */
import { $, h, on } from './utils.js';
import { getEvents, getEventsStatus, eventStatus } from './events.js';
import { isVacationMode } from './planning.js';

export function updateCountdown() {
    const box = $('#countdownContainer');
    const timer = $('#countdownTimer');
    if (!box || !timer) return;

    const loading = getEventsStatus() === 'loading';
    const next = getEvents().find((e) => eventStatus(e) !== 'past');
    box.hidden = isVacationMode() || (!loading && !next);
    if (box.hidden || !next) return;

    const diff = next.start - Date.now();
    if (diff <= 0) {
        timer.textContent = `C'est aujourd'hui : ${next.titre} !`;
        return;
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    timer.replaceChildren(
        h('strong', {}, `${days}j ${hours}h ${minutes}m`),
        ' — ',
        h('a', { href: '#evenements', 'data-goto': 'evenements', class: 'countdown-link' }, next.titre)
    );
}

export function initCountdown() {
    on('events:updated', updateCountdown);
    on('planning:vacation', updateCountdown);
    updateCountdown();
}
