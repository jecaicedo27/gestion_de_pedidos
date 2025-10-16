console.log('⏰ Esperando a que se complete el reinicio de la aplicación...');
console.log('🔄 Reiniciando en 10 segundos...\n');

// Esperar 10 segundos para que se complete el reinicio
setTimeout(async () => {
  console.log('🧪 === PROBANDO ARREGLO DESPUÉS DEL REINICIO ===\n');
  
  try {
    const { testMessengerDropdownFix } = require('./test_messenger_dropdown_fix.js');
    await testMessengerDropdownFix();
  } catch (error) {
    console.error('❌ Error ejecutando test:', error.message);
  }
}, 10000);
