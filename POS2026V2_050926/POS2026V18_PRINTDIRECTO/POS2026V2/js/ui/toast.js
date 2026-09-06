export function toast(msg, color = "#0c6cbd") {
  const previo = document.getElementById("toastGlobal");
  if (previo) previo.remove();

  const div = document.createElement("div");
  div.id = "toastGlobal";
  div.textContent = msg;

  div.style.cssText = `
    position:fixed;
    bottom:85px;
    left:50%;
    transform:translateX(-50%);
    background:${color};
    color:#fff;
    padding:10px 16px;
    border-radius:12px;
    z-index:99999;
    font-weight:700;
    font-size:15px;
    box-shadow:0 4px 12px rgba(0,0,0,.35);
  `;

  document.body.appendChild(div);

  setTimeout(() => div.remove(), 2200);
}
