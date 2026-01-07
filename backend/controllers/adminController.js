const { query } = require('../config/database');

/**
 * GET /api/admin/executive-stats
 * Obtiene KPIs de alto nivel para el dashboard gerencial
 */
const getExecutiveStats = async (req, res) => {
  try {
    console.log('📊 Calculando estadísticas ejecutivas...');

    // Fechas Clave (Recibidas o Default)
    const { startDate, endDate } = req.query;
    let startOfMonth, endOfMonth, startOfPrevMonth, endOfPrevMonth;

    if (startDate && endDate) {
      // Modo Filtrado
      const start = new Date(startDate);
      startOfMonth = startDate;
      endOfMonth = endDate;

      // Mes anterior relativo al seleccionado
      const prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 1);
      startOfPrevMonth = prevStart.toISOString().slice(0, 10);

      const prevEnd = new Date(start);
      prevEnd.setDate(0); // Último día del mes anterior
      endOfPrevMonth = prevEnd.toISOString().slice(0, 10) + ' 23:59:59';
    } else {
      // Default: Mes Actual (Bogota)
      const now = new Date();
      const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));

      const year = bogotaNow.getFullYear();
      const month = bogotaNow.getMonth();

      // Start of Month: YYYY-MM-01
      startOfMonth = new Date(year, month, 1).toLocaleDateString('en-CA');

      // End of Month: Now (Bogota)
      endOfMonth = bogotaNow.toLocaleDateString('en-CA') + ' 23:59:59';

      // Prev Month
      const prevDate = new Date(year, month - 1, 1);
      startOfPrevMonth = prevDate.toLocaleDateString('en-CA');

      const prevEndDate = new Date(year, month, 0);
      endOfPrevMonth = prevEndDate.toLocaleDateString('en-CA') + ' 23:59:59';
    }

    // 1. Ventas del Mes Actual (o Seleccionado) y Proyección
    const salesQuery = `
            SELECT 
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as current_month_sales,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)) / 1.19) as current_month_sales_no_vat,
                SUM(oi.profit_amount) as current_gross_profit,
                SUM(oi.purchase_cost * oi.quantity) as current_cost_sold,

                COUNT(DISTINCT o.id) as total_orders,
                COUNT(DISTINCT o.customer_identification) as active_customers
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND oi.price >= 100
        `;

    // 2. Ventas Velocidad (En el rango seleccionado)
    const velocityQuery = `
            SELECT SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales_period
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND oi.price >= 100
        `;

    // 3. Retención (Clientes que compraron mes anterior Y este mes seleccionado)
    const retentionQuery = `
            SELECT 
                COUNT(DISTINCT t1.customer_identification) as retained_customers,
                (SELECT COUNT(DISTINCT customer_identification) FROM orders WHERE created_at BETWEEN ? AND ? AND status NOT IN ('cancelado', 'anulado', 'gestion_especial')) as prev_month_customers
            FROM orders t1
            WHERE t1.created_at BETWEEN ? AND ?
            AND t1.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND t1.customer_identification IN (
                SELECT customer_identification 
                FROM orders 
                WHERE created_at BETWEEN ? AND ?
                AND status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            )
        `;

    // 4. Mix de Categorías
    const categoryQuery = `
            SELECT 
                CASE 
                    WHEN p.product_name LIKE '%LIQUIPOPS%' OR p.product_name LIKE '%LIQUIPOS%' OR p.product_name LIKE '%JALAPEÑO%' THEN 'Liquipops'
                    WHEN p.product_name LIKE '%GENIALITY%' THEN 'Geniality'
                    WHEN p.product_name LIKE '%SKARCHAMOY%' OR p.product_name LIKE '%CHAMOY%' THEN 'Skarchamoy'
                    WHEN p.product_name LIKE '%SKARCHALITO%' THEN 'Skarchalito'
                    WHEN p.product_name LIKE '%SKARCHA%' THEN 'Skarcha'
                    WHEN p.product_name LIKE '%YEXIS%' THEN 'Yexis'
                    WHEN p.product_name LIKE '%PERLA%' OR p.product_name LIKE '%EXPLOSIVA%' THEN 'Perlas Explosivas'
                    WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                    WHEN p.product_name LIKE '%BANDERITA%' OR p.product_name LIKE '%FRUTOS%' THEN 'Banderitas + Frutos Secos'
                    WHEN p.product_name LIKE '%POLVO%' OR p.product_name LIKE '%MEZCLA%' THEN 'Mezclas en Polvo'
                    WHEN p.product_name LIKE '%INSUMO%' OR p.product_name LIKE '%SIROPE%' OR p.product_name LIKE '%COMPLEMENTO%' THEN 'Complementos'
                    ELSE 'Otros'
                END as category_group,
                CASE 
                    WHEN p.internal_code = 'CHAM004' THEN 'SIROPE SKARCHAMOY DE 500 ML'
                    WHEN p.internal_code = 'CHAM002' THEN 'SIROPE SKARCHAMOY DE 1000 ML'
                    WHEN p.internal_code = 'CHAM001' THEN 'SIROPE SKARCHAMOY DE 250 ML'
                    ELSE p.product_name
                END as product_name_normalized,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as sales_value,
                SUM(oi.profit_amount) as total_profit

            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.payment_method != 'reposicion'
            AND oi.product_code NOT IN ('FL01', 'PROPINA')
            GROUP BY category_group, product_name_normalized
            ORDER BY sales_value DESC
        `;

    // 5. Alerta de Costos Cero (Data Integrity)
    const zeroCostQuery = `
        SELECT COUNT(DISTINCT oi.id) as zero_cost_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at BETWEEN ? AND ?
        AND (oi.purchase_cost = 0 OR oi.purchase_cost IS NULL)
        AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
        AND o.payment_method != 'reposicion'
        AND oi.product_code NOT IN ('FL01', 'PROPINA')
    `;

    const [salesResult] = await query(salesQuery, [startOfMonth, endOfMonth]);
    const [velocityResult] = await query(velocityQuery, [startOfMonth, endOfMonth]);
    const [retentionResult] = await query(retentionQuery, [startOfPrevMonth, endOfPrevMonth, startOfMonth, endOfMonth, startOfPrevMonth, endOfPrevMonth]);
    const categoryResults = await query(categoryQuery, [startOfMonth, endOfMonth]);
    const [zeroCostResult] = await query(zeroCostQuery, [startOfMonth, endOfMonth]);

    // Procesar resultados de categorías para agrupar productos
    const processedCategories = categoryResults.reduce((acc, curr) => {
      const existingCat = acc.find(c => c.category_group === curr.category_group);
      if (existingCat) {
        existingCat.sales_value += Number(curr.sales_value);
        existingCat.total_profit += Number(curr.total_profit);
        existingCat.products.push({
          name: curr.product_name_normalized || curr.product_name || 'Desconocido',
          sales: Number(curr.sales_value),
          profit: Number(curr.total_profit)
        });
      } else {
        acc.push({
          category_group: curr.category_group,
          sales_value: Number(curr.sales_value),
          total_profit: Number(curr.total_profit),
          products: [{
            name: curr.product_name_normalized || curr.product_name || 'Desconocido',
            sales: Number(curr.sales_value),
            profit: Number(curr.total_profit)
          }]
        });
      }
      return acc;
    }, []);

    // Ordenar productos dentro de cada categoría
    processedCategories.forEach(cat => {
      cat.products.sort((a, b) => b.sales - a.sales);
    });

    // Procesamiento de Datos
    console.log('DEBUG salesResult:', salesResult);
    const currentMonthSales = Number(salesResult?.current_month_sales || 0);
    // const currentMonthCost = Number(salesResult?.current_month_cost || 0); // Removed column
    const totalOrders = Number(salesResult?.total_orders || 0);
    const activeCustomers = Number(salesResult?.active_customers || 0);

    const totalSalesPeriod = Number(velocityResult?.total_sales_period || 0);

    // Proyección Lineal Simple
    const now = new Date();
    const startDateObj = new Date(startOfMonth);
    const endDateObj = new Date(endOfMonth);

    // Check if the selected range is fully in the past
    const isPastMonth = endDateObj < now;

    // Days in the selected month (using endDate to determine month duration)
    const daysInMonth = new Date(endDateObj.getFullYear(), endDateObj.getMonth() + 1, 0).getDate();

    let dailySalesVelocity = 0;
    let projectedSales = 0;

    if (isPastMonth) {
      // Past month: Velocity is total / days in month. Projection is irrelevant (equals actual).
      dailySalesVelocity = totalSalesPeriod / daysInMonth;
      projectedSales = totalSalesPeriod;
    } else {
      // Current month: Velocity is total / days passed so far.
      // Assuming startDate is the 1st of the month for this calculation to hold for "monthly" velocity
      const daysPassed = Math.max(1, now.getDate());
      dailySalesVelocity = totalSalesPeriod / daysPassed;
      projectedSales = dailySalesVelocity * daysInMonth;
    }

    // Rentabilidad Real (Proyectada)
    // Calculamos el margen actual usando ventas SIN IVA para ser consistente con costos SIN IVA
    const currentMonthSalesNoVat = Number(salesResult?.current_month_sales_no_vat || 0);
    const currentGrossProfit = Number(salesResult?.current_gross_profit || 0);
    const currentMarginPercent = currentMonthSalesNoVat > 0 ? (currentGrossProfit) / currentMonthSalesNoVat : 0.35;
    const estimatedGrossProfit = (projectedSales / 1.19) * currentMarginPercent;

    // Retención
    const retainedCustomers = Number(retentionResult?.retained_customers || 0);
    const prevMonthCustomers = Number(retentionResult?.prev_month_customers || 0);
    const retentionRate = prevMonthCustomers > 0 ? (retainedCustomers / prevMonthCustomers) * 100 : 0;

    // AOV
    const aov = totalOrders > 0 ? currentMonthSales / totalOrders : 0;

    // Estrategias (Generación básica de texto)
    const strategies = [];

    if (projectedSales < 1000000000) {
      const gap = 1000000000 - projectedSales;
      strategies.push({
        type: 'growth',
        title: 'Brecha de Meta de Ventas',
        description: `Faltan $${(gap / 1000000).toFixed(0)}M para la meta de 1000M. Aumentar velocidad diaria en un ${(gap / projectedSales * 100).toFixed(0)}%.`
      });
    }

    if (retentionRate < 60) {
      strategies.push({
        type: 'retention',
        title: 'Alerta de Retención',
        description: `Retención del ${retentionRate.toFixed(1)}% es baja. Activar campaña de reactivación para clientes del mes pasado.`
      });
    }

    if (aov < 150000) {
      strategies.push({
        type: 'revenue',
        title: 'Oportunidad de Ticket Promedio',
        description: `El AOV es $${(aov / 1000).toFixed(0)}k. Crear bundles de Perlas + Insumos para incentivar mayor compra.`
      });
    }

    res.json({
      success: true,
      kpis: {
        projectedSales,
        estimatedGrossProfit,
        currentGrossProfit, // Nueva variable
        currentMonthSales,
        dailySalesVelocity,
        activeCustomers,
        retentionRate,
        aov,
        currentMarginPercent: (currentMarginPercent * 100).toFixed(1),
        inventoryFund: Number(salesResult?.current_cost_sold || 0)
      },
      targets: {
        sales: 1000000000,
        profit: 200000000
      },
      productMix: processedCategories,
      strategies
    });

  } catch (error) {
    console.error('Error getting executive stats:', error);
    res.status(500).json({ success: false, message: 'Error calculando estadísticas', error: error.message });
  }
};

/**
 * GET /api/admin/advanced-stats
 * Obtiene métricas avanzadas de crecimiento: Churn, Cross-Sell, Geo
 */
const getAdvancedStats = async (req, res) => {
  try {
    console.log('🔍 Calculando estadísticas avanzadas...');

    // Fechas Clave (Recibidas o Default)
    const { startDate, endDate } = req.query;
    let startQueryDate, endQueryDate;

    if (startDate && endDate) {
      startQueryDate = startDate;
      endQueryDate = endDate;
    } else {
      // Default: últimos 30 días (Bogota)
      const now = new Date();
      const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));

      endQueryDate = bogotaNow.toLocaleDateString('en-CA') + ' 23:59:59';

      const startObj = new Date(bogotaNow);
      startObj.setDate(startObj.getDate() - 30);
      startQueryDate = startObj.toLocaleDateString('en-CA');
    }

    console.log(`📅 Rango de Fechas: ${startQueryDate} - ${endQueryDate}`);

    // 1. Churn Risk (Clientes en Riesgo) - INDEPENDIENTE DEL FILTRO DE FECHA
    // Este KPI es "estado actual", no depende del mes seleccionado
    const churnQuery = `
            SELECT 
                c.name, 
                c.phone, 
                c.city,
                MAX(o.created_at) as last_purchase_date, 
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_ltv
            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.status NOT IN ('cancelado', 'anulado')
            GROUP BY c.identification
            HAVING last_purchase_date < DATE_SUB(NOW(), INTERVAL 45 DAY)
            AND last_purchase_date > DATE_SUB(NOW(), INTERVAL 120 DAY)
            ORDER BY total_ltv DESC
            LIMIT 10
        `;

    // 2. Cross-Sell Opportunity (Oportunidad de Perlas)
    const crossSellQuery = `
            SELECT 
                c.name,
                c.phone,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_spent_period
            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            AND c.identification NOT IN (
                SELECT DISTINCT o2.customer_identification
                FROM orders o2
                JOIN order_items oi2 ON o2.id = oi2.order_id
                WHERE (
                    oi2.name LIKE '%PERLA%' 
                    OR oi2.name LIKE '%EXPLOSIVA%' 
                    OR oi2.name LIKE '%LIQUIPOPS%' 
                    OR oi2.name LIKE '%LIQUIPOS%'
                )
                AND o2.status NOT IN ('cancelado', 'anulado')
            )
            GROUP BY c.identification
            HAVING total_spent_period > 1000000
            ORDER BY total_spent_period DESC
            LIMIT 10
        `;

    // 3. Top Cities (Foco Geográfico)
    const citiesQuery = `
            SELECT 
                COALESCE(o.shipping_city, c.city, 'Desconocido') as city,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales
            FROM orders o
            LEFT JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')
            GROUP BY city
            ORDER BY total_sales DESC
            LIMIT 10
        `;

    // 4. Cartera (Cuentas por Cobrar)
    // Deuda: Entregado pero no cerrado en Siigo
    // Recaudo: Cerrado en Siigo este mes
    const receivablesQuery = `
            SELECT 
                (
                    SELECT SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) 
                    FROM orders o 
                    JOIN order_items oi ON o.id = oi.order_id 
                    WHERE o.status = 'entregado' AND o.siigo_closed = 0 AND o.deleted_at IS NULL
                ) as total_debt,
                (
                    SELECT SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) 
                    FROM orders o 
                    JOIN order_items oi ON o.id = oi.order_id 
                    WHERE o.siigo_closed = 1 AND o.siigo_closed_at BETWEEN ? AND ? AND o.deleted_at IS NULL
                ) as collected_this_month
        `;

    // 5. Mix de Clientes (Nuevos vs Recurrentes)
    // 6c. Mix de Clientes (Nuevos vs Recurrentes en el periodo)
    const mixQuery = `
            SELECT 
                COUNT(DISTINCT CASE WHEN first_order_date BETWEEN ? AND ? THEN identification END) as new_customers,
                SUM(CASE WHEN first_order_date BETWEEN ? AND ? THEN total_spent ELSE 0 END) as new_sales,
                COUNT(DISTINCT CASE WHEN first_order_date < ? THEN identification END) as recurring_customers,
                SUM(CASE WHEN first_order_date < ? THEN total_spent ELSE 0 END) as recurring_sales
            FROM (
                SELECT 
                    c.identification,
                    MIN(o.created_at) as first_order_date,
                    SUM(CASE WHEN o.created_at BETWEEN ? AND ? THEN (
                        SELECT SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) 
                        FROM order_items oi 
                        WHERE oi.order_id = o.id
                    ) ELSE 0 END) as total_spent
                FROM customers c
                JOIN orders o ON c.identification = o.customer_identification
                WHERE o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
                GROUP BY c.identification
            ) as cust_stats
            WHERE total_spent > 0
        `;

    // 6. Días de Inventario (Runway)
    // Stock actual / Venta diaria promedio (últimos 30 días)
    const inventoryRunwayQuery = `
            SELECT 
                p.product_name,
                p.available_quantity as current_stock,
                (
                    SELECT IFNULL(SUM(oi.quantity), 0) / DATEDIFF(?, ?)
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.name = p.product_name
                    AND o.created_at BETWEEN ? AND ?
                    AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
                ) as daily_velocity,
                p.available_quantity / NULLIF((
                    SELECT IFNULL(SUM(oi.quantity), 0) / DATEDIFF(?, ?)
                    FROM order_items oi
                    JOIN orders o ON o.id = oi.order_id
                    WHERE oi.name = p.product_name
                    AND o.created_at BETWEEN ? AND ?
                    AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
                ), 0) as days_remaining
            FROM products p
            WHERE p.is_active = 1
            HAVING daily_velocity > 0
            ORDER BY days_remaining ASC
            LIMIT 10
        `;

    // 7. Top Rentabilidad por Cliente
    const profitByCustomerQuery = `
            SELECT 
                c.name,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit,
                (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent

            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY c.identification, c.name
            ORDER BY total_profit DESC
            LIMIT 1000
        `;

    // 8. Top Rentabilidad por Producto
    const profitByProductQuery = `
            SELECT 
                COALESCE(p.product_name, oi.name) as product_name,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit,
                (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent

            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY COALESCE(p.id, oi.name), COALESCE(p.product_name, oi.name)
            ORDER BY total_profit DESC
            LIMIT 500
        `;

    // 9. Rentabilidad por Ciudad (con Top 3 Clientes expandibles)
    const profitByCityQuery = `
            SELECT 
                main.city,
                main.total_sales,
                main.total_profit,
                main.margin_percent,
                (
                    SELECT JSON_ARRAYAGG(JSON_OBJECT(
                        'name', sub.name, 
                        'total_sales', sub.cust_total_sales, 
                        'total_profit', sub.cust_total_profit,
                        'margin_percent', sub.cust_margin_percent
                    ))
                    FROM (
                        SELECT 
                            c.name,
                            COALESCE(o.shipping_city, c.city, 'Desconocido') as city_group,
                            SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as cust_total_sales,
                            SUM(oi.profit_amount) as cust_total_profit,
                            (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as cust_margin_percent

                        FROM orders o
                        JOIN customers c ON o.customer_identification = c.identification
                        JOIN order_items oi ON o.id = oi.order_id
                        LEFT JOIN products p ON p.product_name = oi.name
                        WHERE o.created_at BETWEEN ? AND ?
                        AND o.status NOT IN ('cancelado', 'anulado')
                        GROUP BY c.identification, c.name, city_group
                        ORDER BY cust_total_profit DESC
                    ) as sub
                    WHERE sub.city_group = main.city
                    LIMIT 5
                ) as top_customers
            FROM (
                SELECT 
                    COALESCE(o.shipping_city, c.city, 'Desconocido') as city,
                    SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                    SUM(oi.profit_amount) as total_profit,
                    (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent

                FROM orders o
                LEFT JOIN customers c ON o.customer_identification = c.identification
                JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN products p ON p.product_name = oi.name
                WHERE o.created_at BETWEEN ? AND ?
                AND o.status NOT IN ('cancelado', 'anulado')
                GROUP BY city
                ORDER BY total_profit DESC
                LIMIT 30
            ) as main
        `;

    const churnResult = await query(churnQuery);
    const crossSellResult = await query(crossSellQuery, [startQueryDate, endQueryDate]);
    const [mixResult] = await query(mixQuery, [startQueryDate, endQueryDate, startQueryDate, endQueryDate, startQueryDate, startQueryDate, startQueryDate, endQueryDate]);
    const citiesResult = await query(citiesQuery, [startQueryDate, endQueryDate]);
    const [receivablesResult] = await query(receivablesQuery, [startQueryDate, endQueryDate]);

    // Calcular mix de clientes (Ahora viene ya agregado desde SQL)
    const customerMixResult = {
      'Nuevo': { count: Number(mixResult?.new_customers || 0), sales: Number(mixResult?.new_sales || 0) },
      'Recurrente': { count: Number(mixResult?.recurring_customers || 0), sales: Number(mixResult?.recurring_sales || 0) }
    };


    const inventoryResult = await query(inventoryRunwayQuery, [endQueryDate, startQueryDate, startQueryDate, endQueryDate, endQueryDate, startQueryDate, startQueryDate, endQueryDate]);
    const profitByCustomerResult = await query(profitByCustomerQuery, [startQueryDate, endQueryDate]);
    const profitByProductResult = await query(profitByProductQuery, [startQueryDate, endQueryDate]);
    const profitByCityResult = await query(profitByCityQuery, [startQueryDate, endQueryDate, startQueryDate, endQueryDate]);

    // 10. Clientes con Baja Rentabilidad (margen < 15%)
    const lowProfitCustomersQuery = `
            SELECT 
                c.name,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit,
                (SUM(oi.profit_amount) / SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)))) * 100 as margin_percent

            FROM orders o
            JOIN customers c ON o.customer_identification = c.identification
            JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON p.product_name = oi.name
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado')

            GROUP BY c.identification, c.name
            HAVING margin_percent < 15
            ORDER BY margin_percent ASC
            LIMIT 100
        `;
    const lowProfitCustomersResult = await query(lowProfitCustomersQuery, [startQueryDate, endQueryDate]);

    // 11. Cluster Analysis (Titanes vs Ocasionales -> Now Segments)
    const clusterQuery = `
        SELECT 
            c.name,
            c.segment,
            COUNT(DISTINCT o.id) as order_count,
            SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
            SUM(oi.profit_amount) as total_profit

        FROM orders o
        JOIN customers c ON o.customer_identification = c.identification
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON p.product_name = oi.name
        WHERE o.created_at BETWEEN ? AND ?
        AND o.status NOT IN ('cancelado', 'anulado')
        GROUP BY c.identification
    `;
    const clusterRawData = await query(clusterQuery, [startQueryDate, endQueryDate]);

    // Process Clusters
    const clusters = {
      minorista: { label: 'Minorista (0%)', count: 0, sales: 0, profit: 0, orders: 0 },
      mayorista: { label: 'Mayorista (4-14%)', count: 0, sales: 0, profit: 0, orders: 0 },
      plata: { label: 'Dist. Plata (15-20%)', count: 0, sales: 0, profit: 0, orders: 0 },
      oro: { label: 'Dist. Oro (>20%)', count: 0, sales: 0, profit: 0, orders: 0 }
    };

    // Helper to map DB segment to cluster key
    const mapSegmentToKey = (seg) => {
      if (!seg) return 'minorista';
      const s = seg.toLowerCase();

      // Priority Match
      if (s.includes('oro')) return 'oro';
      if (s.includes('plata')) return 'plata';
      if (s.includes('mayorista')) return 'mayorista';
      if (s.includes('minorista')) return 'minorista';

      // Fallbacks
      if (s.includes('titan')) return 'oro';
      if (s.includes('regular')) return 'plata';
      if (s.includes('ocasional')) return 'minorista';

      return 'minorista';
    };

    const scatterData = clusterRawData.map(c => {
      const sales = Number(c.total_sales);
      const profit = Number(c.total_profit);
      const margin = sales > 0 ? (profit / sales) * 100 : 0;
      const type = mapSegmentToKey(c.segment);

      // Update Cluster Aggregate
      if (clusters[type]) {
        clusters[type].count++;
        clusters[type].sales += sales;
        clusters[type].profit += profit;
        clusters[type].orders += Number(c.order_count);
      }

      return {
        name: c.name,
        sales,
        margin,
        orders: c.order_count,
        type
      };
    });

    const processedClusters = Object.keys(clusters).map(key => {
      const c = clusters[key];
      return {
        type: key,
        label: c.label,
        count: c.count,
        totalSales: c.sales,
        totalProfit: c.profit,
        totalOrders: c.orders,
        avgTicket: c.orders > 0 ? c.sales / c.orders : 0,
        efficiency: c.count > 0 ? c.sales / c.count : 0
      };
    });


    res.json({
      success: true,
      range: { startDate: startQueryDate, endDate: endQueryDate },
      data: {
        churnRisk: churnResult,
        crossSell: crossSellResult,
        topCities: citiesResult,
        receivables: {
          debt: Number(receivablesResult?.total_debt || 0),
          collected: Number(receivablesResult?.collected_this_month || 0)
        },
        customerMix: customerMixResult,
        inventoryRunway: inventoryResult,
        profitByCustomer: profitByCustomerResult,
        profitByProduct: profitByProductResult,
        profitByCity: profitByCityResult,
        lowProfitCustomers: lowProfitCustomersResult,
        // Cluster Data
        customerClusters: processedClusters,
        customerScatter: scatterData
      }
    });
  } catch (error) {
    console.error('Error getting advanced stats:', error);
    res.status(500).json({ success: false, message: 'Error calculando métricas avanzadas', error: error.message });
  }
};

// Get customers for a specific cluster with their metrics
const getClusterCustomers = async (req, res) => {
  try {
    const { clusterType } = req.params;
    const { startDate, endDate } = req.query;

    if (!clusterType) {
      return res.status(400).json({ error: 'Cluster type is required' });
    }

    // Map cluster type to segment names
    const segmentMap = {
      'minorista': ['Minorista', 'Ocasionales'],
      'mayorista': ['Mayorista'],
      'plata': ['Distribuidor Plata', 'Dist. Plata', 'Regulares'],
      'oro': ['Distribuidor Oro', 'Dist. Oro', 'Titanes']
    };

    const segments = segmentMap[clusterType.toLowerCase()];

    if (!segments) {
      return res.status(400).json({ error: 'Invalid cluster type' });
    }

    // Build date filter
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'AND o.created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    // Query to get customers with their metrics
    const queryStr = `
      SELECT 
        c.id,
        c.name,
        c.identification,
        c.segment,
        c.city,
        COUNT(DISTINCT o.id) as total_orders,
        SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
        SUM(oi.quantity * ((oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100)) - CASE WHEN oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%' THEN (oi.price / 1.19) ELSE LEAST(COALESCE(NULLIF(oi.purchase_cost, 0), NULLIF(p.purchasing_price, 0), (oi.price / 1.19) * 0.65), (oi.price / 1.19) * 0.90) END)) as total_profit
      FROM customers c
      LEFT JOIN orders o ON o.customer_identification = c.identification ${dateFilter}
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON p.product_name = oi.name
      WHERE c.segment IN (${segments.map(() => '?').join(',')})
      AND (o.status IS NULL OR o.status NOT IN ('cancelado', 'anulado', 'gestion_especial'))
      GROUP BY c.id, c.name, c.identification, c.segment, c.city
      HAVING total_sales > 0
      ORDER BY total_sales DESC
    `;

    params.push(...segments);

    const customers = await query(queryStr, params);

    // Format the results
    const formattedCustomers = customers.map(customer => ({
      id: customer.id,
      name: customer.name,
      identification: customer.identification,
      segment: customer.segment,
      city: customer.city,
      orders: Number(customer.total_orders || 0),
      sales: Number(customer.total_sales || 0),
      salesWithIVA: Number(customer.total_sales || 0) * 1.19,
      profit: Number(customer.total_profit || 0),
      margin: customer.total_sales > 0 ? (Number(customer.total_profit) / Number(customer.total_sales)) * 100 : 0,
      avgTicket: customer.total_orders > 0 ? Number(customer.total_sales) / Number(customer.total_orders) : 0
    }));

    res.json({
      success: true,
      clusterType,
      count: formattedCustomers.length,
      customers: formattedCustomers
    });

  } catch (error) {
    console.error('Error getting cluster customers:', error);
    res.status(500).json({ error: error.message });
  }
};


// Obtener Estadísticas de Categoría (Mix)
const getCategoryStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Se requieren fechas de inicio y fin' });
    }

    console.log('📊 Stats Categoría - Request:', { startDate, endDate });

    const categoryQuery = `
            SELECT 
                CASE 
                    WHEN p.product_name LIKE '%LIQUIPOPS%' OR p.product_name LIKE '%LIQUIPOS%' OR p.product_name LIKE '%JALAPEÑO%' THEN 'Liquipops'
                    WHEN p.product_name LIKE '%GENIALITY%' THEN 'Geniality'
                    WHEN p.product_name LIKE '%SKARCHAMOY%' OR p.product_name LIKE '%CHAMOY%' THEN 'Skarchamoy'
                    WHEN p.product_name LIKE '%SKARCHALITO%' THEN 'Skarchalito'
                    WHEN p.product_name LIKE '%SKARCHA%' THEN 'Skarcha'
                    WHEN p.product_name LIKE '%YEXIS%' THEN 'Yexis'
                    WHEN p.product_name LIKE '%PERLA%' OR p.product_name LIKE '%EXPLOSIVA%' THEN 'Perlas Explosivas'
                    WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                    WHEN p.product_name LIKE '%BANDERITA%' OR p.product_name LIKE '%FRUTOS%' THEN 'Banderitas + Frutos Secos'
                    WHEN p.product_name LIKE '%POLVO%' OR p.product_name LIKE '%MEZCLA%' THEN 'Mezclas en Polvo'
                    WHEN p.product_name LIKE '%INSUMO%' OR p.product_name LIKE '%SIROPE%' OR p.product_name LIKE '%COMPLEMENTO%' THEN 'Complementos'
                    ELSE 'Otros'
                END as category_group,
                CASE 
                    WHEN p.internal_code = 'CHAM004' THEN 'SIROPE SKARCHAMOY DE 500 ML'
                    WHEN p.internal_code = 'CHAM002' THEN 'SIROPE SKARCHAMOY DE 1000 ML'
                    WHEN p.internal_code = 'CHAM001' THEN 'SIROPE SKARCHAMOY DE 250 ML'
                    ELSE p.product_name
                END as product_name_normalized,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as sales_value,
                SUM(oi.profit_amount) as total_profit

            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN products p ON p.internal_code = oi.product_code
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            GROUP BY category_group, product_name_normalized
            ORDER BY sales_value DESC
        `;

    const categoryResults = await query(categoryQuery, [startDate, endDate]);
    console.log('📊 Stats Categoría - Resultados:', categoryResults.length);

    // Procesar resultados
    const processedCategories = categoryResults.reduce((acc, curr) => {
      const existingCat = acc.find(c => c.category_group === curr.category_group);
      if (existingCat) {
        existingCat.sales_value += Number(curr.sales_value);
        existingCat.total_profit += Number(curr.total_profit);
        existingCat.products.push({
          name: curr.product_name_normalized || curr.product_name || 'Desconocido',
          sales: Number(curr.sales_value),
          profit: Number(curr.total_profit)
        });
      } else {
        acc.push({
          category_group: curr.category_group,
          sales_value: Number(curr.sales_value),
          total_profit: Number(curr.total_profit),
          products: [{
            name: curr.product_name_normalized || curr.product_name || 'Desconocido',
            sales: Number(curr.sales_value),
            profit: Number(curr.total_profit)
          }]
        });
      }
      return acc;
    }, []);

    // Ordenar productos dentro de cada categoría
    processedCategories.forEach(cat => {
      cat.products.sort((a, b) => b.sales - a.sales);
    });

    // Ordenar categorías por ventas totales
    processedCategories.sort((a, b) => b.sales_value - a.sales_value);

    res.json({
      success: true,
      data: processedCategories
    });

  } catch (error) {
    console.error('Error getting category stats:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas de categoría' });
  }
};

// Obtener estadísticas de Fletes (Auditoría)
const getShippingStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // 1. Resumen General
    const summaryQuery = `
            SELECT 
                COUNT(*) as count,
                SUM(oi.quantity * (oi.price / 1.19)) as total_net,
                SUM(oi.quantity * oi.price) as total_gross
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND (oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%')
        `;

    const [summary] = await query(summaryQuery, [startDate, endDate]);

    // 2. Detalle de Pedidos
    const detailsQuery = `
            SELECT 
                o.id,
                o.order_number,
                o.siigo_invoice_number,
                o.created_at,
                o.customer_name,
                o.customer_city,
                oi.name as item_name,
                oi.quantity,
                oi.price as unit_price,
                (oi.quantity * oi.price) as total_charge
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND (oi.name LIKE '%Flete%' OR oi.name LIKE '%Domicilio%' OR oi.name LIKE '%Envío%')
            ORDER BY total_charge DESC, o.created_at DESC
        `;

    const details = await query(detailsQuery, [startDate, endDate]);

    res.json({
      success: true,
      data: {
        summary: {
          count: summary?.count || 0,
          total_net: summary?.total_net || 0,
          total_gross: summary?.total_gross || 0
        },
        details: details
      }
    });

  } catch (error) {
    console.error('Error getting shipping stats:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo estadísticas de fletes' });
  }
};

// Obtener Tendencia de Rentabilidad (Gráfica)
const getProfitabilityTrend = async (req, res) => {
  try {
    const { startDate, endDate, interval } = req.query; // interval: 'day' | 'month'

    let dateFormat;
    let groupBy;

    if (interval === 'month') {
      dateFormat = '%Y-%m';
      groupBy = "DATE_FORMAT(o.created_at, '%Y-%m')";
    } else {
      dateFormat = '%Y-%m-%d';
      groupBy = "DATE(o.created_at)";
    }

    const queryStr = `
            SELECT 
                DATE_FORMAT(o.created_at, '${dateFormat}') as date_label,
                SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales,
                SUM(oi.profit_amount) as total_profit
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.created_at BETWEEN ? AND ?
            AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
            AND o.deleted_at IS NULL
            AND oi.price >= 30
            AND o.payment_method != 'reposicion'
            GROUP BY date_label
            ORDER BY date_label ASC
        `;

    const results = await query(queryStr, [startDate, endDate]);

    // Calculate margin percent in JavaScript to avoid SQL division issues
    const formattedData = results.map(row => {
      const sales = Number(row.total_sales) || 0;
      const profit = Number(row.total_profit) || 0;
      const margin = sales > 0 ? (profit / sales) * 100 : 0;

      return {
        date: row.date_label,
        sales,
        profit,
        margin: parseFloat(margin.toFixed(1))
      };
    });

    res.json({
      success: true,
      data: formattedData
    });

  } catch (error) {
    console.error('Error getting profitability trend:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tendencia de rentabilidad' });
  }
};

// Obtener Historial de Valor de Inventario (Gráfica)
const getInventoryValueHistory = async (req, res) => {
  try {
    // Obtenemos los últimos 30 días con los snapshots más recientes de cada día
    const queryStr = `
            WITH DailyRanked AS (
                SELECT 
                    h.product_id,
                    h.current_stock,
                    DATE(h.analysis_date) as report_date,
                    ROW_NUMBER() OVER (PARTITION BY DATE(h.analysis_date), h.product_id ORDER BY h.analysis_date DESC) as rn
                FROM inventory_analysis_history h
                WHERE h.analysis_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            )
            SELECT 
                dr.report_date as date_label,
                SUM(dr.current_stock * COALESCE(NULLIF(p.purchasing_price, 0), NULLIF(p.standard_price / 1.19, 0), 0)) as total_inventory_value
            FROM DailyRanked dr
            JOIN products p ON dr.product_id = p.id
            WHERE dr.rn = 1
            GROUP BY dr.report_date
            ORDER BY dr.report_date ASC
        `;

    const results = await query(queryStr);

    const formattedData = results.map(row => ({
      date: row.date_label,
      value: Number(row.total_inventory_value)
    }));

    // Backfill missing dates
    const fullHistory = [];
    const today = new Date();
    const map = new Map(formattedData.map(d => {
      // Handle both Date objects and string dates
      const key = d.date instanceof Date ? d.date.toISOString().slice(0, 10) : String(d.date).slice(0, 10);
      return [key, d.value];
    }));

    let lastKnownValue = 0;
    // Find first valid value to initialize if possible
    if (formattedData.length > 0) {
      // Sort just in case sql didn't (it did, but safe)
      formattedData.sort((a, b) => new Date(a.date) - new Date(b.date));
      lastKnownValue = formattedData[0].value;
    }

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);

      let val = map.get(dateKey);

      if (val !== undefined) {
        lastKnownValue = val;
      } else {
        // Use last known value
        val = lastKnownValue;
      }

      fullHistory.push({
        date: dateKey,
        value: val
      });
    }

    res.json({
      success: true,
      data: fullHistory
    });

  } catch (error) {
    console.error('Error getting inventory value history:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo historial de valor de inventario' });
  }
};

// Obtener Historial de Días de Inventario (Rotación)
const getInventoryTurnoverHistory = async (req, res) => {
  try {
    // 1. Obtener Historial de Valor de Inventario (Diario)
    const inventoryQuery = `
            WITH DailyRanked AS (
                SELECT 
                    h.product_id,
                    h.current_stock,
                    DATE(h.analysis_date) as report_date,
                    ROW_NUMBER() OVER (PARTITION BY DATE(h.analysis_date), h.product_id ORDER BY h.analysis_date DESC) as rn
                FROM inventory_analysis_history h
                WHERE h.analysis_date >= DATE_SUB(NOW(), INTERVAL 60 DAY)
            )
            SELECT 
                dr.report_date as date_label,
                SUM(dr.current_stock * COALESCE(NULLIF(p.purchasing_price, 0), NULLIF(p.standard_price / 1.19, 0), 0)) as total_inventory_value
            FROM DailyRanked dr
            JOIN products p ON dr.product_id = p.id
            WHERE dr.rn = 1
            GROUP BY dr.report_date
            ORDER BY dr.report_date ASC
    `;
    const inventoryHistory = await query(inventoryQuery);

    // 2. Obtener COGS Diario (Costo de lo Vendido)
    // Traemos un rango amplio para poder calcular el promedio de 30 días para las fechas más antiguas del inventario
    const cogsQuery = `
        SELECT 
            DATE(o.created_at) as sale_date, 
            SUM(oi.purchase_cost * oi.quantity) as daily_cogs
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial') 
        GROUP BY sale_date
    `;
    const cogsHistory = await query(cogsQuery);

    // Mapear COGS por fecha para acceso rápido
    const cogsMap = {};
    cogsHistory.forEach(row => {
      let key = '';
      if (row.sale_date instanceof Date) {
        key = row.sale_date.toISOString().slice(0, 10);
      } else {
        // Fallback for strings
        key = String(row.sale_date).slice(0, 10);
      }
      cogsMap[key] = Number(row.daily_cogs || 0);
    });

    // 3. Calcular Días de Inventario para cada día de historia
    const turnoverData = inventoryHistory.map(invRow => {
      // Parse date carefully
      let reportDateObj;
      if (invRow.date_label instanceof Date) {
        reportDateObj = invRow.date_label;
      } else {
        reportDateObj = new Date(invRow.date_label);
      }

      const invValue = Number(invRow.total_inventory_value);

      // Calcular COGS de los últimos 30 días respecto a 'reportDate'
      let sumCogs30 = 0;
      let daysCounted = 0;

      for (let i = 0; i < 30; i++) {
        const d = new Date(reportDateObj);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        sumCogs30 += (cogsMap[dateStr] || 0);
        daysCounted++;
      }

      const avgDailyCogs = daysCounted > 0 ? sumCogs30 / daysCounted : 0;

      // Días de Inventario = Valor Inventario / Costo Diario Promedio
      const days = avgDailyCogs > 0 ? invValue / avgDailyCogs : 0;

      return {
        date: invRow.date_label,
        days: parseFloat(days.toFixed(1)),
        invValue,
        avgDailyCogs
      };
    });

    res.json({
      success: true,
      data: turnoverData
    });

  } catch (error) {
    console.error('Error getting inventory turnover history:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo historial de rotación' });
  }
};


// Obtener Tendencia de Ventas por Categoría (Diaria o Mensual)
const getCategoryTrend = async (req, res) => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Se requieren fechas de inicio y fin' });
    }

    const dateExpression = interval === 'month'
      ? "DATE_FORMAT(o.created_at, '%Y-%m-01')"
      : "DATE(o.created_at)";

    const querySql = `
        SELECT 
            ${dateExpression} as date,
            CASE 
                WHEN p.product_name LIKE '%LIQUIPOPS%' OR p.product_name LIKE '%LIQUIPOS%' OR p.product_name LIKE '%JALAPEÑO%' THEN 'Liquipops'
                WHEN p.product_name LIKE '%GENIALITY%' THEN 'Geniality'
                WHEN p.product_name LIKE '%SKARCHAMOY%' OR p.product_name LIKE '%CHAMOY%' THEN 'Skarchamoy'
                WHEN p.product_name LIKE '%SKARCHALITO%' THEN 'Skarchalito'
                WHEN p.product_name LIKE '%SKARCHA%' THEN 'Skarcha'
                WHEN p.product_name LIKE '%YEXIS%' THEN 'Yexis'
                WHEN p.product_name LIKE '%PERLA%' OR p.product_name LIKE '%EXPLOSIVA%' THEN 'Perlas Explosivas'
                WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                WHEN p.product_name LIKE '%BANDERITA%' OR p.product_name LIKE '%FRUTOS%' THEN 'Banderitas + Frutos Secos'
                WHEN p.product_name LIKE '%POLVO%' OR p.product_name LIKE '%MEZCLA%' THEN 'Mezclas en Polvo'
                WHEN p.product_name LIKE '%INSUMO%' OR p.product_name LIKE '%SIROPE%' OR p.product_name LIKE '%COMPLEMENTO%' THEN 'Complementos'
                ELSE 'Otros'
            END as category_group,
            SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as sales_value
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.internal_code = oi.product_code
        WHERE o.created_at BETWEEN ? AND ?
        AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
        GROUP BY ${dateExpression}, category_group
        ORDER BY date ASC
    `;

    const results = await query(querySql, [startDate, endDate]);

    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Error getting category trend:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tendencia de categoría' });
  }
};

// Obtener Tendencia de Rentabilidad por Categoría (Diaria o Mensual)
const getCategoryProfitabilityTrend = async (req, res) => {
  try {
    const { startDate, endDate, interval = 'day' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'Se requieren fechas de inicio y fin' });
    }

    const dateExpression = interval === 'month'
      ? "DATE_FORMAT(o.created_at, '%Y-%m-01')"
      : "DATE(o.created_at)";

    const querySql = `
        SELECT
            ${dateExpression} as date,
            CASE
                WHEN p.product_name LIKE '%LIQUIPOPS%' OR p.product_name LIKE '%LIQUIPOS%' OR p.product_name LIKE '%JALAPEÑO%' THEN 'Liquipops'
                WHEN p.product_name LIKE '%GENIALITY%' THEN 'Geniality'
                WHEN p.product_name LIKE '%SKARCHAMOY%' OR p.product_name LIKE '%CHAMOY%' THEN 'Skarchamoy'
                WHEN p.product_name LIKE '%SKARCHALITO%' THEN 'Skarchalito'
                WHEN p.product_name LIKE '%SKARCHA%' THEN 'Skarcha'
                WHEN p.product_name LIKE '%YEXIS%' THEN 'Yexis'
                WHEN p.product_name LIKE '%PERLA%' OR p.product_name LIKE '%EXPLOSIVA%' THEN 'Perlas Explosivas'
                WHEN p.product_name LIKE '%LIQUIMON%' OR p.product_name LIKE '%BASE CITRICA%' THEN 'Liquimon'
                WHEN p.product_name LIKE '%BANDERITA%' OR p.product_name LIKE '%FRUTOS%' THEN 'Banderitas + Frutos Secos'
                WHEN p.product_name LIKE '%POLVO%' OR p.product_name LIKE '%MEZCLA%' THEN 'Mezclas en Polvo'
                WHEN p.product_name LIKE '%INSUMO%' OR p.product_name LIKE '%SIROPE%' OR p.product_name LIKE '%COMPLEMENTO%' THEN 'Complementos'
                ELSE 'Otros'
            END as category_group,
            SUM(oi.profit_amount) as total_profit,
            SUM(oi.quantity * (oi.price * (1 - COALESCE(oi.discount_percent, 0) / 100))) as total_sales
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.internal_code = oi.product_code
        WHERE o.created_at BETWEEN ? AND ?
        AND o.status NOT IN ('cancelado', 'anulado', 'gestion_especial')
        AND o.payment_method != 'reposicion'
        GROUP BY ${dateExpression}, category_group
        ORDER BY date ASC
    `;

    const results = await query(querySql, [startDate, endDate]);

    // Calculate margin percent in JS to avoid division by zero issues in SQL or weird formatting
    const processedResults = results.map(row => {
      const sales = Number(row.total_sales) || 0;
      const profit = Number(row.total_profit) || 0;
      const margin = sales > 0 ? (profit / sales) * 100 : 0;
      return {
        date: row.date,
        category_group: row.category_group,
        margin_percent: parseFloat(margin.toFixed(1))
      };
    });

    res.json({
      success: true,
      data: processedResults
    });

  } catch (error) {
    console.error('Error getting category profitability trend:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo tendencia de rentabilidad por categoría' });
  }
};

module.exports = {
  getExecutiveStats,
  getAdvancedStats,
  getClusterCustomers,
  getShippingStats,
  getProfitabilityTrend,
  getCategoryStats,
  getCategoryTrend,
  getCategoryProfitabilityTrend,
  getInventoryValueHistory,
  getInventoryTurnoverHistory
};
