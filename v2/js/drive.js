/* =================================================================
   ACCÈS À GOOGLE DRIVE (API v3, dossiers publics en lecture)
   ================================================================ */
import { CONFIG } from './config.js';
import { fetchWithTimeout } from './utils.js';

const API = 'https://www.googleapis.com/drive/v3/files';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

export const isDriveConfigured = () => Boolean(CONFIG.DRIVE.API_KEY);
const cleanId = (id) => String(id).replace(/[^\w-]/g, '');

/* Liste les fichiers correspondant à une requête, en suivant la pagination. */
export async function listFiles({ query, fields, orderBy, pageSize = 1000, maxPages = 5 }) {
    const files = [];
    let pageToken = '';
    for (let page = 0; page < maxPages; page++) {
        const params = new URLSearchParams({
            q: query, key: CONFIG.DRIVE.API_KEY, pageSize: String(pageSize),
            fields: `nextPageToken,files(${fields})`
        });
        if (orderBy) params.set('orderBy', orderBy);
        if (pageToken) params.set('pageToken', pageToken);
        const response = await fetchWithTimeout(`${API}?${params}`);
        if (!response.ok) throw new Error(`Google Drive : erreur ${response.status}`);
        const data = await response.json();
        files.push(...(data.files ?? []));
        pageToken = data.nextPageToken;
        if (!pageToken) break;
    }
    return files;
}

export const childrenQuery = (folderId, extra = '') =>
    `'${cleanId(folderId)}' in parents and trashed = false${extra ? ' and ' + extra : ''}`;

/* Images hébergées par Google (miniatures et plein format) */
export const imageUrl = (id, size = '') => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}${size ? '=w' + size : ''}`;
export const thumbSize = () => (window.innerWidth <= 768 ? 200 : 400);
export const thumbUrl = (id) => imageUrl(id, `${thumbSize()}-h${thumbSize()}-c`);
export const fileViewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=sharing`;
