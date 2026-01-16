// ===============================
// PROVSOFT UI CORE 2026
// ===============================

// ===== CONFIGURACIÓN =====
const PROVSOFT_UI = {
  empresa: "PROVEEDORA DE DULCES Y DESECHABLES",
  sistema: "PROVSOFT",
  año: "2026",

  logo: {
    // 👉 Si no hay logo, déjalo en null
    src: null, 
    alt: "Logo Empresa",
    size: 42
  },

  theme: {
    bg: "#020617",
    card: "#020617",
    primary: "#2563eb",
    danger: "#7f1d1d",
    text: "#e5e7eb",
    muted: "#94a3b8",
    border: "#334155"
  }
};

// ===============================
// INYECTAR CSS GLOBAL
// ===============================
const css = `
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: Poppins, Arial, sans-serif;
  background: ${PROVSOFT_UI.theme.bg};
  color: ${PROVSOFT_UI.theme.text};
  padding: 24px;
}

.provsoft-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 8px;
}

.provsoft-header img {
  width: ${PROVSOFT_UI.logo.size}px;
  height: auto;
}

.provsoft-title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.provsoft-subtitle {
  font-size: 13px;
  color: ${PROVSOFT_UI.theme.muted};
}

.provsoft-divider {
  margin: 14px 0;
  border-bottom: 1px solid ${PROVSOFT_UI.theme.border};
}

.provsoft-card {
  background: ${PROVSOFT_UI.theme.card};
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 0 18px rgba(0,0,0,.45);
}

button {
  background: ${PROVSOFT_UI.theme.primary};
  border: none;
  padding: 12px 20px;
  border-radius: 12px;
  color: white;
  font-size: 14px;
  cursor: pointer;
}

button:disabled {
  background: ${PROVSOFT_UI.theme.border};
  cursor: not-allowed;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 8px;
  border-bottom: 1px solid ${PROVSOFT_UI.theme.border};
  text-align: left;
}

th {
  color: ${PROVSOFT_UI.theme.muted};
  font-size: 13px;
}

.provsoft-footer {
  margin-top: 30px;
  text-align: center;
  font-size: 12px;
  color: ${PROVSOFT_UI.theme.muted};
}

.provsoft-danger {
  background: ${PROVSOFT_UI.theme.danger};
  border: 2px solid #dc2626;
  border-radius: 12px;
  padding: 14px;
  font-weight: bold;
}
`;

const style = document.createElement("style");
style.innerHTML = css;
document.head.appendChild(style);

// ===============================
// HEADER
// ===============================
const header = document.createElement("div");
header.className = "provsoft-header";

if (PROVSOFT_UI.logo.src) {
  const logo = document.createElement("img");
  logo.src = PROVSOFT_UI.logo.src;
  logo.alt = PROVSOFT_UI.logo.alt;
  header.appendChild(logo);
}

const titles = document.createElement("div");
titles.innerHTML = `
  <div class="provsoft-title">${PROVSOFT_UI.empresa}</div>
  <div class="provsoft-subtitle">Sistema ${PROVSOFT_UI.sistema}</div>
`;

header.appendChild(titles);
document.body.prepend(header);

// ===============================
// FOOTER
// ===============================
const footer = document.createElement("div");
footer.className = "provsoft-footer";
footer.innerHTML = `
  POWERED BY <b>${PROVSOFT_UI.sistema}</b> · ${PROVSOFT_UI.año}
`;
document.body.appendChild(footer);
