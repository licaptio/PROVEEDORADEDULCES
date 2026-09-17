import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBbWF23OCSuc_RyX2nZVZxFPGkPrQsQXxE",
  authDomain: "notasfoliador.firebaseapp.com",
  projectId: "notasfoliador",
  storageBucket: "notasfoliador.firebasestorage.app",
  messagingSenderId: "449665263510",
  appId: "1:449665263510:web:b049e4c02babe203da1fb7"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
