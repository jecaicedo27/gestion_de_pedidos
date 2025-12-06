const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get Colombia cities heat map data
router.get('/colombia-sales', authenticateToken, async (req, res) => {
    try {
        // Obtener ventas por ciudad usando pool (evita "Too many connections")
        const cityData = await query(`
            SELECT 
                customer_city,
                customer_department,
                COUNT(*) AS total_orders,
                SUM(COALESCE(total_amount, 0)) AS total_sales,
                AVG(COALESCE(total_amount, 0)) AS avg_order_value,
                MIN(created_at) AS first_order,
                MAX(created_at) AS last_order
            FROM orders 
            WHERE customer_city IS NOT NULL 
              AND customer_city != '' 
              AND customer_city != 'null'
            GROUP BY customer_city, customer_department
            ORDER BY total_sales DESC
        `);

        if (!cityData || cityData.length === 0) {
            return res.json({
                success: true,
                summary: {
                    totalCities: 0,
                    totalOrders: 0,
                    totalSales: 0,
                    highPerformanceCities: 0,
                    mediumPerformanceCities: 0,
                    lowPerformanceCities: 0
                },
                cities: [],
                thresholds: { high: 0, medium: 0 }
            });
        }

        const totalSales = cityData.reduce((sum, city) => sum + parseFloat(city.total_sales || 0), 0);
        const totalOrdersCount = cityData.reduce((sum, city) => sum + (city.total_orders || 0), 0);

        const sortedBySales = [...cityData].sort((a, b) => parseFloat(b.total_sales || 0) - parseFloat(a.total_sales || 0));
        const highSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.2)]?.total_sales || 0);
        const mediumSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.6)]?.total_sales || 0);

        const processedCities = cityData.map(city => {
            const sales = parseFloat(city.total_sales || 0);
            let performance_category;
            let intensity;
            if (sortedBySales[0] && parseFloat(sortedBySales[0].total_sales || 0) > 0) {
                if (sales >= highSalesThreshold) {
                    performance_category = 'high';
                    intensity = 0.8 + (sales / parseFloat(sortedBySales[0].total_sales)) * 0.2;
                } else if (sales >= mediumSalesThreshold) {
                    performance_category = 'medium';
                    const denom = Math.max(1, (highSalesThreshold - mediumSalesThreshold));
                    intensity = 0.4 + ((sales - mediumSalesThreshold) / denom) * 0.4;
                } else {
                    intensity = mediumSalesThreshold > 0 ? 0.1 + (sales / mediumSalesThreshold) * 0.3 : 0.1;
                    performance_category = 'low';
                }
            } else {
                performance_category = 'low';
                intensity = 0.1;
            }

            return {
                customer_city: city.customer_city,
                customer_department: city.customer_department,
                order_count: city.total_orders,
                total_value: sales,
                avg_order_value: parseFloat(city.avg_order_value || 0),
                performance_category,
                intensity: Math.min(1, Math.max(0.1, intensity)),
                percentage: totalOrdersCount > 0 ? (city.total_orders / totalOrdersCount) * 100 : 0,
                first_order: city.first_order,
                last_order: city.last_order,
                city: city.customer_city,
                department: city.customer_department,
                totalOrders: city.total_orders,
                totalSales: sales,
                avgOrderValue: parseFloat(city.avg_order_value || 0),
                category: performance_category
            };
        });

        const highCities = processedCities.filter(c => c.performance_category === 'high');
        const mediumCities = processedCities.filter(c => c.performance_category === 'medium');
        const lowCities = processedCities.filter(c => c.performance_category === 'low');

        return res.json({
            success: true,
            summary: {
                totalCities: cityData.length,
                totalOrders: totalOrdersCount,
                totalValue: totalSales,
                highPerformanceCities: highCities.length,
                mediumPerformanceCities: mediumCities.length,
                lowPerformanceCities: lowCities.length,
                topCity: processedCities[0]?.customer_city || null,
                topCitySales: processedCities[0]?.total_value || 0
            },
            cities: processedCities,
            thresholds: {
                high: highSalesThreshold,
                medium: mediumSalesThreshold
            },
            categorizedCities: {
                high: highCities.slice(0, 10),
                medium: mediumCities.slice(0, 10),
                low: lowCities.slice(0, 10)
            }
        });
    } catch (error) {
        console.error('Error fetching Colombia sales heat map data:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener datos del mapa de calor',
            error: error.message
        });
    }
});

// Get orders count by time period for heat map animation
router.get('/colombia-sales/timeline', authenticateToken, async (req, res) => {
    try {
        const rawPeriod = String(req.query?.period || 'month').toLowerCase();
        let period = 'month';
        if (['day','week','month','quarter'].includes(rawPeriod)) period = rawPeriod;

        let intervalSize = 12;
        let periodExpr = `DATE_FORMAT(created_at, '%Y-%m')`;
        let intervalUnit = 'MONTH';

        switch (period) {
            case 'day':
                periodExpr = `DATE_FORMAT(created_at, '%Y-%m-%d')`;
                intervalSize = 30;
                intervalUnit = 'DAY';
                break;
            case 'week':
                periodExpr = `DATE_FORMAT(created_at, '%Y-%u')`;
                intervalSize = 12;
                intervalUnit = 'WEEK';
                break;
            case 'quarter':
                // MySQL no soporta %q en DATE_FORMAT. Usar YEAR() y QUARTER()
                periodExpr = `CONCAT(YEAR(created_at), '-Q', QUARTER(created_at))`;
                intervalSize = 8;
                intervalUnit = 'QUARTER';
                break;
            default:
                periodExpr = `DATE_FORMAT(created_at, '%Y-%m')`;
                intervalSize = 12;
                intervalUnit = 'MONTH';
        }

        const sql = `
            SELECT 
                ${periodExpr} AS period,
                customer_city,
                COUNT(*) AS orders_count,
                SUM(COALESCE(total_amount, 0)) AS sales_amount
            FROM orders 
            WHERE customer_city IS NOT NULL 
              AND customer_city != '' 
              AND customer_city != 'null'
              AND created_at >= DATE_SUB(NOW(), INTERVAL ${intervalSize} ${intervalUnit})
            GROUP BY period, customer_city
            ORDER BY period DESC, sales_amount DESC
        `;

        const timelineData = await query(sql);

        return res.json({
            success: true,
            period,
            data: timelineData
        });

    } catch (error) {
        console.error('Error fetching heat map timeline data:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener datos de línea de tiempo',
            error: error.message
        });
    }
});

module.exports = router;
