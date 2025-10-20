const axios = require('axios');

async function testChatGPTProcessingAfterRestart() {
  console.log('=== Verificando ChatGPT Processing después del reinicio ===');
  
  try {
    // 1. Verificar backend
    console.log('\n1. Verificando backend en puerto 3001...');
    try {
      const healthCheck = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
      console.log('✅ Backend corriendo correctamente');
    } catch (error) {
      console.log('❌ Backend no responde - Error:', error.code);
      console.log('🔄 Intentando iniciar backend...');
      return;
    }

    // 2. Verificar frontend
    console.log('\n2. Verificando frontend en puerto 3000...');
    try {
      const frontendCheck = await axios.get('http://localhost:3000', { timeout: 5000 });
      console.log('✅ Frontend corriendo correctamente');
    } catch (error) {
      console.log('❌ Frontend no responde - Error:', error.code);
    }

    // 3. Test de autenticación
    console.log('\n3. Probando autenticación...');
    try {
      const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        username: 'admin',
        password: 'admin123'
      });
      
      const token = loginResponse.data.token;
      console.log('✅ Login exitoso');

      // 4. Test del endpoint de ChatGPT
      console.log('\n4. Probando endpoint de ChatGPT processing...');
      const chatgptResponse = await axios.post('http://localhost:3001/api/quotations/process-chatgpt', {
        customerInput: 'Necesito 2 Coca Cola de 500ml',
        customerDocument: '12345678'
      }, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30000
      });
      
      console.log('✅ ChatGPT processing funciona correctamente!');
      console.log('📄 Respuesta obtenida:', JSON.stringify(chatgptResponse.data, null, 2));
      
      // 5. Test de creación de factura SIIGO
      if (chatgptResponse.data && chatgptResponse.data.quotationId) {
        console.log('\n5. Probando creación de factura SIIGO...');
        
        try {
          const invoiceResponse = await axios.post(`http://localhost:3001/api/quotations/create-invoice`, {
            quotationId: chatgptResponse.data.quotationId
          }, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 30000
          });
          
          console.log('✅ Factura SIIGO creada exitosamente!');
          console.log('📄 Respuesta factura:', JSON.stringify(invoiceResponse.data, null, 2));
          
        } catch (invoiceError) {
          console.log('❌ Error al crear factura SIIGO:', invoiceError.response?.status);
          console.log('🔍 Detalle del error:', invoiceError.response?.data);
        }
      }
      
    } catch (authError) {
      console.log('❌ Error en autenticación:', authError.response?.status);
      console.log('🔍 Detalle:', authError.response?.data);
    }

  } catch (generalError) {
    console.error('❌ Error general:', generalError.message);
  }
  
  console.log('\n=== Prueba completada ===');
}

testChatGPTProcessingAfterRestart();
