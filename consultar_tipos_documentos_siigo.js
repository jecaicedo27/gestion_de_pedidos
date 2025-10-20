const siigoService = require('./backend/services/siigoService');
const axios = require('axios');

async function consultarTiposDocumentos() {
  try {
    console.log('🔍 CONSULTANDO TIPOS DE DOCUMENTOS EN SIIGO');
    console.log('='.repeat(60));

    // PASO 1: Autenticar con SIIGO
    console.log('\n📝 PASO 1: Autenticación con SIIGO');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');

    // PASO 2: Consultar tipos de documentos
    console.log('\n📋 PASO 2: Consultando tipos de documentos');
    
    try {
      const response = await axios.get(
        `${siigoService.getBaseUrl()}/v1/document-types`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'siigo'
          }
        }
      );

      console.log('✅ Tipos de documentos obtenidos');
      console.log(`📊 Total de tipos: ${response.data?.length || 0}`);
      
      if (response.data && Array.isArray(response.data)) {
        console.log('\n📋 TIPOS DE DOCUMENTOS DISPONIBLES:');
        console.log('='.repeat(50));
        
        response.data.forEach((doc, index) => {
          console.log(`${index + 1}. ID: ${doc.id} - ${doc.name}`);
          if (doc.code) {
            console.log(`   Código: ${doc.code}`);
          }
          if (doc.active !== undefined) {
            console.log(`   Activo: ${doc.active ? 'Sí' : 'No'}`);
          }
          console.log('');
        });

        // Buscar específicamente FV-1 o facturas no electrónicas
        console.log('\n🔍 BUSCANDO TIPOS RELACIONADOS CON FACTURAS:');
        console.log('='.repeat(50));
        
        const facturas = response.data.filter(doc => 
          doc.name.toLowerCase().includes('factura') ||
          doc.name.toLowerCase().includes('fv') ||
          doc.code?.toLowerCase().includes('fv')
        );
        
        if (facturas.length > 0) {
          facturas.forEach(factura => {
            console.log(`📄 ID: ${factura.id}`);
            console.log(`   Nombre: ${factura.name}`);
            console.log(`   Código: ${factura.code || 'N/A'}`);
            console.log(`   Activo: ${factura.active ? 'Sí' : 'No'}`);
            console.log('');
          });
          
          // Identificar cuál podría ser FV-1
          const posibleFV1 = facturas.find(f => 
            f.name.toLowerCase().includes('fv-1') ||
            f.name.toLowerCase().includes('no electr') ||
            f.name.toLowerCase().includes('pos')
          );
          
          if (posibleFV1) {
            console.log('🎯 POSIBLE FV-1 IDENTIFICADO:');
            console.log(`   ID: ${posibleFV1.id} - ${posibleFV1.name}`);
          }
        } else {
          console.log('❌ No se encontraron tipos de facturas');
        }

      } else {
        console.log('❌ Respuesta inesperada:', response.data);
      }

    } catch (docError) {
      console.log('❌ Error consultando tipos de documentos:', docError.message);
      if (docError.response?.data) {
        console.log('📊 Error details:', JSON.stringify(docError.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.stack) {
      console.log('📊 Stack:', error.stack);
    }
  }
}

console.log('🚀 Consultando tipos de documentos en SIIGO...\n');
consultarTiposDocumentos();
