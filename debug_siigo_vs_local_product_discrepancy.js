const siigoService = require('./backend/services/siigoService');

async function debugProductStatusDiscrepancy() {
    console.log('🔍 INVESTIGANDO DISCREPANCIA ENTRE SIIGO Y BASE DE DATOS LOCAL');
    console.log('=' * 70);

    try {
        // Lista de productos sospechosos (que tienen "INAVILITADO" en el nombre pero están activos)
        const suspiciousProducts = [
            'SHOT11', 'SHOT9', 'SHOT10', 'SHOT8', 'SHOT7', 
            'SHOT6', 'SHOT5', 'SHOT4', 'SHOT3', 'SHOT1', 'SHOT2'
        ];

        console.log('🔎 Consultando productos sospechosos directamente en SIIGO...\n');

        for (const productCode of suspiciousProducts) {
            try {
                console.log(`📦 Consultando ${productCode} en SIIGO:`);
                
                // Obtener todos los productos de SIIGO y buscar este específico
                const allProducts = await siigoService.getAllProducts(1, 100);
                const product = allProducts.find(p => p.code === productCode);
                
                if (product) {
                    console.log(`   ➤ Código: ${product.code}`);
                    console.log(`   ➤ Nombre: "${product.name}"`);
                    console.log(`   ➤ Campo "active" en SIIGO: ${product.active}`);
                    console.log(`   ➤ Tipo de dato active: ${typeof product.active}`);
                    
                    // Analizar si el problema está en la lógica
                    const shouldBeActive = product.active === true ? 1 : 0;
                    console.log(`   ➤ Debería ser is_active: ${shouldBeActive}`);
                    
                    if (product.name.toLowerCase().includes('inavilitado') && product.active === true) {
                        console.log(`   ⚠️  DISCREPANCIA: Nombre indica inactivo pero SIIGO active=${product.active}`);
                    }
                    
                    console.log(`   ➤ Estructura completa:`, JSON.stringify(product, null, 2));
                    console.log('');
                } else {
                    console.log(`   ❌ Producto ${productCode} no encontrado en SIIGO`);
                }
                
                // Pausa para evitar rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (productError) {
                console.error(`❌ Error consultando ${productCode}:`, productError.message);
            }
        }

        // También verificar algunos productos que SÍ están inactivos correctamente
        console.log('\n🔍 Verificando productos que están correctamente inactivos:');
        
        const knownInactive = ['MP174']; // Uno que sabemos está inactivo
        
        for (const productCode of knownInactive) {
            try {
                const allProducts = await siigoService.getAllProducts(1, 100);
                const product = allProducts.find(p => p.code === productCode);
                
                if (product) {
                    console.log(`📦 ${productCode}:`);
                    console.log(`   ➤ Nombre: "${product.name}"`);
                    console.log(`   ➤ Active en SIIGO: ${product.active}`);
                    console.log(`   ➤ Debería ser is_active: ${product.active === true ? 1 : 0}`);
                    console.log('');
                }
            } catch (error) {
                console.error(`Error con ${productCode}:`, error.message);
            }
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

debugProductStatusDiscrepancy();
