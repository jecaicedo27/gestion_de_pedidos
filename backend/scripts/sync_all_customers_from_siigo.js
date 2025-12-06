const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query } = require('../config/database');
const siigoService = require('../services/siigoService');
const customerUpdateService = require('../services/customerUpdateService');

(async () => {
  try {
    console.log('👥 Iniciando sincronización completa de clientes desde SIIGO...');
    const maxPages = parseInt(process.env.SIIGO_MAX_PAGES || '300', 10);
    const customers = await siigoService.getAllCustomers(maxPages);
    console.log(`📊 Total recibido desde SIIGO: ${customers.length}`);

    const existingRows = await query('SELECT siigo_id FROM customers WHERE siigo_id IS NOT NULL');
    const existing = new Set(existingRows.map(r => r.siigo_id));

    let processed = 0, created = 0, updated = 0, errors = 0;

    for (const c of customers) {
      try {
        const extracted = customerUpdateService.extractCompleteCustomerData(c);
        const before = existing.has(c.id);
        await customerUpdateService.upsertCustomer(c.id, extracted);
        processed++;
        if (!before) { existing.add(c.id); created++; } else { updated++; }
        if (processed % 50 === 0) {
          console.log(`⏩ Progreso: ${processed}/${customers.length} | nuevos: ${created} | actualizados: ${updated}`);
        }
      } catch (e) {
        console.error('❌ Error procesando cliente', c?.id, e.message);
        errors++;
      }
    }

    console.log('✅ Sincronización completa finalizada');
    console.log(`📈 Procesados: ${processed} | Nuevos: ${created} | Actualizados: ${updated} | Errores: ${errors}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error crítico en sincronización completa:', err.message);
    process.exit(1);
  }
})();
