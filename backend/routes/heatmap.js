const express = require('express');
const mysql = require('mysql2/promise');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get Colombia cities heat map data
router.get('/colombia-sales', authenticateToken, async (req, res) => {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });

        // Get sales data by city
        const [cityData] = await connection.execute(`
            SELECT 
                customer_city,
                customer_department,
                COUNT(*) as total_orders,
                SUM(COALESCE(total_amount, 0)) as total_sales,
                AVG(COALESCE(total_amount, 0)) as avg_order_value,
                MIN(created_at) as first_order,
                MAX(created_at) as last_order
            FROM orders 
            WHERE customer_city IS NOT NULL 
                AND customer_city != '' 
                AND customer_city != 'null'
                AND deleted_at IS NULL
            GROUP BY customer_city, customer_department
            ORDER BY total_sales DESC
        `);

        if (cityData.length === 0) {
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

        // Calculate statistics
        const totalSales = cityData.reduce((sum, city) => sum + parseFloat(city.total_sales || 0), 0);
        const totalOrdersCount = cityData.reduce((sum, city) => sum + city.total_orders, 0);

        // Calculate thresholds (percentiles)
        const sortedBySales = [...cityData].sort((a, b) => parseFloat(b.total_sales || 0) - parseFloat(a.total_sales || 0));
        const highSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.2)]?.total_sales || 0);
        const mediumSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.6)]?.total_sales || 0);

        // Process cities data for heat map
        const processedCities = cityData.map(city => {
            const sales = parseFloat(city.total_sales || 0);
            let performance_category;
            let intensity;
            
            // Categorize based on sales thresholds
            if (sales >= highSalesThreshold) {
                performance_category = 'high';
                intensity = 0.8 + (sales / parseFloat(sortedBySales[0].total_sales)) * 0.2;
            } else if (sales >= mediumSalesThreshold) {
                performance_category = 'medium';
                intensity = 0.4 + ((sales - mediumSalesThreshold) / (highSalesThreshold - mediumSalesThreshold)) * 0.4;
            } else {
                performance_category = 'low';
                intensity = 0.1 + (sales / mediumSalesThreshold) * 0.3;
            }
            
            return {
                customer_city: city.customer_city,
                customer_department: city.customer_department,
                order_count: city.total_orders,
                total_value: sales,
                avg_order_value: parseFloat(city.avg_order_value || 0),
                performance_category,
                intensity: Math.min(1, Math.max(0.1, intensity)),
                percentage: (city.total_orders / totalOrdersCount) * 100,
                first_order: city.first_order,
                last_order: city.last_order,
                // Keep backward compatibility fields
                city: city.customer_city,
                department: city.customer_department,
                totalOrders: city.total_orders,
                totalSales: sales,
                avgOrderValue: parseFloat(city.avg_order_value || 0),
                category: performance_category
            };
        });

        // Count categories
        const highCities = processedCities.filter(c => c.performance_category === 'high');
        const mediumCities = processedCities.filter(c => c.performance_category === 'medium');
        const lowCities = processedCities.filter(c => c.performance_category === 'low');

        const response = {
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
                high: highCities.slice(0, 10), // Top 10 high performance
                medium: mediumCities.slice(0, 10), // Top 10 medium performance
                low: lowCities.slice(0, 10) // First 10 low performance
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error fetching Colombia sales heat map data:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener datos del mapa de calor',
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

// Get orders count by time period for heat map animation
router.get('/colombia-sales/timeline', authenticateToken, async (req, res) => {
    let connection;
    
    try {
        const { period = 'month' } = req.query; // 'day', 'week', 'month', 'quarter'
        
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });

        let dateFormat;
        let intervalSize;
        
        switch (period) {
            case 'day':
                dateFormat = '%Y-%m-%d';
                intervalSize = 30; // Last 30 days
                break;
            case 'week':
                dateFormat = '%Y-%u';
                intervalSize = 12; // Last 12 weeks
                break;
            case 'quarter':
                dateFormat = '%Y-Q%q';
                intervalSize = 8; // Last 8 quarters
                break;
            default: // month
                dateFormat = '%Y-%m';
                intervalSize = 12; // Last 12 months
        }

        const [timelineData] = await connection.execute(`
            SELECT 
                DATE_FORMAT(created_at, ?) as period,
                customer_city,
                COUNT(*) as orders_count,
                SUM(COALESCE(total_amount, 0)) as sales_amount
            FROM orders 
            WHERE customer_city IS NOT NULL 
                AND customer_city != '' 
                AND customer_city != 'null'
                AND deleted_at IS NULL
                AND created_at >= DATE_SUB(NOW(), INTERVAL ? ${period})
            GROUP BY period, customer_city
            ORDER BY period DESC, sales_amount DESC
        `, [dateFormat, intervalSize]);

        res.json({
            success: true,
            period,
            data: timelineData
        });

    } catch (error) {
        console.error('Error fetching heat map timeline data:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al obtener datos de línea de tiempo',
            error: error.message
        });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

module.exports = router;
