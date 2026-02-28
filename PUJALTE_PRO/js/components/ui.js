/**
 * Módulo de Interfaz de Usuario (UI)
 * Estándares Senior Fullstack - Bloques <150 líneas
 */

export const initUI = () => {

    window.showCustomAlert = (text, icon = '⚠️') => {
        document.getElementById('alert-text').innerText = text;
        document.getElementById('alert-icon').innerText = icon;
        document.getElementById('custom-alert-overlay').style.display = 'flex';
    };

    window.closeCustomAlert = () => {
        document.getElementById('custom-alert-overlay').style.display = 'none';
    };

    window.showAppToast = (text = "¡Hecho!", icon = "✅") => {
        const toast = document.getElementById("toast-notification");
        const tText = document.getElementById("toast-text");
        const tIcon = document.getElementById("toast-icon");

        if (toast && tText && tIcon) {
            tText.innerText = text;
            tIcon.innerText = icon;
            toast.classList.add("visible");
            setTimeout(() => { toast.classList.remove("visible"); }, 3000);
        }
    };

    window.toggleTheme = () => {
        const current = localStorage.getItem('theme') || 'default';
        const next = current === 'midnight-gold' ? 'default' : 'midnight-gold';
        localStorage.setItem('theme', next);
        document.documentElement.setAttribute('data-theme', next);
        window.showAppToast(`Modo ${next === 'default' ? 'Luz' : 'Noche'} activado`);
    };

    window.startIntroCarousel = async () => {
        const cards = [
            document.getElementById('photo-card-1'),
            document.getElementById('photo-card-2'),
            document.getElementById('photo-card-3')
        ];
        const shutter = document.getElementById('sfx-shutter');

        for (const card of cards) {
            if (!card) continue;
            card.classList.add('visible', 'photo-fullscreen');
            if (shutter) {
                shutter.currentTime = 0;
                shutter.play().catch(() => { });
            }
            await new Promise(r => setTimeout(r, 1500));
            card.classList.remove('photo-fullscreen');
            await new Promise(r => setTimeout(r, 400));
        }
    };

    console.log("🎨 Componente UI (Alertas, Toast, Themes) inicializado");
};
