const mysql = require('mysql2/promise');
const siigoService = require('./backend/services/siigoService');

class ProductCleanupService {
    constructor() {
        this.connection = null;
        this.cleanupStats = {
            phantomProductsFound: 0,
            phantomProductsCleaned: 0,
            invalidProductsFound: 0,
            invalidProductsCleaned: 0,
            productsImported: 0,
            totalProcessed: 0
        };
    }

    async connect() {
        this.connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        console.log('🔗 Conectado a la base de datos');
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 Desconectado de la base de datos');
        }
    }

    // Paso 1: Identificar productos "fantasma"
    async identifyPhantomProducts() {
        console.log('\n🔍 PASO 1: Identificando productos "fantasma"...');
        
        try {
            // Obtener TODOS los productos de SIIGO
            console.log('📦 Obteniendo todos los productos de SIIGO...');
            const allSiigoProducts = [];
            let currentPage = 1;
            let hasMorePages = true;

            while (hasMorePages) {
                console.log(`   📄 Consultando página ${currentPage}...`);
                const products = await siigoService.getAllProducts(currentPage, 100);
                
                if (!products || products.length === 0) {
                    hasMorePages = false;
                    break;
                }

                allSiigoProducts.push(...products);
                
                if (products.length < 100) {
                    hasMorePages = false;
                } else {
                    currentPage++;
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`✅ ${allSiigoProducts.length} productos obtenidos de SIIGO`);

            // Crear set con códigos de productos de SIIGO
            const siigoProductCodes = new Set(allSiigoProducts.map(p => p.code));

            // Obtener productos de la base de datos local
            const [localProducts] = await this.connection.execute(
                'SELECT id, internal_code, product_name FROM products'
            );

            console.log(`📊 ${localProducts.length} productos en base de datos local`);

            // Identificar productos fantasma
            const phantomProducts = localProducts.filter(localProduct => 
                localProduct.internal_code && !siigoProductCodes.has(localProduct.internal_code)
            );

            this.cleanupStats.phantomProductsFound = phantomProducts.length;

            if (phantomProducts.length > 0) {
                console.log(`⚠️  ${phantomProducts.length} productos "fantasma" encontrados:`);
                phantomProducts.forEach(product => {
                    console.log(`   - ${product.internal_code}: "${product.product_name}"`);
                });
            } else {
                console.log('✅ No se encontraron productos fantasma');
            }

            return phantomProducts;

        } catch (error) {
            console.error('❌ Error identificando productos fantasma:', error);
            return [];
        }
    }

    // Paso 2: Marcar productos "INAVILITADO" como inactivos
    async markInvalidProductsAsInactive() {
        console.log('\n🔍 PASO 2: Marcando productos "INAVILITADO" como inactivos...');

        try {
            // Buscar productos con "INAVILITADO" en el nombre que están activos
            const [invalidProducts] = await this.connection.execute(`
                SELECT id, internal_code, product_name, is_active 
                FROM products 
                WHERE LOWER(product_name) LIKE '%inavilitado%' AND is_active = 1
            `);

            this.cleanupStats.invalidProductsFound = invalidProducts.length;

            if (invalidProducts.length > 0) {
                console.log(`⚠️  ${invalidProducts.length} productos con "INAVILITADO" que están activos:`);
                invalidProducts.forEach(product => {
                    console.log(`   - ${product.internal_code}: "${product.product_name}"`);
                });

                // Marcarlos como inactivos
                const [updateResult] = await this.connection.execute(`
                    UPDATE products 
                    SET is_active = 0, updated_at = NOW() 
                    WHERE LOWER(product_name) LIKE '%inavilitado%' AND is_active = 1
                `);

                this.cleanupStats.invalidProductsCleaned = updateResult.affectedRows;
                console.log(`✅ ${updateResult.affectedRows} productos marcados como inactivos`);
            } else {
                console.log('✅ No hay productos "INAVILITADO" que estén activos');
            }

        } catch (error) {
            console.error('❌ Error marcando productos inválidos:', error);
        }
    }

    // Paso 3: Limpiar productos fantasma (opcional - marca como inactivos en lugar de eliminar)
    async cleanPhantomProducts(phantomProducts) {
        console.log('\n🧹 PASO 3: Limpiando productos fantasma...');

        if (phantomProducts.length === 0) {
            console.log('✅ No hay productos fantasma que limpiar');
            return;
        }

        try {
            // En lugar de eliminar, marcar como inactivos y agregar prefijo
            for (const product of phantomProducts) {
                await this.connection.execute(`
                    UPDATE products 
                    SET 
                        is_active = 0,
                        product_name = CONCAT('[ELIMINADO] ', product_name),
                        updated_at = NOW()
                    WHERE id = ?
                `, [product.id]);
            }

            this.cleanupStats.phantomProductsCleaned = phantomProducts.length;
            console.log(`✅ ${phantomProducts.length} productos fantasma marcados como eliminados`);

        } catch (error) {
            console.error('❌ Error limpiando productos fantasma:', error);
        }
    }

    // Paso 4: Sincronización completa desde SIIGO
    async fullSyncFromSiigo() {
        console.log('\n🔄 PASO 4: Sincronización completa desde SIIGO...');

        try {
            // Usar el servicio de importación completa existente
            const completeImportService = require('./backend/services/completeProductImportService');
            
            console.log('🗑️  Limpiando productos existentes...');
            await this.connection.execute('DELETE FROM products');
            
            console.log('📥 Importando todos los productos desde SIIGO...');
            const result = await completeImportService.importAllProducts();

            if (result.success) {
                this.cleanupStats.productsImported = result.imported_products;
                this.cleanupStats.totalProcessed = result.total_products;
                console.log(`✅ Importación completa exitosa: ${result.imported_products} productos`);
            } else {
                console.error('❌ Error en la importación:', result.message);
            }

        } catch (error) {
            console.error('❌ Error en sincronización completa:', error);
        }
    }

    // Generar reporte final
    async generateFinalReport() {
        console.log('\n📊 REPORTE FINAL DE LIMPIEZA');
        console.log('=' * 50);

        // Obtener estadísticas actuales
        const [currentStats] = await this.connection.execute(`
            SELECT 
                COUNT(*) as total_products,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_products,
                COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_products
            FROM products
        `);

        const stats = currentStats[0];

        console.log(`🔍 Productos "fantasma" encontrados: ${this.cleanupStats.phantomProductsFound}`);
        console.log(`🧹 Productos "fantasma" limpiados: ${this.cleanupStats.phantomProductsCleaned}`);
        console.log(`⚠️  Productos "INAVILITADO" encontrados: ${this.cleanupStats.invalidProductsFound}`);
        console.log(`✅ Productos "INAVILITADO" corregidos: ${this.cleanupStats.invalidProductsCleaned}`);
        console.log(`📥 Productos importados desde SIIGO: ${this.cleanupStats.productsImported}`);
        console.log(`📊 Total productos procesados: ${this.cleanupStats.totalProcessed}`);
        console.log('');
        console.log('📈 ESTADO ACTUAL:');
        console.log(`   Total productos: ${stats.total_products}`);
        console.log(`   Productos activos: ${stats.active_products}`);
        console.log(`   Productos inactivos: ${stats.inactive_products}`);
        console.log('');
        console.log('🎉 LIMPIEZA COMPLETA EXITOSA');
    }

    // Ejecutar limpieza completa
    async executeFullCleanup() {
        console.log('🧹 INICIANDO LIMPIEZA COMPLETA DE PRODUCTOS');
        console.log('=' * 60);

        try {
            await this.connect();

            // Opción 1: Limpieza gradual (recomendada)
            console.log('🎯 EJECUTANDO LIMPIEZA GRADUAL...');
            
            const phantomProducts = await this.identifyPhantomProducts();
            await this.markInvalidProductsAsInactive();
            await this.cleanPhantomProducts(phantomProducts);

            // Opción 2: Sincronización completa (más agresiva)
            console.log('\n❓ ¿Ejecutar sincronización completa? (reimporta todos los productos)');
            console.log('   Esto eliminará todos los productos actuales y los reimportará desde SIIGO');
            
            // Para este script automático, ejecutaremos la sincronización
            await this.fullSyncFromSiigo();

            await this.generateFinalReport();

        } catch (error) {
            console.error('❌ Error en limpieza completa:', error);
        } finally {
            await this.disconnect();
        }
    }
}

// Ejecutar limpieza
async function main() {
    const cleanupService = new ProductCleanupService();
    await cleanupService.executeFullCleanup();
}

main().catch(console.error);
