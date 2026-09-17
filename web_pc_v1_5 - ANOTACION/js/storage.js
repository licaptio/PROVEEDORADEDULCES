import {
  deleteObject, getDownloadURL, ref, uploadBytes
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import { storage } from "./firebase-config.js";

export async function subirImagenes(recordatorioId, archivos, onProgress) {
  const imagenes = [];

  for (let i = 0; i < archivos.length; i++) {
    const archivo = archivos[i];
    const extension = obtenerExtension(archivo.type);
    const nombre = `${Date.now()}_${i}_${crypto.randomUUID()}.${extension}`;
    const ruta = `recordatorios/${recordatorioId}/${nombre}`;
    const referencia = ref(storage, ruta);

    onProgress?.(i + 1, archivos.length, archivo.name || `imagen_${i + 1}`);

    await uploadBytes(referencia, archivo, {
      contentType: archivo.type || "image/png",
      customMetadata: { recordatorioId }
    });

    const url = await getDownloadURL(referencia);
    imagenes.push({
      url,
      ruta,
      nombre_original: archivo.name || nombre,
      tipo: archivo.type || "image/png"
    });
  }

  return imagenes;
}

export async function eliminarImagenes(imagenes) {
  for (const imagen of imagenes) {
    if (!imagen?.ruta) continue;
    try {
      await deleteObject(ref(storage, imagen.ruta));
    } catch (error) {
      if (error.code !== "storage/object-not-found") throw error;
    }
  }
}

function obtenerExtension(tipo) {
  const mapa = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };
  return mapa[tipo] || "png";
}
