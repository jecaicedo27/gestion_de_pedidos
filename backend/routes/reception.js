const express = require('express');
const router = express.Router();
const receptionController = require('../controllers/receptionController');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar Multer para PDFs
const uploadDir = path.join(__dirname, '../uploads/receptions');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    }
});

// Rutas
router.post('/analyze', auth.authenticateToken, upload.single('invoice'), receptionController.analyzeInvoice);
router.post('/', auth.authenticateToken, upload.single('invoice'), receptionController.createReception);
router.get('/suppliers', auth.authenticateToken, receptionController.getSuppliers);
router.get('/pending', auth.authenticateToken, receptionController.getPendingReceptions);
router.get('/for-approval', auth.authenticateToken, receptionController.getForApproval);
router.get('/', auth.authenticateToken, receptionController.getReceptions);
router.get('/:id', auth.authenticateToken, receptionController.getReception);
router.post('/:id/items', auth.authenticateToken, receptionController.addItem);
router.post('/:id/complete-reception', auth.authenticateToken, receptionController.completeReception);
router.post('/:id/approve', auth.authenticateToken, receptionController.approveReception);
router.put('/:id/update-items', auth.authenticateToken, upload.single('invoice'), receptionController.updateExpectedItems);
router.post('/:id/finalize', auth.authenticateToken, receptionController.finalizeReception);

module.exports = router;
