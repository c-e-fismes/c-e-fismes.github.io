/* =================================================================
   POINT D'ENTRÉE : initialisation des modules
   Chargement immédiat : onglet "Le Club" (planning, défi, statistiques, prochain événement).
   Chargement différé  : galerie, gazettes et documents (à la 1re ouverture de "Vie du Club").
   ================================================================ */
import { CONFIG } from './core/config.js';
import { $, $$, icon, on, safeUrl } from './core/utils.js';
import { cache } from './core/cache.js';
import { initModals } from './ui/modal.js';
import { initLightbox } from './ui/lightbox.js';
import { initNav, onFirstShow } from './ui/nav.js';
import { loadPlanning, updatePlanningStatus } from './features/planning.js';
import { initEvents, loadEvents, render as renderEvents } from './features/events.js';
import { initCalendar } from './features/calendar.js';
import { initMembers, loadMembers } from './features/members.js';
import { initPuzzle } from './features/puzzle.js';
import { initContact } from './features/contact.js';
import { initHome, refreshHomeEvents } from './features/home.js';
import { loadParametres } from './core/parametres.js';
import { initTheme } from './ui/theme.js';
import { initLazyLoad } from './core/lazyload.js';

/* Isole chaque module : une erreur locale ne bloque pas le reste du site. */
function safeInit(label, fn) {
    try {
        const result = fn();
        if (result && typeof result.catch === 'function') {
            result.catch((error) => console.warn(`Module ${label} indisponible :`, error));
        }
    } catch (error) {
        console.warn(`Module ${label} indisponible :`, error);
    }
}

/* ---- Calendrier en panneau latéral (drawer) sur petits écrans (option 2 retenue) ----
   L'habillage du tiroir est créé ici (HTML + CSS), sans toucher à calendar.js. */
function injectCalendarDrawerStyles() {
    if ($('#calendarDrawerStyles')) return;
    const style = document.createElement('style');
    style.id = 'calendarDrawerStyles';
    style.textContent = `
        .calendar-drawer-tab, .calendar-drawer-overlay, .calendar-drawer-close { display: none; }
        @media (max-width: 850px) {
            /* Sans cela, le transform laissé par l'animation de .section.active sert de repère
               au position:fixed du panneau (il suivrait alors le scroll de la page). */
            #agenda.section.active { animation: none; opacity: 1; transform: none; }
            .calendar-drawer-overlay { display: block; }
            .calendar-drawer-tab {
                position: fixed;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                z-index: 1400;
                display: none;
                align-items: center;
                gap: 0.35rem;
                padding: 0.75rem 0.4rem;
                border: 0;
                border-radius: 12px 0 0 12px;
                background: var(--accent);
                color: var(--on-accent);
                font: inherit;
                font-size: 0.85rem;
                font-weight: 700;
                box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
                cursor: pointer;
            }
            .calendar-drawer-tab.is-available { display: flex; }
            .calendar-drawer-tab .icon { width: 18px; height: 18px; }
            .calendar-drawer-tab .tab-label { writing-mode: vertical-rl; transform: rotate(180deg); }
            .calendar-drawer-tab:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }

            .calendar-drawer-overlay {
                position: fixed;
                inset: 0;
                z-index: 1500;
                background: rgba(15, 27, 51, 0.55);
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.25s ease, visibility 0s linear 0.25s;
            }
            .calendar-drawer-overlay.is-open { opacity: 1; visibility: visible; transition: opacity 0.25s ease, visibility 0s; }

            .calendar-card-sidebar.is-drawer {
                display: block;
                position: fixed;
                top: 50%;
                right: 0;
                z-index: 1600;
                width: min(360px, 88vw);
                max-width: 88vw;
                max-height: calc(100vh - 2rem);
                padding: 1rem;
                overflow-y: auto;
                border-top: 3px solid var(--accent);
                box-shadow: -8px 0 28px rgba(0, 0, 0, 0.3);
                transform: translate(102%, -50%);
                visibility: hidden;
                transition: transform 0.28s ease, visibility 0s linear 0.28s;
            }
            .calendar-card-sidebar.is-drawer.is-open {
                transform: translate(0, -50%); visibility: visible;
                transition: transform 0.28s ease, visibility 0s;
            }

            .calendar-drawer-close {
                position: sticky;
                top: 0;
                float: right;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 44px; height: 44px;
                margin: -0.6rem -0.6rem 0 0;
                background: none; border: 0; border-radius: 50%;
                color: var(--text); font-size: 1.6rem; line-height: 1; cursor: pointer;
            }
            .calendar-drawer-close:hover { background: var(--surface-2); }
            .calendar-drawer-close:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
            .calendar-card-sidebar .calendar-header { clear: both; }
            body.calendar-drawer-open { overflow: hidden; }
        }
    `;
    document.head.append(style);
}

function initCalendarDrawer() {
    const card = $('#calendarCard');
    if (!card || $('#calendarDrawerTab')) return;

    injectCalendarDrawerStyles();
    card.classList.add('is-drawer');
    card.tabIndex = -1; /* rend la carte focusable sans toucher au HTML */

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'calendar-drawer-close';
    closeButton.setAttribute('aria-label', 'Fermer le calendrier');
    closeButton.textContent = '×';
    card.prepend(closeButton);

    const overlay = document.createElement('div');
    overlay.id = 'calendarDrawerOverlay';
    overlay.className = 'calendar-drawer-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.append(overlay); /* hors de la section animée */

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'calendarDrawerTab';
    tab.className = 'calendar-drawer-tab';
    tab.setAttribute('aria-label', 'Ouvrir le calendrier');
    tab.setAttribute('aria-controls', 'calendarCard');
    tab.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = 'Calendrier';
    tab.append(icon('calendar'), label);
    document.body.append(tab);

    const isOpen = () => card.classList.contains('is-open');

    /* L'état est piloté par la classe "is-open" (onglet latéral, croix, voile, Échap,
       clic sur une date) : on synchronise l'habillage à chaque changement de classe. */
    const syncUi = () => {
        const open = isOpen();
        tab.setAttribute('aria-expanded', String(open));
        tab.setAttribute('aria-label', open ? 'Fermer le calendrier' : 'Ouvrir le calendrier');
        overlay.classList.toggle('is-open', open);
        document.body.classList.toggle('calendar-drawer-open', open);
    };
    new MutationObserver(syncUi).observe(card, { attributes: true, attributeFilter: ['class'] });

    let lastFocused = null;
    const setOpen = (open, { restoreFocus = false } = {}) => {
        if (open) lastFocused = document.activeElement;
        card.classList.toggle('is-open', open);
        syncUi();
        if (open) {
            card.focus({ preventScroll: true });
        } else if (restoreFocus && lastFocused?.isConnected) {
            lastFocused.focus({ preventScroll: true });
            lastFocused = null;
        }
    };

    tab.addEventListener('click', () => setOpen(!isOpen(), { restoreFocus: true }));
    closeButton.addEventListener('click', () => setOpen(false, { restoreFocus: true }));
    overlay.addEventListener('click', () => setOpen(false, { restoreFocus: true }));

    document.addEventListener('keydown', (event) => {
        if (!isOpen()) return;
        if (event.key === 'Escape') { setOpen(false, { restoreFocus: true }); return; }
        if (event.key !== 'Tab') return;
        const focusables = $$('button, [href], input, select, textarea', card)
            .filter((el) => !el.disabled && el.getClientRects().length);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    on('section:show', (event) => {
        const onAgenda = event.detail.id === 'agenda';
        tab.classList.toggle('is-available', onAgenda);
        if (!onAgenda && isOpen()) setOpen(false);
    });
    tab.classList.toggle('is-available', document.querySelector('.section.active')?.id === 'agenda');

    /* Clic sur une date OU bouton "Voir l'événement" de l'info-bulle : on referme le panneau
       (calendar.js ne le fait que pour le clic direct), puis on replace la carte sous la barre. */
    on('events:focus', (event) => {
        if (window.matchMedia('(max-width: 850px)').matches && isOpen()) setOpen(false);
        const reposition = () => {
            const target = $(`#eventsGrid .event-card[data-date="${event.detail.iso}"]`);
            if (!target) return;
            const barHeight = $('.topbar')?.getBoundingClientRect().height || 0;
            const top = window.scrollY + target.getBoundingClientRect().top - barHeight - 8;
            window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
        };
        requestAnimationFrame(() => {
            reposition();
            /* revealEvent() démarre un défilement "smooth" : une seconde correction l'annule. */
            setTimeout(reposition, 120);
        });
    });

    syncUi();
}

/* Images : repli (data-fallback) ou masquage (data-hide-on-error) en cas d'erreur de chargement */
function initImageFallbacks() {
    $$('img[data-fallback], img[data-hide-on-error]').forEach((img) => {
        const onError = () => {
            if (img.dataset.fallback && !img.dataset.fallbackDone) {
                img.dataset.fallbackDone = '1';
                const repli = safeUrl(img.dataset.fallback, null, { allowRelative: true });
                if (repli) img.src = repli;
            } else if (img.hasAttribute('data-hide-on-error')) {
                img.hidden = true;
            }
        };
        img.addEventListener('error', onError);
        if (img.complete && img.naturalWidth === 0) onError(); /* l'erreur est peut-être déjà survenue */
    });
}

function initNetworkStatus() {
    const banner = $('#netStatus');
    const update = () => { banner.hidden = navigator.onLine; };
    window.addEventListener('offline', update);
    window.addEventListener('online', () => {
        update();
        loadPlanning({ force: true });
        loadEvents({ force: true });
        loadMembers({ force: true });
        loadParametres({ force: true });
    });
    update();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service Worker non enregistré :', error));
    }
}

/* Chargement à la demande des modules lourds (galerie, gazettes, documents). */
function lazyModules() {
    onFirstShow('leclub', () => {
        safeInit('galerie', () => import('./features/gallery.js').then(({ initGallery }) => initGallery()));
        safeInit('gazettes', () => import('./features/gazettes.js').then(({ initGazettes }) => initGazettes()));
    });
    onFirstShow('adherents', () => {
        safeInit('documents', () => import('./features/documents.js').then(({ initDocuments }) => initDocuments()));
    });
}

function boot() {
    cache.purgeObsolete();
    $('#currentYear').textContent = new Date().getFullYear();

    safeInit('thème', initTheme);
    safeInit('modales', initModals);
    safeInit('lightbox', initLightbox);
    safeInit('images', initImageFallbacks);
    safeInit('lazyload', initLazyLoad);
    safeInit('réseau', initNetworkStatus);
    safeInit('contact', initContact);

    /* À enregistrer AVANT initNav (qui peut ouvrir directement #leclub). */
    lazyModules();

    initNav();
    safeInit('paramètres', () => loadParametres());
    safeInit('planning', () => loadPlanning());
    safeInit('événements', initEvents);
    safeInit('calendrier', initCalendar);
    safeInit('calendrier latéral', initCalendarDrawer);
    safeInit('accueil', initHome);
    safeInit('adhérents', initMembers);
    safeInit('puzzle', initPuzzle);

    /* Un seul minuteur : statuts "en direct", compte à rebours, badges des événements */
    setInterval(() => {
        updatePlanningStatus();
        renderEvents();
        refreshHomeEvents();
    }, CONFIG.TICK_MS);

    registerServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
