const { query } = require('./backend/config/database');

const addMoreCarriers = async () => {
  try {
    console.log('🚛 Agregando más transportadoras a la base de datos...');
    
    // Lista de transportadoras adicionales comunes en Colombia
    const carriers = [
      // Mensajería local especial
      { name: 'Mensajería Local', email: null, phone: null, website: null, active: true },
      
      // Transportadoras nacionales adicionales
      { name: 'Camión Externo', email: null, phone: null, website: null, active: true },
      { name: 'Tempo Express', email: 'info@tempoexpress.com', phone: '01-8000-522-020', website: 'https://tempoexpress.com', active: true },
      { name: 'FedEx Colombia', email: 'colombia@fedex.com', phone: '01-8000-463-339', website: 'https://fedex.com/co', active: true },
      { name: 'DHL Express', email: 'contacto@dhl.com.co', phone: '01-8000-919-345', website: 'https://dhl.com.co', active: true },
      { name: 'UPS Colombia', email: 'colombia@ups.com', phone: '01-8000-517-877', website: 'https://ups.com/co', active: true },
      { name: 'Mensajeros Urbanos', email: 'info@mensajerosurbanos.com', phone: '01-580-0150', website: 'https://mensajerosurbanos.com', active: true },
      { name: 'Rappi Envíos', email: 'soporte@rappi.com', phone: '01-593-6959', website: 'https://rappi.com.co', active: true },
      { name: 'Logística Nacional', email: null, phone: null, website: null, active: true },
      { name: 'Transporte Propio', email: null, phone: null, website: null, active: true },
      { name: '472 Mensajería', email: 'info@472.com.co', phone: '01-444-0472', website: 'https://472.com.co', active: true },
      { name: 'Veloz Logística', email: 'info@velozlogistica.com', phone: '01-8000-936-369', website: 'https://velozlogistica.com', active: true },
      { name: 'Alianza Logística', email: 'contacto@alianzalogistica.com', phone: '01-8000-110-900', website: 'https://alianzalogistica.com', active: true },
      { name: 'Colvanes', email: 'servicioalcliente@colvanes.com', phone: '01-8000-955-955', website: 'https://colvanes.com', active: true },
      { name: 'Saferbo', email: 'info@saferbo.com', phone: '01-745-5555', website: 'https://saferbo.com', active: true },
      { name: 'Envia.co', email: 'hola@envia.co', phone: '01-580-0550', website: 'https://envia.co', active: true },
      { name: 'Liftit', email: 'soporte@liftit.co', phone: '01-381-4842', website: 'https://liftit.co', active: true },
      { name: 'Picap', email: 'hola@picap.co', phone: '300-912-2272', website: 'https://picap.co', active: true },
      { name: 'Zoom Logistics', email: 'info@zoomlogistics.co', phone: '01-300-0123', website: 'https://zoomlogistics.co', active: true },
      { name: 'Flash Courier', email: 'ventas@flashcourier.com.co', phone: '01-422-0707', website: 'https://flashcourier.com.co', active: true },
      { name: 'Blue Express', email: 'servicioalcliente@blue.cl', phone: '01-8000-100-200', website: 'https://blue.cl', active: true },
      { name: 'Mercado Envíos', email: 'envios@mercadolibre.com.co', phone: '01-357-0506', website: 'https://envios.mercadolibre.com.co', active: true },
      { name: 'A Tiempo Cargo', email: 'info@atiempocargo.com', phone: '01-8000-111-666', website: 'https://atiempocargo.com', active: true },
      { name: 'Efecty Giros y Envíos', email: 'servicio@efecty.com.co', phone: '01-8000-113-999', website: 'https://efecty.com.co', active: true },
      { name: 'Matrix Giros y Servicios', email: 'servicio@matrixgs.co', phone: '01-8000-180-425', website: 'https://matrixgs.co', active: true }
    ];
    
    let added = 0;
    let skipped = 0;
    
    for (const carrier of carriers) {
      try {
        // Verificar si ya existe
        const existing = await query(
          'SELECT id FROM carriers WHERE name = ?',
          [carrier.name]
        );
        
        if (existing.length > 0) {
          console.log(`⚠️  Transportadora "${carrier.name}" ya existe, omitiendo...`);
          skipped++;
          continue;
        }
        
        // Insertar nueva transportadora
        await query(
          `INSERT INTO carriers (name, email, phone, website, active) 
           VALUES (?, ?, ?, ?, ?)`,
          [carrier.name, carrier.email, carrier.phone, carrier.website, carrier.active]
        );
        
        console.log(`✅ Agregada: ${carrier.name}`);
        added++;
      } catch (error) {
        console.error(`❌ Error agregando ${carrier.name}:`, error.message);
      }
    }
    
    console.log('\n📊 Resumen:');
    console.log(`   - Transportadoras agregadas: ${added}`);
    console.log(`   - Transportadoras omitidas (ya existían): ${skipped}`);
    
    // Mostrar todas las transportadoras activas
    const allCarriers = await query(
      'SELECT name FROM carriers WHERE active = TRUE ORDER BY name'
    );
    
    console.log(`\n📋 Total de transportadoras activas: ${allCarriers.length}`);
    console.log('Lista de transportadoras disponibles:');
    allCarriers.forEach((c, index) => {
      console.log(`   ${index + 1}. ${c.name}`);
    });
    
    console.log('\n🎉 Proceso completado exitosamente!');
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
  
  process.exit(0);
};

addMoreCarriers();
