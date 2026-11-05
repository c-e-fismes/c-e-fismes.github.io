/* =================================================================
   NAVIGATION ENTRE SECTIONS
   - liens partageables (#evenements), bouton Retour du navigateur,
     chargement différé des sections (événement "section:show").
   ================================================================ */
import { $, $$, emit, on, prefersReducedMotion } from './utils.js';

const visited = new Set();

export function showSection(id, { updateHash = true, focus = true } = {}) {
    const target = document.getElementById(id);
    if (!target || !target.classList.contains('section')) return false;

    $$('.section').forEach((section) => section.classList.toggle('active', section === target));
    $$('nav button').forEach((button) => {
        const active = button.dataset.section === id;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });

    if (updateHash && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);

    /* Si la barre de navigation est "collée" en haut, remonter au début du contenu. */
    const nav = $('nav');
    const container = $('.container');
    const top = container.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 8;
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
    document.addEventListener('click', (event) => {
        const navButton = event.target.closest('nav [data-section]');
        if (navButton) { showSection(navButton.dataset.section); return; }
        const link = event.target.closest('[data-goto]');
        if (link) { event.preventDefault(); showSection(link.dataset.goto); }
    });

    const fromHash = () => {
        const id = location.hash.slice(1);
        return id && showSection(id, { updateHash: false, focus: false });
    };
    window.addEventListener('popstate', () => { if (!fromHash()) showSection('club', { updateHash: false, focus: false }); });
    window.addEventListener('hashchange', fromHash);

    if (fromHash()) {
        /* Lien direct (#evenements...) : le navigateur fait défiler jusqu'à la section ; on revient en haut de page */
        const toTop = () => window.scrollTo(0, 0);
        toTop();
        window.addEventListener('load', () => setTimeout(toTop, 0), { once: true });
    } else {
        showSection('club', { updateHash: false, focus: false });
    }
}
