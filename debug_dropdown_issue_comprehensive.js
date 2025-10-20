const axios = require('axios');
const { spawn } = require('child_process');

async function debugDropdownIssueComprehensive() {
  console.log('🔍 === INVESTIGACIÓN COMPLETA DEL PROBLEMA DEL DROPDOWN ===');
  
  try {
    // 1. Verificar si los servidores están corriendo
    console.log('\n🔄 1. Verificando estado de servidores...');
    
    let backendRunning = false;
    let frontendRunning = false;
    
    try {
      const backendResponse = await axios.get('http://localhost:3001/api/health', {
        timeout: 2000
      });
      backendRunning = true;
      console.log('✅ Backend corriendo en puerto 3001');
    } catch (error) {
      console.log('❌ Backend NO está corriendo en puerto 3001');
      try {
        // Verificar si está en otro puerto común
        await axios.get('http://localhost:3000/api/health', { timeout: 2000 });
        console.log('ℹ️ Backend parece estar corriendo en puerto 3000');
      } catch (e) {
        console.log('❌ Backend no encontrado en puertos comunes');
      }
    }
    
    try {
      const frontendResponse = await axios.get('http://localhost:3000/', {
        timeout: 2000
      });
      frontendRunning = true;
      console.log('✅ Frontend corriendo en puerto 3000');
    } catch (error) {
      console.log('❌ Frontend NO está corriendo en puerto 3000');
    }
    
    // 2. Si el backend está corriendo, probar endpoints específicos
    if (backendRunning) {
      console.log('\n📡 2. Probando endpoints específicos del sistema de cotizaciones...');
      
      // Test customer search endpoint sin autenticación
      try {
        const searchResponse = await axios.get('http://localhost:3001/api/quotations/customers/search', {
          params: { q: 'test' },
          timeout: 5000
        });
        console.log('✅ Endpoint de búsqueda de clientes funciona SIN autenticación');
        console.log(`📊 Clientes encontrados: ${searchResponse.data?.length || 0}`);
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('🔐 Endpoint requiere autenticación (401) - ESPERADO');
        } else if (error.response?.status === 500) {
          console.log('❌ Error 500 en endpoint - PROBLEMA');
          console.log('Error:', error.response?.data);
        } else {
          console.log('❌ Error inesperado:', error.response?.status, error.message);
        }
      }
      
      // Verificar si existe el endpoint de quotations
      try {
        const quotationsResponse = await axios.get('http://localhost:3001/api/quotations', {
          timeout: 3000
        });
        console.log('✅ Endpoint /api/quotations existe y responde');
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('🔐 Endpoint /api/quotations existe pero requiere auth');
        } else {
          console.log('❌ Problema con endpoint /api/quotations:', error.response?.status);
        }
      }
    }
    
    // 3. Verificar archivos clave del frontend
    console.log('\n📁 3. Verificando archivos clave del frontend...');
    
    const fs = require('fs');
    const path = require('path');
    
    const criticalFiles = [
      'frontend/src/components/CustomerSearchDropdown.js',
      'frontend/src/pages/QuotationsPage.js',
      'frontend/src/services/api.js'
    ];
    
    for (const filePath of criticalFiles) {
      if (fs.existsSync(filePath)) {
        console.log(`✅ ${filePath} existe`);
        
        // Verificar importaciones en CustomerSearchDropdown
        if (filePath.includes('CustomerSearchDropdown.js')) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          if (content.includes('quotationService.searchCustomers')) {
            console.log('✅ CustomerSearchDropdown usa quotationService.searchCustomers');
          } else {
            console.log('❌ CustomerSearchDropdown NO usa quotationService.searchCustomers');
          }
          
          if (content.includes('useState')) {
            console.log('✅ CustomerSearchDropdown usa hooks de React');
          } else {
            console.log('❌ CustomerSearchDropdown NO usa hooks de React');
          }
        }
      } else {
        console.log(`❌ ${filePath} NO existe`);
      }
    }
    
    // 4. Verificar configuración de API
    console.log('\n🔧 4. Verificando configuración de API...');
    
    if (fs.existsSync('frontend/src/services/api.js')) {
      const apiContent = fs.readFileSync('frontend/src/services/api.js', 'utf8');
      
      if (apiContent.includes('baseURL') && apiContent.includes('3001')) {
        console.log('✅ API configurada para puerto 3001');
      } else if (apiContent.includes('baseURL') && apiContent.includes('3000')) {
        console.log('⚠️ API configurada para puerto 3000 - puede ser incorrecto');
      } else {
        console.log('❌ Configuración de baseURL no encontrada');
      }
      
      if (apiContent.includes('searchCustomers')) {
        console.log('✅ Método searchCustomers existe en api.js');
      } else {
        console.log('❌ Método searchCustomers NO existe en api.js');
      }
    }
    
    // 5. Verificar si QuotationsPage importa correctamente CustomerSearchDropdown
    console.log('\n🔗 5. Verificando importaciones en QuotationsPage...');
    
    if (fs.existsSync('frontend/src/pages/QuotationsPage.js')) {
      const quotationsContent = fs.readFileSync('frontend/src/pages/QuotationsPage.js', 'utf8');
      
      if (quotationsContent.includes('CustomerSearchDropdown')) {
        console.log('✅ QuotationsPage importa CustomerSearchDropdown');
      } else {
        console.log('❌ QuotationsPage NO importa CustomerSearchDropdown');
      }
      
      if (quotationsContent.includes('<CustomerSearchDropdown')) {
        console.log('✅ QuotationsPage usa el componente CustomerSearchDropdown');
      } else {
        console.log('❌ QuotationsPage NO usa el componente CustomerSearchDropdown');
      }
    }
    
    // 6. Recomendaciones basadas en hallazgos
    console.log('\n🎯 === ANÁLISIS Y RECOMENDACIONES ===');
    
    if (!backendRunning) {
      console.log('🚨 PROBLEMA CRÍTICO: Backend no está corriendo');
      console.log('👉 Ejecutar: cd backend && npm start');
    }
    
    if (!frontendRunning) {
      console.log('🚨 PROBLEMA CRÍTICO: Frontend no está corriendo');
      console.log('👉 Ejecutar: cd frontend && npm start');
    }
    
    console.log('\n📋 === PRÓXIMOS PASOS RECOMENDADOS ===');
    console.log('1. 🖥️ Abrir navegador en http://localhost:3000/quotations');
    console.log('2. 🔍 Abrir DevTools (F12) y revisar:');
    console.log('   - Consola de errores JavaScript');
    console.log('   - Pestaña Network para ver requests fallidos');
    console.log('3. 🔄 Intentar usar el dropdown y observar errores');
    
    return {
      backendRunning,
      frontendRunning,
      recommendation: backendRunning && frontendRunning ? 'CHECK_BROWSER_CONSOLE' : 'START_SERVERS'
    };

  } catch (error) {
    console.error('❌ Error general en la investigación:', error.message);
    return { error: error.message };
  }
}

// Ejecutar la investigación
debugDropdownIssueComprehensive()
  .then((result) => {
    console.log('\n✅ Investigación completada');
    console.log('📊 Resultado:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error en investigación:', error);
    process.exit(1);
  });
