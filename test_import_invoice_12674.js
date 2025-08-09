const siigoService = require('./backend/services/siigoService');
const { query } = require('./backend/config/database');

async function testImportInvoice12674() {
  console.log('🧪 PROBANDO IMPORTACIÓN DE FACTURA FV-2-12674');
  console.log('=============================================\n');

  try {
    // 1. Primero buscar la factura en SIIGO
    console.log('📋 1. Buscando factura FV-2-12674 en SIIGO...');
    const invoicesResponse = await siigoService.getInvoices({
      page: 1,
      page_size: 50
    });
    
    const invoice12674 = invoicesResponse.results?.find(inv => 
      inv.name === 'FV-2-12674' || inv.number === '12674' || inv.id.includes('20b6b4f82fc0')
    );
    
    if (!invoice12674) {
      console.log('❌ Factura FV-2-12674 no encontrada en SIIGO');
      return;
    }
    
    console.log('✅ Factura encontrada:');
    console.log(`- ID: ${invoice12674.id}`);
    console.log(`- Nombre: ${invoice12674.name}`);
    console.log(`- Total: $${invoice12674.total}`);
    console.log(`- Cliente ID: ${invoice12674.customer?.id}`);
    
    // 2. Intentar importarla
    console.log('\n📥 2. Intentando importar la factura...');
    try {
      const result = await siigoService.importInvoices(
        [invoice12674.id], 
        'transferencia', 
        'domicilio'
      );
      
      console.log('\n✅ RESULTADO DE IMPORTACIÓN:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.results && result.results[0]) {
        const importResult = result.results[0];
        console.log('\n📊 DETALLES DEL RESULTADO:');
        console.log(`- Success: ${importResult.success}`);
        console.log(`- Order ID: ${importResult.orderId}`);
        console.log(`- Message: ${importResult.message}`);
        
        if (!importResult.success) {
          console.log(`\n❌ ERROR EN IMPORTACIÓN: ${importResult.message}`);
        }
      }
      
    } catch (importError) {
      console.error('\n❌ ERROR AL IMPORTAR:', importError.message);
      console.error('Stack:', importError.stack);
    }
    
    // 3. Verificar si se guardó en la BD
    console.log('\n📋 3. Verificando en base de datos...');
    const savedOrder = await query(
      `SELECT * FROM orders 
       WHERE order_number LIKE '%12674%' 
          OR invoice_code LIKE '%12674%'
          OR siigo_invoice_id = ?`,
      [invoice12674.id]
    );
    
    if (savedOrder.length > 0) {
      console.log('✅ Pedido guardado en BD:', savedOrder[0]);
    } else {
      console.log('❌ Pedido NO se guardó en la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

// Ejecutar test
testImportInvoice12674();
