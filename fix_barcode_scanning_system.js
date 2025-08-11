const mysql = require('mysql2/promise');

async function fixBarcodeScanning() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });
    
    try {
        console.log('🔧 CONFIGURANDO SISTEMA DE ESCANEO DE CÓDIGOS DE BARRAS...\n');
        
        // 1. Primero, asignar códigos de barras temporales basados en internal_code para productos PENDIENTE
        console.log('📊 Actualizando códigos de barras temporales...');
        
        const [pendingProducts] = await connection.execute(
            `SELECT id, product_name, internal_code, barcode 
             FROM products 
             WHERE barcode LIKE 'PENDIENTE_%'`
        );
        
        console.log(`   Encontrados ${pendingProducts.length} productos con código pendiente`);
        
        for (const product of pendingProducts) {
            // Usar el internal_code como código de barras temporal
            if (product.internal_code) {
                await connection.execute(
                    'UPDATE products SET barcode = ? WHERE id = ?',
                    [`TEMP_${product.internal_code}`, product.id]
                );
                console.log(`   ✅ ${product.product_name}: TEMP_${product.internal_code}`);
            }
        }
        
        // 2. Verificar algunos productos específicos
        console.log('\n🎯 Verificando productos del ejemplo:');
        
        const testProducts = [
            'LIQUIPOPS SABOR A CEREZA X 1200 GR',
            'LIQUIPOPS SABOR A MARACUYA X 1200 GR',
            'LIQUIPOPS SABOR A MANGO BICHE X 1200 GR'
        ];
        
        for (const productName of testProducts) {
            const [product] = await connection.execute(
                'SELECT * FROM products WHERE product_name LIKE ? LIMIT 1',
                [`%${productName}%`]
            );
            
            if (product.length > 0) {
                console.log(`\n   🍬 ${product[0].product_name}`);
                console.log(`      Código interno: ${product[0].internal_code}`);
                console.log(`      Código de barras: ${product[0].barcode}`);
                console.log(`      ✅ Escaneable como: ${product[0].barcode}`);
            }
        }
        
        console.log('\n✅ Sistema de códigos de barras configurado correctamente');
        console.log('\n📝 INSTRUCCIONES PARA ESCANEAR:');
        console.log('   1. Para productos con código real (ej: 7708949649979) - escanear el código');
        console.log('   2. Para productos temporales (ej: TEMP_LIQUIPM02) - escribir manualmente el código');
        console.log('   3. El sistema validará automáticamente contra el pedido');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

fixBarcodeScanning().catch(console.error);
