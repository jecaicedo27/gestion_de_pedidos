// Cargar variables de entorno
require('dotenv').config();

const siigoService = require('./services/siigoService');
const { query } = require('./config/database');

async function fixExistingOrdersCustomerInfo() {
  try {
    console.log('🔧 Iniciando corrección de información de clientes en pedidos existentes...');
    
    // Obtener pedidos con "Cliente sin nombre" que tengan siigo_invoice_id
    const ordersToFix = await query(`
      SELECT id, siigo_invoice_id, customer_name, customer_phone, customer_email, customer_address, customer_city, customer_department
      FROM orders 
      WHERE customer_name = 'Cliente sin nombre' 
      AND siigo_invoice_id IS NOT NULL 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`📋 Encontrados ${ordersToFix.length} pedidos para corregir`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const order of ordersToFix) {
      console.log(`\n🔍 Procesando pedido ${order.id} - Factura: ${order.siigo_invoice_id}`);
      
      try {
        // Obtener la factura completa desde SIIGO
        const invoice = await siigoService.getInvoice(order.siigo_invoice_id);
        
        if (invoice.customer && invoice.customer.id) {
          console.log(`👤 Obteniendo información completa del cliente: ${invoice.customer.id}`);
          
          // Obtener información completa del cliente
          const fullCustomer = await siigoService.getCustomer(invoice.customer.id);
          
          if (fullCustomer) {
            // Combinar datos de la factura con datos completos del cliente
            const enrichedInvoice = {
              ...invoice,
              customer: {
                ...invoice.customer,
                ...fullCustomer
              }
            };
            
            // Extraer información del cliente usando la lógica del servicio
            const customerInfo = siigoService.extractCustomerInfo(enrichedInvoice);
            
            console.log('✅ Información extraída:', {
              name: customerInfo.name,
              phone: customerInfo.phone,
              email: customerInfo.email,
              city: customerInfo.city,
              department: customerInfo.department
            });
            
            // Actualizar el pedido en la base de datos
            await query(`
              UPDATE orders 
              SET 
                customer_name = ?,
                customer_phone = ?,
                customer_email = ?,
                customer_address = ?,
                customer_city = ?,
                customer_department = ?,
                updated_at = NOW()
              WHERE id = ?
            `, [
              customerInfo.name,
              customerInfo.phone,
              customerInfo.email,
              customerInfo.address,
              customerInfo.city,
              customerInfo.department,
              order.id
            ]);
            
            console.log(`✅ Pedido ${order.id} actualizado exitosamente`);
            fixedCount++;
            
          } else {
            console.log(`❌ No se pudo obtener información completa del cliente ${invoice.customer.id}`);
            errorCount++;
          }
        } else {
          console.log('❌ La factura no tiene información de cliente');
          errorCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error procesando pedido ${order.id}:`, error.message);
        errorCount++;
      }
      
      // Pequeña pausa para no sobrecargar la API de SIIGO
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Resumen de la corrección:');
    console.log(`✅ Pedidos corregidos: ${fixedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📋 Total procesados: ${ordersToFix.length}`);
    
  } catch (error) {
    console.error('❌ Error en la corrección:', error.message);
  }
}

// Ejecutar corrección
fixExistingOrdersCustomerInfo().then(() => {
  console.log('\n✅ Corrección completada');
  process.exit(0);
}).catch(error => {
  console.error('❌ Error fatal:', error.message);
  process.exit(1);
});
