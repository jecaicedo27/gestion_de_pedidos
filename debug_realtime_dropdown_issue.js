const axios = require('axios');

console.log('🔍 DIAGNÓSTICO EN TIEMPO REAL: Dropdown de mensajeros vacío');
console.log('=========================================================\n');

async function debugRealtimeDropdownIssue() {
  try {
    console.log('1️⃣ Probando directamente la API de usuarios/mensajeros...');
    
    // Simular la misma request que hace el frontend
    const response = await axios.get('http://localhost:3001/api/users?role=mensajero&active=true', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 Status: ${response.status}`);
    console.log(`📊 Headers:`, response.headers);
    console.log(`📋 Data structure:`, JSON.stringify(response.data, null, 2));

    console.log('\n2️⃣ Analizando estructura de respuesta...');
    
    const data = response.data;
    
    if (Array.isArray(data)) {
      console.log('✅ Respuesta es un array directo');
      console.log(`👥 Mensajeros encontrados: ${data.length}`);
      data.forEach((m, index) => {
        console.log(`   ${index + 1}. ID: ${m.id}, full_name: "${m.full_name}", username: "${m.username}"`);
      });
    } else if (data.success && data.data) {
      console.log('✅ Respuesta tiene estructura { success, data }');
      
      if (data.data.users) {
        console.log('✅ data.users existe');
        console.log(`👥 Mensajeros encontrados: ${data.data.users.length}`);
        data.data.users.forEach((m, index) => {
          console.log(`   ${index + 1}. ID: ${m.id}, full_name: "${m.full_name}", username: "${m.username}"`);
        });
      } else if (Array.isArray(data.data)) {
        console.log('✅ data.data es un array');
        console.log(`👥 Mensajeros encontrados: ${data.data.length}`);
        data.data.forEach((m, index) => {
          console.log(`   ${index + 1}. ID: ${m.id}, full_name: "${m.full_name}", username: "${m.username}"`);
        });
      } else {
        console.log('❌ data.data no es reconocible:', data.data);
      }
    } else {
      console.log('❌ Estructura de respuesta no reconocida');
    }

    console.log('\n3️⃣ Simulando el procesamiento del frontend...');
    
    // Simular exactamente lo que hace el LogisticsModal corregido
    let frontendMessengers = [];
    const messengersData = data;
    
    if (Array.isArray(messengersData)) {
      frontendMessengers = messengersData;
      console.log('🔄 Frontend: Procesando como array directo');
    } else if (messengersData.success && messengersData.data) {
      console.log('🔄 Frontend: Procesando estructura con success/data');
      if (messengersData.data.users) {
        frontendMessengers = messengersData.data.users;
        console.log('🔄 Frontend: Usando data.users');
      } else if (Array.isArray(messengersData.data)) {
        frontendMessengers = messengersData.data;
        console.log('🔄 Frontend: Usando data como array');
      } else {
        frontendMessengers = [];
        console.log('🔄 Frontend: data no reconocida, usando array vacío');
      }
    } else if (messengersData.users) {
      frontendMessengers = messengersData.users;
      console.log('🔄 Frontend: Usando users directo');
    } else {
      frontendMessengers = [];
      console.log('🔄 Frontend: Estructura no reconocida, usando array vacío');
    }

    console.log(`\n📊 Frontend mensajeros procesados: ${frontendMessengers.length}`);

    if (frontendMessengers.length > 0) {
      console.log('📋 Opciones que debería generar el dropdown:');
      const dropdownOptions = frontendMessengers.map(messenger => ({
        value: messenger.id.toString(),
        label: messenger.full_name || messenger.username || 'Mensajero sin nombre'
      }));
      
      dropdownOptions.forEach((option, index) => {
        console.log(`   ${index + 1}. value: "${option.value}", label: "${option.label}"`);
      });

      console.log('\n🎯 ANÁLISIS:');
      if (dropdownOptions.length > 0 && dropdownOptions[0].label !== 'Mensajero sin nombre') {
        console.log('✅ Los datos están correctos y el dropdown DEBERÍA mostrar opciones');
        console.log('');
        console.log('🚨 PROBLEMA IDENTIFICADO:');
        console.log('   El problema probablemente está en el componente CustomDropdown de React');
        console.log('   o en el estado de React que no se está actualizando correctamente');
        console.log('');
        console.log('🔧 PASOS PARA SOLUCIONAR:');
        console.log('   1. Verificar que el state se esté actualizando en React');
        console.log('   2. Revisar el componente CustomDropdown');
        console.log('   3. Forzar un re-render con clave única');
      } else {
        console.log('❌ Los datos tienen problemas de etiquetas');
      }
    } else {
      console.log('❌ No se procesaron mensajeros - hay un problema en la lógica de procesamiento');
    }

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error.message);
    if (error.response) {
      console.log(`📡 Status de error: ${error.response.status}`);
      console.log(`📋 Data de error:`, error.response.data);
    }
  }
}

debugRealtimeDropdownIssue().catch(console.error);
