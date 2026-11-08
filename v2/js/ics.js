/* =================================================================
   "AJOUTER À MON AGENDA" : génération d'un fichier .ics (iCalendar) pour un événement
   Compatible Google Agenda, Apple Calendrier (iPhone/Mac), Outlook, etc.
   Les heures sont exprimées en UTC : chaque agenda les convertit dans le fuseau du visiteur.
   ================================================================ */
import { normalizeText } from './utils.js';

const pad = (n) => String(n).padStart(2, '0');

function stamp(timestamp) {
    const d = new Date(timestamp);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/* Échappement imposé par la norme (RFC 5545) */
const escapeText = (value) => String(value ?? '')
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/* Une ligne ne doit pas dépasser 75 octets : les suivantes commencent par une espace */
function fold(line) {
    const encoder = new TextEncoder();
    if (encoder.encode(line).length <= 75) return line;
    const parts = [];
    let current = '';
    let bytes = 0;
    for (const char of line) {
        const size = encoder.encode(char).length;
        if (bytes + size > (parts.length === 0 ? 75 : 74)) { parts.push(current); current = ''; bytes = 0; }
        current += char;
        bytes += size;
    }
    parts.push(current);
    return parts.join('\r\n ');
}

export const slugify = (text) => normalizeText(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'evenement';

export function buildIcs(event, now = Date.now()) {
    const description = [
        event.cadence && `Cadence : ${event.cadence}`,
        event.rondes && `Nombre de rondes : ${event.rondes}`,
        event.commentaire
    ].filter(Boolean).join('\n');

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        "PRODID:-//Cercle d'Echecs de Fismes//Site web//FR",
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${event.start}-${slugify(event.titre)}@cercle-echecs-fismes`,
        `DTSTAMP:${stamp(now)}`,
        `DTSTART:${stamp(event.start)}`,
        `DTEND:${stamp(event.end)}`,
        `SUMMARY:${escapeText(event.titre)}`,
        event.lieu && `LOCATION:${escapeText(event.lieu)}`,
        description && `DESCRIPTION:${escapeText(description)}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).map(fold);

    return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(event) {
    const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(event.titre)}-${event.iso}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
