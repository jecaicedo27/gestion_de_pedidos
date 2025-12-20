const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken } = require('../middleware/auth');
const posController = require('../controllers/posController');

// Multer Config for Evidence
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = 'uploads/evidence';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'evidence-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'));
        }
    }
});

// Route: POST /api/pos/upload-evidence-and-deliver
router.post('/upload-evidence-and-deliver',
    verifyToken,
    upload.fields([
        { name: 'product_photo', maxCount: 1 },
        { name: 'payment_evidence', maxCount: 1 },
        { name: 'cash_photo', maxCount: 1 }
    ]),
    posController.uploadEvidenceAndDeliver
);

// Approval Routes
router.get('/pending-transfers', verifyToken, posController.getPendingTransfers);
router.post('/approve-transfer/:orderId', verifyToken, posController.approveTransfer);
router.post('/reject-transfer/:orderId', verifyToken, posController.rejectTransfer);

module.exports = router;
