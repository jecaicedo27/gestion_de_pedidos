// Cargar variables de entorno
require('dotenv').config();

const siigoService = require('./services/siigoService');
const { query } = require('./config/database');

async function debugCustomerExtraction() {
  try {
    console.log('🔍 Iniciando debug de extracción de clientes...');
    console.log('🔧 Variables de entorno:');
    console.log('- SIIGO_API_BASE_URL:', process.env.SIIGO_API_BASE_URL);
    console.log('- SIIGO_API_USERNAME:', process.env.SIIGO_API_USERNAME);
    console.log('- SIIGO_API_ACCESS_KEY:', process.env.SIIGO_API_ACCESS_KEY ? '***' : 'NO DEFINIDA');
    
    // Obtener una factura reciente que tenga problemas
    const recentOrders = await query(`
      SELECT siigo_invoice_id, customer_name, customer_phone 
      FROM orders 
      WHERE customer_name = 'Cliente sin nombre' 
      AND siigo_invoice_id IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 2
    `);
    
    console.log(`📋 Encontrados ${recentOrders.length} pedidos con "Cliente sin nombre"`);
    
    for (const order of recentOrders) {
      console.log(`\n🔍 Analizando factura: ${order.siigo_invoice_id}`);
      
      try {
        // Obtener la factura completa desde SIIGO
        const invoice = await siigoService.getInvoice(order.siigo_invoice_id);
        
        console.log('📄 Estructura básica de la factura:');
        console.log('- ID:', invoice.id);
        console.log('- Number:', invoice.number);
        console.log('- Total:', invoice.total);
        console.log('- Customer ID:', invoice.customer?.id);
        
        if (invoice.customer) {
          console.log('\n👤 Información del cliente en la factura:');
          console.log(JSON.stringify(invoice.customer, null, 2));
          
          // Intentar obtener información completa del cliente
          if (invoice.customer.id) {
            console.log(`\n🔍 Obteniendo información completa del cliente: ${invoice.customer.id}`);
            
            const fullCustomer = await siigoService.getCustomer(invoice.customer.id);
            
            if (fullCustomer) {
              console.log('\n👤 Información completa del cliente desde SIIGO:');
              console.log(JSON.stringify(fullCustomer, null, 2));
              
              // Probar la extracción de información
              console.log('\n🧪 Probando extracción de información...');
              
              // Simular el proceso de extracción
              const testInvoice = {
                ...invoice,
                customer: {
                  ...invoice.customer,
                  ...fullCustomer
                }
              };
              
              const extractedInfo = siigoService.extractCustomerInfo(testInvoice);
              console.log('\n✅ Información extraída:');
              console.log(JSON.stringify(extractedInfo, null, 2));
              
            } else {
              console.log('❌ No se pudo obtener información completa del cliente');
            }
          }
        } else {
          console.log('❌ La factura no tiene información de cliente');
        }
        
      } catch (error) {
        console.error(`❌ Error procesando factura ${order.siigo_invoice_id}:`, error.message);
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error.message);
  }
}

// Ejecutar debug
debugCustomerExtraction().then(() => {
  console.log('\n✅ Debug completado');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
