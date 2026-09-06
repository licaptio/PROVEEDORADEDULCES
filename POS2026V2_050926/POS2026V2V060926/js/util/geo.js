export const GEO_ACTIVO = false;

export async function obtenerUbicacionSegura() {
  if (!GEO_ACTIVO) return null;

  try {
    return await obtenerUbicacionRobusta();
  } catch (err) {
    console.warn(err);
    return null;
  }
}
