const fs = require('fs');
const path = require('path');

// Create the missing config route
const configRouteContent = `
const express = require('express');
const router = express.Router();

// Ruta pública para configuración básica (sin autenticación)
router.get('/public', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        name: 'Sistema de Gestión de Pedidos',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
          siigo_integration: true,
          chatgpt_integration: true,
          real_time_updates: true
        }
      }
    });
  } catch (error) {
    console.error('Error en configuración pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
`;

const configRoutePath = path.join('backend', 'routes', 'config.js');

// Write the config route
fs.writeFileSync(configRoutePath, configRouteContent, 'utf8');
console.log('✅ Creado archivo config route:', configRoutePath);

// Update server.js to include the config route
const serverPath = path.join('backend', 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Check if config route is already registered
if (!serverContent.includes("app.use('/api/config'")) {
  // Add the config route import
  const configImport = "const configRoutes = require('./routes/config');";
  const importSection = serverContent.indexOf("const quotationsRoutes = require('./routes/quotations');");
  
  if (importSection !== -1) {
    serverContent = serverContent.slice(0, importSection) + 
                   configImport + '\n' + 
                   serverContent.slice(importSection);
  }
  
  // Add the route registration
  const routeRegistration = "app.use('/api/config', configRoutes);";
  const routeSection = serverContent.indexOf("app.use('/api/quotations', quotationsRoutes);");
  
  if (routeSection !== -1) {
    const nextLine = serverContent.indexOf('\n', routeSection) + 1;
    serverContent = serverContent.slice(0, nextLine) + 
                   routeRegistration + '\n' + 
                   serverContent.slice(nextLine);
  }
  
  fs.writeFileSync(serverPath, serverContent, 'utf8');
  console.log('✅ Actualizado server.js con ruta /api/config');
} else {
  console.log('ℹ️ La ruta /api/config ya está registrada');
}

// Check if auth route exists and is working
const authRoutePath = path.join('backend', 'routes', 'auth.js');
if (fs.existsSync(authRoutePath)) {
  console.log('✅ Archivo auth route existe');
  
  // Read auth route to check for issues
  const authContent = fs.readFileSync(authRoutePath, 'utf8');
  if (!authContent.includes('/login')) {
    console.log('❌ No se encuentra ruta /login en auth.js');
  } else {
    console.log('✅ Ruta /login encontrada en auth.js');
  }
} else {
  console.log('❌ Archivo auth route NO existe');
}

// Check if there are any critical route files missing
const criticalRoutes = [
  'auth.js',
  'quotations.js',
  'siigo.js',
  'customers.js',
  'products.js'
];

console.log('\n📋 Verificando rutas críticas:');
criticalRoutes.forEach(routeFile => {
  const routePath = path.join('backend', 'routes', routeFile);
  if (fs.existsSync(routePath)) {
    console.log(`✅ ${routeFile}`);
  } else {
    console.log(`❌ FALTA: ${routeFile}`);
  }
});

console.log('\n🔧 Reparación de rutas críticas completada');
console.log('🔄 Reinicia el backend para aplicar los cambios');
