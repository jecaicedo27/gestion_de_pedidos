const siigoService = require('./siigoService');
const categoryService = require('./categoryService');
const { pool } = require('../config/database');
const cron = require('node-cron');

class AutoSyncService {
    constructor() {
        this.isRunning = false;
        this.lastSync = null;
        this.lastCategorySync = null;
        this.syncInterval = process.env.SIIGO_SYNC_INTERVAL || '*/5'; // Cada 5 minutos por defecto
        this.enabled = process.env.SIIGO_AUTO_SYNC === 'true' || false;
    }

    // Inicializar el servicio automático
    init() {
        if (!this.enabled) {
            console.log('🔄 AutoSync deshabilitado en configuración');
            return;
        }

        console.log(`🔄 AutoSync inicializado - Ejecutándose cada ${this.syncInterval} minutos`);
        
        // Programar tarea cron para sincronización automática
        cron.schedule(`${this.syncInterval} * * * *`, () => {
            this.syncProducts();
        });

        // Ejecutar sincronización inicial después de 30 segundos
        setTimeout(() => {
            this.syncProducts();
        }, 30000);
    }

    // Función principal de sincronización
    async syncProducts() {
        if (this.isRunning) {
            console.log('⏳ Sincronización ya en progreso, omitiendo...');
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            console.log('🔄 Iniciando sincronización automática completa...');
            
            // Sincronizar categorías primero (cada hora para no saturar)
            const now = new Date();
            const shouldSyncCategories = !this.lastCategorySync || 
                (now.getTime() - this.lastCategorySync.getTime()) > (60 * 60 * 1000); // 1 hora
            
            if (shouldSyncCategories) {
                console.log('📂 Sincronizando categorías...');
                try {
                    const categoryResult = await categoryService.syncCategoriesFromSiigo();
                    if (categoryResult.success) {
                        console.log(`✅ Categorías: ${categoryResult.categoriesCreated} creadas, ${categoryResult.categoriesUpdated} actualizadas`);
                        this.lastCategorySync = now;
                    } else {
                        console.log('⚠️ Error sincronizando categorías:', categoryResult.error);
                    }
                } catch (categoryError) {
                    console.error('❌ Error en sincronización de categorías:', categoryError.message);
                }
            } else {
                console.log('📂 Categorías: usando caché (última sync hace menos de 1 hora)');
            }
            
            // Obtener productos actualizados de SIIGO
            console.log('📦 Sincronizando productos...');
            const siigoProducts = await siigoService.getAllProducts();
            
            let updatedCount = 0;
            let unchangedCount = 0;
            let errorCount = 0;

            for (const product of siigoProducts) {
                try {
                    // Extraer datos de SIIGO
                    const productData = {
                        product_name: product.name || 'Producto sin nombre',
                        category: product.account_group?.name || 'Sin categoría',
                        standard_price: this.extractPriceFromSiigo(product),
                        is_active: product.active !== false,
                        description: product.description || ''
                    };

                    // Verificar si hay cambios comparando con la BD
                    const [existingProduct] = await pool.execute(
                        `SELECT id, product_name, category, standard_price, is_active, description, updated_at 
                         FROM products WHERE siigo_product_id = ?`,
                        [product.id]
                    );

                    if (existingProduct.length === 0) {
                        console.log(`⚠️ Producto no encontrado en BD: ${product.name}`);
                        continue;
                    }

                    const existing = existingProduct[0];
                    const hasChanges = 
                        existing.product_name !== productData.product_name ||
                        existing.category !== productData.category ||
                        parseFloat(existing.standard_price) !== productData.standard_price ||
                        Boolean(existing.is_active) !== productData.is_active ||
                        existing.description !== productData.description;

                    if (hasChanges) {
                        // Actualizar producto con cambios
                        await pool.execute(`
                            UPDATE products 
                            SET product_name = ?, 
                                category = ?, 
                                standard_price = ?,
                                is_active = ?,
                                description = ?,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE siigo_product_id = ?
                        `, [
                            productData.product_name,
                            productData.category,
                            productData.standard_price,
                            productData.is_active,
                            productData.description,
                            product.id
                        ]);

                        updatedCount++;
                        
                        // Log de cambios específicos
                        const changes = [];
                        if (existing.product_name !== productData.product_name) {
                            changes.push(`nombre: "${existing.product_name}" → "${productData.product_name}"`);
                        }
                        if (existing.category !== productData.category) {
                            changes.push(`categoría: "${existing.category}" → "${productData.category}"`);
                        }
                        if (parseFloat(existing.standard_price) !== productData.standard_price) {
                            changes.push(`precio: $${existing.standard_price} → $${productData.standard_price}`);
                        }
                        if (Boolean(existing.is_active) !== productData.is_active) {
                            changes.push(`estado: ${existing.is_active ? 'Activo' : 'Inactivo'} → ${productData.is_active ? 'Activo' : 'Inactivo'}`);
                        }
                        
                        console.log(`✅ ${product.name}: ${changes.join(', ')}`);
                        
                        // Registrar el cambio en log de sincronización
                        await this.logSync(product.id, 'updated', `Cambios: ${changes.join(', ')}`);
                    } else {
                        unchangedCount++;
                    }

                } catch (productError) {
                    errorCount++;
                    console.error(`❌ Error sincronizando ${product.name}:`, productError.message);
                    await this.logSync(product.id, 'error', productError.message);
                }
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            this.lastSync = new Date();
            
            console.log(`🎉 Sincronización completada en ${duration}s:`);
            console.log(`   ✅ ${updatedCount} productos actualizados`);
            console.log(`   ⚪ ${unchangedCount} productos sin cambios`);
            console.log(`   ❌ ${errorCount} errores`);

            // Log de sincronización general
            await this.logSync(null, 'completed', `${updatedCount} actualizados, ${unchangedCount} sin cambios, ${errorCount} errores`);

        } catch (error) {
            console.error('❌ Error en sincronización automática:', error);
            await this.logSync(null, 'failed', error.message);
        } finally {
            this.isRunning = false;
        }
    }

    // Función auxiliar para extraer precio
    extractPriceFromSiigo(product) {
        try {
            if (product.prices && 
                Array.isArray(product.prices) && 
                product.prices.length > 0 &&
                product.prices[0].price_list &&
                Array.isArray(product.prices[0].price_list) &&
                product.prices[0].price_list.length > 0) {
                
                return parseFloat(product.prices[0].price_list[0].value) || 0;
            }
            return 0;
        } catch (error) {
            console.warn('Error extrayendo precio:', error.message);
            return 0;
        }
    }

    // Registrar eventos de sincronización
    async logSync(productId, status, message) {
        try {
            await pool.execute(`
                INSERT INTO sync_logs (siigo_product_id, sync_status, message, created_at)
                VALUES (?, ?, ?, NOW())
            `, [productId, status, message]);
        } catch (error) {
            console.error('Error logging sync:', error.message);
        }
    }

    // Método para sincronización manual
    async forcSync() {
        console.log('🔄 Forzando sincronización manual...');
        await this.syncProducts();
    }

    // Obtener estadísticas de sincronización
    async getSyncStats() {
        try {
            const [stats] = await pool.execute(`
                SELECT 
                    sync_status,
                    COUNT(*) as count,
                    MAX(created_at) as last_occurrence
                FROM sync_logs 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY sync_status
                ORDER BY last_occurrence DESC
            `);

            return {
                lastSync: this.lastSync,
                isRunning: this.isRunning,
                enabled: this.enabled,
                interval: this.syncInterval,
                last24Hours: stats
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de sync:', error);
            return { error: error.message };
        }
    }

    // Configurar intervalo dinámicamente
    setInterval(minutes) {
        this.syncInterval = `*/${minutes}`;
        console.log(`🔄 Intervalo de sincronización actualizado a ${minutes} minutos`);
        // Nota: Para aplicar el cambio completamente, sería necesario reiniciar el cron job
    }

    // Habilitar/deshabilitar sincronización
    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`🔄 AutoSync ${enabled ? 'habilitado' : 'deshabilitado'}`);
    }
}

module.exports = new AutoSyncService();
