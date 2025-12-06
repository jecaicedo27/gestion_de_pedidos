const logisticsController = require('../controllers/logisticsController');
const { pool } = require('../config/database');

// Mock request and response
const req = {
    body: {
        orderId: 15440, // Replace with a valid order ID from your DB
        shippingMethod: 'camion_externo',
        transportCompany: 'Camión Externo',
        notes: 'Notas de prueba',
        sender: {
            name: 'Sender Name',
            nit: '123456789',
            phone: '3001234567',
            address: 'Sender Address',
            city: 'Sender City',
            department: 'Sender Dept',
            email: 'sender@example.com'
        },
        recipient: {
            name: 'Recipient Name',
            phone: '3009876543',
            address: 'Recipient Address',
            city: 'Recipient City',
            department: 'Recipient Dept',
            nit: '987654321',
            email: 'recipient@example.com'
        },
        driver: {
            plate: 'ABC1234',
            name: 'Driver Name',
            whatsapp: '3001112233',
            boxes: '10'
        }
    }
};

const res = {
    status: (code) => ({
        json: (data) => console.log(`Status: ${code}`, data),
        send: (data) => console.log(`Status: ${code}`, 'PDF Buffer received')
    }),
    setHeader: (key, value) => console.log(`Header: ${key}=${value}`),
    send: (data) => console.log('Response sent:', data)
};

// Run the function
(async () => {
    try {
        console.log('Testing generateGuide...');
        await logisticsController.generateGuide(req, res);
    } catch (error) {
        console.error('Error in generateGuide:', error);
    } finally {
        pool.end();
    }
})();
