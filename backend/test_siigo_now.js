require('dotenv').config();
console.log('💰 ========== CONSULTA REAL SIIGO BALANCE ==========\n');

console.log('🔧 Configuración SIIGO:');
console.log('   - SIIGO_ENABLED:', process.env.SIIGO_ENABLED);
console.log('   - SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME);
console.log('   - SIIGO_API_BASE_URL:', process.env.SIIGO_API_BASE_URL);

const siigoService = require('./services/siigoService');

async function consultarSaldoReal() {
  const nit = '59856269';
  console.log('\n🔍 Consultando NIT:', nit, '(JUDIT XIMENA BENAVIDES PABON)');
  
  try {
    console.log('👤 Buscando cliente en SIIGO...');
    const cliente = await siigoService.findCustomerByNit(nit);
    
    if (cliente) {
      console.log('✅ Cliente encontrado:');
      console.log('   - Nombre:', cliente.commercial_name || cliente.name);
      console.log('   - ID SIIGO:', cliente.id);
      console.log('   - NIT:', cliente.identification);
      
      console.log('\n💰 Obteniendo cuentas por cobrar...');
      const cuentas = await siigoService.getCustomerAccountsReceivable(cliente.id);
      
      console.log('\n📊 RESULTADO:');
      console.log('=====================================');
      console.log('💰 Saldo Total: $' + (cuentas.total_balance?.toLocaleString('es-CO') || '0'));
      console.log('📋 Total de Facturas:', cuentas.total_invoices || 0);
      
      if (cuentas.pending_invoices && cuentas.pending_invoices.length > 0) {
        console.log('\n📄 FACTURAS PENDIENTES (primeras 5):');
        cuentas.pending_invoices.slice(0, 5).forEach((factura, index) => {
          const numero = factura.number || factura.name || factura.id;
          const saldo = factura.balance || factura.total || 0;
          console.log(`   ${index + 1}. ${numero} - $${saldo.toLocaleString('es-CO')}`);
        });
        
        if (cuentas.pending_invoices.length > 5) {
          console.log(`   ... y ${cuentas.pending_invoices.length - 5} facturas más`);
        }
      }
      
      console.log('\n🎯 COMPARACIÓN:');
      console.log('   - SIIGO Web (tu captura): $3,519,551.24');
      console.log('   - API SIIGO (nuestro resultado): $' + (cuentas.total_balance?.toLocaleString('es-CO') || '0'));
      
      const diferencia = (cuentas.total_balance || 0) - 3519551.24;
      if (Math.abs(diferencia) < 100) {
        console.log('   ✅ Los saldos coinciden (diferencia < $100)');
      } else {
        console.log('   ⚠️  Diferencia:', '$' + diferencia.toLocaleString('es-CO'));
      }
      
      console.log('\n🔧 El walletController debería devolver:');
      console.log(JSON.stringify({
        current_balance: cuentas.total_balance || 0,
        credit_limit: 10000000,
        available_credit: 10000000 - (cuentas.total_balance || 0),
        credit_utilization: (((cuentas.total_balance || 0) / 10000000) * 100).toFixed(2) + '%'
      }, null, 2));
      
    } else {
      console.log('❌ Cliente no encontrado en SIIGO');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

consultarSaldoReal();
