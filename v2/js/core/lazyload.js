/* =================================================================
   LAZY LOADING DES IMAGES DYNAMIQUES
   ------------------------------------------------
   Les images de la page utilisent déjà l'attribut natif loading="lazy".
   Ce module complète le dispositif pour les images créées par le JS
   (galerie, gazettes, etc.) qui utilisent un attribut data-src.
   ================================================================ */
import { $$, safeUrl } from './utils.js';

export function initLazyLoad() {
    const images = $$('img[data-src]:not([src])');
    if (!images.length) return;

    const reveal = (img) => {
        const url = safeUrl(img.dataset.src, null, { allowRelative: true });
        if (url) img.src = url;
        img.removeAttribute('data-src');
    };

    /* Sans IntersectionObserver, on charge directement (compatibilité anciens navigateurs). */
    if (!('IntersectionObserver' in window)) {
        images.forEach(reveal);
        return;
    }

    images.forEach((img) => { if (!img.hasAttribute('loading')) img.loading = 'lazy'; });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            reveal(entry.target);
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '200px 0px', threshold: 0 });

    images.forEach((img) => observer.observe(img));
}
