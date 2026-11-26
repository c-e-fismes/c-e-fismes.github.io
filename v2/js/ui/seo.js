/* =================================================================
   RÉFÉRENCEMENT DE LA MONO-PAGE
   Chaque rubrique a son titre et sa description : les moteurs et les
   partages sociaux affichent ainsi la bonne information selon l'ancre.
   ================================================================ */
import { $ } from '../core/utils.js';

const PAGES = Object.freeze({
    accueil: {
        title: 'Cercle d’Échecs de Fismes - Site officiel',
        description: 'Club d’échecs de Fismes : planning, agenda, classements Elo, gazettes, galerie photos et adhésion. Un club ouvert à tous.'
    },
    rejoindre: {
        title: 'Nous rejoindre - Cercle d’Échecs de Fismes',
        description: 'Comment adhérer au Cercle d’Échecs de Fismes : première séance gratuite, formules, tarifs, étapes d’inscription et planning.'
    },
    agenda: {
        title: 'Agenda - Cercle d’Échecs de Fismes',
        description: 'Événements passés et à venir du Cercle d’Échecs de Fismes : tournois, séances, résultats et calendrier.'
    },
    leclub: {
        title: 'Le club - Cercle d’Échecs de Fismes',
        description: 'Découvrez le club, ses gazettes, sa galerie photos, ses partenaires et ses documents à télécharger.'
    },
    adherents: {
        title: 'Adhérents et classements - Cercle d’Échecs de Fismes',
        description: 'Classements Elo des adhérents du Cercle d’Échecs de Fismes par catégorie et documents du club.'
    },
    contact: {
        title: 'Contact - Cercle d’Échecs de Fismes',
        description: 'Coordonnées, formulaire de contact et plan d’accès du Cercle d’Échecs de Fismes.'
    },
    'mentions-legales': {
        title: 'Mentions légales et RGPD - Cercle d’Échecs de Fismes',
        description: 'Informations légales, hébergement et politique de confidentialité du site du Cercle d’Échecs de Fismes.'
    }
});

export function updateSeo(id) {
    const page = PAGES[id];
    if (!page) return;
    document.title = page.title;
    const meta = $('meta[name="description"]');
    if (meta) meta.content = page.description;
    const ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = page.title;
    const ogDescription = $('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = page.description;
}
