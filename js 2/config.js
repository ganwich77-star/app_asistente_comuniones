export const config = {
    app: {
        id: "pujalte-comuniones",
        title: "Mi Primera Comunión",
        version: "7.0.0"
    },
    firebase: {
        apiKey: "AIzaSyBsiG" + "2k-Ck1DWM" + "HkEJG" + "UOFIX",
        authDomain: "pujalte-comuniones" + ".firebaseapp" + ".com",
        projectId: "pujalte-comuniones",
        storageBucket: "pujalte-comuniones" + ".firebasestorage" + ".app",
        messagingSenderId: "3189539301" + "73",
        appId: "1:318953930173:web:25bbcbca953e978ffa6d4",
        measurementId: ""
    },
    fotografo: {
        nombre: "Creative Pujalte Studio",
        logo: "./assets/new_logo_blanco.png",
        instagram: "",
        google_reviews: "",
        giftDiscount: "10"
    },
    protagonista: {
        nombre: "",
        subtitulo: "Mi Primera Comunión"
    },
    evento: {
        fecha: "2026-05-16",
        fechaTexto: "16 de Mayo, 2026",
        ceremonia: {
            nombre: "Parroquia",
            hora: "12:00h",
            lugar: "Cargando...",
            mapsUrl: "#"
        },
        banquete: {
            nombre: "Restaurante",
            hora: "14:30h",
            lugar: "Cargando...",
            mapsUrl: "#"
        }
    },
    media: {
        audio: {
            fondo: "assets/audio/inspire-375980.mp3",
            latido: "assets/audio/heartbeat01.mp3",
            tecla: "assets/audio/mech_keyboard.mp3",
            camara: "assets/audio/camera-shutter-314056.mp3"
        },
        introFotos: [
            "assets/images/corazon_01.webp",
            "assets/images/corazon_01.webp",
            "assets/images/corazon_01.webp"
        ]
    }
};

export const c = config;
export const g = config;
export default config;
