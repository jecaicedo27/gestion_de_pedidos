const mysql = require('mysql2/promise');
const axios = require('axios');
require('dotenv').config({ path: './backend/.env' });

const config = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'gestion_pedidos_dev'
};

async function verificarStockRealSiigo() {
    console.log('🔍 VERIFICANDO STOCK REAL EN SIIGO VS BASE DE DATOS');
    console.log('=====================================================');
    
    try {
        const connection = await mysql.createConnection(config);
        
        // Obtener algunos productos específicos que muestran cantidades sospechosas
        console.log('1️⃣ Obteniendo productos con stock en la BD...');
        const [products] = await connection.execute(`
            SELECT 
                id,
                name, 
                siigo_code,
                available_quantity,
                stock
            FROM products 
            WHERE available_quantity > 0 OR stock > 0
            ORDER BY available_quantity DESC 
            LIMIT 10
        `);
        
        console.log('📊 Productos en la BD con stock:');
        products.forEach(product => {
            console.log(`   ${product.name}: BD=${product.available_quantity || product.stock} | SIIGO_CODE=${product.siigo_code}`);
        });
        
        console.log('\n2️⃣ Verificando en SIIGO...');
        
        // Configurar SIIGO API
        const siigoConfig = {
            baseURL: 'https://api.siigo.com/v1',
            headers: {
                'Authorization': `Bearer ${process.env.SIIGO_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Partner-Id': process.env.SIIGO_PARTNER_ID
            }
        };
        
        // Verificar algunos productos específicos en SIIGO
        for (let i = 0; i < Math.min(5, products.length); i++) {
            const product = products[i];
            
            try {
                console.log(`\n🔍 Verificando: ${product.name.substring(0, 50)}...`);
                console.log(`   SIIGO Code: ${product.siigo_code}`);
                
                if (!product.siigo_code) {
                    console.log('   ⚠️ Sin código SIIGO - SALTANDO');
                    continue;
                }
                
                // Buscar el producto en SIIGO
                const response = await axios.get(
                    `/products/${product.siigo_code}`, 
                    siigoConfig
                );
                
                if (response.data) {
                    const siigoStock = response.data.stock || response.data.available_quantity || 0;
                    const bdStock = product.available_quantity || product.stock || 0;
                    
                    console.log(`   📦 Stock SIIGO: ${siigoStock}`);
                    console.log(`   💾 Stock BD: ${bdStock}`);
                    
                    if (siigoStock !== bdStock) {
                        console.log(`   ❌ DISCREPANCIA: SIIGO=${siigoStock} vs BD=${bdStock}`);
                    } else {
                        console.log(`   ✅ COINCIDEN`);
                    }
                } else {
                    console.log('   ❌ Producto no encontrado en SIIGO');
                }
                
            } catch (error) {
                console.log(`   ❌ Error consultando SIIGO: ${error.message}`);
                if (error.response) {
                    console.log(`   Status: ${error.response.status}`);
                }
            }
            
            // Pequeña pausa entre consultas
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n3️⃣ Verificando productos específicos sospechosos...');
        
        // Productos específicos mencionados en la imagen
        const suspiciousProducts = [
            { name: 'LIQUIPOPS SABOR A CAFE X 2300 GR', expected_low: true },
            { name: 'LIQUIPOPS SABOR A CAFE X 3400 GR', expected_low: true },
            { name: 'LIQUIPOPS SABOR A BLUEBERRY X 350 GR', expected_low: true }
        ];
        
        for (const suspicious of suspiciousProducts) {
            const [productResult] = await connection.execute(`
                SELECT siigo_code, available_quantity, stock, name 
                FROM products 
                WHERE name LIKE ?
                LIMIT 1
            `, [`%${suspicious.name}%`]);
            
            if (productResult.length > 0) {
                const product = productResult[0];
                console.log(`\n🎯 ${product.name}:`);
                console.log(`   BD Stock: ${product.available_quantity || product.stock}`);
                console.log(`   SIIGO Code: ${product.siigo_code}`);
                
                if (suspicious.expected_low && (product.available_quantity > 50 || product.stock > 50)) {
                    console.log(`   🚨 SOSPECHOSO: Stock demasiado alto para este tipo de producto`);
                }
            }
        }
        
        await connection.end();
        
        console.log('\n📋 RESUMEN:');
        console.log('- Si hay discrepancias, los datos podrían ser ficticios');
        console.log('- Verificar si el botón "Cargar Productos" está realmente sincronizando con SIIGO');
        console.log('- Considerar limpiar toda la tabla y recargar desde SIIGO completamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verificarStockRealSiigo();
