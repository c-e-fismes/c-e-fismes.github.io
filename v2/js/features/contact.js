/* =================================================================
   FORMULAIRE DE CONTACT (Formspree) + carte Google Maps "cliquer pour charger"
   Sans JavaScript, le formulaire reste fonctionnel (envoi classique vers Formspree).
   ================================================================ */
import { $, h, fetchWithTimeout, on, safeUrl, safeMailto } from '../core/utils.js';
import { onFirstShow } from '../ui/nav.js';
import { getParametres } from '../core/parametres.js';

function initForm() {
    const form = $('#contactForm');
    const status = $('#formStatus');
    if (!form || !status) return;
    const submit = $('button[type="submit"]', form);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        submit.disabled = true;
        submit.textContent = 'Envoi en cours...';
        status.className = 'form-status-box';
        status.replaceChildren();
        try {
            const response = await fetchWithTimeout(form.action, {
                method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }
            }, 15000);
            if (!response.ok) throw new Error(`Erreur ${response.status}`);
            status.classList.add('is-success');
            status.textContent = 'Merci. Votre message a bien été envoyé !';
            form.reset();
        } catch {
            const email = safeMailto(getParametres().email);
            status.classList.add('is-error');
            status.replaceChildren(
                'Une erreur est survenue. Vous pouvez ',
                email ? h('a', { href: email }, 'nous écrire directement par e-mail') : 'réessayer plus tard'
            );
        } finally {
            submit.disabled = false;
            submit.textContent = 'Envoyer le message';
        }
    });

    /* Efface le message d'état en quittant la rubrique */
    on('section:show', (e) => { if (e.detail.id !== 'contact') { status.className = 'form-status-box'; status.replaceChildren(); } });
}

/* La carte Google Maps n'est chargée qu'à la première ouverture de la rubrique Contact. */
function initMap() {
    const frame = $('#mapFrame');
    if (!frame) return;
    onFirstShow('contact', () => {
        const src = safeUrl(frame.dataset.src, ['google.com']);
        if (src) frame.src = src;
    });
}

export function initContact() {
    initForm();
    initMap();
}
