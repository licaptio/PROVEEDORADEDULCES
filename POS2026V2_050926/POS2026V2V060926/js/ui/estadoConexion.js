import { db } from "../firebase/config.js";
import {
  collection,
  getDocs,
  limit,
  query
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const INTERVALO_VERIFICACION = 5 * 60 * 1000;
const TIEMPO_LIMITE = 7000;
let intervalo = null;
let verificando = false;

function pintar(estado, detalle = "") {
  const caja = document.getElementById("estadoConexionPOS");
  const texto = document.getElementById("estadoConexionTexto");
  if (!caja || !texto) return;

  caja.classList.remove("online", "offline", "verificando");
  caja.classList.add(estado);
  texto.textContent = estado === "online"
    ? "ONLINE"
    : estado === "offline"
      ? "OFFLINE"
      : "VERIFICANDO";
  caja.title = detalle || texto.textContent;
}

async function comprobarFirebase() {
  if (verificando) return;
  if (!navigator.onLine) {
    pintar("offline", "El equipo no tiene conexión a internet");
    return;
  }

  verificando = true;
  pintar("verificando", "Comprobando conexión con Firebase");

  try {
    const prueba = getDocs(query(collection(db, "productos"), limit(1)));
    const limiteTiempo = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tiempo de conexión agotado")), TIEMPO_LIMITE)
    );
    await Promise.race([prueba, limiteTiempo]);
    pintar("online", "Internet y Firebase disponibles");
  } catch (err) {
    pintar("offline", `Sin comunicación con Firebase: ${err?.message || "error de conexión"}`);
  } finally {
    verificando = false;
  }
}

export function iniciarIndicadorConexion() {
  if (intervalo) return;

  window.addEventListener("offline", () =>
    pintar("offline", "El equipo perdió la conexión a internet")
  );
  window.addEventListener("online", comprobarFirebase);
  window.addEventListener("pos:firebase-error", () =>
    pintar("offline", "Firebase no respondió")
  );

  comprobarFirebase();
  intervalo = setInterval(comprobarFirebase, INTERVALO_VERIFICACION);
}
