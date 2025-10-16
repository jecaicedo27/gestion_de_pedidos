const Joi = require('joi');

// Esquemas de validación
const schemas = {
  // Validación para login
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).required()
  }),

  // Validación para crear usuario
  createUser: Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).required(),
    email: Joi.string().email().optional().allow(''),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('admin', 'facturador', 'cartera', 'logistica', 'mensajero').required(),
    fullName: Joi.string().min(2).max(100).optional().allow(''),
    full_name: Joi.string().min(2).max(100).optional().allow(''),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional()
  }),

  // Validación para actualizar usuario
  updateUser: Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(3).max(30).optional(),
    email: Joi.string().email().optional().allow(''),
    role: Joi.string().valid('admin', 'facturador', 'cartera', 'logistica', 'mensajero').optional(),
    fullName: Joi.string().min(2).max(100).optional(),
    full_name: Joi.string().min(2).max(100).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    active: Joi.boolean().optional()
  }),

  // Validación para crear pedido
  createOrder: Joi.object({
    invoiceCode: Joi.string().max(50).optional().allow(null, ''),
    customerName: Joi.string().min(2).max(100).required(),
    customerPhone: Joi.string().pattern(/^[0-9+\-\s()]+$/).required(),
    customerAddress: Joi.string().min(5).max(255).required(),
    customerEmail: Joi.string().email().optional().allow(null, ''),
    customerDepartment: Joi.string().min(2).max(100).required(),
    customerCity: Joi.string().min(2).max(100).required(),
    deliveryMethod: Joi.string().valid('recoge_bodega', 'envio_nacional', 'domicilio_ciudad').optional(),
    paymentMethod: Joi.string().valid('efectivo', 'transferencia', 'tarjeta_credito', 'pago_electronico').optional(),
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(100).required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.alternatives().try(
          Joi.number().positive(),
          Joi.string().pattern(/^\d+(\.\d+)?$/).custom((value) => parseFloat(value))
        ).required(),
        description: Joi.string().max(255).optional().allow(null, '')
      })
    ).min(1).required(),
    notes: Joi.string().max(500).optional().allow(null, ''),
    deliveryDate: Joi.date().optional().allow(null, ''),
    totalAmount: Joi.number().positive().optional()
  }),

  // Validación para actualizar pedido
  updateOrder: Joi.object({
    customerName: Joi.string().min(2).max(100).optional(),
    customerPhone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    customerAddress: Joi.string().min(5).max(255).optional(),
    customerEmail: Joi.string().email().optional(),
    status: Joi.string().valid(
      'pendiente_facturacion', 
      'revision_cartera', 
      'en_logistica', 
      'en_preparacion', 
      'listo', 
      'en_reparto', 
      'entregado_transportadora', 
      'entregado_cliente', 
      'cancelado',
      // Estados legacy para compatibilidad
      'pendiente', 
      'confirmado', 
      'enviado', 
      'entregado'
    ).optional(),
    delivery_method: Joi.string().valid('recoge_bodega', 'recogida_tienda', 'envio_nacional', 'domicilio_ciudad', 'domicilio_nacional', 'envio_internacional', 'drone_delivery', 'fast', 'domicilio', 'nacional', 'mensajeria_urbana').optional().allow(''),
    payment_method: Joi.string().valid('efectivo', 'transferencia', 'cliente_credito', 'pago_electronico', 'contraentrega').optional(),
    // shipping_payment_method es opcional y solo se valida si no es recogida en tienda
    shipping_payment_method: Joi.string().valid('contado', 'contraentrega').optional().when('delivery_method', {
      is: 'recogida_tienda',
      then: Joi.forbidden(),
      otherwise: Joi.optional()
    }),
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(100).required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().required(),
        description: Joi.string().max(255).optional()
      })
    ).optional(),
    notes: Joi.string().max(500).optional().allow(''),
    deliveryDate: Joi.date().optional(),
    shipping_date: Joi.date().optional(),
    delivery_fee_exempt: Joi.boolean().optional(),
    delivery_fee: Joi.number().min(0).optional()
  }),

  // Validación para entregas agregadas de efectivo del mensajero
  createCashDelivery: Joi.object({
    amount: Joi.number().positive().required(),
    deliveredTo: Joi.number().integer().positive().required(),
    referenceNumber: Joi.string().max(80).optional().allow('', null),
    notes: Joi.string().max(500).optional().allow('', null)
  }),

  // Validación para resetear contraseña
  resetPassword: Joi.object({
    newPassword: Joi.string().min(6).required()
  }),

  // Validación para cambiar contraseña personalizada
  changePassword: Joi.object({
    password: Joi.string().min(6).required()
  }),

  // Validación para configuración de empresa
  companyConfig: Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    logoUrl: Joi.string().uri().optional().allow(''),
    primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    address: Joi.string().max(255).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    email: Joi.string().email().optional()
  })
};

// Middleware de validación genérico
const validate = (schema) => {
  return (req, res, next) => {
    console.log('🔍 VALIDACIÓN - Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      console.log('❌ ERROR DE VALIDACIÓN:', error.details);
      
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      console.log('📋 Errores formateados:', errors);

      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors
      });
    }

    console.log('✅ VALIDACIÓN EXITOSA - Datos validados:', JSON.stringify(value, null, 2));
    req.validatedData = value;
    next();
  };
};

// Middleware para validar parámetros de URL
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params);

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Parámetros inválidos',
        error: error.details[0].message
      });
    }

    req.validatedParams = value;
    next();
  };
};

// Esquemas para parámetros comunes
const paramSchemas = {
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

module.exports = {
  validate,
  validateParams,
  schemas,
  paramSchemas
};
