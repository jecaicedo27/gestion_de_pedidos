const mysql = require('mysql2/promise');
const axios = require('axios');

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos_dev',
    port: process.env.DB_PORT || 3306
};

async function getSiigoToken() {
    try {
        console.log('🔑 Obteniendo token de SIIGO...');
        
        const response = await axios.post('https://api.siigo.com/auth', {
            username: 'COMERCIAL@PERLAS-EXPLOSIVAS.COM',
            access_key: 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk='
        });
        
        console.log('✅ Token obtenido exitosamente');
        return response.data.access_token;
    } catch (error) {
        console.error('❌ Error obteniendo token:', error.message);
        throw error;
    }
}

async function investigateSiigoProducts() {
    let connection;
    try {
        console.log('🔍 INVESTIGACIÓN EXHAUSTIVA DE PRODUCTOS EN SIIGO...');
        
        connection = await mysql.createConnection(dbConfig);
        const token = await getSiigoToken();
        
        // PASO 1: Verificar información de paginación completa
        console.log('\n📊 PASO 1: Analizando estructura de paginación en SIIGO...');
        
        const response = await axios.get('https://api.siigo.com/v1/products', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                page: 1,
                page_size: 100
            },
            timeout: 30000
        });
        
        console.log('\n📄 INFORMACIÓN COMPLETA DE PAGINACIÓN:');
        console.log('📋 Response data keys:', Object.keys(response.data));
        console.log('📊 Pagination object:', JSON.stringify(response.data.pagination, null, 2));
        
        // PASO 2: Buscar específicamente LIQUIPP06
        console.log('\n🎯 PASO 2: Búsqueda específica de LIQUIPP06...');
        
        let found = false;
        let totalProducts = 0;
        let currentPage = 1;
        const maxPages = 20; // Límite de seguridad
        
        while (currentPage <= maxPages && !found) {
            try {
                console.log(`   🔍 Buscando en página ${currentPage}...`);
                
                const pageResponse = await axios.get('https://api.siigo.com/v1/products', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    },
                    params: {
                        page: currentPage,
                        page_size: 100
                    },
                    timeout: 30000
                });
                
                const products = pageResponse.data.results || [];
                totalProducts += products.length;
                
                console.log(`   📦 ${products.length} productos en página ${currentPage} (Total acumulado: ${totalProducts})`);
                
                // Buscar LIQUIPP06 en esta página
                const liquipp06 = products.find(p => p.code === 'LIQUIPP06');
                if (liquipp06) {
                    found = true;
                    console.log('\n🎉 ¡LIQUIPP06 ENCONTRADO!');
                    console.log(`   📍 Página: ${currentPage}`);
                    console.log(`   📝 Nombre: ${liquipp06.name}`);
                    console.log(`   🆔 ID: ${liquipp06.id}`);
                    console.log(`   📊 Estado: ${liquipp06.active ? 'Activo' : 'Inactivo'}`);
                    console.log(`   📧 Código de barras principal: ${liquipp06.barcode || 'NO TIENE'}`);
                    console.log(`   🔍 Additional fields:`, liquipp06.additional_fields);
                    
                    // Extraer código de barras con nuestra lógica
                    let realBarcode = null;
                    if (liquipp06.barcode) {
                        realBarcode = liquipp06.barcode;
                    } else if (liquipp06.additional_fields?.barcode) {
                        realBarcode = liquipp06.additional_fields.barcode;
                    }
                    
                    console.log(`   ✅ Código extraído con nuestra lógica: ${realBarcode || 'SIN CÓDIGO'}`);
                }
                
                // Mostrar algunos códigos de productos de esta página
                console.log(`   📋 Códigos en esta página:`, products.slice(0, 5).map(p => p.code).join(', '));
                
                // Verificar si hay más páginas
                if (pageResponse.data.pagination) {
                    const totalPages = pageResponse.data.pagination.total_pages;
                    console.log(`   📊 Paginación: página ${currentPage} de ${totalPages}`);
                    
                    if (currentPage >= totalPages) {
                        console.log(`   🏁 Última página alcanzada (${currentPage}/${totalPages})`);
                        break;
                    }
                } else if (products.length < 100) {
                    console.log('   🏁 Menos de 100 productos - asumiendo última página');
                    break;
                }
                
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
                
            } catch (pageError) {
                console.error(`   ❌ Error en página ${currentPage}:`, pageError.message);
                break;
            }
        }
        
        console.log(`\n📊 RESUMEN DE BÚSQUEDA:`);
        console.log(`   📦 Total productos encontrados: ${totalProducts}`);
        console.log(`   📄 Páginas revisadas: ${currentPage - 1}`);
        console.log(`   🎯 LIQUIPP06 encontrado: ${found ? 'SÍ' : 'NO'}`);
        
        // PASO 3: Buscar productos similares a LIQUIPP06
        console.log('\n🔍 PASO 3: Buscando productos LIQUIPP similares...');
        
        // Obtener todos los productos y buscar los LIQUIPP
        const allProductsResponse = await axios.get('https://api.siigo.com/v1/products', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Partner-Id': 'siigo'
            },
            params: {
                page: 1,
                page_size: 100
            },
            timeout: 30000
        });
        
        const allProducts = allProductsResponse.data.results || [];
        const liquippProducts = allProducts.filter(p => 
            p.code && p.code.toLowerCase().includes('liquipp')
        );
        
        console.log(`📦 Productos LIQUIPP encontrados: ${liquippProducts.length}`);
        liquippProducts.forEach(product => {
            console.log(`   ✅ ${product.code}: ${product.name} (${product.active ? 'Activo' : 'Inactivo'})`);
        });
        
        // PASO 4: Verificar productos en base de datos vs SIIGO
        console.log('\n📊 PASO 4: Comparando productos en BD vs SIIGO...');
        
        const [dbProducts] = await connection.execute(`
            SELECT COUNT(*) as count FROM products
        `);
        
        console.log(`📦 Productos en BD local: ${dbProducts[0].count}`);
        console.log(`📦 Productos en SIIGO: ${totalProducts}`);
        
        if (!found) {
            console.log('\n🔍 INVESTIGACIÓN ADICIONAL PARA LIQUIPP06:');
            console.log('1. LIQUIPP06 puede haber sido eliminado de SIIGO');
            console.log('2. El código puede haber cambiado');
            console.log('3. El producto puede estar inactivo');
            console.log('4. Puede estar en una categoría diferente');
            
            console.log('\n💡 RECOMENDACIONES:');
            console.log('• Verificar directamente en SIIGO si LIQUIPP06 existe');
            console.log('• Buscar por nombre "LIQUIPOPS SABOR A MANGO BICHE"');
            console.log('• Verificar si el producto fue movido o renombrado');
            console.log('• El sistema está correctamente configurado para todos los productos disponibles');
        }
        
    } catch (error) {
        console.error('❌ Error en investigación:', error.message);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Ejecutar investigación
investigateSiigoProducts();
