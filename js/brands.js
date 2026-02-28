const BRANDS = {
    pujalte: {
        id: "pujalte",
        name: "Creative Pujalte Studio",
        domain: "apps.pujaltefotografia.es",
        logo: "./assets/logo_verde.webp",
        poweredBy: "POWERED BY PUJALTE CREATIVESTUDIO",
        eventFolder: "comuniones2026",
        firebaseCollection: "datos_protagonistas",
        managementTools: true
    },
    basecode: {
        id: "basecode",
        name: "Basecode PRO",
        domain: "basecode.es",
        logo: "./assets/logo_basecode.png",
        poweredBy: "POWERED BY BASECODE CREATIVESTUDIO",
        eventFolder: "comuniones2026",
        firebaseCollection: "datos_protagonistas", // Usamos la misma por ahora para compatibilidad con el creador minificado
        managementTools: false
    }
};

function getCurrentBrand() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    // Si estamos en local (localhost o file://), usamos Pujalte por defecto a menos que estemos en una carpeta específica
    if (!host || host === 'localhost' || host === '127.0.0.1') {
        if (path.includes('basecode') || path.includes('mi_primera_comunion')) return BRANDS.basecode;
        return BRANDS.pujalte;
    }

    if (host.includes('pujalte')) return BRANDS.pujalte;
    if (host.includes('basecode')) return BRANDS.basecode;

    return BRANDS.pujalte;
}

/**
 * Redirige si se intenta acceder a herramientas de gestión desde un dominio no autorizado.
 */
function enforceManagementSecurity() {
    const brand = getCurrentBrand();
    const managementFiles = [
        'creador_eventos.html',
        'super_admin.html',
        'superweb.html',
        'acceso_fotografo.html',
        'index_dashboard.html'
    ];

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';

    if (managementFiles.includes(currentFile) && !brand.managementTools) {
        console.warn(`Acceso restringido a ${currentFile} desde ${brand.domain}. Redirigiendo a Pujalte...`);
        window.location.href = `https://${BRANDS.pujalte.domain}/${currentFile}${window.location.search}`;
    }
}

export { BRANDS, getCurrentBrand, enforceManagementSecurity };

// v1.1 - Sincronización multi-dominio activa.
