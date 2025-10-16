const axios = require('axios');

async function debugChatGPTSimple() {
  console.log('=== Debug Simple ChatGPT Processing ===');
  
  try {
    // 1. Verificar que el backend esté corriendo
    console.log('\n1. Verificando backend...');
    const healthCheck = await axios.get('http://localhost:3001/api/health', { timeout: 5000 });
    console.log('✅ Backend corriendo correctamente');
    
    // 2. Hacer login
    console.log('\n2. Realizando login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso');
    console.log('Token obtenido (primeros 50 caracteres):', token?.substring(0, 50) + '...');
    
    // 3. Probar un endpoint básico para verificar que el token funciona
    console.log('\n3. Probando endpoint básico con token...');
    try {
      const basicTest = await axios.get('http://localhost:3001/api/orders', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });
      
      console.log('✅ Token funciona con endpoint básico');
      
    } catch (basicError) {
      console.log('❌ Error con endpoint básico:', basicError.response?.status);
      console.log('Detalle:', basicError.response?.data);
      return;
    }
    
    // 4. Probar específicamente el endpoint de ChatGPT
    console.log('\n4. Probando endpoint ChatGPT...');
    
    try {
      const chatgptTest = await axios.post('http://localhost:3001/api/quotations/process-chatgpt', {
        customerInput: 'Necesito 1 Coca Cola de 500ml',
        customerDocument: '12345678'
      }, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      console.log('✅ Endpoint ChatGPT funciona correctamente!');
      console.log('Respuesta recibida:', JSON.stringify(chatgptTest.data, null, 2));
      
      // 5. Si funciona ChatGPT, probar creación de factura
      if (chatgptTest.data && chatgptTest.data.quotationId) {
        console.log('\n5. Probando creación de factura SIIGO...');
        
        try {
          const invoiceTest = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
            quotationId: chatgptTest.data.quotationId
          }, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 20000
          });
          
          console.log('✅ Factura SIIGO creada exitosamente!');
          console.log('Respuesta factura:', JSON.stringify(invoiceTest.data, null, 2));
          
        } catch (invoiceError) {
          console.log('❌ Error creando factura SIIGO:', invoiceError.response?.status);
          console.log('Detalle del error:', invoiceError.response?.data);
          
          if (invoiceError.response?.status === 422) {
            console.log('\n🔍 Error 422 detectado - es el que estábamos arreglando');
            console.log('Las correcciones del Document ID deberían haber resuelto esto...');
          }
        }
      }
      
    } catch (chatgptError) {
      console.log('❌ Error con endpoint ChatGPT:', chatgptError.response?.status);
      console.log('Detalle del error:', chatgptError.response?.data);
      
      if (chatgptError.response?.status === 401) {
        console.log('\n🔍 Error 401 - problema de autenticación detectado');
        console.log('El token parece no estar funcionando correctamente');
        
        // Mostrar headers enviados
        console.log('\nHeaders enviados:');
        console.log('Authorization: Bearer ' + token?.substring(0, 20) + '...');
        console.log('Content-Type: application/json');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
  
  console.log('\n=== Debug completado ===');
}

debugChatGPTSimple();
