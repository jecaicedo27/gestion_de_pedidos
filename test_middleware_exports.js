console.log('🔍 Verificando middlewares de las rutas de mensajero...\n');

try {
  // Verificar el middleware auth
  console.log('📋 Verificando middleware auth:');
  const auth = require('./backend/middleware/auth');
  console.log('  - Tipo:', typeof auth);
  console.log('  - Es función:', typeof auth === 'function' ? '✅' : '❌');
  
  if (typeof auth !== 'function') {
    console.log('  - Valor actual:', auth);
    console.log('  - Keys:', Object.keys(auth));
  }
  
  console.log('\n📋 Verificando controlador messengerController:');
  const messengerController = require('./backend/controllers/messengerController');
  console.log('  - getAssignedOrders:', typeof messengerController.getAssignedOrders);
  console.log('  - Es función:', typeof messengerController.getAssignedOrders === 'function' ? '✅' : '❌');
  
  // Probar crear el middleware requireMessengerRole manualmente
  console.log('\n📋 Creando middleware requireMessengerRole:');
  const requireMessengerRole = (req, res, next) => {
    if (req.user.role !== 'mensajero') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado. Solo mensajeros pueden acceder a esta funcionalidad.'
      });
    }
    next();
  };
  console.log('  - Tipo:', typeof requireMessengerRole);
  console.log('  - Es función:', typeof requireMessengerRole === 'function' ? '✅' : '❌');
  
  console.log('\n🧪 Probando crear una ruta simple:');
  const express = require('express');
  const router = express.Router();
  
  // Intentar crear la ruta problemática
  try {
    router.get('/orders', auth, requireMessengerRole, messengerController.getAssignedOrders);
    console.log('✅ Ruta creada exitosamente');
  } catch (routeError) {
    console.log('❌ Error creando ruta:', routeError.message);
    console.log('Stack:', routeError.stack);
  }
  
} catch (error) {
  console.error('❌ Error general:', error.message);
  console.error('Stack:', error.stack);
}
