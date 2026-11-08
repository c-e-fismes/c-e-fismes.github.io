/* =================================================================
   GAZETTES DU CAVALIER JAUNE (PDF sur Google Drive)
   Les 4 derniers numéros + fenêtre d'archives avec recherche.
   ================================================================ */
import { CONFIG } from './config.js';
import { $, h, icon, normalizeText, renderState } from './utils.js';
import { loadWithCache } from './cache.js';
import { isDriveConfigured, listFiles, childrenQuery, fileViewUrl } from './drive.js';
import { openModal } from './modal.js';

let gazettes = [];

async function fetchGazettes() {
    const files = await listFiles({ query: childrenQuery(CONFIG.DRIVE.GAZETTE_FOLDER, "mimeType = 'application/pdf'"), fields: 'id,name' });
    /* Tri "naturel" décroissant : le numéro 100 est bien après le 99 */
    return files.sort((a, b) => b.name.localeCompare(a.name, 'fr', { numeric: true, sensitivity: 'base' }));
}

const link = (file, className = '') =>
    h('a', { href: fileViewUrl(file.id), target: '_blank', rel: 'noopener noreferrer', class: className }, file.name);

function renderLatest() {
    const list = $('#gazetteList');
    if (gazettes.length === 0) { renderState(list, 'Aucune gazette pour le moment.'); $('#gazetteMore').hidden = true; return; }
    list.replaceChildren(...gazettes.slice(0, 4).map((file) => h('li', {}, icon('file'), ' ', link(file))));
    const more = $('#gazetteMore');
    more.hidden = gazettes.length <= 4;
    $('#gazetteMoreBtn').replaceChildren(icon('book'), ` Voir toutes les archives (${gazettes.length} numéros)`);
}

function renderModalList() {
    const needle = normalizeText($('#gazetteSearchInput').value);
    const matches = needle ? gazettes.filter((f) => normalizeText(f.name).includes(needle)) : gazettes;
    const list = $('#gazetteModalList');
    if (matches.length === 0) { renderState(list, 'Aucun numéro ne correspond à votre recherche.'); return; }
    list.replaceChildren(...matches.map((file) => h('li', { class: 'modal-list-item' }, link(file, 'modal-list-link'))));
}

export async function loadGazettes({ force = false } = {}) {
    if (!isDriveConfigured()) { renderState($('#gazetteList'), 'Dossier Drive non configuré.'); return; }
    await loadWithCache('gazettes', fetchGazettes, {
        force,
        onData: (data) => { gazettes = data; renderLatest(); },
        onError: () => renderState($('#gazetteList'), 'Erreur de chargement.', { error: true, retry: () => loadGazettes({ force: true }) })
    });
}

export function initGazettes() {
    $('#gazetteMoreBtn').addEventListener('click', () => {
        $('#gazetteSearchInput').value = '';
        renderModalList();
        openModal('gazetteModal');
    });
    $('#gazetteSearchInput').addEventListener('input', renderModalList);
    loadGazettes();
}
