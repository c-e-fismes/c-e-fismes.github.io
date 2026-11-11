/* =================================================================
   ACCUEIL : prochains événements, prochaine séance, chiffres animés, extrait de la galerie
   ================================================================ */
import { CONFIG } from './config.js';
import { $, $$, h, icon, on, emit, prefersReducedMotion } from './utils.js';
import { loadWithCache } from './cache.js';
import { getEvents, getEventsStatus, eventStatus, getPosterThumb } from './events.js';
import { getSessionTriplet, isVacationMode } from './planning.js';
import { showSection } from './nav.js';
import { isDriveConfigured, listFiles, childrenQuery, imageUrl, thumbUrl, fileViewUrl } from './drive.js';
import { openLightbox } from './lightbox.js';

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
            class: 'he-card', href: '#agenda', 'aria-label': `${e.titre}, le ${e.rawDate} : voir dans l'agenda`,
            onclick: (event) => { event.preventDefault(); showSection('agenda'); setTimeout(() => emit('events:focus', { iso: e.iso }), 150); }
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
    const tag = { prev: 'Précédente', live: 'En direct', next: 'Prochaine séance', after: 'Ensuite' }[kind];
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
    if (isVacationMode()) {
        box.replaceChildren(h('p', { class: 'state-message' }, 'Séances suspendues pendant les vacances scolaires.'));
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
        h('li', {}, h('a', { class: 'gz-row', href: fileViewUrl(file.id), target: '_blank', rel: 'noopener noreferrer' },
            h('span', { class: 'gz-icon' }, icon('file')),
            h('span', { class: 'gz-body' },
                h('strong', {}, file.name.replace(/\.pdf$/i, ''), index === 0 && recent && h('span', { class: 'badge badge--new' }, 'Nouveau')),
                file.created && h('span', {}, `ajoutée le ${longDate.format(file.created)}`)),
            icon('external'))))));
}

async function loadGazettes() {
    if (!$('#homeGazettes')) return;
    if (!isDriveConfigured()) { $('#homeGazettesBlock')?.setAttribute('hidden', ''); return; }
    await loadWithCache('home-gazettes', async () => {
        const files = await listFiles({
            query: childrenQuery(CONFIG.DRIVE.GAZETTE_FOLDER, "mimeType = 'application/pdf'"),
            fields: 'id,name,createdTime', orderBy: 'createdTime desc', pageSize: 3, maxPages: 1
        });
        return files.slice(0, 3).map((f) => ({ id: f.id, name: f.name, created: Date.parse(f.createdTime) || 0 }));
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
    const folder = CONFIG.DRIVE.HOME_PHOTOS_FOLDER || CONFIG.DRIVE.PHOTOS_FOLDER;
    if (!block || !isDriveConfigured() || !folder) return;
    await loadWithCache('home-photos', async () => {
        const files = await listFiles({
            query: childrenQuery(folder, "mimeType contains 'image/'"),
            fields: 'id,name,mimeType', orderBy: 'createdTime desc', pageSize: 8, maxPages: 1
        });
        return files.filter((f) => f.mimeType?.startsWith('image/')).slice(0, 4).map((f) => ({ id: f.id, name: f.name }));
    }, {
        onData: (photos) => {
            block.hidden = photos.length === 0;
            const full = photos.map((p) => imageUrl(p.id, 1600));
            const alts = photos.map((p) => p.name || "Photo du club d'échecs de Fismes");
            $('#homePhotos').replaceChildren(...photos.map((p, i) => {
                const button = h('button', { type: 'button', class: 'home-photo', 'aria-label': `Agrandir la photo : ${alts[i]}`, onclick: () => openLightbox(full, i, alts) },
                    h('img', { src: thumbUrl(p.id), alt: alts[i], loading: 'lazy', decoding: 'async' }));
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
