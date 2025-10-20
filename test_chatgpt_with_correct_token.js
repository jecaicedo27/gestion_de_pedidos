const axios = require('axios');

async function testChatGPTWithCorrectToken() {
  console.log('=== Test ChatGPT con token correcto ===');
  
  try {
    // 1. Login
    console.log('\n1. Realizando login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    // Acceder al token con la ruta correcta
    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso');
    console.log('Token obtenido (primeros 50 chars):', token.substring(0, 50) + '...');
    
    // 2. Test básico para verificar que el token funciona
    console.log('\n2. Verificando token con endpoint básico...');
    try {
      const basicTest = await axios.get('http://localhost:3001/api/orders', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Token funciona correctamente');
      
    } catch (basicError) {
      console.log('❌ Error con token en endpoint básico:', basicError.response?.status);
      return;
    }
    
    // 3. Test del endpoint de ChatGPT
    console.log('\n3. Probando endpoint de ChatGPT...');
    
    try {
      const chatgptTest = await axios.post('http://localhost:3001/api/quotations/process-natural-order', {
        customer_id: 1,
        natural_language_order: 'Necesito 2 Coca Cola de 500ml'
      }, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });
      
      console.log('✅ ChatGPT processing funcionando!');
      console.log('Respuesta:', JSON.stringify(chatgptTest.data, null, 2));
      
      // 4. Test de creación de factura FV-1
      if (chatgptTest.data && chatgptTest.data.quotationId) {
        console.log('\n4. Probando creación de factura FV-1...');
        
        try {
          const invoiceTest = await axios.post('http://localhost:3001/api/quotations/create-invoice', {
            quotationId: chatgptTest.data.quotationId
          }, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 25000
          });
          
          console.log('🎉 ¡FACTURA FV-1 CREADA EXITOSAMENTE!');
          console.log('✅ Las correcciones del Document ID funcionaron');
          console.log('Respuesta factura:', JSON.stringify(invoiceTest.data, null, 2));
          
        } catch (invoiceError) {
          console.log('❌ Error creando factura FV-1:', invoiceError.response?.status);
          console.log('Detalle del error:', invoiceError.response?.data);
          
          if (invoiceError.response?.status === 422) {
            console.log('\n🔍 Todavía hay error 422 - necesitamos revisar más configuraciones');
            
            // Verificar si nuestros cambios se aplicaron
            console.log('Verificando si los cambios de Document ID se aplicaron correctamente...');
          }
        }
      }
      
    } catch (chatgptError) {
      console.log('❌ Error con endpoint ChatGPT:', chatgptError.response?.status);
      console.log('Detalle del error:', chatgptError.response?.data);
    }
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', error.response.data);
    }
  }
  
  console.log('\n=== Test completado ===');
}

testChatGPTWithCorrectToken();
