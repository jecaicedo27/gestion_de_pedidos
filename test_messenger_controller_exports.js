console.log('🔍 Verificando exports del controlador de mensajeros...\n');

try {
  const messengerController = require('./backend/controllers/messengerController');
  
  console.log('📋 Exports del controlador:');
  console.log('  - Tipo:', typeof messengerController);
  console.log('  - Keys:', Object.keys(messengerController));
  
  console.log('\n📊 Verificando funciones específicas:');
  
  const functions = [
    'getAssignedOrders',
    'acceptOrder', 
    'rejectOrder',
    'startDelivery',
    'completeDelivery',
    'markDeliveryFailed',
    'uploadEvidence',
    'getDailySummary',
    'upload'
  ];
  
  functions.forEach(fn => {
    const exported = messengerController[fn];
    console.log(`  - ${fn}: ${typeof exported} ${exported ? '✅' : '❌'}`);
  });
  
  if (typeof messengerController.getAssignedOrders !== 'function') {
    console.log('\n❌ PROBLEMA ENCONTRADO:');
    console.log('  getAssignedOrders no es una función');
    console.log('  Valor actual:', messengerController.getAssignedOrders);
  }
  
} catch (error) {
  console.error('❌ Error cargando controlador:', error);
  console.error('Stack:', error.stack);
}
