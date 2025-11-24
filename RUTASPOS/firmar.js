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
   🔵 LEER ID DEL QR
========================================================== */
const params = new URLSearchParams(window.location.search);
const id = params.get("id");

let dataTraspaso = null;
let tipoFirma = null;

/* ==========================================================
   🔵 CARGAR DATOS DEL TRASPASO
========================================================== */
async function cargarTraspaso() {
  const refDoc = doc(db, "traspasos", id);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
    document.getElementById("subInfo").innerText = "Traspaso no encontrado";
    return;
  }

  dataTraspaso = snap.data();

  document.getElementById("subInfo").innerText = `Traspaso #${id.slice(-6)}`;

  document.getElementById("info").innerHTML = `
    <b>Ruta:</b> ${dataTraspaso.rutaId}<br>
    <b>Vendedor:</b> ${dataTraspaso.vendedorId}<br>
    <b>Fecha:</b> ${dataTraspaso.fecha}<br>
  `;

  const tabla = document.getElementById("tabla");
  dataTraspaso.items.forEach(it => {
    tabla.innerHTML += `
      <tr>
        <td>${it.codigo}</td>
        <td>${it.concepto}</td>
        <td>${it.cantidad}</td>
      </tr>`;
  });

  // bloquear si ya existe firma
  if (dataTraspaso.firmas?.entregaURL) {
    let b = document.getElementById("btnEntrega");
    b.innerText = "ENTREGA ✔";
    b.disabled = true;
  }
  if (dataTraspaso.firmas?.recibeURL) {
    let b = document.getElementById("btnRecibe");
    b.innerText = "RECIBE ✔";
    b.disabled = true;
  }
}

cargarTraspaso();



/* ==========================================================
   🔵 SISTEMA DE TRAZOS SVG SUPER LIGERO
========================================================== */
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let dibujando = false;
let trazos = [];    // lista de strokes
let actual = [];    // trazo actual

function iniciar(e) {
  dibujando = true;
  actual = [];
  agregarPunto(e);
}
function terminar() {
  dibujando = false;
  if (actual.length > 0) trazos.push(actual);
}
function mover(e) {
  if (!dibujando) return;
  agregarPunto(e);
  redibujar();
}

function agregarPunto(e) {
  const rect = canvas.getBoundingClientRect();
  actual.push({
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  });
}

function redibujar() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";

  trazos.forEach(t => {
    ctx.beginPath();
    for (let i=0;i<t.length;i++){
      const p = t[i];
      if (i===0) ctx.moveTo(p.x,p.y);
      else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  });

  if (actual.length){
    ctx.beginPath();
    for (let i=0;i<actual.length;i++){
      const p = actual[i];
      if (i===0) ctx.moveTo(p.x,p.y);
      else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();
  }
}

canvas.addEventListener("pointerdown", iniciar);
canvas.addEventListener("pointerup", terminar);
canvas.addEventListener("pointerleave", terminar);
canvas.addEventListener("pointermove", mover);


/* ==========================================================
   🔵 CONVERTIR A SVG ULTRA LIGERO
========================================================== */
function generarSVG() {
  let paths = "";

  trazos.forEach(t => {
    if (t.length < 2) return;

    const d = t.map((p,i) =>
      i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`
    ).join(" ");

    paths += `<path d="${d}" stroke="black" stroke-width="2" fill="none"/>`;
  });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="500" height="180">
      ${paths}
    </svg>
  `;
}


/* ==========================================================
   🔵 EVENTOS DE FIRMA
========================================================== */
document.getElementById("btnEntrega").onclick = () => iniciarFirma("entrega");
document.getElementById("btnRecibe").onclick = () => iniciarFirma("recibe");

function iniciarFirma(tipo){
  tipoFirma = tipo;
  trazos = [];
  actual = [];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  document.getElementById("canvasBox").style.display = "block";
}

document.getElementById("btnLimpiar").onclick = () => {
  trazos = [];
  actual = [];
  ctx.clearRect(0,0,canvas.width,canvas.height);
};


/* ==========================================================
   🔵 GUARDAR EN STORAGE + FIRESTORE
========================================================== */
document.getElementById("btnGuardar").onclick = async () => {
  const svg = generarSVG();
  const b64 = "data:image/svg+xml;base64," + btoa(svg);

  const path = `traspasos/${id}/firmas/${tipoFirma}.svg`;
  const fileRef = ref(storage, path);

  await uploadString(fileRef, b64, "data_url");
  const url = await getDownloadURL(fileRef);

  const refDoc = doc(db, "traspasos", id);

  let update = {};
  update[`firmas.${tipoFirma}URL`] = url;
  update[`firmas.${tipoFirma}Fecha`] = new Date().toISOString();
  update[`firmas.${tipoFirma}Dispositivo`] = navigator.userAgent;

  await updateDoc(refDoc, update);

  alert("Firma guardada ✔");
  document.getElementById("canvasBox").style.display="none";

  if (tipoFirma === "entrega") {
    let b = document.getElementById("btnEntrega");
    b.innerText = "ENTREGA ✔";
    b.disabled = true;
  } else {
    let b = document.getElementById("btnRecibe");
    b.innerText = "RECIBE ✔";
    b.disabled = true;
  }
};
