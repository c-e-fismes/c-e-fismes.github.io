/* =================================================================
   JOURS FÉRIÉS FRANÇAIS (métropole), calculés automatiquement pour n'importe quelle année :
   aucune mise à jour annuelle. Pâques, Ascension et Pentecôte sont déduits de la date de Pâques.
   ================================================================= */
const pad = (n) => String(n).padStart(2, '0');
const key = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;

/* Date de Pâques (algorithme de Meeus / Jones / Butcher) */
function easter(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

const cache = new Map();

/* Table { 'AAAA-MM-JJ' => nom } des jours fériés d'une année */
export function holidaysOf(year) {
    if (cache.has(year)) return cache.get(year);
    const map = new Map();
    const fixed = [[1, 1, "Jour de l'An"], [5, 1, 'Fête du Travail'], [5, 8, 'Victoire 1945'], [7, 14, 'Fête nationale'], [8, 15, 'Assomption'], [11, 1, 'Toussaint'], [11, 11, 'Armistice 1918'], [12, 25, 'Noël']];
    for (const [month, day, name] of fixed) map.set(key(year, month, day), name);
    const base = easter(year);
    for (const [offset, name] of [[1, 'Lundi de Pâques'], [39, 'Ascension'], [50, 'Lundi de Pentecôte']]) {
        const date = new Date(base.getTime() + offset * 86400000);
        map.set(key(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()), name);
    }
    cache.set(year, map);
    return map;
}

/* Nom du jour férié (ou null) pour une date civile */
export const holidayName = (year, month, day) => holidaysOf(year).get(key(year, month, day)) ?? null;
