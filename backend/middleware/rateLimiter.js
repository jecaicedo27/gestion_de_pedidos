const rateLimit = require('express-rate-limit');

// Configuración base más flexible
const baseConfig = {
  windowMs: 1 * 60 * 1000, // 1 minuto
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log(`⚠️  Rate limit alcanzado para ${req.ip} en ${req.path}`);
    res.status(429).json({
      success: false,
      message: 'Demasiadas solicitudes. Por favor, espere un momento antes de intentar nuevamente.',
      retryAfter: res.getHeader('Retry-After')
    });
  }
};

// Rate limiter general - más permisivo
const generalLimiter = rateLimit({
  ...baseConfig,
  max: 100, // 100 peticiones por minuto (más flexible)
  message: 'Demasiadas solicitudes desde esta IP'
});

// Rate limiter para autenticación
const authLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 intentos de login cada 15 minutos
  skipSuccessfulRequests: true
});

// Rate limiter para SIIGO - más permisivo para evitar 429
const siigoLimiter = rateLimit({
  ...baseConfig,
  windowMs: 2 * 60 * 1000, // 2 minutos
  max: 30, // 30 peticiones cada 2 minutos
  message: 'Demasiadas solicitudes a SIIGO'
});

// Rate limiter para endpoints de consulta frecuente
const queryLimiter = rateLimit({
  ...baseConfig,
  max: 60, // 60 peticiones por minuto para consultas
  message: 'Demasiadas consultas'
});

// Rate limiter para uploads
const uploadLimiter = rateLimit({
  ...baseConfig,
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // 20 uploads cada 5 minutos
  message: 'Demasiados archivos subidos'
});

module.exports = {
  generalLimiter,
  authLimiter,
  siigoLimiter,
  queryLimiter,
  uploadLimiter
};
