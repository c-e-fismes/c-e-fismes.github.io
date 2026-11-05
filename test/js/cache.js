/* =================================================================
   CACHE NAVIGATEUR (localStorage) AVEC REVALIDATION EN ARRIÈRE-PLAN
   - donnée récente  : utilisée telle quelle, pas de requête réseau
   - donnée ancienne : affichée immédiatement PUIS rafraîchie
   - réseau en panne : la donnée ancienne reste affichée (mode hors-ligne)
   ================================================================ */
import { CONFIG } from './config.js';
import { safeStorage } from './utils.js';

const PREFIX = 'cce:';

export const cache = {
    read(key) {
        const raw = safeStorage.getItem(PREFIX + key);
        if (!raw) return null;
        try {
            const entry = JSON.parse(raw);
            const age = Date.now() - entry.t;
            if (entry.v !== CONFIG.APP_VERSION || !(age >= 0) || age > CONFIG.CACHE_MAX_STALE_MS) return null;
            return { data: entry.d, age, fresh: age < CONFIG.CACHE_FRESH_MS };
        } catch { return null; }
    },
    write(key, data) {
        safeStorage.setItem(PREFIX + key, JSON.stringify({ v: CONFIG.APP_VERSION, t: Date.now(), d: data }));
    },
    /* Supprime les entrées d'anciennes versions du site (ancien format "cache_*" inclus). */
    purgeObsolete() {
        for (const key of safeStorage.keys()) {
            if (key.startsWith('cache_') || key === 'cce_app_version' || key === 'cce_vacation_mode' || key === 'cce_theme') {
                safeStorage.removeItem(key);
            } else if (key.startsWith(PREFIX)) {
                try {
                    if (JSON.parse(safeStorage.getItem(key)).v !== CONFIG.APP_VERSION) safeStorage.removeItem(key);
                } catch { safeStorage.removeItem(key); }
            }
        }
    }
};

/**
 * Charge une donnée avec cache.
 * @param {string} key        clé de cache
 * @param {Function} loader   async () => données (sérialisables en JSON)
 * @param {object} handlers   onData(data, {cached}) appelé 1 ou 2 fois ; onError(err) si rien à afficher
 */
export async function loadWithCache(key, loader, { onData, onError, force = false } = {}) {
    const hit = force ? null : cache.read(key);
    if (hit) onData?.(hit.data, { cached: true });
    if (hit?.fresh) return hit.data;
    try {
        const data = await loader();
        cache.write(key, data);
        onData?.(data, { cached: false });
        return data;
    } catch (error) {
        console.warn(`Chargement impossible (${key})`, error);
        if (!hit) onError?.(error);
        return hit?.data ?? null;
    }
}
