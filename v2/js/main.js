/* =================================================================
   POINT D'ENTRÉE : initialisation des modules
   Chargement immédiat : onglet "Le Club" (planning, défi, statistiques, prochain événement).
   Chargement différé  : galerie, gazettes et documents (à la 1re ouverture de "Vie du Club").
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$ } from './utils.js';
import { cache } from './cache.js';
import { initModals } from './modal.js';
import { initLightbox } from './lightbox.js';
import { initNav, onFirstShow } from './nav.js';
import { loadPlanning, updatePlanningStatus } from './planning.js';
import { initEvents, loadEvents, render as renderEvents } from './events.js';
import { initCalendar } from './calendar.js';
import { initCountdown, updateCountdown } from './countdown.js';
import { initMembers, loadMembers } from './members.js';
import { initPuzzle } from './puzzle.js';
import { initGallery } from './gallery.js';
import { initGazettes } from './gazettes.js';
import { initDocuments } from './documents.js';
import { initContact } from './contact.js';
import { initHome } from './home.js';

/* Images : repli (data-fallback) ou masquage (data-hide-on-error) en cas d'erreur de chargement */
function initImageFallbacks() {
    $$('img[data-fallback], img[data-hide-on-error]').forEach((img) => {
        const onError = () => {
            if (img.dataset.fallback && !img.dataset.fallbackDone) {
                img.dataset.fallbackDone = '1';
                img.src = img.dataset.fallback;
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
    });
    update();
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service Worker non enregistré :', error));
    }
}

function boot() {
    cache.purgeObsolete();
    $('#currentYear').textContent = new Date().getFullYear();

    initModals();
    initLightbox();
    initImageFallbacks();
    initNetworkStatus();
    initContact();

    /* Sections à chargement différé : à enregistrer AVANT initNav (qui peut ouvrir directement #leclub) */
    onFirstShow('leclub', () => { initGallery(); initGazettes(); });
    onFirstShow('adherents', initDocuments);

    initNav();
    loadPlanning();
    initEvents();
    initCalendar();
    initCountdown();
    initHome();
    initMembers();
    initPuzzle();

    /* Un seul minuteur : statuts "en direct", compte à rebours, badges des événements */
    setInterval(() => {
        updatePlanningStatus();
        updateCountdown();
        renderEvents();
    }, CONFIG.TICK_MS);

    registerServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
