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
        firebaseCollection: "datos_protagonistas_basecode",
        managementTools: false
    }
};

function getCurrentBrand() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    if (host.includes('pujalte')) return BRANDS.pujalte;
    if (host.includes('basecode') || path.includes('mi_primera_comunion')) return BRANDS.basecode;

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
