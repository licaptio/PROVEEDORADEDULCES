import { db } from "./firebase/config.js";
import { money } from "./util/money.js";
import { toast } from "./ui/toast.js";
import { renderLogin } from "./auth/login.js";

import {
  cargarCatalogo,
  cargarCatalogoFotos
} from "./catalogo/catalogo.js";
import { prepararSistemaAntesDelLogin } from "./ui/inicioSistema.js";

window.__PROVSOFT_ARRANQUE_INICIADO = true;

window.db = db;
window.money = money;
window.toast = toast;

window.POS = {
  db,
  money,
  toast,
  cargarCatalogo,
  cargarCatalogoFotos
};

await prepararSistemaAntesDelLogin(db);
renderLogin();

window.addEventListener("pos:login-ok", () => toast("Catálogo listo"));

console.log("PROVSOFT POS 2026 cargado correctamente");
