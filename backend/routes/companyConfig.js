const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  getCompanyConfig,
  updateCompanyConfig,
  getPublicCompanyConfig,
  getShippingCompanyInfo,
  resetCompanyConfig,
  uploadCompanyLogo
} = require('../controllers/companyConfigController');

// Middleware de multer para subida de archivos (logo)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de multer para logos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/logos');
    // Crear directorio si no existe
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generar nombre único para el archivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro para solo permitir imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, GIF)'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite de 5MB
  }
});

// Rutas públicas (sin autenticación)
router.get('/public', getPublicCompanyConfig);
router.get('/shipping-info', getShippingCompanyInfo);

// Rutas que requieren autenticación
router.get('/', authenticateToken, getCompanyConfig);

// Rutas que requieren rol de admin
router.put('/', authenticateToken, requireRole(['admin']), updateCompanyConfig);
router.post('/reset', authenticateToken, requireRole(['admin']), resetCompanyConfig);

// Ruta para subir logo (solo admin)
router.post('/upload-logo', 
  authenticateToken, 
  requireRole(['admin']), 
  upload.single('logo'), 
  uploadCompanyLogo
);

// Middleware de manejo de errores para multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Tamaño máximo: 5MB'
      });
    }
  }
  
  if (error.message === 'Solo se permiten archivos de imagen (JPEG, PNG, GIF)') {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;
