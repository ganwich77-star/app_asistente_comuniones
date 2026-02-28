/**
 * CONFIGURACIÓN MAESTRA V7 - MOTOR DE COMUNIONES
 */

export const config = {
    app: {
        id: "pujalte-comuniones",
        title: "Mi Primera Comunión",
        version: "7.0.0"
    },

    firebase: {
        apiKey: "AIzaSyBsiG9CByzLlrvGgjctJshIrc2k-Ck1DWM",
        authDomain: "asistente-digital-comuniones.firebaseapp.com",
        projectId: "asistente-digital-comuniones",
        storageBucket: "asistente-digital-comuniones.firebasestorage.app",
        messagingSenderId: "318953930173",
        appId: "1:318953930173:web:25bbcbca953e978ffa6d4",
        measurementId: ""
    },

    fotografo: {
        nombre: "Pujalte Creative Studio",
        logo: "/assets/images/new_lobo_black.webp",
        instagram: "pujaltefotografia",
        google_reviews: "https://g.page/r/CTswPlAvjlLXEAo/review",
        giftDiscount: "10",
        email: "apps@pujaltefotografia.es"
    },

    protagonista: {
        nombre: "",
        subtitulo: "Mi Primera Comunión"
    },

    evento: {
        fecha: "2026-05-16T12:00:00",
        fechaTexto: "Próximamente",
        ceremonia: { nombre: "Parroquia", hora: "12:00h", lugar: "", mapsUrl: "#" },
        banquete: { nombre: "Restaurante", hora: "14:30h", lugar: "", mapsUrl: "#" }
    },

    media: {
        introFotos: [
            "/assets/images/corazon_01.webp",
            "/assets/images/corazon_01.webp",
            "/assets/images/corazon_01.webp"
        ],
        audio: {
            fondo: "/assets/audio/inspire-375980.mp3",
            latido: "/assets/audio/heartbeat01.mp3",
            tecla: "/assets/audio/mech_keyboard.mp3",
            camara: "/assets/audio/camera-shutter-314056.mp3"
        }
    },

    admin: {
        email: "apps@pujaltefotografia.es"
    }
};

export const c = config;
export const g = config;
export default config;
