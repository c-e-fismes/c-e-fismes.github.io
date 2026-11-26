/* =================================================================
   DOCUMENTS DU CLUB (Google Drive via le service Apps Script)
   Chaque sous-dossier du Drive correspond à une catégorie.
   Recherche, catégories, saisons (sept. -> août), tri par date, "Nouveau", pagination.
   ================================================================ */
import { $, h, icon, normalizeText, formatBytes, safeUrl, renderState } from '../core/utils.js';
import { loadWithCache } from '../core/cache.js';
import { isProxyConfigured, listerDocuments, fileViewUrl } from '../core/drive.js';

const PAGE_SIZE = 15;
const NEW_DAYS = 30;

let docs = [];
let filters = { category: 'all', season: 'all', query: '' };
let shown = PAGE_SIZE;

/* "01 - Administratif" -> "Administratif" (le préfixe numérique permet d'ordonner les catégories) */
const categoryName = (folderName) => folderName.replace(/^\s*\d+\s*[-_.)]\s*/, '').trim() || folderName;

function seasonOf(timestamp) {
    const date = new Date(timestamp);
    const start = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1; /* septembre = mois 8 */
    return `${start}-${start + 1}`;
}

const TYPES = [
    [/pdf/, 'PDF'], [/word|document|\.docx?$/, 'Word'], [/sheet|excel|spreadsheet|\.xlsx?$|csv/, 'Tableur'],
    [/presentation|powerpoint|\.pptx?$/, 'Diaporama'], [/^image\//, 'Image'], [/zip|compressed/, 'Archive']
];
function typeOf(file) {
    const key = `${file.mimeType} ${file.name.toLowerCase()}`;
    for (const [pattern, label] of TYPES) if (pattern.test(key)) return label;
    return 'Fichier';
}

function toDoc(file, category) {
    const typeLabel = typeOf(file);
    const modified = Date.parse(file.modifiedTime) || 0;
    return {
        id: file.id,
        title: file.name.replace(/\.[A-Za-z0-9]{2,5}$/, ''),
        category, typeLabel, modified,
        season: modified ? seasonOf(modified) : '',
        size: formatBytes(file.size),
        view: safeUrl(file.webViewLink, ['google.com']) || fileViewUrl(file.id),
        download: safeUrl(file.webContentLink, ['google.com'])
    };
}

async function fetchDocuments() {
    const fichiers = await listerDocuments();
    const racine = fichiers.filter((fichier) => !fichier.categorie).map((fichier) => toDoc(fichier, 'Général'));
    const groupes = new Map();
    for (const fichier of fichiers) {
        if (!fichier.categorie) continue;
        const categorie = categoryName(fichier.categorie);
        if (!groupes.has(categorie)) groupes.set(categorie, []);
        groupes.get(categorie).push(fichier);
    }
    const categories = [...(racine.length ? ['Général'] : []), ...groupes.keys()];
    const docs = [...racine, ...[...groupes.entries()].flatMap(([categorie, liste]) => liste.map((fichier) => toDoc(fichier, categorie)))];
    return { docs, categories };
}

let categories = [];

function filtered() {
    const needle = normalizeText(filters.query);
    return docs
        .filter((d) => (filters.category === 'all' || d.category === filters.category)
            && (filters.season === 'all' || d.season === filters.season)
            && (!needle || normalizeText(`${d.title} ${d.category}`).includes(needle)))
        .sort((a, b) => b.modified - a.modified);
}

function renderChips() {
    const chip = (value, label) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(filters.category === value),
        onclick: () => { filters.category = value; shown = PAGE_SIZE; render(); }
    }, label);
    $('#docChips').replaceChildren(
        chip('all', `Tous (${docs.length})`),
        ...categories.map((name) => chip(name, `${name} (${docs.filter((d) => d.category === name).length})`))
    );
}

function renderSeasons() {
    const select = $('#docSeason');
    const seasons = [...new Set(docs.map((d) => d.season).filter(Boolean))].sort().reverse();
    select.hidden = seasons.length < 2;
    select.replaceChildren(h('option', { value: 'all' }, 'Toutes les saisons'), ...seasons.map((s) => h('option', { value: s }, `Saison ${s}`)));
    select.value = filters.season;
}

function buildRow(doc) {
    const isNew = Date.now() - doc.modified < NEW_DAYS * 86400000;
    const date = doc.modified ? new Date(doc.modified).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const meta = [doc.category, doc.typeLabel + (doc.size ? ` · ${doc.size}` : ''), date].filter(Boolean).join(' • ');
    return h('li', { class: 'doc-item' },
        h('span', { class: 'doc-icon', 'aria-hidden': 'true' }, icon('file')),
        h('div', { class: 'doc-main' },
            h('a', { href: doc.view, target: '_blank', rel: 'noopener noreferrer', class: 'doc-title' }, doc.title, isNew && h('span', { class: 'badge badge--new' }, 'Nouveau')),
            h('span', { class: 'doc-meta' }, meta)),
        h('div', { class: 'doc-actions' },
            h('a', { href: doc.view, target: '_blank', rel: 'noopener noreferrer', class: 'btn btn-small', 'aria-label': `Ouvrir ${doc.title}` }, 'Ouvrir'),
            doc.download && h('a', { href: doc.download, class: 'btn btn-small btn-dark', 'aria-label': `Télécharger ${doc.title}`, rel: 'noopener noreferrer' }, 'Télécharger'))
    );
}

function render() {
    const list = filtered();
    renderChips();
    $('#docCount').textContent = `${list.length} document${list.length > 1 ? 's' : ''}`;
    if (list.length === 0) renderState($('#docList'), docs.length ? 'Aucun document ne correspond à votre recherche.' : 'Aucun document pour le moment.');
    else $('#docList').replaceChildren(...list.slice(0, shown).map(buildRow));
    const more = $('#docMore');
    more.hidden = list.length <= shown;
    more.textContent = `Afficher plus de documents (${list.length - shown} restants)`;
}

function reveal() {
    $('#documentsStatic').hidden = true;
    $('#documentsApp').hidden = false;
    $('#documentsCard').classList.add('is-rich');
}

export async function loadDocuments({ force = false } = {}) {
    await loadWithCache('documents', fetchDocuments, {
        force,
        onData: (data) => { docs = data.docs; categories = data.categories; reveal(); renderSeasons(); render(); },
        onError: () => { reveal(); renderState($('#docList'), 'Impossible de charger les documents pour le moment.', { error: true, retry: () => loadDocuments({ force: true }) }); }
    });
}

export function initDocuments() {
    if (!isProxyConfigured()) return; /* liste d'exemple du HTML conservée */
    $('#docSearch').addEventListener('input', (e) => { filters.query = e.target.value; shown = PAGE_SIZE; render(); });
    $('#docSeason').addEventListener('change', (e) => { filters.season = e.target.value; shown = PAGE_SIZE; render(); });
    $('#docMore').addEventListener('click', () => { shown += PAGE_SIZE; render(); });
    loadDocuments();
}
