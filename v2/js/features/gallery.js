/* =================================================================
   GALERIE PHOTOS (Google Drive) : albums (sous-dossiers) + photos, pagination, visionneuse
   Chargée à la première ouverture de l'onglet "Vie du Club".
   ================================================================ */
import { $, h, debounce, renderState, safeUrl } from '../core/utils.js';
import { loadWithCache } from '../core/cache.js';
import { isProxyConfigured, listerPhotos, imageUrl, thumbUrl } from '../core/drive.js';
import { openLightbox } from '../ui/lightbox.js';

const grid = () => $('#dynamicGalleryGrid');
let rootItems = [];          /* albums puis photos de la racine */
let albumPhotos = [];
let currentAlbum = null;     /* { id, name } ou null (racine) */
let page = 1;

const activeList = () => (currentAlbum ? albumPhotos : rootItems);

/* Nombre de colonnes réellement affichées par la grille CSS (2 lignes par page) */
function columns() {
    const count = getComputedStyle(grid()).gridTemplateColumns.split(' ').filter(Boolean).length;
    return count > 0 ? count : 4;
}

/* Le service renvoie les photos avec le nom du sous-dossier dans "categorie" :
   on reconstruit les albums côté navigateur, sans interroger l'API Drive. */
async function fetchRoot() {
    const fichiers = await listerPhotos();
    const groupes = new Map();
    const racine = [];
    for (const fichier of fichiers) {
        if (!fichier.categorie) { racine.push(fichier); continue; }
        if (!groupes.has(fichier.categorie)) groupes.set(fichier.categorie, []);
        groupes.get(fichier.categorie).push(fichier);
    }
    const albums = [...groupes.entries()].map(([nom, photos]) => ({
        type: 'album', id: nom, name: nom, coverId: photos[0]?.id ?? ''
    }));
    const photos = racine.map((fichier) => ({ type: 'photo', id: fichier.id, name: fichier.name }));
    return [...albums, ...photos];
}

async function fetchAlbum(nom) {
    const fichiers = await listerPhotos();
    return fichiers
        .filter((fichier) => fichier.categorie === nom)
        .map((fichier) => ({ type: 'photo', id: fichier.id, name: fichier.name }));
}

function buildItem(item, photoList) {
    if (item.type === 'album') {
        const button = h('button', { type: 'button', class: 'gallery-item album-card', 'aria-label': `${item.name} Ouvrir l'album`, onclick: () => openAlbum(item.id, item.name) },
            h('h4', { class: 'album-name' }, item.name),
            h('span', { class: 'album-open' }, "Ouvrir l'album"));
        const cover = item.coverId ? safeUrl(thumbUrl(item.coverId), ['googleusercontent.com']) : '';
        if (cover) button.style.setProperty('--cover', `url("${cover}")`); else button.classList.add('no-cover');
        return button;
    }
    const index = photoList.findIndex((p) => p.id === item.id);
    const alt = item.name || "Photo du club d'échecs de Fismes";
    const vignette = safeUrl(thumbUrl(item.id), ['googleusercontent.com']);
    const img = h('img', { src: vignette || undefined, alt, loading: 'lazy', decoding: 'async' });
    const button = h('button', {
        type: 'button', class: 'gallery-item', 'aria-label': `Agrandir la photo : ${alt}`,
        onclick: () => openLightbox(
            photoList.map((p) => safeUrl(imageUrl(p.id, 1600), ['googleusercontent.com'])),
            index,
            photoList.map((p) => p.name || alt)
        )
    }, img);
    img.addEventListener('error', () => { button.hidden = true; });
    return button;
}

function renderPagination(total, perPage) {
    const box = $('#galleryPagination');
    const pages = Math.ceil(total / perPage);
    box.hidden = pages <= 1;
    if (pages <= 1) { box.replaceChildren(); return; }
    box.replaceChildren(
        h('button', { type: 'button', class: 'btn btn-small', disabled: page === 1, onclick: () => goToPage(page - 1) }, '← Précédent'),
        h('span', { class: 'gallery-page-info' }, `Page ${page} / ${pages}`),
        h('button', { type: 'button', class: 'btn btn-small', disabled: page === pages, onclick: () => goToPage(page + 1) }, 'Suivant →')
    );
}

function render() {
    const list = activeList();
    const perPage = columns() * 2;
    page = Math.min(Math.max(page, 1), Math.max(Math.ceil(list.length / perPage), 1));
    const photosOnly = list.filter((item) => item.type === 'photo');
    const start = (page - 1) * perPage;
    grid().replaceChildren(...list.slice(start, start + perPage).map((item) => buildItem(item, photosOnly)));
    renderPagination(list.length, perPage);
}

function goToPage(next) {
    page = next;
    render();
    $('#dynamicGalleryGrid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setBackBar(visible, title = '') {
    $('#galleryBack').hidden = !visible;
    $('#galleryAlbumTitle').textContent = title;
}

export async function loadGalleryRoot({ force = false } = {}) {
    currentAlbum = null;
    page = 1;
    setBackBar(false);
    if (!isProxyConfigured()) { renderState(grid(), 'Service de photos non configuré.', { error: true }); return; }
    if (rootItems.length === 0) renderState(grid(), 'Chargement de la galerie...');
    await loadWithCache('gallery:root', fetchRoot, {
        force,
        onData: (data) => {
            rootItems = data;
            if (currentAlbum) return;
            if (data.length === 0) renderState(grid(), 'Aucune photo dans le dossier pour le moment.');
            else render();
        },
        onError: () => renderState(grid(), 'Erreur lors du chargement de la galerie.', { error: true, retry: () => loadGalleryRoot({ force: true }) })
    });
}

async function openAlbum(id, name) {
    currentAlbum = { id, name };
    albumPhotos = [];
    page = 1;
    setBackBar(true, name);
    $('#galleryPagination').hidden = true;
    renderState(grid(), `Chargement de l'album "${name}"...`);
    await loadWithCache(`gallery:album:${id}`, () => fetchAlbum(id), {
        onData: (data) => {
            if (currentAlbum?.id !== id) return;
            albumPhotos = data;
            if (data.length === 0) renderState(grid(), 'Cet album est vide pour le moment.');
            else render();
        },
        onError: () => renderState(grid(), 'Erreur lors du chargement des photos.', { error: true, retry: () => openAlbum(id, name) })
    });
}

export function initGallery() {
    $('#backToAlbumsBtn').addEventListener('click', () => { currentAlbum = null; page = 1; setBackBar(false); rootItems.length ? render() : loadGalleryRoot(); });
    window.addEventListener('resize', debounce(() => {
        if ($('#leclub').classList.contains('active') && activeList().length > 0) render();
    }, 250));
    loadGalleryRoot();
}
