const mysql = require('mysql2/promise');

async function analyzeCustomerCities() {
    let connection;
    
    try {
        console.log('=== ANALIZANDO CIUDADES DE CLIENTES PARA MAPA DE CALOR ===\n');
        
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conexión a base de datos establecida\n');
        
        // 1. Verificar estructura de la tabla orders
        console.log('1. Verificando estructura de la tabla orders...');
        const [columns] = await connection.execute('DESCRIBE orders');
        const columnNames = columns.map(col => col.Field);
        console.log('Columnas disponibles:', columnNames);
        
        // Verificar si existe customer_city
        const hasCustomerCity = columnNames.includes('customer_city');
        console.log(`Campo customer_city existe: ${hasCustomerCity}\n`);
        
        if (!hasCustomerCity) {
            console.log('❌ El campo customer_city no existe en la tabla orders');
            console.log('Columnas relacionadas con ciudad/ubicación:');
            const locationColumns = columnNames.filter(col => 
                col.toLowerCase().includes('city') || 
                col.toLowerCase().includes('ciudad') ||
                col.toLowerCase().includes('shipping') ||
                col.toLowerCase().includes('delivery')
            );
            console.log(locationColumns);
            return;
        }
        
        // 2. Contar pedidos totales
        const [totalOrders] = await connection.execute('SELECT COUNT(*) as total FROM orders');
        console.log(`2. Total de pedidos: ${totalOrders[0].total}\n`);
        
        // 3. Analizar datos de customer_city
        console.log('3. Analizando datos de customer_city...');
        const [cityData] = await connection.execute(`
            SELECT 
                customer_city,
                COUNT(*) as total_orders,
                SUM(total_amount) as total_sales,
                AVG(total_amount) as avg_order_value,
                MIN(created_at) as first_order,
                MAX(created_at) as last_order
            FROM orders 
            WHERE customer_city IS NOT NULL 
                AND customer_city != '' 
                AND customer_city != 'null'
            GROUP BY customer_city 
            ORDER BY total_orders DESC
        `);
        
        console.log(`Ciudades con pedidos: ${cityData.length}`);
        console.log('\nTop 15 ciudades por número de pedidos:');
        console.log('----------------------------------------');
        cityData.slice(0, 15).forEach((city, index) => {
            console.log(`${index + 1}. ${city.customer_city}: ${city.total_orders} pedidos, $${parseFloat(city.total_sales || 0).toLocaleString()} en ventas`);
        });
        
        // 4. Verificar pedidos sin ciudad
        console.log('\n4. Verificando pedidos sin ciudad...');
        const [missingCity] = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE customer_city IS NULL OR customer_city = '' OR customer_city = 'null'
        `);
        console.log(`Pedidos sin ciudad: ${missingCity[0].count}\n`);
        
        // 5. Crear categorización para el mapa de calor
        console.log('5. Categorizando ciudades para mapa de calor...');
        
        const totalSales = cityData.reduce((sum, city) => sum + parseFloat(city.total_sales || 0), 0);
        const totalOrdersCount = cityData.reduce((sum, city) => sum + city.total_orders, 0);
        
        // Calcular percentiles
        const sortedBySales = [...cityData].sort((a, b) => parseFloat(b.total_sales || 0) - parseFloat(a.total_sales || 0));
        const highSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.2)]?.total_sales || 0);
        const mediumSalesThreshold = parseFloat(sortedBySales[Math.floor(sortedBySales.length * 0.6)]?.total_sales || 0);
        
        console.log(`Umbral ventas altas (Top 20%): $${highSalesThreshold.toLocaleString()}`);
        console.log(`Umbral ventas medias (Top 60%): $${mediumSalesThreshold.toLocaleString()}`);
        
        const heatmapData = cityData.map(city => {
            const sales = parseFloat(city.total_sales || 0);
            let category;
            let intensity;
            
            if (sales >= highSalesThreshold) {
                category = 'high';
                intensity = 0.8 + (sales / parseFloat(sortedBySales[0].total_sales)) * 0.2;
            } else if (sales >= mediumSalesThreshold) {
                category = 'medium';
                intensity = 0.4 + ((sales - mediumSalesThreshold) / (highSalesThreshold - mediumSalesThreshold)) * 0.4;
            } else {
                category = 'low';
                intensity = 0.1 + (sales / mediumSalesThreshold) * 0.3;
            }
            
            return {
                city: city.customer_city,
                totalOrders: city.total_orders,
                totalSales: sales,
                avgOrderValue: parseFloat(city.avg_order_value || 0),
                category,
                intensity: Math.min(1, intensity),
                percentage: (city.total_orders / totalOrdersCount) * 100
            };
        });
        
        console.log('\nCategorización para mapa de calor:');
        console.log('==================================');
        
        const highCities = heatmapData.filter(c => c.category === 'high');
        const mediumCities = heatmapData.filter(c => c.category === 'medium');
        const lowCities = heatmapData.filter(c => c.category === 'low');
        
        console.log(`\n🔥 ZONAS DE ALTO RENDIMIENTO (${highCities.length} ciudades):`);
        highCities.slice(0, 10).forEach(city => {
            console.log(`   ${city.city}: ${city.totalOrders} pedidos, $${city.totalSales.toLocaleString()}, intensidad: ${(city.intensity * 100).toFixed(1)}%`);
        });
        
        console.log(`\n🟡 ZONAS DE RENDIMIENTO MEDIO (${mediumCities.length} ciudades):`);
        mediumCities.slice(0, 10).forEach(city => {
            console.log(`   ${city.city}: ${city.totalOrders} pedidos, $${city.totalSales.toLocaleString()}, intensidad: ${(city.intensity * 100).toFixed(1)}%`);
        });
        
        console.log(`\n🔵 ZONAS QUE NECESITAN ATENCIÓN (${lowCities.length} ciudades):`);
        lowCities.slice(0, 10).forEach(city => {
            console.log(`   ${city.city}: ${city.totalOrders} pedidos, $${city.totalSales.toLocaleString()}, intensidad: ${(city.intensity * 100).toFixed(1)}%`);
        });
        
        // 6. Generar datos para el mapa
        console.log('\n6. Generando estructura de datos para el mapa...');
        const mapData = {
            summary: {
                totalCities: cityData.length,
                totalOrders: totalOrdersCount,
                totalSales: totalSales,
                highPerformanceCities: highCities.length,
                mediumPerformanceCities: mediumCities.length,
                lowPerformanceCities: lowCities.length
            },
            cities: heatmapData,
            thresholds: {
                high: highSalesThreshold,
                medium: mediumSalesThreshold
            }
        };
        
        console.log('\nResumen para el mapa de calor:');
        console.log(`- ${mapData.summary.totalCities} ciudades con ventas`);
        console.log(`- ${mapData.summary.totalOrders} pedidos totales`);
        console.log(`- $${mapData.summary.totalSales.toLocaleString()} en ventas totales`);
        console.log(`- ${mapData.summary.highPerformanceCities} ciudades de alto rendimiento`);
        console.log(`- ${mapData.summary.mediumPerformanceCities} ciudades de rendimiento medio`);
        console.log(`- ${mapData.summary.lowPerformanceCities} ciudades que necesitan atención`);
        
        return mapData;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return null;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

analyzeCustomerCities();
