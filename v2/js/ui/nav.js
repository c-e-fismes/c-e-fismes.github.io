/* =================================================================
   NAVIGATION ENTRE SECTIONS
   - liens partageables (#agenda), bouton Retour du navigateur,
     menu mobile, liens avec ancre (data-goto="rejoindre#planning"),
     chargement différé des sections (événement "section:show").
   ================================================================ */
import { $, $$, emit, on, prefersReducedMotion } from '../core/utils.js';
import { updateSeo } from './seo.js';

const visited = new Set();
/* Anciennes adresses (version 1 du site) : redirigées vers les nouvelles rubriques */
const LEGACY = { club: 'accueil', decouvrir: 'rejoindre', evenements: 'agenda', resultats: 'adherents', vie: 'leclub' };

const closeMenu = () => {
    $('#mainNav')?.classList.remove('is-open');
    $('#menuToggle')?.setAttribute('aria-expanded', 'false');
};

export function showSection(id, { updateHash = true, focus = true } = {}) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('section')) return false;

    $$('.section').forEach((section) => section.classList.toggle('active', section === target));
    $$('#mainNav [data-section]').forEach((lien) => {
        const active = lien.dataset.section === id;
        lien.classList.toggle('active', active);
        if (active) lien.setAttribute('aria-current', 'page'); else lien.removeAttribute('aria-current');
    });
    updateSeo(id);
    closeMenu();

    if (updateHash && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);

    /* Si la barre du haut est "collée", remonter au début du contenu. */
    const bar = $('.topbar');
    const top = $('.container').getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 8;
    if (window.scrollY > top) window.scrollTo({ top: Math.max(top, 0), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    if (focus) target.focus({ preventScroll: true });

    const first = !visited.has(id);
    visited.add(id);
    emit('section:show', { id, first });
    return true;
}

/* Exécute une fonction à la première ouverture d'une section (chargement différé). */
export function onFirstShow(id, callback) {
    on('section:show', (event) => {
        if (event.detail.id === id && event.detail.first) callback();
    });
}

export function initNav() {
    const toggle = $('#menuToggle');
    toggle?.addEventListener('click', () => {
        const open = $('#mainNav').classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });
    document.addEventListener('click', (event) => { if (!event.target.closest('.topbar')) closeMenu(); });

    document.addEventListener('click', (event) => {
        const navButton = event.target.closest('#mainNav [data-section]');
        if (navButton) { event.preventDefault(); showSection(navButton.dataset.section); return; }
        const link = event.target.closest('[data-goto]');
        if (link) {
            event.preventDefault();
            const [id, anchor] = link.dataset.goto.split('#');
            showSection(id);
            if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }));
        }
    });

    /* Une ancre peut viser une sous-partie (#planning, #galerie) : on ouvre
       alors la rubrique parent avant de faire défiler jusqu'à l'ancre. */
    const fromHash = () => {
        let raw = '';
        try { raw = decodeURIComponent(location.hash.slice(1)); }
        catch { raw = location.hash.slice(1); }
        const cible = LEGACY[raw] ?? raw;
        if (!cible) return false;
        const element = document.getElementById(cible);
        if (!element) return false;
        const section = element.classList.contains('section') ? element : element.closest('.section');
        if (!section) return false;
        const ouvert = showSection(section.id, { updateHash: false, focus: false });
        if (ouvert && element !== section) {
            requestAnimationFrame(() => element.scrollIntoView({
                behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start'
            }));
        }
        return ouvert;
    };
    window.addEventListener('popstate', () => { if (!fromHash()) showSection('accueil', { updateHash: false, focus: false }); });
    window.addEventListener('hashchange', fromHash);

    if (fromHash()) {
        /* Lien direct (#agenda...) : le navigateur fait défiler jusqu'à la section ; on revient en haut de page */
        const toTop = () => window.scrollTo(0, 0);
        toTop();
        window.addEventListener('load', () => setTimeout(toTop, 0), { once: true });
    } else {
        showSection('accueil', { updateHash: false, focus: false });
    }
}
