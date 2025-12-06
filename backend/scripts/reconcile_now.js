#!/usr/bin/env node
/**
 * Dispara reconciliación inmediata con SIIGO para un producto específico o para varios identificadores.
 * Uso:
 *   node backend/scripts/reconcile_now.js --code LIQUIPP07
 *   node backend/scripts/reconcile_now.js --siigo 6595d4c4-e3ae-4a57-bfcb-c89073342adb
 *   node backend/scripts/reconcile_now.js --id 6109
 */
const stockConsistencyService = require('../services/stockConsistencyService');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    const v = args[i + 1];
    if (k === '--code') out.code = v;
    if (k === '--siigo') out.siigo = v;
    if (k === '--id') out.id = v;
  }
  return out;
}

(async () => {
  try {
    const { code, siigo, id } = parseArgs();
    if (!code && !siigo && !id) {
      console.error('Uso: --code <SKU> | --siigo <siigo_id_or_code> | --id <product_id>');
      process.exit(1);
    }

    // Iniciar el servicio (si no está corriendo) y encolar
    await stockConsistencyService.start();
    if (code) {
      console.log('→ Encolando por code:', code);
      stockConsistencyService.enqueueByCode(code);
    }
    if (siigo) {
      console.log('→ Encolando por siigo_id:', siigo);
      stockConsistencyService.enqueueBySiigoId(siigo);
    }
    if (id) {
      console.log('→ Encolando por id:', id);
      stockConsistencyService.enqueueByProductId(id);
    }

    // Dar tiempo breve a timers y procesar inmediatamente un ciclo
    await new Promise((r) => setTimeout(r, 1000));
    console.log('→ Procesando cola ahora...');
    await stockConsistencyService.processQueue();

    // Esperar un poco por cualquier emisión/evento pendiente
    await new Promise((r) => setTimeout(r, 1500));
    console.log('✅ Reconciliación inmediata finalizada');
    process.exit(0);
  } catch (e) {
    console.error('❌ Error en reconciliación inmediata:', e?.message || e);
    process.exit(1);
  }
})();
