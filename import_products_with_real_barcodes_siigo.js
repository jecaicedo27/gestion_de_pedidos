const axios = require('axios');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'backend', '.env') });

async function importProductsWithRealBarcodes() {
    console.log('🚀 Importando productos desde SIIGO con códigos de barras reales...\n');
    
    let connection;
    
    try {
        // Conectar a la base de datos
        console.log('🔗 Conectando a la base de datos...');
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('✅ Conexión a base de datos exitosa');

        // Autenticar con SIIGO
        console.log('\n🔐 Autenticando con SIIGO...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY,
            partner_id: process.env.SIIGO_PARTNER_ID || 'siigo'
        });

        const token = authResponse.data.access_token;
        console.log('✅ Autenticación SIIGO exitosa');

        // Importar todos los productos
        console.log('\n📋 Iniciando importación de productos...');
        
        let totalProducts = 0;
        let productsWithRealBarcodes = 0;
        let productsWithGeneratedBarcodes = 0;
        let page = 1;
        let hasMoreProducts = true;
        const pageSize = 50;
        const timestamp = Date.now();

        // Limpiar tabla de productos para reimportar
        await connection.execute('DELETE FROM products');
        console.log('🧹 Tabla de productos limpiada para reimportación');

        while (hasMoreProducts) {
            console.log(`   📄 Procesando página ${page}...`);
            
            const productsResponse = await axios.get(`https://api.siigo.com/v1/products?page=${page}&page_size=${pageSize}`, {
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json',
                    'Partner-Id': process.env.SIIGO_PARTNER_ID || 'siigo'
                }
            });

            const products = productsResponse.data.results;
            
            if (products.length === 0) {
                hasMoreProducts = false;
                break;
            }

            // Procesar cada producto
            for (const product of products) {
                try {
                    // Extraer código de barras real desde additional_fields.barcode
                    let barcode = '';
                    let hasRealBarcode = false;
                    
                    if (product.additional_fields && 
                        product.additional_fields.barcode && 
                        product.additional_fields.barcode.trim() !== '') {
                        // Producto tiene código de barras real de SIIGO
                        barcode = product.additional_fields.barcode.trim();
                        hasRealBarcode = true;
                        productsWithRealBarcodes++;
                    } else {
                        // Generar código único para producto sin barcode real
                        barcode = `LIQ-${timestamp}-${String(totalProducts + 1).padStart(3, '0')}`;
                        hasRealBarcode = false;
                        productsWithGeneratedBarcodes++;
                    }

                    // Extraer precio
                    let price = 0;
                    if (product.prices && product.prices.length > 0 && 
                        product.prices[0].price_list && product.prices[0].price_list.length > 0) {
                        price = product.prices[0].price_list[0].value || 0;
                    }

                    // Extraer categoría
                    let category = '';
                    if (product.account_group && product.account_group.name) {
                        category = product.account_group.name;
                    }

                    // Insertar producto en base de datos
                    await connection.execute(`
                        INSERT INTO products (
                            siigo_id, name, code, price, category, 
                            additional_fields_barcode, is_active, stock, 
                            created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    `, [
                        product.id,
                        product.name || '',
                        product.code || '',
                        price,
                        category,
                        barcode,
                        product.active ? 1 : 0,
                        product.available_quantity || 0
                    ]);

                    totalProducts++;
                    
                    // Log de productos con códigos de barras reales
                    if (hasRealBarcode) {
                        console.log(`   ✅ ${product.code} - ${product.name.substring(0, 30)}... - Barcode real: ${barcode}`);
                    }

                } catch (productError) {
                    console.error(`❌ Error procesando producto ${product.code}:`, productError.message);
                }
            }

            // Control de paginación
            if (products.length < pageSize) {
                hasMoreProducts = false;
            } else {
                page++;
            }

            // Pausa para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Resumen de importación
        console.log('\n🎯 RESUMEN DE IMPORTACIÓN:');
        console.log('='.repeat(60));
        console.log(`📊 Total productos importados: ${totalProducts}`);
        console.log(`✅ Productos con códigos de barras REALES de SIIGO: ${productsWithRealBarcodes}`);
        console.log(`🔧 Productos con códigos generados únicos: ${productsWithGeneratedBarcodes}`);
        console.log(`📈 Porcentaje con códigos reales: ${((productsWithRealBarcodes / totalProducts) * 100).toFixed(1)}%`);
        console.log('='.repeat(60));

        // Mostrar algunos ejemplos de productos con códigos reales
        console.log('\n📋 PRODUCTOS CON CÓDIGOS DE BARRAS REALES:');
        const [realBarcodeProducts] = await connection.execute(`
            SELECT code, name, additional_fields_barcode 
            FROM products 
            WHERE additional_fields_barcode NOT LIKE 'LIQ-%' 
            AND additional_fields_barcode != '' 
            ORDER BY code 
            LIMIT 10
        `);
        
        realBarcodeProducts.forEach(product => {
            console.log(`   ${product.code} - ${product.additional_fields_barcode} - ${product.name.substring(0, 40)}...`);
        });

        console.log('\n✅ Importación completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error durante la importación:', error.message);
        if (error.response && error.response.data) {
            console.error('Detalles del error:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔒 Conexión a base de datos cerrada');
        }
    }
}

importProductsWithRealBarcodes().catch(console.error);
