/* ==========================================================
   🔵 FIREBASE
========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } 
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCK5nb6u2CGRJ8AB1aPlRn54b97bdeAFeM",
  authDomain: "inventariopv-643f1.firebaseapp.com",
  projectId: "inventariopv-643f1",
  storageBucket: "inventariopv-643f1.appspot.com",
  messagingSenderId: "96242533231",
  appId: "1:96242533231:web:aae75a18fbaf9840529e9a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);


/* ==========================================================
   🔵 OBTENER ID DEL URL
========================================================== */
const params = new URLSearchParams(window.location.search);
const idTraspaso = params.get("id");

if (!idTraspaso) {
  alert("❌ Falta ID de traspaso en el QR");
}

let dataTraspaso = null;


/* ==========================================================
   🔵 CARGAR TRASPASO
========================================================== */
async function cargarTraspaso() {
  const refDoc = doc(db, "traspasos", idTraspaso);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
    alert("❌ Traspaso no encontrado");
    return;
  }

  dataTraspaso = snap.data();

  document.getElementById("info").innerHTML = `
    <b>ID:</b> ${idTraspaso}<br>
    <b>Fecha:</b> ${dataTraspaso.fecha}<br>
    <b>Ruta:</b> ${dataTraspaso.rutaId}<br>
    <b>Vendedor:</b> ${dataTraspaso.vendedorId}<br>
  `;

  const tbl = document.getElementById("tabla");
  dataTraspaso.items.forEach(it => {
    tbl.innerHTML += `
      <tr>
        <td>${it.codigo}</td>
        <td>${it.concepto}</td>
        <td>${it.cantidad}</td>
      </tr>`;
  });

  if (dataTraspaso.firmaEntregaURL) {
    btnEntrega.disabled = true;
    btnEntrega.innerText = "Ya firmado";
  }
  if (dataTraspaso.firmaRecibeURL) {
    btnRecibe.disabled = true;
    btnRecibe.innerText = "Ya firmado";
  }
}

cargarTraspaso();


/* ==========================================================
   🔵 SVG – Firma ligera PRO
========================================================== */
const svg = document.getElementById("svgFirma");
let dibujando = false;

svg.addEventListener("mousedown", (e) => {
  dibujando = true;
  dibujar(e);
});
svg.addEventListener("mousemove", dibujar);
svg.addEventListener("mouseup", () => dibujando = false);
svg.addEventListener("mouseleave", () => dibujando = false);

function dibujar(e) {
  if (!dibujando) return;

  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const punto = document.createElementNS("http://www.w3.org/2000/svg","circle");
  punto.setAttribute("cx", x);
  punto.setAttribute("cy", y);
  punto.setAttribute("r", 1.6);
  punto.setAttribute("fill", "#000");

  svg.appendChild(punto);
}


/* ==========================================================
   🔵 BOTONES
========================================================== */
let tipoFirma = null;

const btnEntrega = document.getElementById("btnEntrega");
const btnRecibe = document.getElementById("btnRecibe");
const canvasBox = document.getElementById("canvasBox");

btnEntrega.onclick = () => abrir("entrega");
btnRecibe.onclick = () => abrir("recibe");

function abrir(tipo){
  tipoFirma = tipo;
  canvasBox.style.display = "block";
}

document.getElementById("btnLimpiar").onclick = () => {
  while(svg.lastChild) svg.removeChild(svg.lastChild);
};


/* ==========================================================
   🔵 GUARDAR FIRMA
========================================================== */
document.getElementById("btnGuardarFirma").onclick = guardarFirma;

async function guardarFirma() {

  const svgData = new XMLSerializer().serializeToString(svg);

  const path = `firmas/${idTraspaso}_${tipoFirma}.svg`;
  const storageRef = ref(storage, path);

  await uploadString(storageRef, svgData, "raw");
  const url = await getDownloadURL(storageRef);

  const refDoc = doc(db, "traspasos", idTraspaso);

  const payload = {
    [`firma${tipoFirma === "entrega" ? "Entrega" : "Recibe"}URL`]: url,
    [`firma${tipoFirma === "entrega" ? "Entrega" : "Recibe"}Fecha`]: new Date().toISOString(),
    [`firma${tipoFirma === "entrega" ? "Entrega" : "Recibe"}Device`]: navigator.userAgent
  };

  await updateDoc(refDoc, payload);

  alert("✔ Firma guardada correctamente");

  while(svg.lastChild) svg.removeChild(svg.lastChild);
  canvasBox.style.display = "none";

  if (tipoFirma === "entrega") {
    btnEntrega.disabled = true;
    btnEntrega.innerText = "Ya firmado";
  } else {
    btnRecibe.disabled = true;
    btnRecibe.innerText = "Ya firmado";
  }
}
