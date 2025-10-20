const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * Middleware de autorización para Analytics Avanzados.
 * Permitidos: admin, logistica, cartera. Bloquea mensajero y demás roles.
 */
const requireAdmin = (req, res, next) => {
  const allowed = ['admin', 'logistica', 'cartera'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ message: 'Acceso denegado - Permisos insuficientes' });
  }
  next();
};

// Endpoint principal para obtener analytics avanzados
router.get('/advanced-dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [
      dailyShipments,
      topShippingCities,
      topCustomers,
      customerRepeatPurchases,
      lostCustomers,
      newCustomersDaily,
      performanceMetrics,
      salesTrends,
      productPerformance
    ] = await Promise.all([
      getDailyShipments(),
      getTopShippingCities(),
      getTopCustomers(),
      getCustomerRepeatPurchases(),
      getLostCustomers(),
      getNewCustomersDaily(),
      getPerformanceMetrics(),
      getSalesTrends(),
      getProductPerformance()
    ]);

    res.json({
      success: true,
      data: {
        dailyShipments,
        topShippingCities,
        topCustomers,
        customerRepeatPurchases,
        lostCustomers,
        newCustomersDaily,
        performanceMetrics,
        salesTrends,
        productPerformance
      }
    });
  } catch (error) {
    console.error('Error obteniendo analytics avanzados:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
});

// Función para obtener envíos diarios con gráfica
async function getDailyShipments() {
  try {
    const query = `
      SELECT 
        DATE(shipping_date) as date,
        COUNT(*) as shipments,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value
      FROM orders 
      WHERE shipping_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND status IN ('enviado', 'entregado')
      GROUP BY DATE(shipping_date)
      ORDER BY date DESC
    `;
    
    const [results] = await db.query(query);
    
    // Agregar estadísticas adicionales
    const totalShipments = results.reduce((sum, row) => sum + row.shipments, 0);
    const avgDailyShipments = totalShipments / (results.length || 1);
    
    return {
      chartData: results.map(row => ({
        date: row.date,
        shipments: row.shipments,
        revenue: parseFloat(row.total_revenue || 0),
        avgOrderValue: parseFloat(row.avg_order_value || 0)
      })),
      summary: {
        totalShipments,
        avgDailyShipments: Math.round(avgDailyShipments * 100) / 100,
        lastWeekShipments: results.slice(0, 7).reduce((sum, row) => sum + row.shipments, 0)
      }
    };
  } catch (error) {
    console.error('Error en getDailyShipments:', error);
    return { chartData: [], summary: {} };
  }
}

// Función para obtener ciudades con más envíos
async function getTopShippingCities() {
  try {
    const query = `
      SELECT 
        shipping_city,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders WHERE shipping_city IS NOT NULL)) as percentage
      FROM orders 
      WHERE shipping_city IS NOT NULL 
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
        AND status NOT IN ('cancelado')
      GROUP BY shipping_city
      ORDER BY order_count DESC
      LIMIT 15
    `;
    
    const [results] = await db.query(query);
    
    return results.map(row => ({
      city: row.shipping_city,
      orderCount: row.order_count,
      totalRevenue: parseFloat(row.total_revenue || 0),
      avgOrderValue: parseFloat(row.avg_order_value || 0),
      percentage: parseFloat(row.percentage || 0)
    }));
  } catch (error) {
    console.error('Error en getTopShippingCities:', error);
    return [];
  }
}

// Función para obtener mejores clientes
async function getTopCustomers() {
  try {
    const query = `
      SELECT 
        c.document,
        c.commercial_name,
        c.name,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_spent,
        AVG(o.total_amount) as avg_order_value,
        MAX(o.created_at) as last_order_date,
        MIN(o.created_at) as first_order_date,
        DATEDIFF(CURDATE(), MAX(o.created_at)) as days_since_last_order
      FROM customers c
      INNER JOIN orders o ON c.document = o.customer_document
      WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        AND o.status NOT IN ('cancelado')
      GROUP BY c.document, c.commercial_name, c.name
      ORDER BY total_spent DESC
      LIMIT 20
    `;
    
    const [results] = await db.query(query);
    
    return results.map(row => ({
      document: row.document,
      name: row.commercial_name || row.name,
      orderCount: row.order_count,
      totalSpent: parseFloat(row.total_spent || 0),
      avgOrderValue: parseFloat(row.avg_order_value || 0),
      lastOrderDate: row.last_order_date,
      firstOrderDate: row.first_order_date,
      daysSinceLastOrder: row.days_since_last_order,
      customerType: row.order_count >= 10 ? 'VIP' : row.order_count >= 5 ? 'Frecuente' : 'Regular'
    }));
  } catch (error) {
    console.error('Error en getTopCustomers:', error);
    return [];
  }
}

// Función para analizar recompras de clientes
async function getCustomerRepeatPurchases() {
  try {
    const query = `
      WITH customer_stats AS (
        SELECT 
          customer_document,
          COUNT(*) as total_orders,
          MIN(created_at) as first_order,
          MAX(created_at) as last_order,
          SUM(total_amount) as total_spent,
          DATEDIFF(MAX(created_at), MIN(created_at)) as customer_lifespan_days
        FROM orders 
        WHERE status NOT IN ('cancelado')
          AND created_at >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
        GROUP BY customer_document
      ),
      repeat_analysis AS (
        SELECT 
          CASE 
            WHEN total_orders = 1 THEN 'Una vez'
            WHEN total_orders BETWEEN 2 AND 4 THEN '2-4 pedidos'
            WHEN total_orders BETWEEN 5 AND 9 THEN '5-9 pedidos'
            WHEN total_orders BETWEEN 10 AND 19 THEN '10-19 pedidos'
            ELSE '20+ pedidos'
          END as order_frequency,
          COUNT(*) as customer_count,
          AVG(total_spent) as avg_total_spent,
          AVG(customer_lifespan_days) as avg_lifespan_days
        FROM customer_stats
        GROUP BY 
          CASE 
            WHEN total_orders = 1 THEN 'Una vez'
            WHEN total_orders BETWEEN 2 AND 4 THEN '2-4 pedidos'
            WHEN total_orders BETWEEN 5 AND 9 THEN '5-9 pedidos'
            WHEN total_orders BETWEEN 10 AND 19 THEN '10-19 pedidos'
            ELSE '20+ pedidos'
          END
      )
      SELECT * FROM repeat_analysis ORDER BY 
        CASE order_frequency
          WHEN 'Una vez' THEN 1
          WHEN '2-4 pedidos' THEN 2
          WHEN '5-9 pedidos' THEN 3
          WHEN '10-19 pedidos' THEN 4
          ELSE 5
        END
    `;
    
    const [results] = await db.query(query);
    
    // Calcular métricas adicionales
    const totalCustomers = results.reduce((sum, row) => sum + row.customer_count, 0);
    const repeatCustomers = results.filter(row => row.order_frequency !== 'Una vez')
                                   .reduce((sum, row) => sum + row.customer_count, 0);
    
    return {
      distribution: results.map(row => ({
        frequency: row.order_frequency,
        customerCount: row.customer_count,
        avgTotalSpent: parseFloat(row.avg_total_spent || 0),
        avgLifespanDays: parseInt(row.avg_lifespan_days || 0),
        percentage: ((row.customer_count / totalCustomers) * 100).toFixed(1)
      })),
      summary: {
        totalCustomers,
        repeatCustomers,
        repeatRate: ((repeatCustomers / totalCustomers) * 100).toFixed(1)
      }
    };
  } catch (error) {
    console.error('Error en getCustomerRepeatPurchases:', error);
    return { distribution: [], summary: {} };
  }
}

// Función para identificar clientes perdidos
async function getLostCustomers() {
  try {
    const query = `
      WITH customer_last_order AS (
        SELECT 
          c.document,
          c.commercial_name,
          c.name,
          MAX(o.created_at) as last_order_date,
          COUNT(o.id) as total_orders,
          SUM(o.total_amount) as total_spent,
          DATEDIFF(CURDATE(), MAX(o.created_at)) as days_since_last_order
        FROM customers c
        INNER JOIN orders o ON c.document = o.customer_document
        WHERE o.status NOT IN ('cancelado')
        GROUP BY c.document, c.commercial_name, c.name
      )
      SELECT 
        document,
        commercial_name,
        name,
        last_order_date,
        total_orders,
        total_spent,
        days_since_last_order,
        CASE 
          WHEN days_since_last_order > 180 THEN 'Muy perdido'
          WHEN days_since_last_order > 90 THEN 'En riesgo alto'
          WHEN days_since_last_order > 60 THEN 'En riesgo medio'
          ELSE 'En riesgo bajo'
        END as risk_level
      FROM customer_last_order
      WHERE days_since_last_order > 60
        AND total_orders >= 2
      ORDER BY total_spent DESC, days_since_last_order DESC
      LIMIT 50
    `;
    
    const [results] = await db.query(query);
    
    // Agrupar por nivel de riesgo
    const riskGroups = {
      'Muy perdido': [],
      'En riesgo alto': [],
      'En riesgo medio': [],
      'En riesgo bajo': []
    };
    
    results.forEach(customer => {
      riskGroups[customer.risk_level].push({
        document: customer.document,
        name: customer.commercial_name || customer.name,
        lastOrderDate: customer.last_order_date,
        totalOrders: customer.total_orders,
        totalSpent: parseFloat(customer.total_spent || 0),
        daysSinceLastOrder: customer.days_since_last_order
      });
    });
    
    return {
      byRiskLevel: riskGroups,
      summary: {
        totalLostCustomers: results.length,
        highRiskCount: riskGroups['En riesgo alto'].length + riskGroups['Muy perdido'].length,
        potentialLostRevenue: results.reduce((sum, customer) => sum + parseFloat(customer.total_spent || 0), 0)
      }
    };
  } catch (error) {
    console.error('Error en getLostCustomers:', error);
    return { byRiskLevel: {}, summary: {} };
  }
}

// Función para obtener nuevos clientes diarios
async function getNewCustomersDaily() {
  try {
    const query = `
      WITH first_orders AS (
        SELECT 
          customer_document,
          MIN(created_at) as first_order_date
        FROM orders
        WHERE status NOT IN ('cancelado')
        GROUP BY customer_document
      )
      SELECT 
        DATE(first_order_date) as date,
        COUNT(*) as new_customers
      FROM first_orders
      WHERE first_order_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(first_order_date)
      ORDER BY date DESC
    `;
    
    const [results] = await db.query(query);
    
    // Calcular tendencia
    const totalNewCustomers = results.reduce((sum, row) => sum + row.new_customers, 0);
    const avgDailyNew = totalNewCustomers / (results.length || 1);
    
    return {
      chartData: results.map(row => ({
        date: row.date,
        newCustomers: row.new_customers
      })),
      summary: {
        totalNewCustomers,
        avgDailyNew: Math.round(avgDailyNew * 100) / 100,
        lastWeekNew: results.slice(0, 7).reduce((sum, row) => sum + row.new_customers, 0)
      }
    };
  } catch (error) {
    console.error('Error en getNewCustomersDaily:', error);
    return { chartData: [], summary: {} };
  }
}

// Función para obtener métricas de rendimiento
async function getPerformanceMetrics() {
  try {
    const [conversionRate, avgProcessingTime, returnRate] = await Promise.all([
      getConversionRate(),
      getAvgProcessingTime(),
      getReturnRate()
    ]);
    
    return {
      conversionRate,
      avgProcessingTime,
      returnRate
    };
  } catch (error) {
    console.error('Error en getPerformanceMetrics:', error);
    return {};
  }
}

// Función para calcular tasa de conversión
async function getConversionRate() {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'entregado' THEN 1 END) as delivered_orders,
        COUNT(CASE WHEN status = 'cancelado' THEN 1 END) as cancelled_orders
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
    
    const [results] = await db.query(query);
    const row = results[0];
    
    return {
      totalOrders: row.total_orders,
      deliveredOrders: row.delivered_orders,
      cancelledOrders: row.cancelled_orders,
      conversionRate: row.total_orders > 0 ? ((row.delivered_orders / row.total_orders) * 100).toFixed(1) : 0,
      cancellationRate: row.total_orders > 0 ? ((row.cancelled_orders / row.total_orders) * 100).toFixed(1) : 0
    };
  } catch (error) {
    console.error('Error en getConversionRate:', error);
    return {};
  }
}

// Función para calcular tiempo promedio de procesamiento
async function getAvgProcessingTime() {
  try {
    const query = `
      SELECT 
        AVG(DATEDIFF(shipping_date, created_at)) as avg_processing_days,
        MIN(DATEDIFF(shipping_date, created_at)) as min_processing_days,
        MAX(DATEDIFF(shipping_date, created_at)) as max_processing_days
      FROM orders
      WHERE shipping_date IS NOT NULL 
        AND status IN ('enviado', 'entregado')
        AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `;
    
    const [results] = await db.query(query);
    const row = results[0];
    
    return {
      avgProcessingDays: parseFloat(row.avg_processing_days || 0).toFixed(1),
      minProcessingDays: row.min_processing_days || 0,
      maxProcessingDays: row.max_processing_days || 0
    };
  } catch (error) {
    console.error('Error en getAvgProcessingTime:', error);
    return {};
  }
}

// Función para calcular tasa de devoluciones
async function getReturnRate() {
  try {
    // Esto es un placeholder - se puede implementar cuando se tenga tabla de devoluciones
    return {
      returnRate: 0,
      totalReturns: 0,
      returnValue: 0
    };
  } catch (error) {
    console.error('Error en getReturnRate:', error);
    return {};
  }
}

// Función para obtener tendencias de ventas
async function getSalesTrends() {
  try {
    const query = `
      SELECT 
        YEARWEEK(created_at, 1) as year_week,
        DATE(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY)) as week_start,
        COUNT(*) as order_count,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_document) as unique_customers
      FROM orders
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)
        AND status NOT IN ('cancelado')
      GROUP BY YEARWEEK(created_at, 1), DATE(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY))
      ORDER BY year_week ASC
    `;
    
    const [results] = await db.query(query);
    
    return results.map(row => ({
      weekStart: row.week_start,
      orderCount: row.order_count,
      totalRevenue: parseFloat(row.total_revenue || 0),
      avgOrderValue: parseFloat(row.avg_order_value || 0),
      uniqueCustomers: row.unique_customers
    }));
  } catch (error) {
    console.error('Error en getSalesTrends:', error);
    return [];
  }
}

// Función para obtener rendimiento de productos
async function getProductPerformance() {
  try {
    const query = `
      SELECT 
        oi.product_code,
        oi.product_name,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.subtotal) as total_revenue,
        AVG(oi.unit_price) as avg_price
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        AND o.status NOT IN ('cancelado')
      GROUP BY oi.product_code, oi.product_name
      ORDER BY total_revenue DESC
      LIMIT 20
    `;
    
    const [results] = await db.query(query);
    
    return results.map(row => ({
      productCode: row.product_code,
      productName: row.product_name,
      orderCount: row.order_count,
      totalQuantity: row.total_quantity,
      totalRevenue: parseFloat(row.total_revenue || 0),
      avgPrice: parseFloat(row.avg_price || 0)
    }));
  } catch (error) {
    console.error('Error en getProductPerformance:', error);
    return [];
  }
}

module.exports = router;
