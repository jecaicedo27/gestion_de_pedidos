const axios = require('axios');

async function checkPages() {
    console.log('🔍 Verificando estado de páginas y endpoints\n');
    console.log('=====================================\n');

    // Login primero
    try {
        console.log('1. 🔐 Autenticando...');
        const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });

        const token = loginResponse.data.data?.token;
        if (!token) {
            console.error('❌ No se pudo obtener token');
            return;
        }
        console.log('✅ Autenticación exitosa\n');

        // Configurar axios con token
        const authAxios = axios.create({
            baseURL: 'http://localhost:3001/api',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // 2. Verificar endpoint de productos
        console.log('2. 📦 Verificando endpoint de productos...');
        try {
            const productsResponse = await authAxios.get('/products');
            console.log(`✅ Productos: ${productsResponse.data.data?.length || 0} productos encontrados`);
            console.log(`   Estado: ${productsResponse.status}`);
        } catch (error) {
            console.error(`❌ Error en productos: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 3. Verificar endpoint de usuarios
        console.log('3. 👥 Verificando endpoint de usuarios...');
        try {
            const usersResponse = await authAxios.get('/users');
            console.log(`✅ Usuarios: ${usersResponse.data.data?.length || 0} usuarios encontrados`);
            console.log(`   Estado: ${usersResponse.status}`);
        } catch (error) {
            console.error(`❌ Error en usuarios: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 4. Verificar endpoint de categorías
        console.log('4. 📂 Verificando endpoint de categorías...');
        try {
            const categoriesResponse = await authAxios.get('/products/categories');
            console.log(`✅ Categorías: ${categoriesResponse.data.data?.length || 0} categorías encontradas`);
            console.log(`   Estado: ${categoriesResponse.status}`);
        } catch (error) {
            console.error(`❌ Error en categorías: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        // 5. Verificar endpoint de clientes
        console.log('5. 🏢 Verificando endpoint de clientes...');
        try {
            const customersResponse = await authAxios.get('/customers');
            console.log(`✅ Clientes: ${customersResponse.data.data?.length || 0} clientes encontrados`);
            console.log(`   Estado: ${customersResponse.status}`);
        } catch (error) {
            console.error(`❌ Error en clientes: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        }
        console.log('');

        console.log('✅ Verificación completada');
        console.log('=====================================\n');
        console.log('RESUMEN:');
        console.log('- Si los endpoints responden con datos, el problema puede ser del frontend');
        console.log('- Si hay errores 500, puede ser un problema del backend');
        console.log('- Revisa la consola del navegador para errores de JavaScript');

    } catch (error) {
        console.error('❌ Error general:', error.message);
    }
}

checkPages();
