
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc,
  setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

/* ============================================================
   FIREBASE
   ============================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyCK5nb6u2CGRJ8AB1aPlRn54b97bdeAFeM",
  authDomain: "inventariopv-643f1.firebaseapp.com",
  projectId: "inventariopv-643f1",
  storageBucket: "inventariopv-643f1.firebasestorage.app",
  messagingSenderId: "96242533231",
  appId: "1:96242533231:web:aae75a18fbaf9840529e9a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const RUTA = ["CLIENTES", "PDD031204KL5", "USUARIOS"];
const usuariosCol = collection(db, ...RUTA);

/* ============================================================
   ESTADO
   ============================================================ */
let usuarios = [];
let usuarioEditandoId = null;
let camposActuales = {};

const $ = (id) => document.getElementById(id);
const loading = $("loading");
const tbody = $("usuariosBody");
const emptyState = $("emptyState");
const buscar = $("buscar");
const modalBackdrop = $("modalBackdrop");
const formCampos = $("formCampos");
const btnEliminar = $("btnEliminar");
const docIdBox = $("docIdBox");
const docIdText = $("docIdText");

function toast(msg, error=false){
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast show" + (error ? " error" : "");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=> el.className="toast", 2600);
}

function valOr(obj, keys, fallback=""){
  for (const k of keys){
    if (obj?.[k] !== undefined && obj?.[k] !== null && String(obj[k]).trim() !== "") return obj[k];
  }
  return fallback;
}

function escapeHtml(v){
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function etiquetaCampo(k){
  return k.replaceAll("_"," ").replace(/([a-z])([A-Z])/g,"$1 $2")
          .replace(/\b\w/g, c=>c.toUpperCase());
}

function getTipo(valor){
  if (typeof valor === "boolean") return "boolean";
  if (typeof valor === "number") return "number";
  if (valor && typeof valor === "object") return "json";
  return "string";
}

async function cargarUsuarios(){
  loading.classList.remove("hidden");
  try{
    const snap = await getDocs(usuariosCol);
    usuarios = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    render();
  }catch(e){
    console.error(e);
    toast("Error cargando usuarios: " + e.message, true);
  }finally{
    loading.classList.add("hidden");
  }
}

function render(){
  const q = buscar.value.trim().toLowerCase();
  const filtrados = usuarios.filter(u =>
    [u.id, ...Object.values(u)].some(v => {
      try { return String(typeof v==="object" ? JSON.stringify(v) : v).toLowerCase().includes(q); }
      catch { return false; }
    })
  );

  $("totalUsuarios").textContent = usuarios.length;
  tbody.innerHTML = "";
  emptyState.classList.toggle("hidden", filtrados.length !== 0);

  for (const u of filtrados){
    const usuario = valOr(u, ["usuario","username","user","nombreUsuario"], u.id);
    const nombre = valOr(u, ["nombre","nombreCompleto","displayName","empleado"], "—");
    const correo = valOr(u, ["correo","email","mail"], "—");
    const ruta = valOr(u, ["ruta","rol","role","sucursal","tienda"], "—");
    const activoRaw = valOr(u, ["activo","habilitado","estatus","estado"], true);
    const activo = activoRaw === false || String(activoRaw).toLowerCase()==="inactivo" || String(activoRaw)==="0" ? false : true;
    const inicial = String(usuario || "?").charAt(0).toUpperCase();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="user-main">
          <div class="avatar">${escapeHtml(inicial)}</div>
          <div><strong>${escapeHtml(usuario)}</strong><small>${escapeHtml(u.id)}</small></div>
        </div>
      </td>
      <td>${escapeHtml(nombre)}</td>
      <td>${escapeHtml(correo)}</td>
      <td>${escapeHtml(ruta)}</td>
      <td><span class="badge ${activo ? "active":"inactive"}">${activo ? "ACTIVO":"INACTIVO"}</span></td>
      <td><button class="btn btn-secondary btn-sm" data-edit="${escapeHtml(u.id)}">Modificar</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.addEventListener("click", ()=>abrirEditar(btn.dataset.edit));
  });
}

function crearCampo(nombre, valor, removible=true){
  const tipo = getTipo(valor);
  const wrap = document.createElement("div");
  wrap.className = "field-row";
  wrap.dataset.field = nombre;

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.textContent = etiquetaCampo(nombre);

  let input;
  if (tipo === "boolean"){
    input = document.createElement("select");
    input.innerHTML = `<option value="true">Sí</option><option value="false">No</option>`;
    input.value = String(valor);
  } else {
    input = document.createElement("input");
    input.type = tipo === "number" ? "number" : "text";
    if (tipo === "json"){
      input.value = JSON.stringify(valor);
      input.dataset.json = "1";
    } else {
      input.value = valor ?? "";
    }
  }

  input.dataset.key = nombre;
  input.dataset.type = tipo;

  field.appendChild(label);
  field.appendChild(input);
  wrap.appendChild(field);

  if (removible){
    const rm = document.createElement("button");
    rm.className = "remove-field";
    rm.type = "button";
    rm.title = "Quitar campo";
    rm.textContent = "×";
    rm.onclick = ()=> {
      delete camposActuales[nombre];
      wrap.remove();
    };
    wrap.appendChild(rm);
  }

  formCampos.appendChild(wrap);
}

function abrirNuevo(){
  usuarioEditandoId = null;
  camposActuales = {
    usuario: "",
    nombre: "",
    correo: "",
    ruta: "",
    activo: true
  };

  $("modalKicker").textContent = "Nuevo usuario";
  $("modalTitle").textContent = "Agregar usuario";
  btnEliminar.classList.add("hidden");
  docIdBox.classList.add("hidden");
  formCampos.innerHTML = "";

  Object.entries(camposActuales).forEach(([k,v])=>crearCampo(k,v,false));
  modalBackdrop.classList.remove("hidden");
}

async function abrirEditar(id){
  try{
    const snap = await getDoc(doc(db, ...RUTA, id));
    if(!snap.exists()) return toast("El usuario ya no existe.", true);

    usuarioEditandoId = id;
    camposActuales = structuredClone(snap.data());

    $("modalKicker").textContent = "Editar usuario";
    $("modalTitle").textContent = valOr(camposActuales, ["nombre","usuario"], "Modificar usuario");
    docIdText.textContent = id;
    docIdBox.classList.remove("hidden");
    btnEliminar.classList.remove("hidden");

    formCampos.innerHTML = "";
    Object.entries(camposActuales).forEach(([k,v])=>crearCampo(k,v,true));
    modalBackdrop.classList.remove("hidden");
  }catch(e){
    console.error(e);
    toast("No se pudo abrir el usuario.", true);
  }
}

function cerrarModal(){
  modalBackdrop.classList.add("hidden");
  usuarioEditandoId = null;
  camposActuales = {};
}

function leerFormulario(){
  const data = {};
  formCampos.querySelectorAll("[data-key]").forEach(input=>{
    const key = input.dataset.key;
    const type = input.dataset.type;
    let value = input.value;

    if(type === "number") value = value === "" ? null : Number(value);
    if(type === "boolean") value = value === "true";
    if(type === "json"){
      try { value = JSON.parse(value); }
      catch { throw new Error(`El campo "${key}" contiene JSON inválido.`); }
    }
    data[key] = value;
  });
  return data;
}

function generarId(data){
  const base = String(data.usuario || data.correo || data.nombre || "usuario")
    .trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9_-]+/g,"-")
    .replace(/^-+|-+$/g,"");
  return (base || "usuario") + "-" + Date.now().toString().slice(-6);
}

async function guardar(){
  try{
    const data = leerFormulario();
    const id = usuarioEditandoId || generarId(data);
    const ref = doc(db, ...RUTA, id);

    $("btnGuardar").disabled = true;
    $("btnGuardar").textContent = "Guardando...";

    if(usuarioEditandoId){
      await setDoc(ref, data); // reemplaza el documento con los campos visibles
      toast("Usuario modificado correctamente.");
    }else{
      await setDoc(ref, data);
      toast("Usuario agregado correctamente.");
    }

    cerrarModal();
    await cargarUsuarios();
  }catch(e){
    console.error(e);
    toast(e.message || "No se pudo guardar.", true);
  }finally{
    $("btnGuardar").disabled = false;
    $("btnGuardar").textContent = "Guardar cambios";
  }
}

async function eliminarUsuario(){
  if(!usuarioEditandoId) return;
  const nombre = valOr(camposActuales, ["nombre","usuario"], usuarioEditandoId);
  const ok1 = confirm(`¿Eliminar al usuario "${nombre}"?`);
  if(!ok1) return;
  const ok2 = confirm("Esta acción elimina el documento de Firestore. ¿Continuar?");
  if(!ok2) return;

  try{
    btnEliminar.disabled = true;
    btnEliminar.textContent = "Eliminando...";
    await deleteDoc(doc(db, ...RUTA, usuarioEditandoId));
    toast("Usuario eliminado.");
    cerrarModal();
    await cargarUsuarios();
  }catch(e){
    console.error(e);
    toast("No se pudo eliminar: " + e.message, true);
  }finally{
    btnEliminar.disabled = false;
    btnEliminar.textContent = "Eliminar usuario";
  }
}

$("btnNuevo").addEventListener("click", abrirNuevo);
$("btnRecargar").addEventListener("click", cargarUsuarios);
$("btnCerrarModal").addEventListener("click", cerrarModal);
$("btnCancelar").addEventListener("click", cerrarModal);
$("btnGuardar").addEventListener("click", guardar);
btnEliminar.addEventListener("click", eliminarUsuario);
buscar.addEventListener("input", render);

$("btnAgregarCampo").addEventListener("click", ()=>{
  const nombre = $("nuevoCampoNombre").value.trim();
  const tipo = $("nuevoCampoTipo").value;
  if(!nombre) return toast("Escribe el nombre del campo.", true);
  if(formCampos.querySelector(`[data-key="${CSS.escape(nombre)}"]`)) return toast("Ese campo ya existe.", true);

  const valor = tipo === "number" ? 0 : tipo === "boolean" ? true : "";
  camposActuales[nombre] = valor;
  crearCampo(nombre, valor, true);
  $("nuevoCampoNombre").value = "";
});

modalBackdrop.addEventListener("click", e=>{
  if(e.target === modalBackdrop) cerrarModal();
});

window.addEventListener("keydown", e=>{
  if(e.key === "Escape" && !modalBackdrop.classList.contains("hidden")) cerrarModal();
});

cargarUsuarios();
