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
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
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
    collection(db, "ventas"),
    where("rutaId", "==", rutaId),
    where("estado", "==", "PENDIENTE"),
    orderBy("fecha")
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
