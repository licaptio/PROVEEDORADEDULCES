// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK5nb6u2CGRJ8AB1aPlRn54b97bdeAFeM",
  authDomain: "inventariopv-643f1.firebaseapp.com",
  projectId: "inventariopv-643f1",
  storageBucket: "inventariopv-643f1.firebasestorage.app",
  messagingSenderId: "96242533231",
  appId: "1:96242533231:web:aae75a18fbaf9840529e9a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 🔐 TOMAR FOLIO ATÓMICO
export async function tomarFolio(serie) {
  const ref = doc(db, "series_fiscales", serie);

  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw "Serie no existe";

    const actual = snap.data().ultimo_folio || 0;
    const siguiente = actual + 1;

    tx.update(ref, {
      ultimo_folio: siguiente,
      updated_at: serverTimestamp()
    });

    return siguiente;
  });
}

// 🔎 OBTENER VENTAS DE UNA RUTA
export async function obtenerVentasRuta(rutaId) {
  const q = query(
    collection(db, "ventas_rutav2"),
    where("rutaId", "==", rutaId),
    orderBy("fecha")
  );

  const snap = await getDocs(q);

  // 🔑 POST-FILTRO DE ESTADO
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(v => !v.estado || v.estado === "PENDIENTE");
}
