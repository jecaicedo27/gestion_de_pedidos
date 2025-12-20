const express = require('express');
const router = express.Router();
const supplierCodeController = require('../controllers/supplierCodeController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar Multer para Excel
const uploadDir = path.join(__dirname, '../uploads/supplier_codes');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'mapping-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
    }
});

// Rutas
router.post('/upload', auth.authenticateToken, upload.single('file'), supplierCodeController.uploadMapping);
router.get('/resolve/:code', auth.authenticateToken, supplierCodeController.resolveCode);
router.get('/', auth.authenticateToken, supplierCodeController.getMapping);

module.exports = router;
