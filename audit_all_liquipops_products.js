const mysql = require('mysql2/promise');
const SiigoService = require('./backend/services/siigoService');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function auditAllLiquipopsProducts() {
    let connection;
    try {
        console.log('🔍 Auditando todos los productos LIQUIPOPS...');
        
        connection = await mysql.createConnection(dbConfig);
        
        // Buscar todos los productos relacionados con LIQUIPOPS
        console.log('\n📋 1. Consultando productos LIQUIPOPS en base de datos local:');
        const [localProducts] = await connection.execute(`
            SELECT id, product_name, barcode, siigo_product_id, category, internal_code
            FROM products 
            WHERE product_name LIKE '%LIQUIPP%'
            OR product_name LIKE '%LIQUIPOPS%'
            OR category LIKE '%LIQUIPP%'
            ORDER BY product_name
        `);
        
        if (localProducts.length === 0) {
            console.log('❌ No se encontraron productos LIQUIPOPS en base de datos local');
            return;
        }
        
        console.log(`✅ Encontrados ${localProducts.length} productos LIQUIPOPS/LIQUIPP:`);
        
        const siigoService = new SiigoService();
        await siigoService.initialize();
        
        let productsWithRealBarcodes = 0;
        let productsWithGeneratedBarcodes = 0;
        let productsWithPendienteBarcodes = 0;
        let productsWithDiscrepancies = 0;
        
        for (let i = 0; i < localProducts.length; i++) {
            const product = localProducts[i];
            const productNum = i + 1;
            
            console.log(`\n📦 ${productNum}/${localProducts.length}: ${product.product_name}`);
            console.log(`   📧 Código de barras BD: ${product.barcode}`);
            console.log(`   🆔 SIIGO Product ID: ${product.siigo_product_id || 'NO TIENE'}`);
            console.log(`   🏷️ Código interno: ${product.internal_code || 'NO TIENE'}`);
            
            // Clasificar el tipo de código de barras
            let barcodeType = 'DESCONOCIDO';
            
            if (product.barcode.startsWith('PENDIENTE_')) {
                barcodeType = 'PENDIENTE (Corregido)';
                productsWithPendienteBarcodes++;
            } else if (product.barcode === 'PENDIENTE') {
                barcodeType = 'PENDIENTE (Sin corregir)';
                productsWithPendienteBarcodes++;
            } else if (product.barcode.match(/^77[0-9]{11}$/)) {
                barcodeType = 'GENERADO AUTOMÁTICAMENTE';
                productsWithGeneratedBarcodes++;
            } else {
                barcodeType = 'POSIBLE CÓDIGO REAL';
                productsWithRealBarcodes++;
            }
            
            console.log(`   🔍 Tipo de código: ${barcodeType}`);
            
            // Si tiene siigo_product_id, consultar en SIIGO para verificar
            if (product.siigo_product_id) {
                try {
                    console.log(`   🌐 Consultando en SIIGO...`);
                    const siigoProduct = await siigoService.getProductById(product.siigo_product_id);
                    
                    if (siigoProduct) {
                        console.log(`   📧 Código SIIGO: ${siigoProduct.barcode || 'NO TIENE'}`);
                        console.log(`   📋 Código referencia SIIGO: ${siigoProduct.code || 'NO TIENE'}`);
                        
                        // Comparar códigos
                        if (siigoProduct.barcode && siigoProduct.barcode !== product.barcode) {
                            console.log(`   🚨 DISCREPANCIA: BD=${product.barcode} vs SIIGO=${siigoProduct.barcode}`);
                            productsWithDiscrepancies++;
                        } else if (siigoProduct.barcode && siigoProduct.barcode === product.barcode) {
                            console.log(`   ✅ Códigos coinciden`);
                        } else if (!siigoProduct.barcode && barcodeType.includes('GENERADO')) {
                            console.log(`   ❌ SIIGO no tiene código pero nosotros generamos uno`);
                        }
                    } else {
                        console.log(`   ❌ No se pudo obtener desde SIIGO`);
                    }
                    
                    // Pequeña pausa para evitar rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                    
                } catch (error) {
                    console.log(`   ❌ Error consultando SIIGO: ${error.message}`);
                }
            } else {
                console.log(`   ⚠️  No tiene siigo_product_id para validar`);
            }
        }
        
        // Resumen
        console.log(`\n📊 RESUMEN DE AUDITORÍA:`);
        console.log(`   📦 Total productos: ${localProducts.length}`);
        console.log(`   ✅ Productos con códigos reales: ${productsWithRealBarcodes}`);
        console.log(`   🤖 Productos con códigos generados: ${productsWithGeneratedBarcodes}`);
        console.log(`   ⏳ Productos con códigos PENDIENTE: ${productsWithPendienteBarcodes}`);
        console.log(`   🚨 Productos con discrepancias: ${productsWithDiscrepancies}`);
        
        // Buscar productos que podrían ser LIQUIPP06 específicamente
        console.log(`\n🔍 Buscando productos que podrían ser LIQUIPP06:`);
        const possibleLiquipp06 = localProducts.filter(p => 
            p.product_name.includes('LIQUIPP06') ||
            p.internal_code === 'LIQUIPP06' ||
            p.product_name.toLowerCase().includes('chamoy') && p.product_name.includes('LIQUIPP')
        );
        
        if (possibleLiquipp06.length > 0) {
            console.log(`✅ Encontrados ${possibleLiquipp06.length} candidatos para LIQUIPP06:`);
            possibleLiquipp06.forEach(p => {
                console.log(`   - ID ${p.id}: ${p.product_name} (barcode: ${p.barcode})`);
            });
        } else {
            console.log(`❌ No se encontraron candidatos específicos para LIQUIPP06`);
            console.log(`💡 El producto podría tener un nombre diferente en la BD`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('📄 Respuesta de error:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar auditoría
auditAllLiquipopsProducts();
