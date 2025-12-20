
const { query, poolEnd } = require('./config/database');

const analyzeConsumption = async () => {
    try {
        const daysToAnalyze = 15;
        const coverageDays = 15;

        console.log(`🔍 Iniciando análisis de consumo (${daysToAnalyze} días, cobertura: ${coverageDays} días)...`);

        // 1. Obtener ventas
        const salesQuery = `
            SELECT 
                oi.product_id,
                p.product_name AS product_name,
                SUM(oi.quantity) AS total_sold
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON p.id = oi.product_id
            WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND o.status NOT IN ('cancelado', 'anulado')
              AND o.deleted_at IS NULL
            GROUP BY oi.product_id
            HAVING total_sold > 0
        `;

        const salesData = await query(salesQuery, [daysToAnalyze]);
        console.log(`📊 Analizando ${salesData.length} productos con ventas...`);

        // 2. Obtener configuración y stock
        const productIds = salesData.map(s => s.product_id);
        if (productIds.length === 0) {
            console.log('No hay ventas.');
            return;
        }

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
        console.log(`✅ Stock obtenido para ${stockResults.length} productos`);

        // 3. Obtener tendencias
        const trendQuery = `
            SELECT 
                oi.product_id,
                CASE 
                    WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL 15 DAY) THEN 'recent'
                    ELSE 'older'
                END AS period,
                SUM(oi.quantity) AS qty
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.product_id IN (${productIds.map(id => `'${id}'`).join(',')})
              AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              AND o.status NOT IN ('cancelado', 'anulado')
              AND o.deleted_at IS NULL
            GROUP BY oi.product_id, period
        `;
        const trendResults = await query(trendQuery, [daysToAnalyze]);
        console.log(`✅ Tendencias obtenidas: ${trendResults.length} registros`);

        // 4. Procesar
        const updates = [];
        for (const sale of salesData) {
            const productId = sale.product_id;
            const avgDailyConsumption = Number((sale.total_sold / daysToAnalyze).toFixed(2));
            const stockInfo = stockMap[productId] || { current_stock: 0, min_qty: 0, pack_size: 1 };
            const currentStock = Number(stockInfo.current_stock);
            const packSize = Number(stockInfo.pack_size);
            const calculatedMinQty = Math.ceil(avgDailyConsumption * 8);
            const desiredStock = Math.max(avgDailyConsumption * coverageDays, calculatedMinQty);
            let qtyToPurchase = Math.max(0, desiredStock - currentStock);

            if (qtyToPurchase > 0 && packSize > 1) {
                qtyToPurchase = Math.ceil(qtyToPurchase / packSize) * packSize;
            }

            updates.push({
                productId,
                calculatedMinQty,
                packSize,
                qtyToPurchase
            });
        }

        console.log(`✅ Preparadas ${updates.length} actualizaciones`);

        // 5. Ejecutar actualizaciones
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

        console.log('✅ Análisis completado exitosamente.');

    } catch (error) {
        console.error('❌ Error analizando consumo:', error);
    } finally {
        await poolEnd();
    }
};

analyzeConsumption();
