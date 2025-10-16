const siigoService = require('./backend/services/siigoService');
const { query } = require('./backend/config/database');

async function testCompleteImportFlow() {
  console.log('🧪 PROBANDO FLUJO COMPLETO DE IMPORTACIÓN DESDE SIIGO');
  console.log('==================================================\n');

  try {
    console.log('📋 1. Obteniendo facturas recientes de SIIGO...');
    const invoicesResponse = await siigoService.getInvoices({
      page: 1,
      page_size: 20
    });
    
    if (!invoicesResponse.results || invoicesResponse.results.length === 0) {
      console.log('❌ No se encontraron facturas en SIIGO');
      return;
    }
    
    console.log(`✅ ${invoicesResponse.results.length} facturas encontradas\n`);
    
    // Buscar una factura que no esté ya importada
    for (const invoice of invoicesResponse.results) {
      console.log(`🔍 2. Verificando factura ${invoice.name || invoice.id}...`);
      
      // Verificar si ya existe en la base de datos
      const existing = await query(
        'SELECT id FROM orders WHERE siigo_invoice_id = ?',
        [invoice.id]
      );
      
      if (existing.length > 0) {
        console.log(`⚠️ Factura ${invoice.name} ya existe en BD (ID: ${existing[0].id}), saltando...\n`);
        continue;
      }
      
      console.log(`✅ Factura ${invoice.name} no existe en BD, procediendo con importación...\n`);
      
      // Obtener detalles completos para ver si tiene observaciones
      console.log(`📄 3. Obteniendo detalles completos de factura ${invoice.id}...`);
      const fullInvoice = await siigoService.getInvoiceDetails(invoice.id);
      
      console.log('📊 DATOS DE LA FACTURA:');
      console.log(`- ID: ${fullInvoice.id}`);
      console.log(`- Nombre: ${fullInvoice.name}`);
      console.log(`- Total: $${fullInvoice.total}`);
      console.log(`- Cliente ID: ${fullInvoice.customer?.id}`);
      
      // Verificar si tiene observaciones con método de pago de envío
      const hasShippingPaymentInfo = (text) => {
        if (!text) return false;
        return text.includes('FORMA DE PAGO DE ENVIO') || text.includes('FORMA DE PAGO DE ENVÍO');
      };
      
      const hasPaymentInfo = hasShippingPaymentInfo(fullInvoice.observations) || 
                           hasShippingPaymentInfo(fullInvoice.notes) || 
                           hasShippingPaymentInfo(fullInvoice.comments);
      
      console.log(`- Observaciones: ${fullInvoice.observations ? 'SÍ' : 'NO'}`);
      console.log(`- Notas: ${fullInvoice.notes ? 'SÍ' : 'NO'}`);
      console.log(`- Comentarios: ${fullInvoice.comments ? 'SÍ' : 'NO'}`);
      console.log(`- Tiene info de pago de envío: ${hasPaymentInfo ? 'SÍ' : 'NO'}`);
      
      if (fullInvoice.observations) {
        console.log(`\n📝 OBSERVACIONES:`)
        console.log(fullInvoice.observations);
      }
      
      if (fullInvoice.notes) {
        console.log(`\n📝 NOTAS:`);
        console.log(fullInvoice.notes);
      }
      
      // Simular extracción del método de pago de envío ANTES de importar
      console.log(`\n💰 4. SIMULANDO EXTRACCIÓN DE MÉTODO DE PAGO DE ENVÍO:`);
      const extractShippingPaymentMethod = (invoice, fullInvoice) => {
        const textSources = [
          fullInvoice.observations,
          fullInvoice.notes,
          fullInvoice.comments,
          invoice.observations,
          invoice.notes
        ].filter(Boolean);
        
        for (const text of textSources) {
          if (!text) continue;
          
          const normalizedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\s+/g, ' ');
          
          const lines = normalizedText.split('\n');
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.match(/^FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:/i)) {
              const paymentMethodMatch = trimmedLine.replace(/^FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:\s*/i, '').trim();
              if (paymentMethodMatch) {
                const normalized = paymentMethodMatch.toLowerCase();
                if (normalized.includes('contado')) return 'contado';
                if (normalized.includes('contraentrega') || normalized.includes('contra entrega')) return 'contraentrega';
                return paymentMethodMatch;
              }
            }
          }
        }
        
        return null;
      };
      
      const extractedPaymentMethod = extractShippingPaymentMethod(invoice, fullInvoice);
      console.log(`🎯 MÉTODO EXTRAÍDO: ${extractedPaymentMethod || 'NINGUNO'}`);
      
      // Proceder con la importación real
      console.log(`\n🚀 5. IMPORTANDO FACTURA A LA BASE DE DATOS...`);
      try {
        const importResult = await siigoService.processInvoiceToOrder(
          fullInvoice, 
          'transferencia', 
          'domicilio'
        );
        
        console.log(`✅ IMPORTACIÓN EXITOSA:`);
        console.log(`- Pedido ID: ${importResult.orderId}`);
        console.log(`- Items: ${importResult.itemsCount}`);
        console.log(`- Mensaje: ${importResult.message}`);
        
        // Verificar qué se guardó en la base de datos
        console.log(`\n🔍 6. VERIFICANDO DATOS GUARDADOS EN BD...`);
        const savedOrder = await query(
          `SELECT 
            id, order_number, customer_name, customer_phone, customer_address,
            shipping_payment_method, siigo_observations, total_amount
           FROM orders 
           WHERE id = ?`,
          [importResult.orderId]
        );
        
        if (savedOrder.length > 0) {
          const order = savedOrder[0];
          console.log(`📊 DATOS GUARDADOS:`);
          console.log(`- ID: ${order.id}`);
          console.log(`- Número: ${order.order_number}`);
          console.log(`- Cliente: ${order.customer_name}`);
          console.log(`- Teléfono: ${order.customer_phone}`);
          console.log(`- Dirección: ${order.customer_address}`);
          console.log(`- 💰 MÉTODO DE PAGO ENVÍO: ${order.shipping_payment_method || 'NO GUARDADO'}`);
          console.log(`- Total: $${order.total_amount}`);
          console.log(`- Observaciones guardadas: ${order.siigo_observations ? 'SÍ' : 'NO'}`);
          
          console.log(`\n🎉 RESULTADO DEL FLUJO COMPLETO:`);
          if (extractedPaymentMethod && order.shipping_payment_method) {
            if (extractedPaymentMethod === order.shipping_payment_method) {
              console.log(`✅ ¡ÉXITO! El método de pago se extrajo Y guardó correctamente`);
              console.log(`   Extraído: "${extractedPaymentMethod}"`);
              console.log(`   Guardado: "${order.shipping_payment_method}"`);
            } else {
              console.log(`⚠️ Se extrajo pero se guardó diferente`);
              console.log(`   Extraído: "${extractedPaymentMethod}"`);
              console.log(`   Guardado: "${order.shipping_payment_method}"`);
            }
          } else if (extractedPaymentMethod && !order.shipping_payment_method) {
            console.log(`❌ Se extrajo pero NO se guardó en la base de datos`);
            console.log(`   Extraído: "${extractedPaymentMethod}"`);
            console.log(`   Guardado: null`);
          } else if (!extractedPaymentMethod && !order.shipping_payment_method) {
            console.log(`ℹ️ No había método de pago en las observaciones (esperado)`);
          } else {
            console.log(`❓ Caso inusual: se guardó sin extraer`);
          }
        }
        
        return; // Salir después del primer éxito
        
      } catch (importError) {
        console.error(`❌ Error importando factura:`, importError.message);
        continue; // Intentar con la siguiente factura
      }
    }
    
    console.log('❌ No se encontró ninguna factura válida para importar');
    
  } catch (error) {
    console.error('❌ Error en test:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar test
testCompleteImportFlow();
