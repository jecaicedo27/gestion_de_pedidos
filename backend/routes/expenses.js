
const express = require('express');
const router = express.Router();
const expensesController = require('../controllers/expensesController');
const { verifyToken } = require('../middleware/auth');
const MessengerController = require('../controllers/messengerController'); // Reuse upload middleware

// Get list of expenses
router.get('/', verifyToken, expensesController.getExpenses);

// Get daily stats
router.get('/stats', verifyToken, expensesController.getStats);

// Create new expense (with file upload)
// ...
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'expense-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

router.post('/', [verifyToken, upload.single('evidence')], expensesController.createExpense);

// Update expense
router.put('/:id', [verifyToken, upload.single('evidence')], expensesController.updateExpense);

// Delete expense
router.delete('/:id', verifyToken, expensesController.deleteExpense);

module.exports = router;
