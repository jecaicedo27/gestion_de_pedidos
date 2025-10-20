
// TEST SCRIPT - Pegar en la consola del navegador en la página de logística

console.log('🧪 PROBANDO CARGA DE MENSAJEROS...');

// Simular la función loadMessengers del frontend
async function testLoadMessengers() {
  try {
    const token = localStorage.getItem('token');
    console.log('🔑 Token:', token ? 'Presente' : 'NO ENCONTRADO');
    
    const response = await fetch('/api/users?role=mensajero&active=true', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 Datos recibidos:', data);
      
      // Verificar estructura esperada por el frontend
      const users = data.data?.data?.users || data.data?.users || data.users || [];
      console.log('👥 Mensajeros extraídos:', users);
      console.log('🔢 Cantidad de mensajeros:', users.length);
      
      if (users.length > 0) {
        console.log('✅ ¡Mensajeros encontrados! El problema puede estar en el renderizado');
        users.forEach((user, index) => {
          console.log(`   ${index + 1}. ${user.name || user.full_name || user.username} (ID: ${user.id})`);
        });
      } else {
        console.log('❌ No se encontraron mensajeros en la respuesta');
      }
    } else {
      console.log('❌ Error en la respuesta:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Error probando carga de mensajeros:', error);
  }
}

// Ejecutar la prueba
testLoadMessengers();

// También probar el estado actual de los mensajeros en React
console.log('🔍 Estado actual de mensajeros en React:');
// Esto requiere acceso al estado del componente, que varía según la implementación
