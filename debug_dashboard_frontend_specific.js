const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function simulateFrontendFlow() {
    try {
        console.log('=== SIMULANDO FLUJO EXACTO DEL FRONTEND ===\n');
        
        // 1. Login como hace el frontend
        console.log('1. Login (como frontend)...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'admin',
            password: 'admin123'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('Login falló');
        }
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login exitoso');
        
        // 2. Simular getDashboardStats (estadísticas básicas)
        console.log('\n2. Probando orderService.getDashboardStats()...');
        try {
            const dashboardResponse = await axios.get(`${BASE_URL}/orders/dashboard-stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Dashboard Stats Response Status:', dashboardResponse.status);
            console.log('Dashboard Stats Keys:', Object.keys(dashboardResponse.data));
            if (dashboardResponse.data.data) {
                console.log('Dashboard Stats Data Keys:', Object.keys(dashboardResponse.data.data));
            }
        } catch (error) {
            console.log('❌ Dashboard Stats Error:', error.response?.status, error.response?.data?.message || error.message);
        }
        
        // 3. Simular analyticsService.getAdvancedDashboard()
        console.log('\n3. Probando analyticsService.getAdvancedDashboard()...');
        try {
            const analyticsResponse = await axios.get(`${BASE_URL}/analytics/advanced-dashboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('✅ Analytics Response Status:', analyticsResponse.status);
            console.log('Analytics Response Structure:', {
                success: analyticsResponse.data.success,
                hasData: !!analyticsResponse.data.data,
                dataKeys: analyticsResponse.data.data ? Object.keys(analyticsResponse.data.data) : 'No data'
            });
            
            // Verificar cada sección de analytics
            if (analyticsResponse.data.data) {
                const data = analyticsResponse.data.data;
                console.log('\n=== VERIFICACIÓN DETALLADA DE DATOS DE ANALYTICS ===');
                
                const sections = [
                    'dailyShipments',
                    'topShippingCities', 
                    'topCustomers',
                    'customerRepeatPurchases',
                    'lostCustomers',
                    'newCustomersDaily',
                    'performanceMetrics',
                    'salesTrends',
                    'productPerformance'
                ];
                
                sections.forEach(section => {
                    console.log(`${section}:`, data[section] ? '✅ Present' : '❌ Missing');
                    if (data[section]) {
                        if (Array.isArray(data[section])) {
                            console.log(`  - Array with ${data[section].length} items`);
                        } else if (typeof data[section] === 'object') {
                            console.log(`  - Object with keys: ${Object.keys(data[section]).join(', ')}`);
                        }
                    }
                });
                
                // Mostrar un ejemplo de datos
                console.log('\n=== EJEMPLO DE DATOS (Daily Shipments) ===');
                if (data.dailyShipments && Array.isArray(data.dailyShipments)) {
                    console.log('Sample:', data.dailyShipments.slice(0, 3));
                } else {
                    console.log('Daily Shipments Structure:', data.dailyShipments);
                }
            }
            
        } catch (error) {
            console.log('❌ Analytics Error:', error.response?.status, error.response?.data?.message || error.message);
            if (error.response?.data) {
                console.log('Full Error Response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        
        // 4. Probar también los endpoints específicos de analytics
        console.log('\n4. Probando endpoints específicos...');
        const specificEndpoints = [
            'daily-shipments',
            'top-shipping-cities',
            'top-customers'
        ];
        
        for (const endpoint of specificEndpoints) {
            try {
                const response = await axios.get(`${BASE_URL}/analytics/${endpoint}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                console.log(`✅ ${endpoint}: Status ${response.status}`);
            } catch (error) {
                console.log(`❌ ${endpoint}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error general:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

async function main() {
    await simulateFrontendFlow();
}

main();
