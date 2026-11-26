/* =================================================================
   THÈME CLAIR / SOMBRE
   Le choix est appliqué avant l'affichage par init.js ; ce module
   synchronise simplement le bouton et mémorise les changements.
   ================================================================ */
import { $, safeStorage } from '../core/utils.js';

const COULEURS = { light: '#111827', dark: '#0B1220' };

function appliquer(theme) {
    document.documentElement.dataset.theme = theme;
    const bouton = $('#themeToggle');
    if (bouton) {
        const sombre = theme === 'dark';
        bouton.setAttribute('aria-pressed', String(sombre));
        bouton.setAttribute('aria-label', sombre ? 'Activer le thème clair' : 'Activer le thème sombre');
        bouton.title = sombre ? 'Activer le thème clair' : 'Activer le thème sombre';
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = COULEURS[theme] || COULEURS.light;
}

export function initTheme() {
    const bouton = $('#themeToggle');
    if (!bouton) return;
    appliquer(document.documentElement.dataset.theme || 'light');

    bouton.addEventListener('click', () => {
        const suivant = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        safeStorage.setItem('cce:theme', suivant);
        appliquer(suivant);
    });
}
