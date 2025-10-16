const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3001';
const TEST_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function consultarUltimaFacturaSiigo() {
  try {
    console.log('🔍 CONSULTA DE ÚLTIMA FACTURA CREADA EN SIIGO');
    console.log('='.repeat(60));

    // PASO 1: Autenticación
    console.log('\n📝 PASO 1: Autenticación');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_CREDENTIALS);
    console.log('✅ Login exitoso');
    
    const token = loginResponse.data.data.token;
    const authHeaders = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // PASO 2: Consultar facturas recientes de SIIGO
    console.log('\n📋 PASO 2: Consultando facturas recientes de SIIGO');
    
    // Obtener fecha de hoy y ayer para filtrar facturas recientes
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`🗓️ Buscando facturas creadas entre ${yesterdayStr} y ${todayStr}`);
    
    try {
      // Llamar al endpoint del backend que consulta SIIGO
      const facturas = await axios.get(`${BASE_URL}/api/siigo/invoices`, {
        headers: authHeaders,
        params: {
          page: 1,
          page_size: 20,
          created_start: yesterdayStr,
          created_end: todayStr
        }
      });

      console.log('✅ Facturas obtenidas de SIIGO');
      console.log(`📊 Total de facturas encontradas: ${facturas.data?.pagination?.total_results || 0}`);
      
      if (facturas.data?.results && facturas.data.results.length > 0) {
        console.log('\n📋 FACTURAS ENCONTRADAS:');
        console.log('='.repeat(50));
        
        facturas.data.results.forEach((factura, index) => {
          console.log(`\n${index + 1}. 📄 FACTURA:`);
          console.log(`   🏷️ Número: ${factura.number || 'N/A'}`);
          console.log(`   🆔 ID SIIGO: ${factura.id || 'N/A'}`);
          console.log(`   📅 Fecha: ${factura.date || 'N/A'}`);
          console.log(`   👤 Cliente: ${factura.customer?.identification || 'N/A'} - ${factura.customer?.name || 'N/A'}`);
          console.log(`   💰 Total: $${factura.total || 0} COP`);
          console.log(`   📋 Estado: ${factura.status || 'N/A'}`);
          console.log(`   📝 Tipo Documento: ${factura.document?.id || 'N/A'} (${factura.document?.name || 'N/A'})`);
          
          // Mostrar items si están disponibles
          if (factura.items && factura.items.length > 0) {
            console.log('   📦 Items:');
            factura.items.forEach((item, itemIndex) => {
              console.log(`      ${itemIndex + 1}. ${item.code || 'N/A'} - ${item.description || 'N/A'}`);
              console.log(`         Cantidad: ${item.quantity || 0}, Precio: $${item.price || 0}`);
            });
          }
          
          // Si tiene observaciones, mostrarlas (pueden contener referencia a nuestro sistema)
          if (factura.observations) {
            const obs = factura.observations.substring(0, 100);
            console.log(`   📄 Observaciones: ${obs}${factura.observations.length > 100 ? '...' : ''}`);
          }
          
          console.log(`   🔗 URL SIIGO: https://app.siigo.com/app/invoices/${factura.id}`);
        });

        // Identificar la última factura (la más reciente)
        const ultimaFactura = facturas.data.results[0]; // SIIGO normalmente devuelve ordenado por fecha desc
        
        console.log('\n🎯 ÚLTIMA FACTURA CREADA:');
        console.log('='.repeat(50));
        console.log(`📄 Número de Factura: ${ultimaFactura.number}`);
        console.log(`🆔 ID del Documento: ${ultimaFactura.id}`);
        console.log(`📋 Tipo de Documento: ${ultimaFactura.document?.id} - ${ultimaFactura.document?.name}`);
        console.log(`📅 Fecha de Creación: ${ultimaFactura.date}`);
        console.log(`💰 Total: $${ultimaFactura.total} COP`);
        console.log(`👤 Cliente: ${ultimaFactura.customer?.identification} - ${ultimaFactura.customer?.name}`);

        // PASO 3: Obtener detalles completos de la última factura
        console.log('\n🔍 PASO 3: Obteniendo detalles completos de la última factura');
        
        try {
          const detallesFactura = await axios.get(`${BASE_URL}/api/siigo/invoices/${ultimaFactura.id}`, {
            headers: authHeaders
          });
          
          console.log('✅ Detalles completos obtenidos');
          console.log('📊 INFORMACIÓN COMPLETA:');
          console.log(JSON.stringify(detallesFactura.data, null, 2));
          
        } catch (detallesError) {
          console.log('⚠️ No se pudieron obtener detalles completos:', detallesError.response?.data || detallesError.message);
        }

      } else {
        console.log('❌ No se encontraron facturas en el período especificado');
        
        // Intentar buscar con un rango más amplio
        console.log('\n🔍 Intentando búsqueda más amplia (últimos 7 días)...');
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        
        try {
          const facturasAmplia = await axios.get(`${BASE_URL}/api/siigo/invoices`, {
            headers: authHeaders,
            params: {
              page: 1,
              page_size: 10,
              created_start: weekAgoStr,
              created_end: todayStr
            }
          });
          
          if (facturasAmplia.data?.results && facturasAmplia.data.results.length > 0) {
            console.log(`📋 Encontradas ${facturasAmplia.data.results.length} facturas en los últimos 7 días:`);
            facturasAmplia.data.results.forEach((factura, index) => {
              console.log(`${index + 1}. ${factura.number} - ${factura.date} - $${factura.total}`);
            });
          } else {
            console.log('❌ No se encontraron facturas en los últimos 7 días');
          }
        } catch (ampliaError) {
          console.log('❌ Error en búsqueda amplia:', ampliaError.message);
        }
      }

    } catch (siigoError) {
      console.log('❌ Error consultando facturas de SIIGO:', siigoError.response?.data || siigoError.message);
      
      // Intentar consulta directa a SIIGO sin filtros
      console.log('\n🔍 Intentando consulta directa sin filtros...');
      try {
        const facturasSinFiltros = await axios.get(`${BASE_URL}/api/siigo/invoices`, {
          headers: authHeaders,
          params: {
            page: 1,
            page_size: 5
          }
        });
        
        console.log('✅ Facturas obtenidas sin filtros');
        if (facturasSinFiltros.data?.results) {
          facturasSinFiltros.data.results.forEach((factura, index) => {
            console.log(`${index + 1}. ${factura.number || factura.id} - ${factura.date} - $${factura.total || 0}`);
          });
        }
        
      } catch (sinFiltrosError) {
        console.log('❌ Error también en consulta sin filtros:', sinFiltrosError.message);
      }
    }

    // PASO 4: Verificar si hay quotations guardadas localmente que puedan tener referencia SIIGO
    console.log('\n📋 PASO 4: Verificando quotations locales con referencia SIIGO');
    
    try {
      const quotationsResponse = await axios.get(`${BASE_URL}/api/quotations`, {
        headers: authHeaders,
        params: {
          limit: 10,
          page: 1
        }
      });
      
      if (quotationsResponse.data?.data && quotationsResponse.data.data.length > 0) {
        console.log(`✅ Encontradas ${quotationsResponse.data.data.length} quotations locales`);
        
        const quotationsConSiigo = quotationsResponse.data.data.filter(q => 
          q.siigo_invoice_id || q.siigo_invoice_number || (q.notes && q.notes.includes('SIIGO'))
        );
        
        if (quotationsConSiigo.length > 0) {
          console.log(`🎯 ${quotationsConSiigo.length} quotations tienen referencia SIIGO:`);
          quotationsConSiigo.forEach((q, index) => {
            console.log(`${index + 1}. ID: ${q.id}`);
            console.log(`   SIIGO Invoice ID: ${q.siigo_invoice_id || 'N/A'}`);
            console.log(`   SIIGO Invoice Number: ${q.siigo_invoice_number || 'N/A'}`);
            console.log(`   Customer: ${q.customer_name || q.customer_id}`);
            console.log(`   Total: $${q.total_amount || 0}`);
            console.log(`   Fecha: ${q.created_at}`);
          });
        } else {
          console.log('ℹ️ No se encontraron quotations con referencia SIIGO');
        }
      } else {
        console.log('ℹ️ No se encontraron quotations locales');
      }
      
    } catch (quotationsError) {
      console.log('⚠️ Error consultando quotations locales:', quotationsError.message);
    }

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    if (error.response?.data) {
      console.log('📊 Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

console.log('🚀 Consultando última factura creada en SIIGO...\n');
consultarUltimaFacturaSiigo();
