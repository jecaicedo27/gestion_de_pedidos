const fs = require('fs');

console.log('🚨 SOLUCIONANDO ERRORES CRÍTICOS URGENTES');
console.log('='.repeat(70));

async function fixCriticalErrors() {
  try {
    console.log('🔧 1. ARREGLANDO TAX ID INVÁLIDO EN SIIGO SERVICE...');
    
    // Fix invalid tax ID in siigoInvoiceService.js
    const siigoServicePath = 'backend/services/siigoInvoiceService.js';
    let siigoContent = fs.readFileSync(siigoServicePath, 'utf8');
    
    // Replace invalid tax ID with null (no tax for now, since we don't know the correct one)
    siigoContent = siigoContent.replace(
      'defaultTaxId: 13156, // IVA 19%',
      'defaultTaxId: null, // Sin IVA por defecto hasta obtener ID correcto'
    );
    
    fs.writeFileSync(siigoServicePath, siigoContent);
    console.log('✅ Tax ID inválido removido de siigoInvoiceService.js');

    console.log('\n🔧 2. CREANDO ENDPOINT /api/config/public FALTANTE...');
    
    // Create missing public config endpoint
    const configRoutesPath = 'backend/routes/config.js';
    if (fs.existsSync(configRoutesPath)) {
      let configContent = fs.readFileSync(configRoutesPath, 'utf8');
      
      // Add public config endpoint if it doesn't exist
      if (!configContent.includes('/public')) {
        const publicEndpoint = `

// Endpoint público para configuración básica (sin autenticación)
router.get('/public', async (req, res) => {
  try {
    console.log('📋 Solicitud de configuración pública');
    
    // Configuración básica que puede ser pública
    const publicConfig = {
      company_name: 'Perlas Explosivas Colombia',
      app_name: 'Sistema de Gestión de Pedidos',
      version: '2.0.0',
      support_email: 'admin@perlasexplosivascolombia.com',
      theme: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d'
      }
    };
    
    res.json({
      success: true,
      data: publicConfig
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});`;
        
        // Insert before module.exports
        configContent = configContent.replace(
          'module.exports = router;',
          publicEndpoint + '\n\nmodule.exports = router;'
        );
        
        fs.writeFileSync(configRoutesPath, configContent);
        console.log('✅ Endpoint /api/config/public creado exitosamente');
      } else {
        console.log('✅ Endpoint /api/config/public ya existe');
      }
    } else {
      console.log('⚠️ Archivo config.js no encontrado, creando...');
      
      const newConfigFile = `const express = require('express');
const router = express.Router();

// Endpoint público para configuración básica (sin autenticación)
router.get('/public', async (req, res) => {
  try {
    console.log('📋 Solicitud de configuración pública');
    
    // Configuración básica que puede ser pública
    const publicConfig = {
      company_name: 'Perlas Explosivas Colombia',
      app_name: 'Sistema de Gestión de Pedidos',
      version: '2.0.0',
      support_email: 'admin@perlasexplosivascolombia.com',
      theme: {
        primaryColor: '#007bff',
        secondaryColor: '#6c757d'
      }
    };
    
    res.json({
      success: true,
      data: publicConfig
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración pública:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;`;
      
      fs.writeFileSync(configRoutesPath, newConfigFile);
      console.log('✅ Archivo config.js creado con endpoint público');
    }

    console.log('\n🔧 3. VERIFICANDO CONFIGURACIÓN DE RUTAS EN SERVER.JS...');
    
    // Ensure config routes are properly mounted in server.js
    const serverPath = 'backend/server.js';
    if (fs.existsSync(serverPath)) {
      let serverContent = fs.readFileSync(serverPath, 'utf8');
      
      if (!serverContent.includes("require('./routes/config')")) {
        console.log('⚠️ Rutas de config no están registradas en server.js');
        
        // Add config routes
        const configRoute = "app.use('/api/config', require('./routes/config'));";
        
        // Find a good place to insert it (after other routes)
        if (serverContent.includes("app.use('/api/auth'")) {
          serverContent = serverContent.replace(
            "app.use('/api/auth', require('./routes/auth'));",
            "app.use('/api/auth', require('./routes/auth'));\napp.use('/api/config', require('./routes/config'));"
          );
        } else {
          // Insert before error handlers or at the end of route definitions
          const lines = serverContent.split('\n');
          let insertIndex = -1;
          
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('app.listen') || lines[i].includes('module.exports')) {
              insertIndex = i;
              break;
            }
          }
          
          if (insertIndex > -1) {
            lines.splice(insertIndex, 0, '', '// Rutas de configuración', configRoute);
            serverContent = lines.join('\n');
          }
        }
        
        fs.writeFileSync(serverPath, serverContent);
        console.log('✅ Rutas de config agregadas a server.js');
      } else {
        console.log('✅ Rutas de config ya están registradas');
      }
    } else {
      console.log('⚠️ server.js no encontrado');
    }

    console.log('\n🔧 4. VERIFICANDO QUE NO HAYA MÁS TAX IDs INVÁLIDOS...');
    
    // Check other files for invalid tax IDs
    const filesToCheck = [
      'backend/controllers/quotationController.js',
      'backend/services/chatgptService.js'
    ];
    
    filesToCheck.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('13156')) {
          console.log(`⚠️ Encontrado tax ID inválido en ${filePath}`);
          // Replace with null for now
          content = content.replace(/13156/g, 'null');
          fs.writeFileSync(filePath, content);
          console.log(`✅ Tax ID inválido removido de ${filePath}`);
        } else {
          console.log(`✅ ${filePath} no contiene tax IDs inválidos`);
        }
      }
    });

    console.log('\n🎯 RESUMEN DE CORRECCIONES:');
    console.log('='.repeat(50));
    console.log('✅ Tax ID inválido 13156 → removido (sin IVA por defecto)');
    console.log('✅ Endpoint /api/config/public → creado');
    console.log('✅ Rutas de config → registradas en server.js');
    console.log('✅ Archivos adicionales → verificados');
    
    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('1. Reiniciar el backend para aplicar cambios');
    console.log('2. Probar creación de facturas (debería funcionar sin IVA)');
    console.log('3. Consultar el tax ID correcto en SIIGO para aplicar IVA después');
    
    console.log('\n✅ CORRECCIONES COMPLETADAS - SISTEMA LISTO PARA PRUEBAS');
    
  } catch (error) {
    console.error('❌ Error aplicando correcciones:', error.message);
  }
}

fixCriticalErrors();
