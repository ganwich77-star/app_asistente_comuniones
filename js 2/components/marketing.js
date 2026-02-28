import { collection, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

/**
 * Módulo de Marketing y Conversión
 * Estándares Senior Fullstack - Bloques <150 líneas
 */

let urgencyInterval = null;

export const initMarketing = (db, EVENT_ID) => {

    window.showLeadForm = () => {
        const form = document.getElementById('marketing-gift-form');
        if (form) {
            form.classList.remove('hidden');
            form.scrollIntoView({ behavior: 'smooth' });
            startUrgencyCounter();
        }
    };

    const startUrgencyCounter = () => {
        if (urgencyInterval) clearInterval(urgencyInterval);
        const expiration = new Date().getTime() + (60 * 60 * 1000); // 1 hora de oferta

        const h = document.getElementById('urgency-hours');
        const m = document.getElementById('urgency-minutes');
        const s = document.getElementById('urgency-seconds');

        urgencyInterval = setInterval(() => {
            const now = new Date().getTime();
            const diff = expiration - now;

            if (diff <= 0) {
                clearInterval(urgencyInterval);
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            if (h) h.innerText = hours.toString().padStart(2, '0');
            if (m) m.innerText = minutes.toString().padStart(2, '0');
            if (s) s.innerText = seconds.toString().padStart(2, '0');
        }, 1000);
    };

    window.confirmarDescuento = async () => {
        const name = document.getElementById('lead-name')?.value.trim();
        const phone = document.getElementById('lead-phone')?.value.trim();
        const email = document.getElementById('lead-email')?.value.trim();
        const privacy = document.getElementById('privacy-check')?.checked;

        if (!name || !phone || !email || !privacy) {
            return window.showCustomAlert("Por favor, acepta la política y completa los datos.", "📝");
        }

        try {
            await addDoc(collection(db, 'eventos', EVENT_ID, 'leads_regalo'), {
                nombre: name,
                telefono: phone,
                email: email,
                fecha: new Date().toISOString()
            });

            // Notificación silenciosa a Mail
            addDoc(collection(db, 'mail'), {
                to: ['apps@pujaltefotografia.es'],
                message: {
                    subject: `¡Nuevo Lead! ⚡ ${name}`,
                    text: `Lead registrado: ${name}\nTeléfono: ${phone}\nEmail: ${email}`
                }
            });

            window.showGiftConfirmationModal();
            document.getElementById('marketing-gift-form').classList.add('hidden');
        } catch (e) {
            window.showCustomAlert("Error al procesar. Reintenta.", "❌");
        }
    };

    console.log("⚡ Módulo Marketing (Urgencia & Leads) inicializado");
};
