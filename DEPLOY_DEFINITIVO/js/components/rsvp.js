import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Módulo de Confirmación de Asistencia (RSVP)
 * Estándares Senior Fullstack - Bloques <150 líneas
 */

let menuData = { Carne: 0, Pescado: 0, Vegetariano: 0, Vegano: 0, SinGluten: 0, Infantil: 0 };
let menuSettingsData = { enabled: true };

export const initRSVP = (db, EVENT_ID, config, sendWhatsAppNotification) => {

    // Gestión de cantidad de invitados (Adultos/Niños)
    window.changeGuestValue = (type, delta) => {
        const el = document.getElementById(`count-${type}`);
        if (el) {
            let current = parseInt(el.innerText) || 0;
            el.innerText = Math.max(0, current + delta);
        }
    };

    // Control del desplegable de menú
    window.toggleMenuDropdown = () => {
        const dropdown = document.getElementById('menu-dropdown');
        const header = dropdown?.parentElement?.querySelector('.dropdown-header');
        if (dropdown && header) {
            dropdown.classList.toggle('open');
            header.classList.toggle('activo');
        }
    };

    // Selección de platos específicos
    window.changeMenuUnit = (key, delta) => {
        if (delta > 0) {
            const adults = parseInt(document.getElementById('count-adults')?.innerText || 0);
            const kids = parseInt(document.getElementById('count-kids')?.innerText || 0);
            const totalGuests = adults + kids;
            const currentMenus = Object.values(menuData).reduce((a, b) => a + b, 0);

            if (currentMenus >= totalGuests) {
                window.showCustomAlert(`Ya has seleccionado menú para los ${totalGuests} invitados.`, "🍽️");
                return;
            }
        }

        menuData[key] = Math.max(0, (menuData[key] || 0) + delta);
        const el = document.getElementById(`unit-${key}`);
        if (el) el.innerText = menuData[key];
        window.updateDropdownLabel();
    };

    window.updateDropdownLabel = () => {
        let total = Object.values(menuData).reduce((a, b) => a + b, 0);
        const label = document.getElementById('dropdown-label');
        if (label) {
            label.innerHTML = total > 0
                ? `🍽️ <i>${total} platos seleccionados</i>`
                : '🍽️ Elige tu menú';
        }
    };

    window.handleRSVP = async () => {
        const name = document.getElementById('guest-names')?.value.trim();
        const adults = parseInt(document.getElementById('count-adults')?.innerText || 0);
        const kids = parseInt(document.getElementById('count-kids')?.innerText || 0);
        const comments = document.getElementById('guest-comments')?.value.trim() || '';
        const submitBtn = document.getElementById('submit-btn');

        if (!name) return window.showCustomAlert("Por favor, introduce tu nombre.", "✍️");

        const totalGuests = adults + kids;
        const totalMenus = Object.values(menuData).reduce((a, b) => a + b, 0);

        if (menuSettingsData.enabled && totalMenus !== totalGuests) {
            return window.showCustomAlert(`Selecciona un menú por persona (${totalGuests} en total).`, "🍽️");
        }

        if (submitBtn) { submitBtn.innerText = "Enviando..."; submitBtn.disabled = true; }

        try {
            const payload = {
                nombres: name, adultos, niños: kids,
                menu: menuSettingsData.enabled ? menuData : { disabled: true },
                comentarios: comments, fecha: new Date().toISOString(), status: 'unread'
            };

            await addDoc(collection(db, 'eventos', EVENT_ID, 'invitados'), payload);

            // PHP Notification
            fetch('send_mail.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, eventName: config.app.title })
            }).catch(() => { });

            if (typeof sendWhatsAppNotification === 'function') sendWhatsAppNotification(payload);

            window.showCustomAlert("¡Asistencia confirmada!", "✅");
            if (submitBtn) submitBtn.innerText = "Confirmado";

        } catch (error) {
            window.showCustomAlert("Error al enviar.", "❌");
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Confirmar"; }
        }
    };

    console.log("📝 Componente RSVP Refactorizado");
};
