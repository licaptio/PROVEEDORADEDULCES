export async function guardarVenta(db, venta) {

  const { collection, addDoc } =
    await import(
      "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
    );

  const ref = collection(db, "ventas_rutav2");

  const docRef = await addDoc(ref, venta);

  return docRef.id;
}
