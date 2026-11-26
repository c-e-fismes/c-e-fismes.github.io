/* =================================================================
   ACCÈS AUX FICHIERS GOOGLE DRIVE VIA LE SERVICE APPS SCRIPT
   Le navigateur ne contient aucune clé API : il appelle uniquement
   l'URL publique /exec, en lecture seule, au format JSONP.
   ================================================================ */
import { CONFIG } from './config.js';
import { fetchJsonp } from './utils.js';

export const isProxyConfigured = () => Boolean(CONFIG.API_PROXY_URL);

/* Appelle une action autorisée du service et normalise les fichiers reçus. */
async function charger(action) {
    if (!isProxyConfigured()) throw new Error('Service de fichiers non configuré');
    const reponse = await fetchJsonp(CONFIG.API_PROXY_URL, { params: { action } });
    if (!reponse || reponse.ok !== true || !Array.isArray(reponse.fichiers)) {
        throw new Error(reponse?.erreur || 'Réponse du service invalide');
    }
    return reponse.fichiers.map((fichier) => ({
        id: String(fichier.id ?? ''),
        name: String(fichier.nom ?? fichier.name ?? ''),
        mimeType: String(fichier.mimeType ?? ''),
        categorie: String(fichier.categorie ?? ''),
        createdTime: String(fichier.createdTime ?? ''),
        modifiedTime: String(fichier.modifiedTime ?? ''),
        size: String(fichier.size ?? ''),
        webViewLink: String(fichier.webViewLink ?? ''),
        webContentLink: String(fichier.webContentLink ?? '')
    }));
}

/* Une action par usage : le service ne connaît que ces clés logiques. */
export const listerPhotos = () => charger('photos');
export const listerPhotosAccueil = () => charger('accueil');
export const listerAffiches = () => charger('affiches');
export const listerGazettes = () => charger('gazettes');
export const listerDocuments = () => charger('documents');

/* Constructions d'URL uniquement : aucun appel réseau ici. */
export const imageUrl = (id, size = '') => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}${size ? '=w' + size : ''}`;
export const thumbSize = () => (window.innerWidth <= 768 ? 200 : 400);
export const thumbUrl = (id) => imageUrl(id, `${thumbSize()}-h${thumbSize()}-c`);
export const fileViewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=sharing`;
