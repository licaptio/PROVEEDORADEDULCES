import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { firebaseConfig, APP_CONFIG } from "./config.js";

const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

export function observarSesion(callback) {
  onAuthStateChanged(auth, user => {
    if (!user) {
      callback(null);
      return;
    }

    const correo = String(user.email || "").toLowerCase();
    const autorizado = APP_CONFIG.correoAutorizado.toLowerCase();

    if (correo !== autorizado) {
      signOut(auth);
      callback(null);
      return;
    }

    callback(user);
  });
}

export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return await signOut(auth);
}
