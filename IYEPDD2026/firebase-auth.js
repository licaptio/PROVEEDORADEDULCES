/* =========================================
   🔥 FIREBASE AUTH – PROVSOFT AUDITORÍA
   ========================================= */

const firebaseConfig = {
  apiKey: "AIzaSyCK5nb6u2CGRJ8AB1aPlRn54b97bdeAFeM",
  authDomain: "inventariopv-643f1.firebaseapp.com",
  projectId: "inventariopv-643f1",
  storageBucket: "inventariopv-643f1.firebasestorage.app",
  messagingSenderId: "96242533231",
  appId: "1:96242533231:web:aae75a18fbaf9840529e9a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
window.auth = auth;

/* =========================================
   🔒 PERSISTENCIA
   ========================================= */
const persistReady = auth
  .setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch(err => console.error("Persistencia error:", err));

/* =========================================
   ⏱️ INACTIVIDAD
   ========================================= */
const INACTIVITY_LIMIT = 4 * 60 * 1000;
const LAST_ACTIVE_KEY = "provsoft_auditoria_last_active_ms";

let inactivityTimer = null;
let watchdogInterval = null;
let authUiBound = false;

function $id(id) {
  return document.getElementById(id);
}

function notifyAuthUIChanged() {
  document.dispatchEvent(new CustomEvent("provsoft-auth-changed"));
}

function setLastActiveNow() {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch (_) {}
}

function getLastActive() {
  try {
    const v = sessionStorage.getItem(LAST_ACTIVE_KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch (_) {
    return 0;
  }
}

function isExpired() {
  const last = getLastActive();
  if (!last) return false;
  return (Date.now() - last) >= INACTIVITY_LIMIT;
}

function stopTimers() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = null;

  if (watchdogInterval) clearInterval(watchdogInterval);
  watchdogInterval = null;
}

function startWatchdog() {
  if (watchdogInterval) return;

  watchdogInterval = setInterval(() => {
    if (auth.currentUser && isExpired()) {
      logout("Sesión cerrada por inactividad.");
    }
  }, 10000);
}

function resetInactivityTimer() {
  if (!auth.currentUser) return;

  setLastActiveNow();

  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    logout("Sesión cerrada por 4 minutos de inactividad.");
  }, INACTIVITY_LIMIT);

  startWatchdog();
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach(evt => {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

document.addEventListener("visibilitychange", () => {
  if (!auth.currentUser) return;
  if (document.hidden) return;

  if (isExpired()) {
    logout("Sesión cerrada por inactividad.");
  } else {
    resetInactivityTimer();
  }
});

/* =========================================
   🔐 LOGIN
   ========================================= */
async function login() {
  const emailEl = $id("email");
  const passEl = $id("password");
  const errorBox = $id("loginError");
  const loginWrap = $id("loginWrap");
  const loadingScreen = $id("loadingScreen");

  const email = emailEl ? emailEl.value.trim() : "";
  const password = passEl ? passEl.value : "";

  if (errorBox) errorBox.innerText = "";

  if (!email || !password) {
    if (errorBox) errorBox.innerText = "Escribe correo y contraseña.";
    return;
  }

  if (loadingScreen) {
    loadingScreen.textContent = "Entrando...";
    loadingScreen.style.display = "flex";
  }
  if (loginWrap) {
    loginWrap.style.display = "none";
  }

  await persistReady;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    let msg = "Error de autenticación.";

    if (err?.code === "auth/invalid-login-credentials" || err?.code === "auth/wrong-password") {
      msg = "Correo o contraseña incorrectos.";
    } else if (err?.code === "auth/user-not-found") {
      msg = "Usuario no encontrado.";
    } else if (err?.code === "auth/invalid-email") {
      msg = "Correo inválido.";
    } else if (err?.code === "auth/too-many-requests") {
      msg = "Demasiados intentos. Intenta más tarde.";
    } else if (err?.message) {
      msg = err.message;
    }

    if (loadingScreen) loadingScreen.style.display = "none";
    if (loginWrap) loginWrap.style.display = "flex";
    if (errorBox) errorBox.innerText = msg;
  }
}

/* =========================================
   🔒 LOGOUT
   ========================================= */
function logout(msg = "") {
  stopTimers();

  auth.signOut().finally(() => {
    const emailEl = $id("email");
    const passEl = $id("password");
    const errorBox = $id("loginError");

    if (emailEl) emailEl.value = "";
    if (passEl) passEl.value = "";
    if (errorBox) errorBox.innerText = msg || "";

    try {
      sessionStorage.removeItem(LAST_ACTIVE_KEY);
    } catch (_) {}

    applyAuthUI(auth.currentUser);
    notifyAuthUIChanged();
  });
}

window.provsoftLogin = login;
window.provsoftLogout = logout;

/* =========================================
   🧩 UI
   ========================================= */
function bindAuthUI() {
  if (authUiBound) return;
  authUiBound = true;

  const btnLogin = $id("btnLogin");
  const emailEl = $id("email");
  const passEl = $id("password");

  if (btnLogin) {
    btnLogin.addEventListener("click", login);
  }

  if (emailEl) {
    emailEl.addEventListener("keydown", e => {
      if (e.key === "Enter") login();
    });
  }

  if (passEl) {
    passEl.addEventListener("keydown", e => {
      if (e.key === "Enter") login();
    });
  }
}

function applyAuthUI(user) {
  const loginWrap = $id("loginWrap");
  const appShell = $id("appShell");
  const loadingScreen = $id("loadingScreen");
  const sessionUser = $id("sessionUser");

  if (user) {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (loginWrap) loginWrap.style.display = "none";
    if (appShell) appShell.style.display = "block";
    if (sessionUser) sessionUser.textContent = `Usuario: ${user.email || "sin correo"}`;

    setLastActiveNow();
    resetInactivityTimer();
  } else {
    if (loadingScreen) loadingScreen.style.display = "none";
    if (appShell) appShell.style.display = "none";
    if (loginWrap) loginWrap.style.display = "flex";

    stopTimers();
  }
}

function initAuthUI() {
  bindAuthUI();
  applyAuthUI(auth.currentUser);
  notifyAuthUIChanged();
}

/* =========================================
   🔒 SESIÓN ACTIVA
   ========================================= */
auth.onAuthStateChanged(user => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      bindAuthUI();
      applyAuthUI(user);
      notifyAuthUIChanged();
    }, { once: true });
    return;
  }

  bindAuthUI();
  applyAuthUI(user);
  notifyAuthUIChanged();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthUI, { once: true });
} else {
  initAuthUI();
}
