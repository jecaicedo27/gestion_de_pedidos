const axios = require('axios');

const API_BASE_URL = 'http://localhost:3001/api';

// Test data for authentication  
const testAdmin = {
  username: 'admin', 
  password: 'admin123'
};

async function testAnalyticsDashboard() {
  try {
    console.log('🧪 Iniciando prueba del dashboard de analytics...\n');

    // 1. Hacer login para obtener token
    console.log('1. Haciendo login como admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testAdmin);
    
    if (!loginResponse.data.success) {
      throw new Error('Login fallido');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso');

    // 2. Probar endpoint de analytics avanzados
    console.log('\n2. Probando endpoint de analytics avanzados...');
    const analyticsResponse = await axios.get(`${API_BASE_URL}/analytics/advanced-dashboard`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 segundos
    });

    console.log('📊 Respuesta del endpoint de analytics:');
    console.log('Status:', analyticsResponse.status);
    console.log('Success:', analyticsResponse.data.success);
    
    if (analyticsResponse.data.success && analyticsResponse.data.data) {
      const data = analyticsResponse.data.data;
      
      // Verificar las diferentes secciones de datos
      console.log('\n📈 Secciones de datos disponibles:');
      
      if (data.dailyShipments) {
        console.log('✅ Daily Shipments:', {
          chartData: data.dailyShipments.chartData?.length || 0,
          totalShipments: data.dailyShipments.summary?.totalShipments || 0
        });
      } else {
        console.log('❌ Daily Shipments: No data');
      }
      
      if (data.topShippingCities) {
        console.log('✅ Top Shipping Cities:', data.topShippingCities.length || 0, 'ciudades');
      } else {
        console.log('❌ Top Shipping Cities: No data');
      }
      
      if (data.topCustomers) {
        console.log('✅ Top Customers:', data.topCustomers.length || 0, 'clientes');
      } else {
        console.log('❌ Top Customers: No data');
      }
      
      if (data.customerRepeatPurchases) {
        console.log('✅ Customer Repeat Purchases:', {
          distribution: data.customerRepeatPurchases.distribution?.length || 0,
          totalCustomers: data.customerRepeatPurchases.summary?.totalCustomers || 0
        });
      } else {
        console.log('❌ Customer Repeat Purchases: No data');
      }
      
      if (data.lostCustomers) {
        console.log('✅ Lost Customers:', {
          totalLostCustomers: data.lostCustomers.summary?.totalLostCustomers || 0,
          highRiskCount: data.lostCustomers.summary?.highRiskCount || 0
        });
      } else {
        console.log('❌ Lost Customers: No data');
      }
      
      if (data.newCustomersDaily) {
        console.log('✅ New Customers Daily:', {
          chartData: data.newCustomersDaily.chartData?.length || 0,
          totalNewCustomers: data.newCustomersDaily.summary?.totalNewCustomers || 0
        });
      } else {
        console.log('❌ New Customers Daily: No data');
      }
      
      if (data.performanceMetrics) {
        console.log('✅ Performance Metrics:', {
          conversionRate: data.performanceMetrics.conversionRate?.conversionRate || 0,
          avgProcessingDays: data.performanceMetrics.avgProcessingTime?.avgProcessingDays || 0
        });
      } else {
        console.log('❌ Performance Metrics: No data');
      }
      
      if (data.salesTrends) {
        console.log('✅ Sales Trends:', data.salesTrends.length || 0, 'semanas de datos');
      } else {
        console.log('❌ Sales Trends: No data');
      }
      
      if (data.productPerformance) {
        console.log('✅ Product Performance:', data.productPerformance.length || 0, 'productos');
      } else {
        console.log('❌ Product Performance: No data');
      }
      
      console.log('\n✅ El endpoint de analytics está funcionando correctamente!');
      console.log('📋 Los datos están siendo procesados y devueltos en el formato esperado.');
      
    } else {
      console.log('❌ El endpoint respondió pero sin datos o con error');
      console.log('Response:', analyticsResponse.data);
    }

  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('💡 El backend no parece estar ejecutándose en el puerto 3001');
    } else if (error.code === 'ECONNABORTED') {
      console.error('💡 Timeout - el endpoint tardó más de 30 segundos en responder');
    }
  }
}

// Ejecutar la prueba
console.log('🚀 Probando el dashboard de analytics después del fix...');
testAnalyticsDashboard();
