const { pool } = require('../config/database');
const siigoService = require('./siigoService');

class CategoryService {
    
    /**
     * Sincronizar todas las categorías desde SIIGO
     */
    async syncCategoriesFromSiigo() {
        const startTime = Date.now();
        let categoriesSynced = 0;
        let categoriesCreated = 0;
        let categoriesUpdated = 0;
        let categoriesDeactivated = 0;
        let errors = 0;
        let errorDetails = [];

        try {
            console.log('🔄 Iniciando sincronización de categorías desde SIIGO...');
            
            // Obtener categorías desde SIIGO (account groups)
            const siigoCategories = await this.getCategoriesFromSiigo();
            
            if (!siigoCategories || siigoCategories.length === 0) {
                console.log('ℹ️ No se encontraron categorías en SIIGO');
                await this.logSyncResult(startTime, 0, 0, 0, 0, 0, null);
                return {
                    success: true,
                    categoriesSynced: 0,
                    categoriesCreated: 0,
                    categoriesUpdated: 0,
                    categoriesDeactivated: 0,
                    errors: 0
                };
            }

            console.log(`📋 Se encontraron ${siigoCategories.length} categorías en SIIGO`);

            // Obtener categorías existentes en la base de datos
            const [existingCategories] = await pool.execute(`
                SELECT id, siigo_id, name, is_active 
                FROM categories
            `);

            const existingCategoryMap = new Map();
            existingCategories.forEach(cat => {
                if (cat.siigo_id) {
                    existingCategoryMap.set(cat.siigo_id, cat);
                }
                existingCategoryMap.set(cat.name, cat);
            });

            // Procesar cada categoría de SIIGO
            for (const siigoCategory of siigoCategories) {
                try {
                    const categoryName = siigoCategory.name;
                    const categoryId = siigoCategory.id;
                    
                    if (!categoryName) {
                        console.warn('⚠️ Categoría sin nombre encontrada, omitiendo...');
                        continue;
                    }

                    // Verificar si la categoría ya existe
                    const existingCategory = existingCategoryMap.get(categoryId) || 
                                          existingCategoryMap.get(categoryName);

                    if (existingCategory) {
                        // Actualizar categoría existente
                        const needsUpdate = 
                            existingCategory.name !== categoryName ||
                            existingCategory.siigo_id !== categoryId ||
                            existingCategory.is_active !== (siigoCategory.active !== false);

                        if (needsUpdate) {
                            await pool.execute(`
                                UPDATE categories 
                                SET name = ?, 
                                    siigo_id = ?,
                                    description = ?,
                                    is_active = ?,
                                    updated_at = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [
                                categoryName,
                                categoryId,
                                siigoCategory.description || `Categoría sincronizada desde SIIGO`,
                                siigoCategory.active !== false,
                                existingCategory.id
                            ]);
                            
                            categoriesUpdated++;
                            console.log(`✅ Categoría actualizada: ${categoryName}`);
                        }
                    } else {
                        // Insertar nueva categoría
                        await pool.execute(`
                            INSERT INTO categories 
                            (siigo_id, name, description, is_active)
                            VALUES (?, ?, ?, ?)
                        `, [
                            categoryId,
                            categoryName,
                            siigoCategory.description || `Categoría sincronizada desde SIIGO`,
                            siigoCategory.active !== false
                        ]);
                        
                        categoriesCreated++;
                        console.log(`🆕 Nueva categoría creada: ${categoryName}`);
                    }

                    categoriesSynced++;

                } catch (categoryError) {
                    console.error(`❌ Error procesando categoría ${siigoCategory.name}:`, categoryError);
                    errors++;
                    errorDetails.push(`Error en ${siigoCategory.name}: ${categoryError.message}`);
                }
            }

            // Desactivar categorías que ya no existen en SIIGO
            const siigoIds = siigoCategories.map(cat => cat.id).filter(id => id);
            const siigoNames = siigoCategories.map(cat => cat.name).filter(name => name);
            
            if (siigoIds.length > 0 && siigoNames.length > 0) {
                const placeholders = siigoIds.map(() => '?').join(',');
                const namePlaceholders = siigoNames.map(() => '?').join(',');
                
                const [deactivatedResult] = await pool.execute(`
                    UPDATE categories 
                    SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                    WHERE is_active = TRUE 
                    AND siigo_id IS NOT NULL 
                    AND siigo_id NOT IN (${placeholders})
                    AND name NOT IN (${namePlaceholders})
                `, [...siigoIds, ...siigoNames]);
                
                categoriesDeactivated = deactivatedResult.affectedRows;
                if (categoriesDeactivated > 0) {
                    console.log(`🔄 ${categoriesDeactivated} categorías desactivadas (ya no existen en SIIGO)`);
                }
            }

            const syncDuration = Date.now() - startTime;
            console.log(`✅ Sincronización de categorías completada en ${syncDuration}ms`);
            console.log(`📊 Resumen: ${categoriesCreated} creadas, ${categoriesUpdated} actualizadas, ${categoriesDeactivated} desactivadas, ${errors} errores`);

            // Registrar el resultado de la sincronización
            await this.logSyncResult(
                startTime, 
                categoriesSynced, 
                categoriesCreated, 
                categoriesUpdated, 
                categoriesDeactivated, 
                errors, 
                errorDetails.length > 0 ? errorDetails.join('; ') : null
            );

            return {
                success: true,
                categoriesSynced,
                categoriesCreated,
                categoriesUpdated,
                categoriesDeactivated,
                errors,
                syncDuration
            };

        } catch (error) {
            const syncDuration = Date.now() - startTime;
            console.error('❌ Error en sincronización de categorías:', error);
            
            await this.logSyncResult(startTime, 0, 0, 0, 0, 1, error.message);
            
            return {
                success: false,
                error: error.message,
                categoriesSynced: 0,
                categoriesCreated: 0,
                categoriesUpdated: 0,
                categoriesDeactivated: 0,
                errors: 1,
                syncDuration
            };
        }
    }

    /**
     * Obtener categorías desde SIIGO
     */
    async getCategoriesFromSiigo() {
        try {
            console.log('🔍 Obteniendo categorías desde SIIGO...');
            
            // Obtener productos para extraer categorías únicas
            const products = await siigoService.getAllProducts();
            
            if (!products || products.length === 0) {
                return [];
            }

            // Extraer categorías únicas de los productos
            const categoryMap = new Map();
            
            products.forEach(product => {
                if (product.account_group && product.account_group.name) {
                    const categoryName = product.account_group.name;
                    const categoryId = product.account_group.id;
                    
                    if (!categoryMap.has(categoryName)) {
                        categoryMap.set(categoryName, {
                            id: categoryId,
                            name: categoryName,
                            description: `Categoría extraída de productos SIIGO`,
                            active: true // Las categorías de productos activos se consideran activas
                        });
                    }
                }
            });

            const categories = Array.from(categoryMap.values());
            console.log(`📋 ${categories.length} categorías únicas extraídas de ${products.length} productos`);
            
            return categories;

        } catch (error) {
            console.error('❌ Error obteniendo categorías desde SIIGO:', error);
            throw error;
        }
    }

    /**
     * Obtener todas las categorías activas para filtros
     */
    async getActiveCategories() {
        try {
            const [categories] = await pool.execute(`
                SELECT 
                    MIN(c.id) as id,
                    c.name,
                    MIN(c.description) as description,
                    COUNT(p.id) as product_count
                FROM categories c
                LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
                WHERE c.is_active = TRUE
                GROUP BY c.name
                HAVING COUNT(p.id) > 0 OR c.name IS NOT NULL
                ORDER BY c.name ASC
            `);

            return categories.map(cat => ({
                id: cat.id,
                value: cat.name,
                label: cat.name,
                description: cat.description,
                count: cat.product_count || 0
            }));

        } catch (error) {
            console.error('Error obteniendo categorías activas:', error);
            throw error;
        }
    }

    /**
     * Registrar resultado de sincronización
     */
    async logSyncResult(startTime, synced, created, updated, deactivated, errors, errorDetails) {
        try {
            const syncDuration = Date.now() - startTime;
            
            await pool.execute(`
                INSERT INTO category_sync_logs 
                (categories_synced, categories_created, categories_updated, 
                 categories_deactivated, errors, sync_duration_ms, error_details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [synced, created, updated, deactivated, errors, syncDuration, errorDetails]);
            
        } catch (error) {
            console.error('Error registrando log de sincronización:', error);
        }
    }

    /**
     * Obtener estadísticas de las últimas sincronizaciones
     */
    async getSyncStats() {
        try {
            const [lastSyncs] = await pool.execute(`
                SELECT 
                    sync_date,
                    categories_synced,
                    categories_created,
                    categories_updated,
                    categories_deactivated,
                    errors,
                    sync_duration_ms
                FROM category_sync_logs 
                ORDER BY sync_date DESC 
                LIMIT 10
            `);

            const [summary] = await pool.execute(`
                SELECT 
                    COUNT(*) as total_categories,
                    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_categories,
                    COUNT(CASE WHEN siigo_id IS NOT NULL THEN 1 END) as synced_categories
                FROM categories
            `);

            return {
                summary: summary[0],
                recentSyncs: lastSyncs
            };

        } catch (error) {
            console.error('Error obteniendo estadísticas de sincronización:', error);
            throw error;
        }
    }
}

module.exports = new CategoryService();
