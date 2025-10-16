const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function checkSiigoQuotationAPI() {
  try {
    console.log('🔍 Verificando API de cotizaciones SIIGO...\n');
    
    // Credenciales SIIGO
    const SIIGO_API_URL = process.env.SIIGO_API_BASE_URL || 'https://api.siigo.com';
    const SIIGO_USERNAME = process.env.SIIGO_API_USERNAME;
    const SIIGO_ACCESS_KEY = process.env.SIIGO_API_ACCESS_KEY;
    
    console.log('📋 Credenciales SIIGO:');
    console.log(`   URL: ${SIIGO_API_URL}`);
    console.log(`   Usuario: ${SIIGO_USERNAME}`);
    console.log(`   Access Key: ${SIIGO_ACCESS_KEY ? '✓ Configurada' : '✗ No configurada'}`);
    
    // Autenticar
    console.log('\n🔐 Autenticando con SIIGO...');
    const authResponse = await axios.post(`${SIIGO_API_URL}/auth`, {
      username: SIIGO_USERNAME,
      access_key: SIIGO_ACCESS_KEY
    });
    
    const token = authResponse.data.access_token;
    console.log('✅ Token obtenido exitosamente');
    
    // Obtener tipos de documentos disponibles
    console.log('\n📄 Obteniendo tipos de documentos disponibles...');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Partner-Id': 'siigo'
    };
    
    try {
      const docsResponse = await axios.get(`${SIIGO_API_URL}/v1/document-types`, { headers });
      console.log('\n✅ Tipos de documentos disponibles:');
      
      const quotationTypes = docsResponse.data.filter(doc => 
        doc.name?.toLowerCase().includes('cotiz') || 
        doc.name?.toLowerCase().includes('quote') ||
        doc.type === 'Quote' ||
        doc.code === 'COT'
      );
      
      if (quotationTypes.length > 0) {
        console.log('\n🎯 Tipos de documento para COTIZACIONES encontrados:');
        quotationTypes.forEach(doc => {
          console.log(`   ID: ${doc.id} - ${doc.name} (${doc.code || 'Sin código'})`);
        });
      } else {
        console.log('\n⚠️ No se encontraron tipos específicos para cotizaciones');
        console.log('   Mostrando todos los tipos disponibles:');
        docsResponse.data.slice(0, 10).forEach(doc => {
          console.log(`   ID: ${doc.id} - ${doc.name} (${doc.code || 'Sin código'})`);
        });
      }
      
    } catch (error) {
      console.log('\n⚠️ No se pudo obtener tipos de documentos');
      console.log('   Error:', error.response?.data || error.message);
    }
    
    // Verificar endpoints disponibles
    console.log('\n🔍 Verificando endpoints disponibles...');
    
    // Verificar endpoint de estimates (cotizaciones)
    console.log('\n1. Verificando /v1/estimates...');
    try {
      const estimatesResponse = await axios.get(`${SIIGO_API_URL}/v1/estimates?page_size=1`, { headers });
      console.log('   ✅ Endpoint de estimates disponible');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   ❌ Endpoint /v1/estimates NO disponible');
      } else {
        console.log('   ⚠️ Error:', error.response?.status || error.message);
      }
    }
    
    // Verificar endpoint de invoices (facturas)
    console.log('\n2. Verificando /v1/invoices...');
    try {
      const invoicesResponse = await axios.get(`${SIIGO_API_URL}/v1/invoices?page_size=1`, { headers });
      console.log('   ✅ Endpoint de invoices disponible');
    } catch (error) {
      console.log('   ❌ Error:', error.response?.status || error.message);
    }
    
    // Verificar endpoint de documents (documentos genéricos)
    console.log('\n3. Verificando /v1/documents...');
    try {
      const docsResponse = await axios.get(`${SIIGO_API_URL}/v1/documents?page_size=1`, { headers });
      console.log('   ✅ Endpoint de documents disponible');
      console.log('   ℹ️ Este endpoint puede usarse para crear cotizaciones con el document.id correcto');
    } catch (error) {
      console.log('   ❌ Error:', error.response?.status || error.message);
    }
    
    console.log('\n💡 RECOMENDACIÓN:');
    console.log('   Para crear cotizaciones en SIIGO, usa el endpoint /v1/invoices');
    console.log('   con el document.id correcto para cotizaciones (probablemente 2, 24, o consulta document-types)');
    console.log('   La estructura debe ser similar a la de facturas pero con el tipo de documento de cotización');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
  }
}

checkSiigoQuotationAPI();
