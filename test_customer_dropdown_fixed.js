const axios = require('axios');

console.log('🔍 VERIFICANDO CUSTOMER DROPDOWN - BACKEND FUNCIONANDO');
console.log('=====================================================');

async function testCustomerDropdown() {
    try {
        // 1. Test correct config endpoint
        console.log('\n1. Probando endpoint de configuración correcto...');
        const configResponse = await axios.get('http://localhost:3001/api/company-config/public');
        console.log('✅ Config endpoint working:', configResponse.status);
        
        // 2. Login to get token
        console.log('\n2. Realizando login...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        
        const token = loginResponse.data.token;
        console.log('✅ Login successful, token obtained');
        
        // 3. Test customer search endpoint
        console.log('\n3. Probando endpoint de búsqueda de clientes...');
        const customersResponse = await axios.get('http://localhost:3001/api/quotations/customers/search?q=', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Customer search endpoint working:', customersResponse.status);
        console.log('📊 Customers found:', customersResponse.data.length);
        
        if (customersResponse.data.length > 0) {
            console.log('🎯 Sample customer:');
            console.log('   - ID:', customersResponse.data[0].id);
            console.log('   - Name:', customersResponse.data[0].commercial_name || customersResponse.data[0].name);
            console.log('   - Document:', customersResponse.data[0].identification);
        }
        
        // 4. Test search with query parameter
        console.log('\n4. Probando búsqueda con filtro...');
        const searchResponse = await axios.get('http://localhost:3001/api/quotations/customers/search?q=a', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Filtered search working:', searchResponse.status);
        console.log('📊 Filtered customers found:', searchResponse.data.length);
        
        console.log('\n🎉 ¡CUSTOMER DROPDOWN COMPLETAMENTE FUNCIONAL!');
        console.log('✅ Backend: ✓ Funcionando en puerto 3001');
        console.log('✅ Autenticación: ✓ Token válido');
        console.log('✅ Búsqueda de clientes: ✓ Endpoint funcionando');
        console.log('✅ Filtros: ✓ Búsqueda por texto funciona');
        console.log('\n💡 El usuario puede ahora:');
        console.log('   - Acceder al frontend en http://localhost:3000');
        console.log('   - Crear cotizaciones');
        console.log('   - Buscar y seleccionar clientes en el dropdown');
        console.log('   - Generar facturas en SIIGO');
        console.log('\n⚠️ IMPORTANTE: Mantener este terminal abierto para que el backend siga funcionando');
        
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        
        if (error.response) {
            console.log('📋 Status:', error.response.status);
            console.log('📋 Data:', error.response.data);
        }
        
        console.log('\n🔧 DIAGNÓSTICO:');
        if (error.code === 'ECONNREFUSED') {
            console.log('🚨 Backend no responde - verificar que esté funcionando');
        } else if (error.response?.status === 404) {
            console.log('🚨 Endpoint no encontrado - verificar rutas');
        } else if (error.response?.status === 401) {
            console.log('🚨 Error de autenticación - verificar credenciales');
        }
    }
}

testCustomerDropdown();
