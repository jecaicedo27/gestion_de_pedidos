const adminController = require('./controllers/adminController');

// Mock Req/Res
const req = {
    query: {
        startDate: '2025-12-01',
        endDate: '2025-12-31 23:59:59'
    }
};

const res = {
    json: (data) => console.log('✅ Success:', JSON.stringify(data, null, 2).substring(0, 500)),
    status: (code) => ({
        json: (error) => console.error('❌ Error Status:', code, error)
    })
};

(async () => {
    try {
        console.error('🚀 Starting Executive Stats Debug Script...');
        if (adminController.getExecutiveStats) {
            await adminController.getExecutiveStats(req, res);
        } else {
            console.error('❌ getExecutiveStats not found in exports. Exports:', Object.keys(adminController));
        }
    } catch (error) {
        console.error('❌ Uncaught Error:', error);
    } finally {
        setTimeout(() => process.exit(), 5000);
    }
})();
