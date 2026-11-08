/* =================================================================
   FENÊTRES MODALES ACCESSIBLES
   - Échap pour fermer, clic sur le fond, piège de focus (Tab),
     restitution du focus, blocage du défilement de la page.
   ================================================================ */
import { $, $$, emit } from './utils.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const stack = [];

export function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal || modal.classList.contains('active')) return;
    modal._returnFocus = document.activeElement;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    stack.push(modal);
    const target = $('[data-autofocus]', modal) || $(FOCUSABLE, modal);
    target?.focus();
    emit('modal:open', { id });
}

export function closeModal(modalOrId) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal || !modal.classList.contains('active')) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    const index = stack.indexOf(modal);
    if (index >= 0) stack.splice(index, 1);
    if (stack.length === 0) document.body.classList.remove('modal-open');
    modal._returnFocus?.focus?.();
    emit('modal:close', { id: modal.id });
}

export const topModal = () => stack[stack.length - 1] ?? null;

export function initModals() {
    document.addEventListener('click', (event) => {
        const opener = event.target.closest('[data-open-modal]');
        if (opener) { event.preventDefault(); openModal(opener.dataset.openModal); return; }
        const closer = event.target.closest('[data-close-modal]');
        if (closer) { closeModal(closer.closest('.overlay')); return; }
        if (event.target.classList?.contains('overlay')) closeModal(event.target);
    });

    document.addEventListener('keydown', (event) => {
        const modal = topModal();
        if (!modal) return;
        if (event.key === 'Escape') { event.preventDefault(); closeModal(modal); return; }
        if (event.key !== 'Tab') return;
        const items = $$(FOCUSABLE, modal).filter((el) => !el.hidden && el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        else if (!modal.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
    });
}
