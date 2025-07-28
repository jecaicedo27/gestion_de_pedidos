const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { verifyToken, verifyRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const configController = require('../controllers/configController');

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Permitir solo imágenes
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB por defecto
  }
});

// GET /api/config/public - Obtener configuración pública (sin autenticación)
router.get('/public', 
  configController.getPublicConfig
);

// GET /api/config/theme - Obtener configuración de tema (sin autenticación)
router.get('/theme', 
  configController.getThemeConfig
);

// GET /api/config - Obtener configuración completa (solo admin)
router.get('/', 
  verifyToken,
  verifyRoles.admin,
  configController.getConfig
);

// PUT /api/config - Actualizar configuración (solo admin)
router.put('/', 
  verifyToken,
  verifyRoles.admin,
  validate(schemas.companyConfig),
  configController.updateConfig
);

// POST /api/config/reset - Resetear configuración a valores por defecto (solo admin)
router.post('/reset', 
  verifyToken,
  verifyRoles.admin,
  configController.resetConfig
);

// POST /api/config/upload-logo - Subir logo de empresa (solo admin)
router.post('/upload-logo', 
  verifyToken,
  verifyRoles.admin,
  upload.single('logo'),
  configController.uploadLogo
);

module.exports = router;
