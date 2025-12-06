#!/usr/bin/env node
/**
 * Script: set_siigo_iva_config.js
 * Propósito: Configurar parámetros de IVA para facturación SIIGO desde línea de comando.
 *
 * Claves en system_config:
 *  - siigo_tax_iva_id: ID del impuesto IVA (19%) en SIIGO (requerido para forzar IVA por ítem).
 *  - siigo_iva_rate: Porcentaje de IVA (por defecto 19).
 *  - siigo_prices_include_tax: Flag booleano que indica si los precios ya incluyen IVA.
 *
 * Uso:
 *  node backend/scripts/set_siigo_iva_config.js --tax-id=1234 --rate=19 --include=true
 *  node backend/scripts/set_siigo_iva_config.js --tax-id=1234
 *  node backend/scripts/set_siigo_iva_config.js --include=false
 *
 * También soporta variables de entorno:
 *  SIIGO_TAX_IVA_ID=1234 SIIGO_IVA_RATE=19 SIIGO_PRICES_INCLUDE_TAX=true node backend/scripts/set_siigo_iva_config.js
 */

const configService = require('../services/configService');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const a of args) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) {
      out[m[1]] = m[2];
    } else if (a.startsWith('--')) {
      out[a.replace(/^--/, '')] = true;
    }
  }
  return out;
}

(async () => {
  try {
    const args = parseArgs();

    const taxIdRaw = args['tax-id'] ?? process.env.SIIGO_TAX_IVA_ID ?? null;
    const rateRaw = args['rate'] ?? process.env.SIIGO_IVA_RATE ?? null;
    const includeRaw = args['include'] ?? process.env.SIIGO_PRICES_INCLUDE_TAX ?? null;

    let writes = 0;

    if (taxIdRaw !== null && taxIdRaw !== undefined && String(taxIdRaw).trim() !== '') {
      const taxId = Number(taxIdRaw);
      if (Number.isFinite(taxId) && taxId > 0) {
        await configService.setConfig('siigo_tax_iva_id', taxId, 'number', 'ID impuesto IVA 19% de SIIGO');
        console.log(`✅ Guardado siigo_tax_iva_id = ${taxId}`);
        writes++;
      } else {
        console.warn(`⚠️  Valor inválido para --tax-id (${taxIdRaw}). Debe ser número > 0`);
      }
    }

    if (rateRaw !== null && rateRaw !== undefined && String(rateRaw).trim() !== '') {
      const rate = Number(rateRaw);
      if (Number.isFinite(rate) && rate >= 0) {
        await configService.setConfig('siigo_iva_rate', rate, 'number', 'Tasa IVA (%)');
        console.log(`✅ Guardado siigo_iva_rate = ${rate}`);
        writes++;
      } else {
        console.warn(`⚠️  Valor inválido para --rate (${rateRaw}). Debe ser número >= 0`);
      }
    }

    if (includeRaw !== null && includeRaw !== undefined && String(includeRaw).trim() !== '') {
      const val = (includeRaw === true || String(includeRaw).toLowerCase() === 'true' || includeRaw === 1 || String(includeRaw) === '1');
      await configService.setConfig('siigo_prices_include_tax', val ? 'true' : 'false', 'boolean', 'Indica si los precios ya incluyen IVA');
      console.log(`✅ Guardado siigo_prices_include_tax = ${val}`);
      writes++;
    }

    if (writes === 0) {
      console.log('ℹ️  No se recibieron parámetros. Uso:');
      console.log('   node backend/scripts/set_siigo_iva_config.js --tax-id=1234 --rate=19 --include=true');
      console.log('   (o variables de entorno SIIGO_TAX_IVA_ID, SIIGO_IVA_RATE, SIIGO_PRICES_INCLUDE_TAX)');
    }

    // Mostrar valores actuales
    const currentTaxId = await configService.getConfig('siigo_tax_iva_id', null);
    const currentRate = await configService.getConfig('siigo_iva_rate', '19');
    const currentInclude = await configService.getConfig('siigo_prices_include_tax', 'false');

    console.log('\n📋 Configuración actual de IVA:');
    console.log(`   siigo_tax_iva_id        = ${currentTaxId ?? '(no configurado)'}`);
    console.log(`   siigo_iva_rate          = ${currentRate}`);
    console.log(`   siigo_prices_include_tax= ${currentInclude}`);

    console.log('\nSiguiente paso recomendado:');
    console.log('- Crear una factura de prueba desde Inventario + Facturación y validar en SIIGO que los ítems tengan IVA aplicado.');
    console.log('- Si los precios de tus ítems ya incluyen IVA, usa --include=true o SIIGO_PRICES_INCLUDE_TAX=true');
    console.log('- Asegúrate de que el tax-id corresponda al impuesto IVA 19% de tu SIIGO.');
  } catch (err) {
    console.error('❌ Error configurando IVA:', err.message);
    process.exit(1);
  }
})();
