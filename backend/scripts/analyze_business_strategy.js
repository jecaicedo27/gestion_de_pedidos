
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '/var/www/gestion_de_pedidos/backend/.env' });

async function analyzeStrategy() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log("🚀 INICIANDO ANÁLISIS ESTRATÉGICO DE PERLAS EXPLOSIVAS 🚀\n");
        const startDate = '2025-01-01'; // Analyze this year or last 6 months
        const endDate = '2025-12-31';

        // 1. ¿QUÉ VENDER MÁS? (Productos con mayor Margen pero bajo volumen relativo)
        // Buscamos "Joyas Ocultas": Margen > 40%
        const [hiddenGems] = await connection.query(`
            SELECT 
                p.product_name,
                SUM(oi.quantity) as units_sold,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - IFNULL(p.purchasing_price, 0))) as total_profit,
                (SUM(oi.quantity * (oi.price - IFNULL(p.purchasing_price, 0))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN products p ON oi.name = p.product_name
            WHERE o.status NOT IN ('cancelado', 'anulado')
            GROUP BY p.product_name
            HAVING margin_percent > 40 AND total_sales > 0
            ORDER BY total_sales DESC
            LIMIT 5
        `);
        console.log("💎 JOYAS OCULTAS (Vender Más - Alto Margen):");
        hiddenGems.forEach(p => {
            console.log(`- ${p.product_name}: Margen ${Number(p.margin_percent).toFixed(1)}% | Ventas: $${Number(p.total_sales).toLocaleString()}`);
        });
        console.log("\n");

        // 2. ¿A QUIÉN DEJAR DE VENDER (o Renegociar)? (Clientes volumen alto pero margen < 15%)
        const [profitKillers] = await connection.query(`
            SELECT 
                c.name,
                SUM(oi.quantity * oi.price) as total_sales,
                SUM(oi.quantity * (oi.price - IFNULL(p.purchasing_price, 0))) as total_profit,
                (SUM(oi.quantity * (oi.price - IFNULL(p.purchasing_price, 0))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            JOIN customers c ON o.customer_identification = c.identification
            JOIN products p ON oi.name = p.product_name
            WHERE o.status NOT IN ('cancelado', 'anulado')
            GROUP BY c.name
            HAVING total_sales > 2000000 AND margin_percent < 15
            ORDER BY margin_percent ASC
            LIMIT 5
        `);
        console.log("⚠️ CLIENTES 'VAMPIRO' (Renegociar o Dejar - Alto Volumen, Bajo Margen):");
        if (profitKillers.length === 0) console.log("   ¡Excelente! No tienes clientes grandes con margen peligroso (<15%).");
        profitKillers.forEach(c => {
            console.log(`- ${c.name}: Margen ${Number(c.margin_percent).toFixed(1)}% | Compra: $${Number(c.total_sales).toLocaleString()} | Utilidad real: $${Number(c.total_profit).toLocaleString()}`);
        });
        console.log("\n");

        // 3. EN QUÉ CONCENTRARSE (Ciudades más eficientes)
        const [goldenCities] = await connection.query(`
            SELECT 
                COALESCE(o.shipping_city, c.city) as city,
                SUM(oi.quantity * oi.price) as total_sales,
                (SUM(oi.quantity * (oi.price - IFNULL(p.purchasing_price, 0))) / SUM(oi.quantity * oi.price)) * 100 as margin_percent
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.name = p.product_name
            LEFT JOIN customers c ON o.customer_identification = c.identification
            WHERE o.status NOT IN ('cancelado', 'anulado')
            GROUP BY city
            HAVING total_sales > 5000000
            ORDER BY margin_percent DESC
            LIMIT 5
        `);
        console.log("🏙️ CIUDADES DE ORO (Concentrarse Aquí):");
        goldenCities.forEach(c => {
            console.log(`- ${c.city}: Rentabilidad ${Number(c.margin_percent).toFixed(1)}% | Ventas: $${Number(c.total_sales).toLocaleString()}`);
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await connection.end();
    }
}

analyzeStrategy();
