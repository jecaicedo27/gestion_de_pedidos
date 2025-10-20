const path = require('path');
const fs = require('fs').promises;

console.log('🔧 Corrigiendo endpoint de configuración faltante...');

async function fixConfigEndpoint() {
    try {
        const routesPath = path.join(__dirname, 'backend', 'routes', 'config.js');
        
        // Leer el archivo actual
        let content = await fs.readFile(routesPath, 'utf8');
        console.log('📖 Leyendo archivo de rutas de configuración...');
        
        // Verificar si ya existe el endpoint público
        if (content.includes('/public')) {
            console.log('✅ El endpoint /public ya existe');
        } else {
            // Agregar el endpoint público
            const publicEndpoint = `
// Ruta pública para obtener configuración básica (sin autenticación)
router.get('/public', async (req, res) => {
  try {
    console.log('📋 Solicitud de configuración pública recibida');
    
    // Configuración básica que se puede compartir públicamente
    const publicConfig = {
      company_name: process.env.COMPANY_NAME || 'Perlas Explosivas',
      app_version: '1.0.0',
      features: {
        siigo_integration: true,
        chatgpt_integration: true,
        auto_notifications: true
      }
    };
    
    res.json(publicConfig);
  } catch (error) {
    console.error('❌ Error obteniendo configuración pública:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'No se pudo obtener la configuración pública'
    });
  }
});
`;
            
            // Insertar antes de module.exports
            content = content.replace(
                'module.exports = router;',
                publicEndpoint + '\nmodule.exports = router;'
            );
            
            await fs.writeFile(routesPath, content);
            console.log('✅ Endpoint público agregado correctamente');
        }
        
        // Verificar el problema de tipos de documento SIIGO
        console.log('🔧 Corrigiendo configuración de tipos de documento SIIGO...');
        
        const siigoServicePath = path.join(__dirname, 'backend', 'services', 'siigoInvoiceService.js');
        let siigoContent = await fs.readFile(siigoServicePath, 'utf8');
        
        // Actualizar el ID del documento de factura
        if (siigoContent.includes('document: { id: 5153 }')) {
            siigoContent = siigoContent.replace(
                'document: { id: 5153 }',
                'document: { id: 5152 }' // ID correcto para facturas FV
            );
            
            await fs.writeFile(siigoServicePath, siigoContent);
            console.log('✅ ID de documento SIIGO corregido: 5152');
        }
        
        // También actualizar en quotationController si está ahí
        const quotationPath = path.join(__dirname, 'backend', 'controllers', 'quotationController.js');
        let quotationContent = await fs.readFile(quotationPath, 'utf8');
        
        if (quotationContent.includes('document: { id: 5153 }')) {
            quotationContent = quotationContent.replace(
                /document: { id: 5153 }/g,
                'document: { id: 5152 }'
            );
            
            await fs.writeFile(quotationPath, quotationContent);
            console.log('✅ ID de documento en controller corregido: 5152');
        }
        
    } catch (error) {
        console.error('❌ Error corrigiendo configuración:', error);
    }
}

fixConfigEndpoint();
