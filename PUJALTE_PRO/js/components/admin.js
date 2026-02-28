import { db, auth } from '../firebase_init.js';
import { collection, addDoc, onSnapshot, getDocs, doc, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

import { config } from '../config.js';

export function initAdmin() {
    // TODA LA LÓGICA DE ADMINISTRACIÓN SE HA CENTRALIZADO EN main.js
    // Este archivo se mantiene vacío para evitar errores de importación 
    // en archivos que aún puedan referenciarlo, pero ya no ejecuta código.
    console.log("Admin module loaded (Logic moved to main.js)");
}
