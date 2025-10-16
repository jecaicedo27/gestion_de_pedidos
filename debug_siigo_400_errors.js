const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

// Función para obtener token de SIIGO
async function getSiigoToken() {
    console.log('\n🔐 Obteniendo token de SIIGO...');
    
    try {
        const response = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Token obtenido exitosamente');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error obteniendo token de SIIGO:', error.response?.data || error.message);
        throw error;
    }
}

// Función para debug de producto específico
async function debugSiigoProduct(token, code, siigoId) {
    console.log(`\n🔍 DEBUGGING producto: ${code} (SIIGO ID: ${siigoId})`);
    
    // Método 1: Buscar por code (como se hacía originalmente)
    console.log('📋 Método 1: Buscar por code');
    try {
        const response1 = await axios.get(`https://api.siigo.com/v1/products?code=${code}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Por code: Encontrado - ${response1.data?.[0]?.name} (Activo: ${response1.data?.[0]?.active})`);
    } catch (error) {
        console.log(`❌ Por code: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            console.log('   Detalle:', JSON.stringify(error.response.data, null, 2));
        }
    }
    
    // Método 2: Buscar por ID directamente
    console.log('📋 Método 2: Buscar por ID');
    try {
        const response2 = await axios.get(`https://api.siigo.com/v1/products/${siigoId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`✅ Por ID: Encontrado - ${response2.data?.name} (Activo: ${response2.data?.active})`);
    } catch (error) {
        console.log(`❌ Por ID: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
        if (error.response?.data) {
            console.log('   Detalle:', JSON.stringify(error.response.data, null, 2));
        }
    }
    
    // Método 3: Listar productos y buscar manualmente
    console.log('📋 Método 3: Búsqueda en listado general');
    try {
        const response3 = await axios.get('https://api.siigo.com/v1/products?page=1&page_size=20', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const found = response3.data?.results?.find(p => p.code === code || p.id === siigoId);
        if (found) {
            console.log(`✅ En listado: Encontrado - ${found.name} (Activo: ${found.active})`);
        } else {
            console.log(`⚠️  En listado: No encontrado en los primeros 20 productos`);
        }
    } catch (error) {
        console.log(`❌ En listado: Error ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
    
    console.log('─'.repeat(50));
}

async function main() {
    let connection;
    
    try {
        console.log('🚀 DEBUGGING ERRORES 400 DE SIIGO API');
        console.log('=' .repeat(60));
        
        // Conectar a la base de datos
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'gestion_pedidos_dev'
        });
        
        console.log('✅ Conectado a la base de datos');
        
        // Obtener token de SIIGO
        const token = await getSiigoToken();
        
        // Obtener productos problemáticos
        const [rows] = await connection.execute(`
            SELECT siigo_id, internal_code, product_name, is_active 
            FROM products 
            WHERE internal_code IN ('SHOT000', 'MP171', 'SKAR021', 'SKAR10', 'MP166') 
            AND siigo_id IS NOT NULL
            ORDER BY internal_code
        `);
        
        console.log(`\n📊 Productos problemáticos encontrados: ${rows.length}`);
        
        for (const product of rows) {
            await debugSiigoProduct(token, product.internal_code, product.siigo_id);
            
            // Pequeño delay entre productos
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // También probar con un producto que sabemos que funciona
        console.log('\n🧪 PRODUCTO DE CONTROL (MP172 - que funcionaba antes)');
        const [controlRows] = await connection.execute(`
            SELECT siigo_id, internal_code, product_name, is_active 
            FROM products 
            WHERE internal_code = 'MP172' 
            AND siigo_id IS NOT NULL
        `);
        
        if (controlRows.length > 0) {
            await debugSiigoProduct(token, controlRows[0].internal_code, controlRows[0].siigo_id);
        }
        
        console.log('\n✅ Debug completado');
        
    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Conexión a base de datos cerrada');
        }
    }
}

// Ejecutar
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { main };
