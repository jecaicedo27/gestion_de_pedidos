// Utils para extraer datos del destinatario desde notas/observaciones (alineado con backend)
/**
 * Extrae datos del destinatario desde un bloque de texto (observaciones/notas).
 * Acepta variantes con/sin acentos y diferentes claves.
 * Devuelve objeto si hay información útil (address o city + (name|phone|nit)).
 *
 * Ejemplos de claves soportadas:
 * - Forma de pago de envío: "FORMA DE PAGO DE ENVIO:", "PAGO ENVIO:", "METODO ENVIO:"
 * - Medio de pago (pedido): "MEDIO DE PAGO:", "METODO DE PAGO:", "PAGO:"
 * - Nombre: "NOMBRE:", "DESTINATARIO:"
 * - NIT/Documento: "NIT:", "DOCUMENTO:"
 * - Teléfono: "TELÉFONO:", "TEL:", "CELULAR:", "CEL:", "WHATSAPP:"
 * - Departamento: "DEPARTAMENTO:", "DEPTO:", "DPTO:", "DEPARTMENT:"
 * - Ciudad: "CIUDAD:", "MUNICIPIO:", "CITY:", "CIUDAD DESTINO:"
 * - Destino combinado: "DESTINO: Ciudad - Departamento" o "Ciudad, Departamento"
 * - Dirección: "DIRECCIÓN:", "DIRECCION:", "DIR:", "DIRECCION ENVIO:", "DIRECCION ENTREGA:", "DIRECCION DESTINATARIO:"
 */
export const extractRecipientDataFromNotes = (notes) => {
  if (!notes) return null;

  const raw = String(notes || '');
  const lines = raw.split(/\r?\n/);

  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const getAfterColon = (s) => s.split(':').slice(1).join(':').trim();

  const data = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const ln = norm(trimmed);

    // Forma de pago de envío
    if (/^forma\s*de\s*pago\s*de\s*envio\s*:/.test(ln) || /^pago\s*envio\s*:/.test(ln) || /^metodo\s*envio\s*:/.test(ln)) {
      data.shippingPaymentMethod = getAfterColon(trimmed);
      continue;
    }
    // Medio de pago del pedido
    if (/^medio\s*de\s*pago\s*:/.test(ln) || /^metodo\s*de\s*pago\s*:/.test(ln) || /^pago\s*:/.test(ln)) {
      data.paymentMethod = getAfterColon(trimmed);
      continue;
    }
    // Nombre / destinatario
    if (/^(nombre|destinatario)\s*:/.test(ln)) {
      data.name = getAfterColon(trimmed);
      continue;
    }
    // NIT / documento
    if (/^nit\s*:/.test(ln) || /^documento\s*:/.test(ln)) {
      data.nit = getAfterColon(trimmed);
      continue;
    }
    // Teléfono / WhatsApp
    if (/^(telefono|tel|celular|cel|whatsapp)\s*:/.test(ln)) {
      data.phone = getAfterColon(trimmed);
      continue;
    }
    // Departamento
    if (/^(departamento(\s*destino)?|depto|dpto|department)\s*:/.test(ln)) {
      data.department = getAfterColon(trimmed);
      continue;
    }
    // Ciudad y variantes
    if (/^(ciudad(\s*destino)?|municipio|city)\s*:/.test(ln)) {
      data.city = getAfterColon(trimmed);
      continue;
    }
    // Destino: "DESTINO: Ciudad - Departamento" o "Ciudad, Departamento"
    if (/^destino\s*:/.test(ln)) {
      const v = getAfterColon(trimmed);
      const parts = v.split(/[-,]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 1 && !data.city) data.city = parts[0];
      if (parts.length >= 2 && !data.department) data.department = parts[1];
      continue;
    }
    // Dirección y variantes
    if (/^(direccion(\s*de\s*(envio|entrega))?|dir|direccion envio|direccion entrega|direccion destinatario)\s*:/.test(ln)) {
      data.address = getAfterColon(trimmed);
      continue;
    }
  }

  // Retornar si hay dirección, o ciudad con algún identificador de persona
  const hasUseful =
    !!data.address ||
    (!!data.city && (!!data.name || !!data.phone || !!data.nit));

  return hasUseful ? data : null;
};

export default extractRecipientDataFromNotes;
