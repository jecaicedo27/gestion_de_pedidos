#!/usr/bin/env node
/**
 * Script: set_siigo_options.js
 * Propósito:
 *  - Configurar opciones de facturación SIIGO adicionales:
 *      - siigo_use_prices_from_siigo: usar SIIGO como única fuente de precios (true/false)
 *      - siigo_shipping_product_code: código del ítem de flete/domicilio/envío (ej. FL01)
 *
 * Uso:
 *  node backend/scripts/set_siigo_options.js --use-siigo-prices=true --shipping-code=FL01
 *  node backend/scripts/set_siigo_options.js --use-siigo-prices=false
 *
 * También soporta variables de entorno:
 *  SIIGO_USE_PRICES_FROM_SIIGO=true SIIGO_SHIPPING_PRODUCT_CODE=FL01 node backend/scripts/set_siigo_options.js
 */

const configService = require('../services/configService');

function parseArgs() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (arg.startsWith('--')) out[arg.replace(/^--/, '')] = true;
  }
  return out;
}

(async () => {
  try {
    const args = parseArgs();

    const useSiigoPricesRaw = args['use-siigo-prices'] ?? process.env.SIIGO_USE_PRICES_FROM_SIIGO ?? null;
    const shippingCodeRaw = args['shipping-code'] ?? process.env.SIIGO_SHIPPING_PRODUCT_CODE ?? null;
    const pricesIncludeRaw = args['prices-include-tax'] ?? process.env.SIIGO_PRICES_INCLUDE_TAX ?? null;
    const ivaRateRaw = args['iva-rate'] ?? process.env.SIIGO_IVA_RATE ?? null;

    let writes = 0;

    if (useSiigoPricesRaw !== null && useSiigoPricesRaw !== undefined && String(useSiigoPricesRaw).trim() !== '') {
      const val = (useSiigoPricesRaw === true || String(useSiigoPricesRaw).toLowerCase() === 'true' || useSiigoPricesRaw === 1 || String(useSiigoPricesRaw) === '1');
      await configService.setConfig('siigo_use_prices_from_siigo', val ? 'true' : 'false', 'boolean', 'Usar SIIGO como única fuente de precios por producto');
      console.log(`✅ Guardado siigo_use_prices_from_siigo = ${val}`);
      writes++;
    }

    if (shippingCodeRaw !== null && shippingCodeRaw !== undefined && String(shippingCodeRaw).trim() !== '') {
      const code = String(shippingCodeRaw).trim();
      await configService.setConfig('siigo_shipping_product_code', code, 'string', 'Código de producto/servicio de flete (SIIGO)');
      console.log(`✅ Guardado siigo_shipping_product_code = ${code}`);
      writes++;
    }

    if (pricesIncludeRaw !== null && pricesIncludeRaw !== undefined && String(pricesIncludeRaw).trim() !== '') {
      const val = (pricesIncludeRaw === true || String(pricesIncludeRaw).toLowerCase() === 'true' || pricesIncludeRaw === 1 || String(pricesIncludeRaw) === '1');
      await configService.setConfig('siigo_prices_include_tax', val ? 'true' : 'false', 'boolean', 'Los precios configurados incluyen IVA (entradas con IVA)');
      console.log(`✅ Guardado siigo_prices_include_tax = ${val}`);
      writes++;
    }

    if (ivaRateRaw !== null && ivaRateRaw !== undefined && String(ivaRateRaw).trim() !== '') {
      const rate = String(ivaRateRaw).trim();
      const numeric = Number(rate);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        throw new Error(`Valor inválido para --iva-rate: ${rate}`);
      }
      await configService.setConfig('siigo_iva_rate', rate, 'number', 'Porcentaje de IVA por defecto para conversión precio base/impuesto');
      console.log(`✅ Guardado siigo_iva_rate = ${rate}`);
      writes++;
    }

    if (writes === 0) {
      console.log('ℹ️  No se recibieron parámetros. Uso:');
      console.log('   node backend/scripts/set_siigo_options.js --use-siigo-prices=true --shipping-code=FL01 --prices-include-tax=true --iva-rate=19');
    }

    // Mostrar valores actuales
    const currentUse = await configService.getConfig('siigo_use_prices_from_siigo', 'true');
    const currentShip = await configService.getConfig('siigo_shipping_product_code', '(no configurado)');
    const currentInclude = await configService.getConfig('siigo_prices_include_tax', 'false');
    const currentIva = await configService.getConfig('siigo_iva_rate', '19');

    console.log('\n📋 Opciones actuales:');
    console.log(`   siigo_use_prices_from_siigo = ${currentUse}`);
    console.log(`   siigo_shipping_product_code = ${currentShip}`);
    console.log(`   siigo_prices_include_tax = ${currentInclude}`);
    console.log(`   siigo_iva_rate = ${currentIva}`);

    console.log('\nSiguiente paso recomendado:');
    console.log('- Reiniciar servicios para asegurar que todo use las nuevas opciones.');
    console.log('- Desde el front, crear factura enviando solo code + quantity por ítem.');
  } catch (err) {
    console.error('❌ Error configurando opciones SIIGO:', err.message);
    process.exit(1);
  }
})();
