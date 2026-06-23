import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseUrl, supabaseAnonKey } from "./config.js";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function buscarFacturaPorUUID(uuid) {
  return await supabase
    .from("deuda_limpia_pdd")
    .select(`
      id,
      uuid_cfdi,
      fecha,
      rfc_emisor,
      razon_social_emisor,
      total,
      serie,
      folio,
      foliotecnopro,
      factura_pagada,
      factura_fisicamente,
      en_observacion,
      observacion_fecha,
      observacion_usuario,
      observacion_nota_actual,
      observacion_actualizada_en,
      observacion_resuelta_fecha,
      observacion_resuelta_usuario,
      observacion_resuelta_nota
    `)
    .eq("uuid_cfdi", uuid)
    .maybeSingle();
}

export async function cargarHistorial(uuid) {
  return await supabase
    .from("deuda_limpia_pdd_observaciones")
    .select("*")
    .eq("uuid_cfdi", uuid)
    .order("fecha_evento", { ascending: false });
}

export async function insertarHistorial(factura, tipo, nota, usuario) {
  return await supabase
    .from("deuda_limpia_pdd_observaciones")
    .insert({
      deuda_id: factura.id,
      uuid_cfdi: factura.uuid_cfdi,
      tipo_evento: tipo,
      nota,
      usuario
    })
    .select();
}

export async function marcarFactura(factura, nota, usuario) {
  return await supabase
    .from("deuda_limpia_pdd")
    .update({
      en_observacion: true,
      observacion_fecha: new Date().toISOString(),
      observacion_usuario: usuario,
      observacion_nota_actual: nota,
      observacion_actualizada_en: new Date().toISOString()
    })
    .eq("id", factura.id);
}

export async function actualizarNotaFactura(factura, nota) {
  return await supabase
    .from("deuda_limpia_pdd")
    .update({
      observacion_nota_actual: nota,
      observacion_actualizada_en: new Date().toISOString()
    })
    .eq("id", factura.id);
}

export async function desmarcarFactura(factura, nota, usuario) {
  return await supabase
    .from("deuda_limpia_pdd")
    .update({
      en_observacion: false,
      observacion_resuelta_fecha: new Date().toISOString(),
      observacion_resuelta_usuario: usuario,
      observacion_resuelta_nota: nota,
      observacion_nota_actual: nota,
      observacion_actualizada_en: new Date().toISOString()
    })
    .eq("id", factura.id);
}

export async function listarObservadas() {
  return await supabase
    .from("deuda_limpia_pdd")
    .select(`
      id,
      uuid_cfdi,
      fecha,
      rfc_emisor,
      razon_social_emisor,
      total,
      serie,
      folio,
      foliotecnopro,
      en_observacion,
      observacion_fecha,
      observacion_usuario,
      observacion_nota_actual,
      observacion_actualizada_en
    `)
    .eq("en_observacion", true)
    .order("observacion_fecha", { ascending: false });
}