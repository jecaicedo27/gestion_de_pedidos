const extractRecipientDataFromNotes = (notes) => {
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

        console.log(`Processing line: "${trimmed}" -> Normalized: "${ln}"`);

        // Formas de pago de envío
        if (/^forma\s*de\s*pago\s*de\s*envio\s*:/.test(ln) || /^pago\s*envio\s*:/.test(ln) || /^metodo\s*envio\s*:/.test(ln)) {
            data.shippingPaymentMethod = getAfterColon(trimmed);
            continue;
        }
        // Medio de pago del pedido
        if (/^medio\s*de\s*pago\s*:/.test(ln) || /^metodo\s*de\s*pago\s*:/.test(ln) || /^pago\s*:/.test(ln)) {
            data.paymentMethod = getAfterColon(trimmed);
            continue;
        }
        // Nombre/NIT
        if (/^(nombre|destinatario)\s*:/.test(ln)) {
            data.name = getAfterColon(trimmed);
            continue;
        }
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
        // Destino: puede venir "DESTINO: Ciudad - Departamento"
        if (/^destino\s*:/.test(ln)) {
            const v = getAfterColon(trimmed);
            const parts = v.split(/[-,]/).map(p => p.trim()).filter(Boolean);
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

const testNotes = `ESTADO DE PAGO: CONFIRMADO
MEDIO DE PAGO: TRANSFERENCIA
FORMA DE PAGO DE ENVIO: CONTADO
NOMBRE: Maryoli liseth Garcia Alvarez
NIT: 1092527463
TELÉFONO: 3155873199
DEPARTAMENTO: NORTE DE SANTANDER
CIUDAD: cucuta
DIRECCIÓN: Av12#6-37 loma de bolivar
NOTA: Distribuidor Cucuta.`;

const result = extractRecipientDataFromNotes(testNotes);
console.log('Result:', result);
