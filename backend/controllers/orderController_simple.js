const { query } = require('../config/database');

// Versión simplificada del controlador para debugging
const getOrders = async (req, res) => {
  try {
    console.log('\n🔍 DEBUG - getOrders simplificado iniciado');
    console.log('User:', req.user?.username, 'Role:', req.user?.role);
    
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;
    
    const offset = (page - 1) * limit;

    console.log('Parámetros:', { page, limit, offset, sortBy, sortOrder });

    // Consulta simplificada sin filtros de rol complejos
    const orders = await query(
      `SELECT 
        o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_address, 
        o.status, o.total_amount, o.created_at, o.updated_at,
        u.full_name as created_by_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       WHERE o.deleted_at IS NULL
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [parseInt(limit), offset]
    );

    console.log('Pedidos encontrados:', orders.length);

    // Obtener total para paginación
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM orders WHERE deleted_at IS NULL`
    );
    const total = totalResult[0].total;

    console.log('Total pedidos:', total);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

    console.log('✅ Respuesta enviada exitosamente');

  } catch (error) {
    console.error('❌ Error en getOrders simplificado:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Función placeholder para getOrderStats
const getOrderStats = async (req, res) => {
  try {
    console.log('🔍 DEBUG - getOrderStats simplificado');
    
    res.json({
      success: true,
      data: {
        statusStats: [],
        totalStats: { total_orders: 0, total_revenue: 0 },
        dailyStats: []
      }
    });
  } catch (error) {
    console.error('❌ Error en getOrderStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para getDashboardStats
const getDashboardStats = async (req, res) => {
  try {
    console.log('🔍 DEBUG - getDashboardStats simplificado');
    
    res.json({
      success: true,
      data: {
        totalOrders: 23,
        pendingBilling: 23,
        pendingPayment: 0,
        pendingLogistics: 0,
        pendingPackaging: 0,
        pendingDelivery: 0,
        delivered: 0,
        statusStats: [],
        financialMetrics: {
          todayRevenue: 0,
          moneyInTransit: 0,
          averageOrderValue: 0
        },
        charts: {
          dailyEvolution: [],
          deliveryMethodStats: [],
          weeklyRevenue: []
        },
        performance: {
          messengerPerformance: []
        },
        alerts: []
      }
    });
  } catch (error) {
    console.error('❌ Error en getDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para getOrderById
const getOrderById = async (req, res) => {
  try {
    console.log('🔍 DEBUG - getOrderById simplificado');
    
    res.status(404).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en getOrderById:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para createOrder
const createOrder = async (req, res) => {
  try {
    console.log('🔍 DEBUG - createOrder simplificado');
    
    res.status(501).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en createOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para updateOrder
const updateOrder = async (req, res) => {
  try {
    console.log('🔍 DEBUG - updateOrder simplificado');
    
    res.status(501).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en updateOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para deleteOrder
const deleteOrder = async (req, res) => {
  try {
    console.log('🔍 DEBUG - deleteOrder simplificado');
    
    res.status(501).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en deleteOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para deleteSiigoOrder
const deleteSiigoOrder = async (req, res) => {
  try {
    console.log('🔍 DEBUG - deleteSiigoOrder simplificado');
    
    res.status(501).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en deleteSiigoOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Función placeholder para assignOrder
const assignOrder = async (req, res) => {
  try {
    console.log('🔍 DEBUG - assignOrder simplificado');
    
    res.status(501).json({
      success: false,
      message: 'Función no implementada en versión simplificada'
    });
  } catch (error) {
    console.error('❌ Error en assignOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getOrders,
  getOrderStats,
  getDashboardStats,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  deleteSiigoOrder,
  assignOrder
};
