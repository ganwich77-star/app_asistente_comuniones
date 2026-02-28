/**
 * Módulo de Pagos y Regalos
 * Estándares Senior Fullstack - Bloques <150 líneas
 */

export const initPayment = (giftSettingsData, config) => {

    window.handleBizum = () => {
        if (!giftSettingsData.bizumPhone) {
            return window.showCustomAlert("El número de Bizum no está configurado.", "📱");
        }
        const telEl = document.getElementById("txtTelefono");
        if (telEl) telEl.innerText = giftSettingsData.bizumPhone;

        const modal = document.getElementById('bizum-modal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeBizumModal = () => {
        const modal = document.getElementById('bizum-modal');
        if (modal) modal.style.display = 'none';
    };

    window.handleHucha = () => {
        const iban = giftSettingsData.iban;
        if (!iban) return window.showCustomAlert("El IBAN no está configurado.", "🏦");

        navigator.clipboard.writeText(iban.replace(/\s/g, '')).then(() => {
            window.showBankModal();
        }).catch(() => {
            window.showCustomAlert("No se pudo copiar el IBAN.", "❌");
        });
    };

    window.showBankModal = () => {
        const modal = document.getElementById('bank-modal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeBankModal = () => {
        const modal = document.getElementById('bank-modal');
        if (modal) modal.style.display = 'none';
        const toast = document.getElementById('iban-copy-toast');
        if (toast) toast.style.opacity = 0;
    };

    console.log("💳 Componente Pagos inicializado");
};
