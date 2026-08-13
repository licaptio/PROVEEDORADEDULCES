export function crearFirma(canvas) {
  const ctx = canvas.getContext("2d");
  let drawing = false;

  function resize() {
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    if (!width || !height) return;
    canvas.width = width;
    canvas.height = height;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
  }

  const getPos = e => {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  };

  const start = e => {
    drawing = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };

  const move = e => {
    if (!drawing) return;
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };

  const end = () => { drawing = false; };

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
  window.addEventListener("resize", resize);

  return {
    resize,
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); },
    hasInk() {
      if (!canvas.width || !canvas.height) return false;
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v !== 0);
    },
    getBase64() { return canvas.toDataURL("image/png"); }
  };
}
