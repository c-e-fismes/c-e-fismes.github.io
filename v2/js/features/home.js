/* =================================================================
   ACCUEIL : prochains événements, prochaine séance, chiffres animés, extrait de la galerie
   ================================================================ */
import { CONFIG } from '../core/config.js';
import { $, $$, h, icon, on, emit, prefersReducedMotion, safeUrl } from '../core/utils.js';
import { loadWithCache } from '../core/cache.js';
import { getEvents, getEventsStatus, eventStatus, getPosterThumb } from './events.js';
import { getSessionTriplet, isVacationMode } from './planning.js';
import { showSection } from '../ui/nav.js';
import { isProxyConfigured, listerGazettes, listerPhotosAccueil, imageUrl, thumbUrl, fileViewUrl } from '../core/drive.js';
import { openLightbox } from '../ui/lightbox.js';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/* ----- Prochains événements (3 cartes) ----- */
function renderEvents() {
    const box = $('#homeEvents');
    if (!box) return;
    if (getEventsStatus() === 'error') { box.replaceChildren(h('p', { class: 'state-message is-error' }, 'Impossible de charger les événements pour le moment.')); return; }
    const upcoming = getEvents().filter((e) => eventStatus(e) !== 'past').slice(0, 3);
    if (upcoming.length === 0) {
        box.replaceChildren(h('p', { class: 'state-message' }, getEventsStatus() === 'loading' ? 'Chargement des événements...' : 'Aucun événement à venir pour le moment.'));
        return;
    }
    box.replaceChildren(...upcoming.map((e) => {
        const [, month, day] = e.iso.split('-');
        const thumb = getPosterThumb(e, 160);
        return h('a', {
            class: 'he-card', href: '#agenda',
            onclick: (event) => { event.preventDefault(); emit('events:skip-autoscroll'); showSection('agenda'); setTimeout(() => emit('events:focus', { iso: e.iso }), 150); }
        },
            h('div', { class: 'he-date' }, h('span', { class: 'he-day' }, String(+day)), h('span', { class: 'he-month' }, MONTHS[+month - 1])),
            h('div', { class: 'he-body' },
                eventStatus(e) === 'live' && h('span', { class: 'badge badge--live' }, 'En cours'),
                h('h3', {}, e.titre),
                h('div', { class: 'he-meta' },
                    h('span', {}, icon('clock'), ` ${e.rawTime}`),
                    h('span', {}, icon('pin'), ` ${e.lieu}`))),
            thumb && h('img', { class: 'he-poster', src: thumb, alt: '', loading: 'lazy', decoding: 'async' })
        );
    }));
}

/* ----- Séances : précédente, prochaine (ou en cours) et suivante ----- */
const dateFr = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, weekday: 'long', day: 'numeric', month: 'long' });
const dayFr = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, day: 'numeric' });
const monthFr = new Intl.DateTimeFormat('fr-FR', { timeZone: CONFIG.TIMEZONE, month: 'short' });
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function sessionRow(occurrence, kind) {
    const tag = { prev: 'Précédente', live: 'En direct', next: 'Prochaine séance', after: 'À venir' }[kind];
    const { item, start } = occurrence;
    return h('li', { class: `session-row session--${kind}`, 'data-start': String(start) },
        h('div', { class: 'he-date' }, h('span', { class: 'he-day' }, dayFr.format(start)), h('span', { class: 'he-month' }, monthFr.format(start).replace('.', ''))),
        h('div', { class: 'session-body' },
            h('strong', {}, capitalize(dateFr.format(start))),
            h('span', {}, icon('clock'), ` ${item.horaire}`),
            h('span', {}, icon('pin'), ` ${item.commune}${item.lieu ? ', ' + item.lieu : ''}`)),
        h('span', { class: `session-tag session-tag--${kind}` }, tag));
}

function renderSessions() {
    const box = $('#homeSessions');
    if (!box) return;
    const card = box.closest('.duo-card');
    card?.classList.toggle('is-vacation', isVacationMode());
    if (isVacationMode()) {
        box.replaceChildren(h('div', { class: 'vacation-home' },
            h('span', { class: 'vacation-home-icon' }, icon('sun')),
            h('strong', { class: 'vacation-home-title' }, 'Séances suspendues pendant les vacances scolaires'),
            h('p', {}, 'Profitez bien de cette pause ! Reprise des séances habituelles dès la rentrée.'),
            h('a', { href: '#rejoindre', 'data-goto': 'rejoindre#planning', class: 'block-link' }, 'Voir le planning ', icon('arrow'))));
        return;
    }
    const triplet = getSessionTriplet();
    if (!triplet) { box.replaceChildren(h('p', { class: 'state-message' }, 'Chargement du planning...')); return; }
    const { previous, current, after } = triplet;
    box.replaceChildren(h('ul', { class: 'session-list' },
        previous && sessionRow(previous, 'prev'),
        sessionRow(current, current.status === 'live' ? 'live' : 'next'),
        after && sessionRow(after, 'after')));
}

/* ----- Les 3 dernières gazettes (la plus récente porte "Nouveau" si elle date de moins de GAZETTE_NEW_DAYS jours) ----- */
const longDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function renderGazettes(files) {
    const box = $('#homeGazettes');
    if (!box) return;
    if (!files || files.length === 0) { box.replaceChildren(h('p', { class: 'state-message' }, 'Aucune gazette pour le moment.')); return; }
    const recent = files[0].created && (Date.now() - files[0].created) < CONFIG.GAZETTE_NEW_DAYS * 86400000;
    box.replaceChildren(h('ul', { class: 'gz-list' }, ...files.map((file, index) =>
        h('li', {}, h('a', { class: 'gz-row', href: safeUrl(fileViewUrl(file.id), ['google.com']), target: '_blank', rel: 'noopener noreferrer' },
            h('span', { class: 'gz-icon' }, icon('file')),
            h('span', { class: 'gz-body' },
                h('strong', {}, file.name.replace(/\.pdf$/i, ''), index === 0 && recent && h('span', { class: 'badge badge--new' }, 'Nouveau')),
                file.created && h('span', {}, `ajoutée le ${longDate.format(file.created)}`)),
            icon('external'))))));
}

async function loadGazettes() {
    if (!$('#homeGazettes')) return;
    if (!isProxyConfigured()) { $('#homeGazettesBlock')?.setAttribute('hidden', ''); return; }
    await loadWithCache('home-gazettes', async () => {
        const fichiers = await listerGazettes(); /* déjà triés du plus récent au plus ancien par le service */
        return fichiers.slice(0, 3).map((f) => ({ id: f.id, name: f.name, created: Date.parse(f.createdTime) || 0 }));
    }, {
        onData: renderGazettes,
        onError: () => $('#homeGazettes').replaceChildren(h('p', { class: 'state-message is-error' }, 'Impossible de charger les gazettes pour le moment.'))
    });
}

/* ----- Chiffres : compteurs animés à l'affichage ----- */
const counted = new Set();
function animate(el) {
    const match = el.textContent.trim().match(/^(\d+)(%?)$/);
    if (!match || prefersReducedMotion()) return;
    const target = +match[1];
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / 900, 1);
        el.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3))) + match[2];
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}
function initCounters() {
    const observer = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => entries.forEach((entry) => {
            if (entry.isIntersecting && !counted.has(entry.target.id)) { counted.add(entry.target.id); animate(entry.target); observer.unobserve(entry.target); }
        }), { threshold: 0.4 })
        : null;
    on('stats:updated', () => $$('.stat-tile .stat-num[id]').forEach((el) => { if (observer && !counted.has(el.id)) observer.observe(el); }));
}

/* ----- Extrait de la galerie (4 photos les plus récentes) ----- */
async function loadPhotos() {
    const block = $('#homePhotosBlock');
    if (!block || !isProxyConfigured()) return;
    await loadWithCache('home-photos', async () => {
        const fichiers = await listerPhotosAccueil();
        return fichiers
            .filter((fichier) => fichier.mimeType.startsWith('image/'))
            .sort((a, b) => Date.parse(b.createdTime || b.modifiedTime || 0) - Date.parse(a.createdTime || a.modifiedTime || 0))
            .slice(0, 4)
            .map((fichier) => ({ id: fichier.id, name: fichier.name }));
    }, {
        onData: (photos) => {
            block.hidden = photos.length === 0;
            const full = photos.map((p) => safeUrl(imageUrl(p.id, 1600), ['googleusercontent.com']));
            const alts = photos.map((p) => p.name || "Photo du club d'échecs de Fismes");
            $('#homePhotos').replaceChildren(...photos.map((p, i) => {
                const vignette = safeUrl(thumbUrl(p.id), ['googleusercontent.com']);
                const button = h('button', { type: 'button', class: 'home-photo', 'aria-label': `Agrandir la photo : ${alts[i]}`, onclick: () => openLightbox(full, i, alts) },
                    h('img', { src: vignette || undefined, alt: alts[i], loading: 'lazy', decoding: 'async' }));
                button.firstChild.addEventListener('error', () => { button.hidden = true; });
                return button;
            }));
        },
        onError: () => { block.hidden = true; }
    });
}

export const refreshHomeEvents = renderEvents;

export function initHome() {
    on('events:updated', renderEvents);
    on('planning:status', renderSessions);
    on('planning:vacation', renderSessions);
    renderEvents();
    renderSessions();
    initCounters();
    loadPhotos();
    loadGazettes();
}
