require('dotenv').config();

async function debugFactura12207Cliente() {
  try {
    console.log('🔍 INVESTIGANDO FACTURA 12207 - CLIENTE REAL');
    console.log('=' .repeat(60));
    
    // Cargar el servicio SIIGO
    const siigoService = require('./services/siigoService');
    
    console.log('\n1️⃣ Buscando factura 12207 directamente en SIIGO...');
    
    // Buscar todas las facturas recientes para encontrar la 12207
    const facturas = await siigoService.getInvoices({
      page_size: 50,
      page: 1
    });
    
    console.log(`📄 Total facturas encontradas: ${facturas.results?.length || 0}`);
    
    // Buscar la factura 12207 específicamente
    const factura12207 = facturas.results?.find(factura => 
      factura.name?.includes('12207') || 
      factura.number?.includes('12207') ||
      factura.consecutive === 12207 ||
      factura.id?.includes('12207')
    );
    
    if (factura12207) {
      console.log('\n✅ FACTURA 12207 ENCONTRADA:');
      console.log('📋 Información básica:');
      console.log(`   - ID: ${factura12207.id}`);
      console.log(`   - Número: ${factura12207.name || factura12207.number}`);
      console.log(`   - Total: $${factura12207.total?.toLocaleString() || '0'}`);
      console.log(`   - Fecha: ${factura12207.created || factura12207.date}`);
      
      // Información del cliente
      if (factura12207.customer) {
        console.log('\n👤 INFORMACIÓN DEL CLIENTE:');
        console.log(`   - ID Cliente: ${factura12207.customer.id || 'No disponible'}`);
        console.log(`   - Identificación: ${factura12207.customer.identification || 'No disponible'}`);
        console.log(`   - Nombre: ${factura12207.customer.commercial_name || factura12207.customer.name || 'No disponible'}`);
        
        // Si hay identificación del cliente, buscar más detalles
        if (factura12207.customer.id) {
          console.log('\n2️⃣ Obteniendo detalles completos del cliente...');
          
          try {
            const clienteCompleto = await siigoService.getCustomer(factura12207.customer.id);
            
            if (clienteCompleto) {
              console.log('\n📊 CLIENTE COMPLETO:');
              console.log('   - ID:', clienteCompleto.id);
              console.log('   - Nombre comercial:', clienteCompleto.commercial_name || 'No disponible');
              console.log('   - Identificación:', clienteCompleto.identification || 'No disponible');
              console.log('   - Tipo cliente:', clienteCompleto.type?.name || 'No disponible');
              
              // Buscar información de contacto
              if (clienteCompleto.contacts && clienteCompleto.contacts.length > 0) {
                const contacto = clienteCompleto.contacts[0];
                console.log('   - Contacto:', `${contacto.first_name || ''} ${contacto.last_name || ''}`.trim());
                console.log('   - Email:', contacto.email || 'No disponible');
                console.log('   - Teléfono:', contacto.phone?.number || 'No disponible');
              }
              
              // Información de dirección
              if (clienteCompleto.address) {
                console.log('   - Dirección:', clienteCompleto.address.address || 'No disponible');
                console.log('   - Ciudad:', clienteCompleto.address.city?.city_name || 'No disponible');
              }
              
              // Si es cliente mostrador, podría tener una identificación específica
              const esClienteMostrador = (
                clienteCompleto.commercial_name?.toLowerCase().includes('mostrador') ||
                clienteCompleto.commercial_name?.toLowerCase().includes('contado') ||
                clienteCompleto.identification === '222222222222' ||
                clienteCompleto.identification === '11111111111' ||
                clienteCompleto.type?.name?.toLowerCase().includes('mostrador')
              );
              
              console.log(`\n🏪 ¿Es cliente mostrador? ${esClienteMostrador ? 'SÍ' : 'NO'}`);
              
              if (esClienteMostrador) {
                console.log('\n📝 NOTA: Esta factura es efectivamente de cliente mostrador');
                console.log('   - Las facturas de mostrador pueden tener comportamiento especial');
                console.log('   - Podrían necesitar manejo diferente en el sistema de refresco');
              } else if (clienteCompleto.identification) {
                console.log(`\n🔍 NIT REAL DEL CLIENTE: ${clienteCompleto.identification}`);
                console.log('   - Use este NIT para futuras pruebas con esta factura');
              }
            }
          } catch (error) {
            console.log(`❌ Error obteniendo detalles del cliente: ${error.message}`);
          }
        }
      } else {
        console.log('\n❌ No se encontró información del cliente en la factura');
      }
      
      // Mostrar estructura completa para debugging
      console.log('\n🔍 ESTRUCTURA COMPLETA DE LA FACTURA:');
      console.log(JSON.stringify(factura12207, null, 2));
      
    } else {
      console.log('\n❌ No se encontró la factura 12207 en las facturas recientes');
      
      // Mostrar las facturas encontradas para referencia
      console.log('\n📋 Facturas encontradas:');
      facturas.results?.slice(0, 10).forEach((factura, index) => {
        console.log(`   ${index + 1}. ${factura.name || factura.number} - $${factura.total?.toLocaleString()} - ${factura.created}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en investigación:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar investigación
debugFactura12207Cliente();
