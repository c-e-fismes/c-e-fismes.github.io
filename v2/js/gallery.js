/* =================================================================
   GALERIE PHOTOS (Google Drive) : albums (sous-dossiers) + photos, pagination, visionneuse
   Chargée à la première ouverture de l'onglet "Vie du Club".
   ================================================================ */
import { CONFIG } from './config.js';
import { $, h, debounce, renderState, safeUrl } from './utils.js';
import { loadWithCache } from './cache.js';
import { isDriveConfigured, listFiles, childrenQuery, FOLDER_MIME, imageUrl, thumbUrl } from './drive.js';
import { openLightbox } from './lightbox.js';

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

async function fetchRoot() {
    const files = await listFiles({
        query: childrenQuery(CONFIG.DRIVE.PHOTOS_FOLDER, `(mimeType = '${FOLDER_MIME}' or mimeType contains 'image/')`),
        fields: 'id,name,mimeType', orderBy: 'folder,name'
    });
    const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
    const photos = files.filter((f) => f.mimeType.startsWith('image/')).map((f) => ({ type: 'photo', id: f.id, name: f.name }));
    const albums = await Promise.all(folders.map(async (folder) => {
        let coverId = '';
        try {
            const [first] = await listFiles({ query: childrenQuery(folder.id, "mimeType contains 'image/'"), fields: 'id', pageSize: 1, maxPages: 1 });
            coverId = first?.id ?? '';
        } catch { /* album sans couverture */ }
        return { type: 'album', id: folder.id, name: folder.name, coverId };
    }));
    return [...albums, ...photos];
}

async function fetchAlbum(id) {
    const files = await listFiles({ query: childrenQuery(id, "mimeType contains 'image/'"), fields: 'id,name', orderBy: 'name' });
    return files.map((f) => ({ type: 'photo', id: f.id, name: f.name }));
}

function buildItem(item, photoList) {
    if (item.type === 'album') {
        const button = h('button', { type: 'button', class: 'gallery-item album-card', 'aria-label': `Ouvrir l'album ${item.name}`, onclick: () => openAlbum(item.id, item.name) },
            h('h4', { class: 'album-name' }, item.name),
            h('span', { class: 'album-open' }, "Ouvrir l'album"));
        const cover = item.coverId ? safeUrl(thumbUrl(item.coverId), ['googleusercontent.com']) : '';
        if (cover) button.style.setProperty('--cover', `url("${cover}")`); else button.classList.add('no-cover');
        return button;
    }
    const index = photoList.findIndex((p) => p.id === item.id);
    const alt = item.name || "Photo du club d'échecs de Fismes";
    const img = h('img', { src: thumbUrl(item.id), alt, loading: 'lazy', decoding: 'async' });
    const button = h('button', {
        type: 'button', class: 'gallery-item', 'aria-label': `Agrandir la photo : ${alt}`,
        onclick: () => openLightbox(photoList.map((p) => imageUrl(p.id, 1600)), index, photoList.map((p) => p.name || alt))
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
    if (!isDriveConfigured()) { renderState(grid(), 'Galerie Google Drive non configurée.', { error: true }); return; }
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
