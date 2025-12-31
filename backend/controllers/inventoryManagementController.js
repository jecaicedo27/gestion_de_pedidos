const { query } = require('../config/database');

/**
 * GET /api/inventory-management/view
 * Obtiene vista completa de inventario con configuraciones y análisis
 */
const getInventoryManagementView = async (req, res) => {
    try {
        const { category, search, lowStockOnly } = req.query;

        // Nota: en esta BD la tabla products no tiene deleted_at
        let where = ['p.is_active = 1'];
        const params = [];

        // Filtro: solo bajo stock (usar WHERE para evitar HAVING sin agregación)
        if (lowStockOnly === 'true') {
            where.push('COALESCE(p.available_quantity, 0) < COALESCE(pic.min_inventory_qty, 0)');
        }

        if (category) {
            where.push('p.category = ?');
            params.push(category);
        }

        if (search) {
            // En esta BD la columna es product_name (no name)
            where.push('(p.product_name LIKE ? OR p.internal_code LIKE ? OR p.barcode LIKE ?)');
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        // Nota: la tabla products en producción NO tiene image_url.
        // Para mantener compatibilidad con el frontend, exponemos image_url como NULL.
        const sql = `
      SELECT 
        p.id,
        p.product_name AS name,
        p.internal_code,
        p.barcode,
        p.category,
        p.subcategory,
        NULL AS image_url,
        COALESCE(p.available_quantity, 0) AS current_stock,
        COALESCE(p.purchasing_price, 0) AS purchasing_price,
        COALESCE(p.standard_price, 0) AS standard_price,
        pic.id AS config_id,
        COALESCE(pic.min_inventory_qty, 0) AS min_inventory_qty,
        COALESCE(pic.pack_size, 1) AS pack_size,
        pic.supplier,
        pic.suggested_order_qty,
        pic.last_analysis_date,
        pic.abc_classification,
        iah.avg_daily_consumption,
        iah.consumption_trend,
        iah.days_until_stockout
      FROM products p
      LEFT JOIN product_inventory_config pic ON pic.product_id = p.id
      LEFT JOIN (
        SELECT 
          product_id,
          avg_daily_consumption,
          consumption_trend,
          days_until_stockout
        FROM inventory_analysis_history
        WHERE (product_id, analysis_date) IN (
          SELECT product_id, MAX(analysis_date)
          FROM inventory_analysis_history
          GROUP BY product_id
        )
      ) iah ON iah.product_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY p.product_name ASC
    `;

        const products = await query(sql, params);

        return res.json({ success: true, data: products });
    } catch (error) {
        console.error('Error obteniendo vista de inventario:', error);
        // Enviar un mensaje más útil sin exponer datos sensibles.
        const devMessage = error?.sqlMessage || error?.message || 'Error interno del servidor';
        return res.status(500).json({ message: 'Error analizando consumo', error: error.message });
    }
};

/**
 * GET /api/inventory-management/kpis
 * Obtiene indicadores clave de rendimiento del inventario
 */
const getInventoryKPIs = async (req, res) => {
    try {
        console.log('📊 Calculando KPIs de inventario...');

        // 1. Valor Total del Inventario (Precio Venta) con y sin IVA, más Costo Real
        const totalValueQuery = `
      SELECT 
        SUM(p.available_quantity * p.standard_price) as total_value,
        SUM(p.available_quantity * p.standard_price / 1.19) as total_value_no_vat,
        SUM(p.available_quantity * COALESCE(p.purchasing_price, p.standard_price / 1.19)) as total_cost
      FROM products p
      WHERE p.is_active = 1 AND p.available_quantity > 0
    `;

        // 2. Productos con Stock Bajo y Agotados
        const stockStatusQuery = `
      SELECT
        COUNT(CASE WHEN p.available_quantity <= 0 THEN 1 END) as out_of_stock_count,
        COUNT(CASE WHEN p.available_quantity > 0 AND p.available_quantity <= COALESCE(pic.min_inventory_qty, 10) THEN 1 END) as low_stock_count,
        COUNT(*) as total_products
      FROM products p
      LEFT JOIN product_inventory_config pic ON pic.product_id = p.id
      WHERE p.is_active = 1
    `;

        // 3. Velocidad de Ventas y Proyección
        const salesVelocityQuery = `
            SELECT SUM(oi.quantity * oi.price) as total_sales_30_days
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
        `;

        // 4. Ratio de Costo Histórico (Mes Anterior Bogota)
        const now = new Date();
        const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        const year = bogotaNow.getFullYear();
        const month = bogotaNow.getMonth();

        const firstDayPrevMonth = new Date(year, month - 1, 1).toLocaleDateString('en-CA');
        const lastDayPrevMonth = new Date(year, month, 0).toLocaleDateString('en-CA') + ' 23:59:59';

        const historicalCostQuery = `
            SELECT 
                SUM(oi.quantity * oi.price) as total_revenue,
                SUM(oi.quantity * COALESCE(p.standard_price, 0)) as total_cost
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            AND o.deleted_at IS NULL
        `;

        const [valueResult] = await query(totalValueQuery);
        const [statusResult] = await query(stockStatusQuery);
        const [velocityResult] = await query(salesVelocityQuery);
        const [costResult] = await query(historicalCostQuery, [firstDayPrevMonth, lastDayPrevMonth]);

        const totalSales30Days = Number(velocityResult?.total_sales_30_days || 0);
        const dailySalesVelocity = totalSales30Days / 30;

        // Proyección mes actual: Velocidad diaria * Días en el mes actual (Bogota based)
        const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
        const monthlySalesProjection = dailySalesVelocity * daysInCurrentMonth;

        // Costo real de mercancía desde BD (purchasing_price sin IVA)
        const totalInventoryValue = Number(valueResult?.total_value || 0);
        const totalInventoryValueNoVat = Number(valueResult?.total_value_no_vat || 0);
        const merchandiseCost = Number(valueResult?.total_cost || 0);
        // Calcular margen comparando ambos sin IVA (precio sin IVA vs costo sin IVA)
        const costRatio = totalInventoryValueNoVat > 0 ? merchandiseCost / totalInventoryValueNoVat : 0;

        const kpis = {
            totalInventoryValue: totalInventoryValue,
            totalInventoryValueNoVat: totalInventoryValueNoVat,
            outOfStockCount: statusResult?.out_of_stock_count || 0,
            lowStockCount: statusResult?.low_stock_count || 0,
            totalProducts: statusResult?.total_products || 0,
            inventoryAccuracy: 98.5, // Placeholder por ahora
            dailySalesVelocity: dailySalesVelocity,
            monthlySalesProjection: monthlySalesProjection,
            merchandiseCost: merchandiseCost,
            costRatio: costRatio
        };

        res.json(kpis);
    } catch (error) {
        console.error('Error calculando KPIs:', error);
        res.status(500).json({ message: 'Error calculando KPIs de inventario', error: error.message });
    }
};

/**
 * GET /api/inventory-management/products/:id/config
 * Obtiene configuración de un producto específico
 */
const getProductConfig = async (req, res) => {
    try {
        const { id } = req.params;

        const [config] = await query(
            `SELECT pic.*, p.purchasing_price 
             FROM product_inventory_config pic 
             RIGHT JOIN products p ON p.id = pic.product_id
             WHERE p.id = ?`,
            [id]
        );

        if (!config) {
            // Fallback si no existe producto (raro)
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        // Si pic es null (RIGHT JOIN), devolver defaults con el purchasing_price del producto
        const responseData = {
            id: config.id, // Puede ser null si no hay config
            product_id: parseInt(id),
            min_inventory_qty: config.min_inventory_qty || 0,
            pack_size: config.pack_size || 1,
            suggested_order_qty: config.suggested_order_qty,
            supplier: config.supplier,
            purchasing_price: config.purchasing_price || 0
        };

        return res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('Error obteniendo configuración de producto:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

/**
 * PUT /api/inventory-management/products/:id/config
 * Actualiza configuración de inventario de un producto
 */
const updateProductConfig = async (req, res) => {
    try {
        const { id } = req.params;
        const { min_inventory_qty, pack_size, supplier, purchasing_price } = req.body;

        console.log(`🔧 updateProductConfig received for ID ${id}:`, req.body); // DEBUG LOG

        // Validaciones
        if (min_inventory_qty !== undefined && (min_inventory_qty < 0 || !Number.isInteger(min_inventory_qty))) {
            return res.status(400).json({ success: false, message: 'Cantidad mínima debe ser un entero positivo' });
        }

        if (pack_size !== undefined && (pack_size <= 0 || !Number.isInteger(pack_size))) {
            return res.status(400).json({ success: false, message: 'Tamaño de pack debe ser un entero positivo mayor a 0' });
        }

        if (purchasing_price !== undefined && (purchasing_price < 0 || isNaN(Number(purchasing_price)))) {
            return res.status(400).json({ success: false, message: 'Costo de compra debe ser un número positivo' });
        }

        // Verificar si el producto existe
        const [product] = await query('SELECT id FROM products WHERE id = ?', [id]);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        // Actualizar precio de compra en la tabla products
        if (purchasing_price !== undefined) {
            await query('UPDATE products SET purchasing_price = ? WHERE id = ?', [purchasing_price, id]);
        }

        // Verificar si ya existe configuración
        const [existingConfig] = await query(
            'SELECT id FROM product_inventory_config WHERE product_id = ?',
            [id]
        );

        if (existingConfig) {
            // Actualizar
            const updates = [];
            const values = [];

            if (min_inventory_qty !== undefined) {
                updates.push('min_inventory_qty = ?');
                values.push(min_inventory_qty);
            }

            if (pack_size !== undefined) {
                updates.push('pack_size = ?');
                values.push(pack_size);
            }

            if (supplier !== undefined) {
                updates.push('supplier = ?');
                values.push(supplier);
            }

            if (updates.length > 0) {
                values.push(id);
                await query(
                    `UPDATE product_inventory_config SET ${updates.join(', ')} WHERE product_id = ?`,
                    values
                );
            }
        } else {
            // Insertar nueva configuración
            console.log('Inserting new config with supplier:', supplier); // DEBUG
            await query(
                `INSERT INTO product_inventory_config (product_id, min_inventory_qty, pack_size, supplier)
         VALUES (?, ?, ?, ?)`,
                [id, min_inventory_qty || 0, pack_size || 1, supplier || null]
            );
        }

        console.log(`✅ Configuración actualizada para producto ${id}`);
        return res.json({ success: true, message: 'Configuración actualizada exitosamente' });
    } catch (error) {
        console.error('Error actualizando configuración de producto:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};

/**
 * Calcula el nivel de urgencia basado en stock actual, mínimo y consumo diario
 */
function calculateUrgencyLevel(currentStock, minQty, avgDailyConsumption) {
    if (!avgDailyConsumption || avgDailyConsumption <= 0) {
        if (currentStock < minQty) return 'URGENTE';
        return 'NORMAL';
    }

    const daysUntilStockout = currentStock / avgDailyConsumption;

    if (daysUntilStockout < 7) return 'CRÍTICO';
    if (daysUntilStockout < 14) return 'URGENTE';
    return 'NORMAL';
}

/**
 * POST /api/inventory-management/analyze
 * Analiza el consumo histórico de todos los productos y genera sugerencias
 */
const analyzeConsumption = async (req, res) => {
    try {
        const { days = 15, coverage = 15 } = req.body;
        const daysToAnalyze = Number(days) || 15;
        // FIX: Si no se envía 'coverage' explícitamente, usar 'days' (que es lo que envía el frontend)
        const coverageDays = req.body.coverage ? Number(req.body.coverage) : (Number(days) || 15);

        console.log(`🔍 Iniciando análisis de consumo (${daysToAnalyze} días, cobertura: ${coverageDays} días)...`);

        // 1. Obtener ventas para análisis ponderado (Últimos 30 días vs Últimos 7 días)
        // Estrategia: 60% peso a los últimos 7 días, 40% peso a los últimos 30 días.
        const salesQuery = `
            SELECT 
                p.id AS product_id,
                p.product_name AS product_name,
                SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN oi.quantity ELSE 0 END) AS sold_last_7,
                SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN oi.quantity ELSE 0 END) AS sold_last_30
            FROM products p
            LEFT JOIN order_items oi ON p.product_name = oi.name
            LEFT JOIN orders o ON o.id = oi.order_id 
                AND o.status NOT IN ('cancelado', 'anulado') 
                AND o.deleted_at IS NULL
                AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            WHERE p.is_active = 1
            GROUP BY p.id, p.product_name
        `;

        const salesData = await query(salesQuery);
        const productIds = salesData.map(p => p.product_id);

        if (productIds.length === 0) {
            return res.json({ success: true, message: 'No hay productos activos para analizar.', data: [] });
        }

        // 2. Obtener stock actual y configuración
        const stockQuery = `
            SELECT 
                p.id,
                COALESCE(p.available_quantity, 0) AS current_stock,
                COALESCE(pic.min_inventory_qty, 0) AS min_qty,
                COALESCE(pic.pack_size, 1) AS pack_size
            FROM products p
            LEFT JOIN product_inventory_config pic ON pic.product_id = p.id
            WHERE p.id IN (${productIds.map(id => `'${id}'`).join(',')})
        `;
        const stockResults = await query(stockQuery);
        const stockMap = {};
        stockResults.forEach(row => stockMap[row.id] = row);

        // 3. Obtener tendencias (Mantenemos lógica visual de tendencias)
        const trendQuery = `
            SELECT 
                p.id AS product_id,
                CASE 
                    WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY) THEN 'recent'
                    ELSE 'older'
                END AS period,
                SUM(oi.quantity) AS qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.product_name = oi.name
            WHERE p.id IN (${productIds.map(id => `'${id}'`).join(',')})
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
              AND o.status NOT IN ('cancelado', 'anulado')
              AND o.deleted_at IS NULL
            GROUP BY p.id, period
        `;
        const trendResults = await query(trendQuery);
        const trendMap = {};
        trendResults.forEach(row => {
            if (!trendMap[row.product_id]) trendMap[row.product_id] = { recent: 0, older: 0 };
            trendMap[row.product_id][row.period] = row.qty;
        });

        // 4. Procesar y preparar actualizaciones
        const updates = [];
        const historyInserts = [];

        for (const sale of salesData) {
            const productId = sale.product_id;

            // CÁLCULO DE PROMEDIO PONDERADO
            // Velocidad corta (últimos 7 días)
            const dailyAvg7 = Number(sale.sold_last_7) / 7;

            // Velocidad larga (últimos 30 días)
            const dailyAvg30 = Number(sale.sold_last_30) / 30;

            // Promedio Ponderado: 60% Corto Plazo + 40% Largo Plazo
            const weightedDailyAvg = (dailyAvg7 * 0.6) + (dailyAvg30 * 0.4);

            const avgDailyConsumption = Number(weightedDailyAvg.toFixed(2));

            // Tendencia
            const trends = trendMap[productId] || { recent: 0, older: 0 };
            const older = trends.older;
            const recent = trends.recent;
            let consumptionTrend = 'estable';
            if (older > 0) {
                const percentChange = ((recent - older) / older) * 100;
                if (percentChange > 10) consumptionTrend = 'creciendo';
                else if (percentChange < -10) consumptionTrend = 'decreciendo';
            }

            // Stock y Config
            const stockInfo = stockMap[productId] || { current_stock: 0, min_qty: 0, pack_size: 1 };
            const currentStock = Number(stockInfo.current_stock);
            const packSize = Number(stockInfo.pack_size);

            // Cálculos
            // MODIFICADO: Se redujo el stock de seguridad de 8 días a 1 día por solicitud del usuario (fábrica cercana)
            const calculatedMinQty = Math.ceil(avgDailyConsumption * 1);
            const desiredStock = Math.max(avgDailyConsumption * coverageDays, calculatedMinQty);
            let qtyToPurchase = Math.max(0, desiredStock - currentStock);

            if (qtyToPurchase > 0 && packSize > 1) {
                qtyToPurchase = Math.ceil(qtyToPurchase / packSize) * packSize;
            }

            const daysUntilStockout = avgDailyConsumption > 0
                ? Math.floor(currentStock / avgDailyConsumption)
                : null;

            updates.push({
                productId,
                calculatedMinQty,
                packSize,
                qtyToPurchase
            });

            historyInserts.push([
                productId, avgDailyConsumption, consumptionTrend, qtyToPurchase, currentStock, daysUntilStockout
            ]);
        }

        // 5. Ejecutar actualizaciones en serie para no saturar conexiones
        for (const update of updates) {
            await query(
                `INSERT INTO product_inventory_config (product_id, min_inventory_qty, pack_size, suggested_order_qty, last_analysis_date)
                 VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE 
                    min_inventory_qty = VALUES(min_inventory_qty),
                    suggested_order_qty = VALUES(suggested_order_qty),
                    last_analysis_date = VALUES(last_analysis_date)`,
                [update.productId, update.calculatedMinQty, update.packSize, update.qtyToPurchase]
            );
        }

        // 6. Insertar historial (Bulk Insert)
        if (historyInserts.length > 0) {
            const placeholders = historyInserts.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
            const flatValues = historyInserts.flat();

            await query(
                `INSERT INTO inventory_analysis_history 
                (product_id, avg_daily_consumption, consumption_trend, suggested_qty, current_stock, days_until_stockout)
                VALUES ${placeholders}`,
                flatValues
            );
        }

        console.log('✅ Análisis de consumo completado exitosamente.');

        return res.json({
            success: true,
            message: `Análisis completado. ${updates.length} productos procesados.`,
            data: {
                analyzed_count: updates.length,
                coverage_days: coverageDays
            }
        });

    } catch (error) {
        console.error('Error analizando consumo:', error);
        return res.status(500).json({ message: 'Error analizando consumo', error: error.message });
    }
};



/**
 * POST /api/inventory-management/calculate-abc
 * Calcula y actualiza la clasificación ABC de los productos
 * A: 80% del valor de consumo
 * B: 15% del valor de consumo (acumulado 95%)
 * C: 5% del valor de consumo (resto)
 */
const calculateABC = async (req, res) => {
    try {
        console.log('🔤 Iniciando cálculo de clasificación ABC...');

        // 1. Obtener consumo valorizado de los últimos 90 días
        const consumptionQuery = `
            SELECT 
                p.id,
                p.product_name,
                SUM(oi.quantity * p.standard_price) as consumption_value
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.product_name = oi.name
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
                AND o.status NOT IN ('cancelado', 'anulado')
                AND p.is_active = 1
            GROUP BY p.id
            ORDER BY consumption_value DESC
        `;

        const products = await query(consumptionQuery);

        if (products.length === 0) {
            return res.json({ success: true, message: 'No hay datos de consumo suficientes para calcular ABC' });
        }

        // 2. Calcular valor total
        const totalValue = products.reduce((sum, p) => sum + (Number(p.consumption_value) || 0), 0);

        console.log(`💰 Valor total de consumo (90 días): ${totalValue}`);

        // 3. Clasificar
        let accumulatedValue = 0;
        const updates = [];

        for (const product of products) {
            const value = Number(product.consumption_value) || 0;
            accumulatedValue += value;
            const percentage = (accumulatedValue / totalValue) * 100;

            let classification = 'C';
            if (percentage <= 80) classification = 'A';
            else if (percentage <= 95) classification = 'B';

            // Preparar actualización
            updates.push(query(
                `INSERT INTO product_inventory_config (product_id, abc_classification)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE abc_classification = ?`,
                [product.id, classification, classification]
            ));
        }

        await Promise.all(updates);

        console.log(`✅ Clasificación ABC completada para ${products.length} productos`);

        return res.json({
            success: true,
            message: 'Clasificación ABC actualizada exitosamente',
            stats: {
                total_products: products.length,
                total_value: totalValue
            }
        });

    } catch (error) {
        console.error('Error calculando ABC:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor', error: error.message });
    }
};

/**
 * GET /api/inventory-management/export-excel
 * Genera y descarga un archivo Excel con el estado actual del inventario
 */
const exportInventoryToExcel = async (req, res) => {
    try {
        console.log('📊 Iniciando exportación a Excel...');
        const ExcelJS = require('exceljs');

        // 1. Obtener datos (reutilizando lógica de vista)
        const sql = `
            SELECT 
                p.internal_code,
                p.product_name,
                p.category,
                COALESCE(p.available_quantity, 0) AS current_stock,
                COALESCE(pic.min_inventory_qty, 0) AS min_inventory_qty,
                COALESCE(pic.pack_size, 1) AS pack_size,
                pic.suggested_order_qty,
                pic.abc_classification,
                iah.avg_daily_consumption,
                iah.days_until_stockout
            FROM products p
            LEFT JOIN product_inventory_config pic ON pic.product_id = p.id
            LEFT JOIN (
                SELECT 
                    product_id,
                    avg_daily_consumption,
                    days_until_stockout
                FROM inventory_analysis_history
                WHERE (product_id, analysis_date) IN (
                    SELECT product_id, MAX(analysis_date)
                    FROM inventory_analysis_history
                    GROUP BY product_id
                )
            ) iah ON iah.product_id = p.id
            WHERE p.is_active = 1
            ORDER BY p.category, p.product_name
        `;

        const products = await query(sql);

        // 2. Crear Workbook y Worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inventario');

        // 3. Definir columnas
        worksheet.columns = [
            { header: 'CÓDIGO', key: 'code', width: 15 },
            { header: 'CATEGORÍA', key: 'category', width: 20 },
            { header: 'PRODUCTO', key: 'product', width: 40 },
            { header: 'ABC', key: 'abc', width: 8 },
            { header: 'STOCK', key: 'stock', width: 10 },
            { header: 'MÍNIMO', key: 'min', width: 10 },
            { header: 'PACK', key: 'pack', width: 8 },
            { header: 'CONSUMO PROM.', key: 'avg', width: 15 },
            { header: 'DÍAS STOCK', key: 'days', width: 12 },
            { header: 'SUGERIDO', key: 'suggested', width: 12 },
            { header: 'URGENCIA', key: 'urgency', width: 15 }
        ];

        // Estilo de cabecera
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' }
        };

        // 4. Agregar filas
        products.forEach(p => {
            const urgency = calculateUrgencyLevel(p.current_stock, p.min_inventory_qty, p.avg_daily_consumption);

            const row = worksheet.addRow({
                code: p.internal_code,
                category: p.category,
                product: p.product_name,
                abc: p.abc_classification || '-',
                stock: Number(p.current_stock),
                min: Number(p.min_inventory_qty),
                pack: Number(p.pack_size),
                avg: Number(p.avg_daily_consumption || 0),
                days: p.days_until_stockout !== null ? Number(p.days_until_stockout) : '-',
                suggested: Number(p.suggested_order_qty || 0),
                urgency: urgency
            });

            // Formato condicional básico
            if (urgency === 'AGOTADO') {
                row.getCell('urgency').font = { color: { argb: 'FFFF0000' }, bold: true };
            } else if (urgency === 'CRÍTICO') {
                row.getCell('urgency').font = { color: { argb: 'FFFF8C00' }, bold: true };
            }

            if (p.suggested_order_qty > 0) {
                row.getCell('suggested').fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD4EFDF' } // Verde claro
                };
            }
        });

        // 5. Enviar respuesta
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=inventario_sugerido.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error exportando Excel:', error);
        res.status(500).send('Error generando archivo Excel');
    }
};

/**
 * POST /api/inventory-management/generate-purchase-order
 * Genera una orden de compra en Excel para un proveedor específico
 */
const generatePurchaseOrder = async (req, res) => {
    try {
        const { supplier } = req.body;

        if (!supplier) {
            return res.status(400).json({ success: false, message: 'Proveedor es requerido' });
        }

        console.log(`📊 Generando Orden de Compra para: ${supplier}`);
        const ExcelJS = require('exceljs');

        // 1. Obtener productos del proveedor con sugerencia de pedido > 0
        const sql = `
            SELECT 
                p.internal_code,
                p.barcode,
                p.product_name,
                p.category,
                COALESCE(pic.pack_size, 1) AS pack_size,
                pic.suggested_order_qty
            FROM products p
            JOIN product_inventory_config pic ON pic.product_id = p.id
            WHERE p.is_active = 1 
            AND pic.supplier = ? 
            AND pic.suggested_order_qty > 0
            ORDER BY p.category, p.product_name
        `;

        const products = await query(sql, [supplier]);

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No hay productos con sugerencia de pedido para este proveedor'
            });
        }

        // 2. Crear Workbook y Worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Orden de Compra');

        // 3. Definir columnas
        worksheet.columns = [
            { header: 'CÓDIGO', key: 'code', width: 15 },
            { header: 'BARRAS', key: 'barcode', width: 15 },
            { header: 'PRODUCTO', key: 'product', width: 45 },
            { header: 'CANTIDAD (UNIDADES)', key: 'qty', width: 20 },
            { header: 'PACK/CAJA', key: 'pack', width: 12 },
            { header: 'TOTAL CAJAS', key: 'total_packs', width: 15 },
            { header: 'OBSERVACIONES', key: 'notes', width: 30 }
        ];

        // Estilo de cabecera
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2C3E50' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 25;

        // 4. Agregar filas
        products.forEach(p => {
            const packs = Math.ceil(p.suggested_order_qty / p.pack_size);

            const row = worksheet.addRow({
                code: p.internal_code,
                barcode: p.barcode,
                product: p.product_name,
                qty: Number(p.suggested_order_qty),
                pack: Number(p.pack_size),
                total_packs: packs,
                notes: ''
            });

            // Bordes para cada celda
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                // Alinear números a la derecha, texto a la izquierda
                if (typeof cell.value === 'number') {
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else {
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                }
            });
        });

        // 5. Configurar respuesta para descarga
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Orden_Compra_${supplier.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generando Orden de Compra:', error);
        res.status(500).json({ success: false, message: 'Error interno generando Orden de Compra', error: error.message });
    }
};

module.exports = {
    getInventoryManagementView,
    getProductConfig,
    updateProductConfig,
    analyzeConsumption,
    getInventoryKPIs,
    calculateABC,
    exportInventoryToExcel,
    generatePurchaseOrder
};
