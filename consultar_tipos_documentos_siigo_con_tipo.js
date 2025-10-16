const siigoService = require('./backend/services/siigoService');
const axios = require('axios');

async function consultarTiposDocumentosConTipo() {
  try {
    console.log('🔍 CONSULTANDO TIPOS DE DOCUMENTOS EN SIIGO CON PARÁMETRO TYPE');
    console.log('='.repeat(70));

    // PASO 1: Autenticar con SIIGO
    console.log('\n📝 PASO 1: Autenticación con SIIGO');
    const token = await siigoService.authenticate();
    console.log('✅ Autenticación exitosa');

    // PASO 2: Consultar tipos de documentos con diferentes types
    console.log('\n📋 PASO 2: Consultando tipos de documentos con diferentes tipos');
    
    const possibleTypes = [
      'invoice',
      'FV', 
      'voucher',
      'document',
      'sales',
      'factura',
      'billing'
    ];

    let allDocumentTypes = [];

    for (let type of possibleTypes) {
      console.log(`\n🔍 Probando type="${type}"...`);
      
      try {
        const response = await axios.get(
          `${siigoService.getBaseUrl()}/v1/document-types?type=${type}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Partner-Id': 'siigo'
            }
          }
        );

        console.log(`✅ Type="${type}" funcionó - ${response.data?.length || 0} documentos`);
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          console.log(`📊 Documentos encontrados con type="${type}":`);
          response.data.forEach((doc, index) => {
            console.log(`   ${index + 1}. ID: ${doc.id} - ${doc.name}`);
            if (doc.code) console.log(`      Código: ${doc.code}`);
            if (doc.active !== undefined) console.log(`      Activo: ${doc.active ? 'Sí' : 'No'}`);
          });
          
          // Agregar a la lista total
          allDocumentTypes = [...allDocumentTypes, ...response.data];
        }
        
      } catch (typeError) {
        console.log(`❌ Type="${type}" falló:`, typeError.response?.status || typeError.message);
        if (typeError.response?.data?.Errors) {
          typeError.response.data.Errors.forEach(error => {
            console.log(`   - ${error.Code}: ${error.Message}`);
          });
        }
      }
    }

    // PASO 3: Analizar todos los documentos encontrados
    if (allDocumentTypes.length > 0) {
      console.log('\n🎯 ANÁLISIS COMPLETO DE DOCUMENTOS ENCONTRADOS:');
      console.log('='.repeat(60));
      
      // Eliminar duplicados basado en ID
      const uniqueDocuments = allDocumentTypes.filter((doc, index, self) => 
        index === self.findIndex(d => d.id === doc.id)
      );
      
      console.log(`📊 Total de documentos únicos: ${uniqueDocuments.length}`);
      
      // Buscar específicamente facturas
      console.log('\n🔍 BUSCANDO FACTURAS (FV-1 y FV-2):');
      console.log('='.repeat(50));
      
      const facturas = uniqueDocuments.filter(doc => 
        doc.name.toLowerCase().includes('factura') ||
        doc.name.toLowerCase().includes('fv') ||
        doc.code?.toLowerCase().includes('fv') ||
        doc.name.toLowerCase().includes('venta') ||
        doc.name.toLowerCase().includes('invoice')
      );
      
      if (facturas.length > 0) {
        console.log(`📄 Facturas encontradas: ${facturas.length}`);
        facturas.forEach(factura => {
          console.log(`\n📋 ID: ${factura.id}`);
          console.log(`   Nombre: ${factura.name}`);
          console.log(`   Código: ${factura.code || 'N/A'}`);
          console.log(`   Activo: ${factura.active ? 'Sí' : 'No'}`);
          
          // Identificar si podría ser FV-1 o FV-2
          const esPosibleFV1 = factura.name.toLowerCase().includes('fv-1') ||
                               factura.name.toLowerCase().includes('fv 1') ||
                               factura.name.toLowerCase().includes('no electr') ||
                               factura.name.toLowerCase().includes('pos') ||
                               factura.name.toLowerCase().includes('manual');
                               
          const esPosibleFV2 = factura.name.toLowerCase().includes('fv-2') ||
                               factura.name.toLowerCase().includes('fv 2') ||
                               factura.name.toLowerCase().includes('electr') ||
                               factura.name.toLowerCase().includes('dian');
          
          if (esPosibleFV1) {
            console.log(`   🎯 POSIBLE FV-1 (No electrónica)`);
          }
          if (esPosibleFV2) {
            console.log(`   ⚡ POSIBLE FV-2 (Electrónica)`);
          }
        });
        
        // Identificar el candidato más probable para FV-1
        const candidatoFV1 = facturas.find(f => 
          f.name.toLowerCase().includes('fv-1') ||
          f.name.toLowerCase().includes('no electr') ||
          f.name.toLowerCase().includes('pos')
        );
        
        if (candidatoFV1) {
          console.log('\n🏆 CANDIDATO MÁS PROBABLE PARA FV-1:');
          console.log(`📋 ID: ${candidatoFV1.id}`);
          console.log(`📄 Nombre: ${candidatoFV1.name}`);
          console.log(`🔧 Código: ${candidatoFV1.code || 'N/A'}`);
          
          console.log('\n✨ LISTO PARA CREAR FACTURA FV-1:');
          console.log(`Usar document.id = ${candidatoFV1.id} para crear facturas FV-1`);
        } else {
          console.log('\n⚠️ No se encontró un candidato obvio para FV-1');
          console.log('💡 Recomendación: Revisar manualmente los nombres de las facturas');
        }

        // Verificar FV-2 conocido (ID 27081)
        const fv2Conocido = facturas.find(f => f.id === 27081);
        if (fv2Conocido) {
          console.log('\n✅ CONFIRMACIÓN FV-2:');
          console.log(`📋 ID: ${fv2Conocido.id} - ${fv2Conocido.name}`);
          console.log('(Este es el FV-2 que ya sabemos que funciona)');
        }

      } else {
        console.log('❌ No se encontraron facturas en ningún tipo');
      }

      // Mostrar todos los documentos únicos para referencia
      console.log('\n📊 TODOS LOS DOCUMENTOS ÚNICOS ENCONTRADOS:');
      console.log('='.repeat(60));
      uniqueDocuments.forEach((doc, index) => {
        console.log(`${index + 1}. ID: ${doc.id} - ${doc.name} (Código: ${doc.code || 'N/A'})`);
      });

    } else {
      console.log('\n❌ No se encontraron documentos con ningún tipo');
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.stack) {
      console.log('📊 Stack:', error.stack);
    }
  }
}

console.log('🚀 Consultando tipos de documentos en SIIGO con parámetro type...\n');
consultarTiposDocumentosConTipo();
