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
                    text: `Lead registrado: ${name}\nTeléfono: ${phone}\nEmail: ${email}`,
                    html: `
                        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 32px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 1px; text-transform: uppercase; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.15);">¡Nuevo Regalo Reclamado!</h1>
                                <p style="color: rgba(255,255,255,0.95); margin-top: 10px; font-size: 15px; font-weight: 500;">Un invitado ha solicitado su cupón de descuento</p>
                            </div>

                            <!-- Body -->
                            <div style="padding: 32px; color: #334155;">
                                <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                                    <h2 style="margin: 0 0 12px 0; color: #7c2d12; font-size: 18px;">👤 Información del Cliente</h2>
                                    <p style="margin: 4px 0; font-size: 15px;"><strong>Nombre:</strong> ${name}</p>
                                    <p style="margin: 4px 0; font-size: 15px;"><strong>Teléfono:</strong> <a href="tel:${phone}" style="color: #f97316; text-decoration: none; font-weight: bold;">${phone}</a></p>
                                    <p style="margin: 4px 0; font-size: 15px;"><strong>Email:</strong> <a href="mailto:${email}" style="color: #f97316; text-decoration: none;">${email}</a></p>
                                </div>

                                <div style="text-align: center; margin-top: 32px;">
                                    <a href="https://apps.pujaltefotografia.es/superweb.html" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">Ver en Superweb</a>
                                </div>
                            </div>
                            <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <small style="color: #94a3b8;">Este es un mensaje automático de tu Asistente Digital.</small>
                            </div>
                        </div>
                    `
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
