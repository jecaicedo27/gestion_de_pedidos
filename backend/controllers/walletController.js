const { query, transaction } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const siigoRefreshService = require('../services/siigoRefreshService');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/payment-proofs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `payment-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

// Obtener información de crédito de un cliente CON SIIGO SDK
const getCustomerCredit = async (req, res) => {
  try {
    const { customerName } = req.params;
    console.log(`🔍 [WALLET] Consultando crédito para cliente: ${customerName}`);

    // 1. Buscar información local del cliente
    const creditInfo = await query(
      `SELECT * FROM customer_credit 
       WHERE customer_name = ? AND status != 'inactive'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [customerName]
    );

    // 2. Intentar obtener saldos reales desde SIIGO usando SDK
    let siigoBalance = null;
    let siigoData = null;
    
    try {
      console.log(`💰 [WALLET] Consultando saldos SIIGO con SDK para: ${customerName}`);
      
      // Usar el customer_nit de la base de datos directamente
      let customerNit = null;
      
      if (creditInfo.length > 0 && creditInfo[0].customer_nit) {
        customerNit = creditInfo[0].customer_nit;
        console.log(`🔍 [WALLET] NIT obtenido de BD: ${customerNit}`);
      } else {
        // Fallback: Extraer NIT del nombre del cliente si es necesario
        // Formato común: "EMPRESA S.A.S - 900123456-7"
        const nitMatch = customerName.match(/(\d{6,12}-?\d?)/);
        if (nitMatch) {
          customerNit = nitMatch[1].replace('-', ''); // Remover guión si existe
          console.log(`🔍 [WALLET] NIT extraído del nombre: ${customerNit}`);
        } else {
          console.log(`❌ [WALLET] No se pudo obtener NIT para: ${customerName}`);
          throw new Error('No se pudo obtener NIT del cliente');
        }
      }

      // Obtener saldos reales desde SIIGO con refresco inteligente
      siigoData = await siigoRefreshService.getCustomerBalanceWithRefresh(customerNit);
      siigoBalance = siigoData?.total_balance || 0;
      
      console.log(`💰 [WALLET] Saldo SIIGO obtenido: $${siigoBalance?.toLocaleString()} (Fuente: ${siigoData?.source})`);
      
    } catch (siigoError) {
      console.warn(`⚠️  [WALLET] Error consultando SIIGO para ${customerName}:`, siigoError.message);
      siigoBalance = 0;
      siigoData = { 
        total_balance: 0, 
        source: 'error',
        error: siigoError.message 
      };
    }

    // 3. Combinar información local con saldos SIIGO
    if (creditInfo.length > 0) {
      const localCredit = creditInfo[0];
      
      // Respuesta combinada con información local + saldos SIIGO
      const responseData = {
        // Información local de configuración de crédito
        id: localCredit.id,
        customer_name: localCredit.customer_name,
        customer_phone: localCredit.customer_phone,
        customer_email: localCredit.customer_email,
        credit_limit: parseFloat(localCredit.credit_limit || 0),
        notes: localCredit.notes,
        status: localCredit.status,
        created_at: localCredit.created_at,
        updated_at: localCredit.updated_at,
        
        // ✅ CORREGIDO: Usar current_balance con el saldo real de SIIGO
        current_balance: siigoBalance,
        
        // Información adicional de SIIGO para debugging
        siigo_data: siigoData,
        
        // Cálculos basados en SIIGO
        available_credit: Math.max(0, parseFloat(localCredit.credit_limit || 0) - siigoBalance),
        credit_utilization: parseFloat(localCredit.credit_limit || 0) > 0 
          ? ((siigoBalance / parseFloat(localCredit.credit_limit || 0)) * 100).toFixed(2)
          : 0,
        
        // Información de origen
        data_source: {
          local_config: 'database',
          balance_source: siigoData?.source || 'unknown',
          balance_updated: new Date().toISOString(),
          siigo_balance: siigoBalance
        },
        
        // Mantener saldo local como referencia histórica
        local_current_balance: parseFloat(localCredit.current_balance || 0)
      };

      console.log(`✅ [WALLET] Información combinada para ${customerName}:`);
      console.log(`   - Límite de crédito: $${responseData.credit_limit.toLocaleString()}`);
      console.log(`   - Saldo SIIGO: $${responseData.current_balance.toLocaleString()}`);
      console.log(`   - Crédito disponible: $${responseData.available_credit.toLocaleString()}`);
      console.log(`   - Utilización: ${responseData.credit_utilization}%`);

      res.json({
        success: true,
        data: responseData
      });

    } else {
      // Cliente no está configurado localmente, pero mostrar saldos SIIGO si existen
      console.log(`⚠️  [WALLET] Cliente ${customerName} no configurado localmente`);
      
      if (siigoBalance && siigoBalance > 0) {
        // Cliente tiene saldos en SIIGO pero no está configurado localmente
        res.json({
          success: true,
          data: {
            customer_name: customerName,
            credit_limit: 0,
            siigo_current_balance: siigoBalance,
            siigo_data: siigoData,
            available_credit: -siigoBalance, // Negativo porque no hay límite configurado
            credit_utilization: 'N/A',
            data_source: {
              local_config: 'not_configured',
              balance_source: siigoData?.source || 'unknown',
              balance_updated: new Date().toISOString()
            },
            message: 'Cliente no configurado localmente pero tiene saldos en SIIGO'
          }
        });
      } else {
        // Cliente no encontrado ni localmente ni en SIIGO
        return res.status(404).json({
          success: false,
          message: 'No se encontró información de crédito para este cliente',
          data: {
            customer_name: customerName,
            siigo_data: siigoData,
            checked_sources: ['local_database', 'siigo_api']
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ [WALLET] Error obteniendo información de crédito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Validar pago y enviar a logística
const validatePayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentMethod,
      validationType = 'approved', // 'approved' o 'rejected'
      validationNotes,
      paymentReference,
      paymentAmount,
      paymentDate,
      bankName,
      creditApproved,
      customerCreditLimit,
      customerCurrentBalance
    } = req.body;

    const userId = req.user.id;
    const paymentProofImage = req.file ? req.file.filename : null;

    // Verificar que el pedido existe y está en revisión por cartera
    const order = await query(
      'SELECT * FROM orders WHERE id = ? AND status = "revision_cartera"',
      [orderId]
    );

    if (!order.length) {
      return res.status(404).json({
        success: false,
        message: 'Pedido no encontrado o no está en revisión por cartera'
      });
    }

    const orderData = order[0];

    await transaction(async (connection) => {
      // Crear registro de validación
      await connection.execute(
        `INSERT INTO wallet_validations (
          order_id, payment_method, validation_type, payment_proof_image,
          payment_reference, payment_amount, payment_date, bank_name,
          customer_credit_limit, customer_current_balance, credit_approved,
          validation_status, validation_notes, validated_by, validated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          orderId,
          paymentMethod,
          validationType,
          paymentProofImage,
          paymentReference || null,
          paymentAmount || null,
          paymentDate || null,
          bankName || null,
          customerCreditLimit || null,
          customerCurrentBalance || null,
          creditApproved || false,
          validationType, // validation_status
          validationNotes || null,
          userId
        ]
      );

      if (validationType === 'approved') {
        // Si es cliente a crédito, actualizar el saldo
        if (paymentMethod === 'cliente_credito' && creditApproved) {
          await connection.execute(
            `UPDATE customer_credit 
             SET current_balance = current_balance + ?, updated_at = NOW()
             WHERE customer_name = ? AND status = 'active'`,
            [orderData.total_amount, orderData.customer_name]
          );
        }

        // Actualizar estado del pedido a logística
        await connection.execute(
          `UPDATE orders 
           SET status = "en_logistica", 
               validation_status = "approved",
               validation_notes = ?,
               updated_at = NOW() 
           WHERE id = ?`,
          [validationNotes, orderId]
        );
      } else {
        // Rechazado - mantener en cartera pero marcar como rechazado
        await connection.execute(
          `UPDATE orders 
           SET validation_status = "rejected",
               validation_notes = ?,
               updated_at = NOW() 
           WHERE id = ?`,
          [validationNotes, orderId]
        );
      }
    });

    // Obtener el pedido actualizado
    const updatedOrder = await query(
      `SELECT 
        o.*, 
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       WHERE o.id = ?`,
      [orderId]
    );

    const message = validationType === 'approved' 
      ? 'Pago validado exitosamente y enviado a logística'
      : 'Pedido marcado como no apto para logística';

    res.json({
      success: true,
      message,
      data: updatedOrder[0]
    });

  } catch (error) {
    console.error('Error validando pago:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener historial de validaciones
const getValidationHistory = async (req, res) => {
  try {
    const { orderId } = req.params;

    const validations = await query(
      `SELECT 
        wv.*,
        u.full_name as validated_by_name
       FROM wallet_validations wv
       LEFT JOIN users u ON wv.validated_by = u.id
       WHERE wv.order_id = ?
       ORDER BY wv.created_at DESC`,
      [orderId]
    );

    res.json({
      success: true,
      data: validations
    });

  } catch (error) {
    console.error('Error obteniendo historial de validaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener lista de clientes con crédito
const getCreditCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR customer_email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const customers = await query(
      `SELECT * FROM customer_credit 
       ${whereClause}
       ORDER BY customer_name ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const totalResult = await query(
      `SELECT COUNT(*) as total FROM customer_credit ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo clientes con crédito:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Crear o actualizar cliente con crédito
const upsertCreditCustomer = async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      creditLimit,
      currentBalance = 0,
      status = 'active',
      notes
    } = req.body;

    const userId = req.user.id;

    // Verificar si el cliente ya existe
    const existingCustomer = await query(
      'SELECT id FROM customer_credit WHERE customer_name = ?',
      [customerName]
    );

    if (existingCustomer.length > 0) {
      // Actualizar cliente existente
      await query(
        `UPDATE customer_credit 
         SET customer_phone = ?, customer_email = ?, credit_limit = ?, 
             current_balance = ?, status = ?, notes = ?, updated_at = NOW()
         WHERE customer_name = ?`,
        [customerPhone, customerEmail, creditLimit, currentBalance, status, notes, customerName]
      );

      res.json({
        success: true,
        message: 'Cliente actualizado exitosamente'
      });
    } else {
      // Crear nuevo cliente
      await query(
        `INSERT INTO customer_credit 
         (customer_name, customer_phone, customer_email, credit_limit, 
          current_balance, status, notes, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [customerName, customerPhone, customerEmail, creditLimit, currentBalance, status, notes, userId]
      );

      res.json({
        success: true,
        message: 'Cliente creado exitosamente'
      });
    }

  } catch (error) {
    console.error('Error creando/actualizando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener pedidos pendientes de validación en cartera
const getWalletOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE o.status = "revision_cartera"';
    const params = [];

    if (search) {
      whereClause += ' AND (o.customer_name LIKE ? OR o.customer_phone LIKE ? OR o.order_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // CONSULTA ESPECÍFICA PARA CARTERA CON TODOS LOS CAMPOS NECESARIOS
    const orders = await query(
      `SELECT 
        o.id,
        o.order_number,
        o.customer_name,
        o.customer_phone,
        o.customer_email,
        o.customer_address,
        o.customer_department,
        o.customer_city,
        o.payment_method,
        o.delivery_method,
        o.shipping_date,
        o.total_amount,
        o.status,
        o.notes,
        o.validation_status,
        o.validation_notes,
        o.created_at,
        o.updated_at,
        u.full_name as created_by_name,
        assigned_user.full_name as assigned_to_name
       FROM orders o
       LEFT JOIN users u ON o.created_by = u.id
       LEFT JOIN users assigned_user ON o.assigned_to = assigned_user.id
       ${whereClause}
       ORDER BY o.updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Contar total de pedidos
    const totalResult = await query(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );

    // PROCESAR PEDIDOS SIN SOBRESCRIBIR DATOS VÁLIDOS
    const processedOrders = orders.map(order => ({
      ...order,
      // Solo asegurar que delivery_method tenga un valor por defecto si está vacío
      delivery_method: order.delivery_method || 'domicilio',
      // Solo asegurar que customer_name tenga un valor por defecto si está vacío
      customer_name: order.customer_name || 'Cliente sin nombre',
      // Formatear el total
      total_amount: parseFloat(order.total_amount || 0)
      // NO sobrescribir payment_method - mantener el valor original de la base de datos
    }));

    res.json({
      success: true,
      data: {
        orders: processedOrders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult[0].total,
          pages: Math.ceil(totalResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo pedidos de cartera:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener estadísticas de cartera
const getWalletStats = async (req, res) => {
  try {
    // Pedidos pendientes de validación
    const pendingValidations = await query(
      'SELECT COUNT(*) as count FROM orders WHERE status = "revision_cartera"'
    );

    // Total de crédito otorgado
    const totalCredit = await query(
      'SELECT SUM(credit_limit) as total FROM customer_credit WHERE status = "active"'
    );

    // Total de saldo pendiente
    const totalBalance = await query(
      'SELECT SUM(current_balance) as total FROM customer_credit WHERE status = "active"'
    );

    // Validaciones del día
    const todayValidations = await query(
      'SELECT COUNT(*) as count FROM wallet_validations WHERE DATE(validated_at) = CURDATE()'
    );

    // Clientes con cupo agotado (calculado dinámicamente)
    const exhaustedCredit = await query(
      `SELECT COUNT(*) as count FROM customer_credit 
       WHERE status = "active" AND (credit_limit - current_balance) <= 0`
    );

    res.json({
      success: true,
      data: {
        pendingValidations: pendingValidations[0].count,
        totalCredit: totalCredit[0].total || 0,
        totalBalance: totalBalance[0].total || 0,
        todayValidations: todayValidations[0].count,
        exhaustedCredit: exhaustedCredit[0].count
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de cartera:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getCustomerCredit,
  validatePayment: [upload.single('paymentProofImage'), validatePayment],
  getValidationHistory,
  getCreditCustomers,
  upsertCreditCustomer,
  getWalletOrders,
  getWalletStats
};
