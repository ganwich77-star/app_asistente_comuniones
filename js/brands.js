const BRANDS = {
    pujalte: {
        id: "pujalte",
        name: "Pujalte Creative Studio",
        domain: "apps.pujaltefotografia.es",
        logo: "./assets/logo_verde.webp",
        poweredBy: "POWERED BY PUJALTE CREATIVESTUDIO",
        eventFolder: "comuniones2026",
        firebaseCollection: "datos_protagonistas", // Mantener la original por compatibilidad
        managementTools: true
    },
    basecode: {
        id: "basecode",
        name: "Basecode PRO",
        domain: "basecode.es",
        logo: "./assets/logo_basecode.png",
        poweredBy: "POWERED BY BASECODE CREATIVESTUDIO",
        eventFolder: "comuniones2026", // El usuario dijo que quiere lo mismo pero en Basecode
        firebaseCollection: "datos_protagonistas_basecode", // Colección separada para Basecode
        managementTools: false
    }
};

function getCurrentBrand() {
    const host = window.location.hostname;
    const path = window.location.pathname;

    if (host.includes('pujalte')) return BRANDS.pujalte;
    if (host.includes('basecode') || path.includes('mi_primera_comunion')) return BRANDS.basecode;

    // Por defecto devolvemos Pujalte para no romper nada local
    return BRANDS.pujalte;
}

export { BRANDS, getCurrentBrand };
