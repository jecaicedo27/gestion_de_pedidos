const { pool } = require('../config/database');
const siigoService = require('../services/siigoService');
const { validationResult } = require('express-validator');

const productController = {
    // Función auxiliar para extraer precio de la estructura de SIIGO
    extractPriceFromSiigo(product) {
        try {
            // El precio viene en product.prices[0].price_list[0].value según la estructura de SIIGO
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
            console.warn('Error extrayendo precio de SIIGO:', error.message);
            return 0;
        }
    },

    
    // Función CORREGIDA para extraer código de barras de SIIGO (busca en múltiples campos)
    extractBarcodeFromSiigo(siigoProduct) {
        // Prioridad 1: Campo principal barcode
        if (siigoProduct.barcode && siigoProduct.barcode.trim()) {
            return siigoProduct.barcode.trim();
        }
        
        // Prioridad 2: Campo additional_fields.barcode (NUEVO - CRÍTICO)
        if (siigoProduct.additional_fields?.barcode && siigoProduct.additional_fields.barcode.trim()) {
            return siigoProduct.additional_fields.barcode.trim();
        }
        
        // Prioridad 3: Buscar en metadata (legacy)
        if (siigoProduct.metadata && Array.isArray(siigoProduct.metadata)) {
            const barcodeField = siigoProduct.metadata.find(meta => 
                meta.name && (
                    meta.name.toLowerCase().includes('barcode') ||
                    meta.name.toLowerCase().includes('codigo') ||
                    meta.name.toLowerCase().includes('barra')
                )
            );
            
            if (barcodeField && barcodeField.value && barcodeField.value.trim()) {
                return barcodeField.value.trim();
            }
        }
        
        // No tiene código de barras
        return null;
    },

    // Obtener todos los productos con códigos de barras (con paginación)
    async getAllProducts(req, res) {
        try {
        // Parámetros de paginación
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        const search = req.query.search || '';
        const categories = req.query.categories || req.query.category || ''; // Soporte para múltiples categorías
        const includeInactive = req.query.includeInactive === 'true'; // Parámetro legacy
        const isActive = req.query.is_active; // Nuevo parámetro específico para filtrar por estado
        
        const offset = (page - 1) * pageSize;
        const limitOffset = `LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`;
        
        // CORREGIDO: Manejar filtro de estado activo/inactivo
        let searchCondition = 'WHERE 1=1';
        let queryParams = [];
        
        // Si se especifica is_active, filtrar por ese valor específico
        if (isActive !== undefined) {
            searchCondition += ` AND pb.is_active = ?`;
            queryParams.push(parseInt(isActive));
        } else if (!includeInactive) {
            // Si no se especifica is_active pero includeInactive es false, solo mostrar activos
            searchCondition += ` AND pb.is_active = 1`;
        }
        
        if (search.trim()) {
            searchCondition += ` AND (
                pb.product_name LIKE ? OR 
                pb.barcode LIKE ? OR 
                pb.internal_code LIKE ? OR 
                pb.category LIKE ?
            )`;
            const searchTerm = `%${search.trim()}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }
        
        // Filtro por múltiples categorías
        if (categories.trim()) {
            const categoryList = categories.split(',').map(cat => cat.trim()).filter(cat => cat);
            if (categoryList.length > 0) {
                const placeholders = categoryList.map(() => '?').join(',');
                searchCondition += ` AND pb.category IN (${placeholders})`;
                queryParams.push(...categoryList);
            }
        }
            
            // Query para obtener el total de productos
            const countQuery = `
                SELECT COUNT(DISTINCT pb.id) as total
                FROM products pb
                ${searchCondition}
            `;
            
            const [countResult] = await pool.execute(countQuery, queryParams);
            const total = countResult[0].total;
            
            // Query para obtener los productos con paginación
            const query = `
                SELECT 
                    pb.id,
                    pb.product_name,
                    pb.barcode,
                    pb.internal_code,
                    pb.siigo_product_id,
                    pb.category,
                    pb.category as brand,
                    pb.description,
                    pb.standard_price as unit_weight,
                    pb.standard_price,
                    pb.available_quantity,
                    pb.stock,
                    pb.is_active,
                    pb.created_at,
                    pb.updated_at,
                    COUNT(pv.id) as variant_count
                FROM products pb
                LEFT JOIN product_variants pv ON pb.id = pv.product_barcode_id AND pv.is_active = TRUE
                ${searchCondition}
                GROUP BY pb.id
                ORDER BY pb.product_name ASC
                ${limitOffset}
            `;
            
            const [products] = await pool.execute(query, queryParams);
            
            // Calcular información de paginación
            const totalPages = Math.ceil(total / pageSize);
            const hasNextPage = page < totalPages;
            const hasPreviousPage = page > 1;
            
            res.json({
                success: true,
                data: products,
                pagination: {
                    currentPage: page,
                    pageSize: pageSize,
                    totalItems: total,
                    totalPages: totalPages,
                    hasNextPage: hasNextPage,
                    hasPreviousPage: hasPreviousPage,
                    startItem: offset + 1,
                    endItem: Math.min(offset + pageSize, total)
                }
            });
        } catch (error) {
            console.error('Error al obtener productos:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Cargar productos desde SIIGO API - VERSIÓN COMPLETA CON CÓDIGOS TEMPORALES
    loadProductsFromSiigo: async (req, res) => {
        try {
            console.log('🚀 Iniciando importación completa de productos desde SIIGO...');
            
            // Usar el servicio de importación completa
            const completeImportService = require('../services/completeProductImportService');
            const result = await completeImportService.importAllProducts();

            if (result.success) {
                // Respuesta exitosa con estadísticas detalladas
                res.json({
                    success: true,
                    message: `🎉 Importación completa exitosa: ${result.imported_products} productos importados, ${result.categories_created} categorías, ${result.real_barcodes} códigos reales, ${result.temp_barcodes} códigos temporales`,
                    data: {
                        total_products: result.total_products,
                        imported_products: result.imported_products,
                        real_barcodes: result.real_barcodes,
                        temp_barcodes: result.temp_barcodes,
                        categories_created: result.categories_created,
                        duration_seconds: result.duration_seconds,
                        categories: result.categories,
                        // Mantener compatibilidad con frontend existente
                        total_processed: result.total_products,
                        inserted: result.imported_products,
                        updated: 0,
                        errors: result.total_products - result.imported_products
                    }
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.message || 'Error en la importación completa de productos',
                    error: result.error
                });
            }

        } catch (error) {
            console.error('❌ Error en importación completa:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno en la importación de productos desde SIIGO',
                error: error.message
            });
        }
    },

    // Buscar producto por código de barras
    async findByBarcode(req, res) {
        try {
            const { barcode } = req.params;
            
            if (!barcode) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de barras requerido'
                });
            }

            // Buscar en productos principales
            const [products] = await pool.execute(`
                SELECT 
                    pb.id,
                    pb.product_name,
                    pb.barcode,
                    pb.internal_code,
                    pb.siigo_product_id,
                    pb.category,
                    pb.category as brand,
                    pb.description,
                    pb.standard_price as unit_weight,
                    pb.standard_price,
                    pb.is_active,
                    'main' as barcode_type
                FROM products pb
                WHERE pb.barcode = ? AND pb.is_active = TRUE
                
                UNION
                
                SELECT 
                    pb.id,
                    CONCAT(pb.product_name, ' - ', pv.variant_name) as product_name,
                    pv.variant_barcode as barcode,
                    pb.internal_code,
                    pb.siigo_product_id,
                    pb.category,
                    pb.category as brand,
                    pb.description,
                    pb.standard_price as unit_weight,
                    pb.standard_price,
                    pv.is_active,
                    'variant' as barcode_type
                FROM products pb
                JOIN product_variants pv ON pb.id = pv.product_barcode_id
                WHERE pv.variant_barcode = ? AND pv.is_active = TRUE AND pb.is_active = TRUE
            `, [barcode, barcode]);

            if (products.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Producto no encontrado con ese código de barras'
                });
            }

            res.json({
                success: true,
                data: products[0]
            });

        } catch (error) {
            console.error('Error buscando producto por código de barras:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Verificar código de barras para empaque
    async verifyBarcodeForPackaging(req, res) {
        try {
            const { barcode, order_id } = req.body;
            const user_id = req.user.id;

            if (!barcode || !order_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Código de barras y ID del pedido son requeridos'
                });
            }

            // Buscar el producto
            const [products] = await pool.execute(`
                SELECT 
                    pb.id as product_barcode_id,
                    pb.product_name,
                    pb.barcode,
                    pb.internal_code
                FROM products pb
                WHERE pb.barcode = ? AND pb.is_active = TRUE
                
                UNION
                
                SELECT 
                    pb.id as product_barcode_id,
                    CONCAT(pb.product_name, ' - ', pv.variant_name) as product_name,
                    pv.variant_barcode as barcode,
                    pb.internal_code
                FROM products pb
                JOIN product_variants pv ON pb.id = pv.product_barcode_id
                WHERE pv.variant_barcode = ? AND pv.is_active = TRUE AND pb.is_active = TRUE
            `, [barcode, barcode]);

            const product_found = products.length > 0;
            let scan_result = 'not_found';
            let product_barcode_id = null;

            if (product_found) {
                product_barcode_id = products[0].product_barcode_id;
                
                // Verificar si este producto está en el pedido
                const [orderItems] = await pool.execute(
                    'SELECT id FROM order_items WHERE order_id = ? AND product_name LIKE ?',
                    [order_id, `%${products[0].product_name.split(' - ')[0]}%`]
                );

                if (orderItems.length > 0) {
                    scan_result = 'success';
                } else {
                    scan_result = 'not_in_order';
                }
            }

            // Registrar el escaneo
            await pool.execute(`
                INSERT INTO barcode_scan_logs 
                (order_id, barcode, product_found, product_barcode_id, scan_result, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [order_id, barcode, product_found, product_barcode_id, scan_result, user_id]);

            res.json({
                success: true,
                data: {
                    product_found,
                    scan_result,
                    product: products[0] || null
                }
            });

        } catch (error) {
            console.error('Error verificando código de barras:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener estadísticas de productos
    async getProductStats(req, res) {
        try {
            const [stats] = await pool.execute(`
                SELECT 
                    COUNT(*) as total_products,
                    COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_products,
                    COUNT(CASE WHEN siigo_product_id IS NOT NULL THEN 1 END) as siigo_synced,
                    COUNT(DISTINCT category) as categories,
                    AVG(standard_price) as avg_price
                FROM products
            `);

            const [variantStats] = await pool.execute(`
                SELECT COUNT(*) as total_variants
                FROM product_variants pv
                JOIN products pb ON pv.product_barcode_id = pb.id
                WHERE pv.is_active = TRUE AND pb.is_active = TRUE
            `);

            res.json({
                success: true,
                data: {
                    ...stats[0],
                    total_variants: variantStats[0].total_variants
                }
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener todas las categorías para el filtro (usando servicio dinámico)
    async getCategories(req, res) {
        try {
            console.log('🔍 Obteniendo categorías dinámicas para filtro...');
            
            const categoryService = require('../services/categoryService');
            const categories = await categoryService.getActiveCategories();

            console.log(`📂 ${categories.length} categorías dinámicas encontradas`);

            res.json({
                success: true,
                data: categories
            });

        } catch (error) {
            console.error('Error obteniendo categorías dinámicas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Sincronizar categorías desde SIIGO
    async syncCategories(req, res) {
        try {
            console.log('🔄 Iniciando sincronización manual de categorías...');
            
            const categoryService = require('../services/categoryService');
            const result = await categoryService.syncCategoriesFromSiigo();

            if (result.success) {
                res.json({
                    success: true,
                    message: 'Categorías sincronizadas exitosamente',
                    data: result
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Error sincronizando categorías',
                    error: result.error,
                    data: result
                });
            }

        } catch (error) {
            console.error('Error sincronizando categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // Obtener estadísticas de sincronización de categorías
    async getCategorySyncStats(req, res) {
        try {
            const categoryService = require('../services/categoryService');
            const stats = await categoryService.getSyncStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Error obteniendo estadísticas de categorías:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = productController;
