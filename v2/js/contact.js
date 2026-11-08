/* =================================================================
   FORMULAIRE DE CONTACT (Formspree) + carte Google Maps "cliquer pour charger"
   Sans JavaScript, le formulaire reste fonctionnel (envoi classique vers Formspree).
   ================================================================ */
import { $, fetchWithTimeout, on } from './utils.js';
import { onFirstShow } from './nav.js';

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
        status.textContent = '';
        try {
            const response = await fetchWithTimeout(form.action, {
                method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }
            }, 15000);
            if (!response.ok) throw new Error(`Erreur ${response.status}`);
            status.classList.add('is-success');
            status.textContent = 'Merci. Votre message a bien été envoyé !';
            form.reset();
        } catch {
            status.classList.add('is-error');
            status.textContent = "Une erreur est survenue lors de l'envoi. Vous pouvez nous écrire directement par e-mail.";
        } finally {
            submit.disabled = false;
            submit.textContent = 'Envoyer le message';
        }
    });

    /* Efface le message d'état en quittant l'onglet */
    on('section:show', (e) => { if (e.detail.id !== 'contact') { status.className = 'form-status-box'; status.textContent = ''; } });
}

/* La carte Google Maps n'est chargée qu'à la première ouverture de l'onglet Contact (pas au chargement du site) */
function initMap() {
    const frame = $('#mapFrame');
    if (!frame) return;
    onFirstShow('contact', () => { frame.src = frame.dataset.src; });
}

export function initContact() {
    initForm();
    initMap();
}
