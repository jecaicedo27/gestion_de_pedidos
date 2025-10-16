const siigoService = require('./services/siigoService');

async function diagnoseSimple() {
  console.log('🧪 DIAGNÓSTICO SIIGO DIRECTO');
  console.log('============================');
  
  try {
    // Test 1: Autenticación
    console.log('\n1. 🔐 Probando autenticación...');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');
    console.log(`🎫 Token: ${token.substring(0, 20)}...`);
    
    // Test 2: Obtener facturas
    console.log('\n2. 📄 Probando endpoint de facturas...');
    try {
      const invoices = await siigoService.getInvoices({ page_size: 5 });
      console.log('✅ Facturas obtenidas exitosamente');
      console.log(`📊 Total de facturas: ${invoices.results?.length || 0}`);
      if (invoices.results && invoices.results.length > 0) {
        console.log(`📋 Primera factura: ${invoices.results[0].name}`);
      }
    } catch (error) {
      console.log('❌ Error obteniendo facturas:', error.message);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    // Test 3: Factura específica
    console.log('\n3. 🎯 Probando factura específica...');
    const invoiceId = '304eb3e4-f182-415a-a1da-1c1ed86d4758';
    try {
      const invoice = await siigoService.getInvoiceDetails(invoiceId);
      console.log('✅ Factura específica obtenida');
      console.log(`📊 Factura: ${invoice.name}`);
      console.log(`📦 Items: ${invoice.items?.length || 0}`);
      if (invoice.items && invoice.items.length > 0) {
        console.log('🔍 Primer item:', invoice.items[0]);
      }
    } catch (error) {
      console.log('❌ Error obteniendo factura específica:', error.message);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
  
  process.exit(0);
}

diagnoseSimple();
