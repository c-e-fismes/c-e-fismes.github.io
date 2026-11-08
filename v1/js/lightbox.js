/* =================================================================
   VISIONNEUSE D'IMAGES (affiches, photos) : flèches, clavier, balayage tactile
   ================================================================ */
import { $ } from './utils.js';
import { openModal, closeModal, topModal } from './modal.js';

let urls = [];
let index = 0;
let alts = [];

const box = () => document.getElementById('lightbox');
const image = () => document.getElementById('lightboxImg');

function show() {
    const img = image();
    img.src = urls[index];
    img.alt = alts[index] || '';
    const multiple = urls.length > 1;
    $('#lightboxPrev').hidden = !multiple;
    $('#lightboxNext').hidden = !multiple;
}

export function openLightbox(list, startIndex = 0, altList = []) {
    urls = Array.isArray(list) ? list : [list];
    alts = altList;
    index = Math.min(Math.max(startIndex, 0), urls.length - 1);
    if (urls.length === 0) return;
    show();
    openModal('lightbox');
}

export function changeLightboxImage(direction) {
    if (urls.length <= 1) return;
    index = (index + direction + urls.length) % urls.length;
    show();
}

export function initLightbox() {
    $('#lightboxPrev').addEventListener('click', () => changeLightboxImage(-1));
    $('#lightboxNext').addEventListener('click', () => changeLightboxImage(1));

    /* Zoom des images fixes du HTML (ex. polo) */
    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-zoom]');
        if (trigger) openLightbox([trigger.dataset.zoom], 0, [trigger.dataset.zoomAlt || '']);
    });

    document.addEventListener('keydown', (event) => {
        if (topModal() !== box()) return;
        if (event.key === 'ArrowLeft') changeLightboxImage(-1);
        if (event.key === 'ArrowRight') changeLightboxImage(1);
    });

    /* Balayage horizontal au doigt */
    let startX = null;
    const container = box().querySelector('.lightbox-container');
    container.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') startX = e.clientX; });
    container.addEventListener('pointerup', (e) => {
        if (startX === null) return;
        const dx = e.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 50) changeLightboxImage(dx < 0 ? 1 : -1);
    });

    /* Libère l'image une fois la fenêtre fermée */
    document.addEventListener('modal:close', (e) => {
        if (e.detail.id !== 'lightbox') return;
        setTimeout(() => { if (!box().classList.contains('active')) image().removeAttribute('src'); }, 300);
    });
}

export { closeModal };
