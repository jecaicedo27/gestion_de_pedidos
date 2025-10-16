require('dotenv').config({ path: './backend/.env' });
const axios = require('axios');

async function obtenerEstructuraCompleta() {
    console.log('🔍 OBTENIENDO ESTRUCTURA COMPLETA DE PRODUCTOS SIIGO');
    
    const username = process.env.SIIGO_API_USERNAME;
    const accessKey = process.env.SIIGO_API_ACCESS_KEY;
    
    try {
        // Autenticar
        console.log('🔐 Autenticando con SIIGO...');
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: username,
            access_key: accessKey
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        const token = authResponse.data.access_token;
        console.log('✅ Autenticación exitosa');
        
        // Obtener múltiples páginas de productos para análisis completo
        console.log('\n📦 Obteniendo productos de SIIGO...');
        const allProducts = [];
        let page = 1;
        const maxPages = 5; // Limitar para evitar rate limits
        
        while (page <= maxPages) {
            try {
                console.log(`📄 Obteniendo página ${page}...`);
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 segundos entre requests
                
                const response = await axios.get(`https://api.siigo.com/v1/products?created_start=2020-01-01&page=${page}&page_size=20`, {
                    headers: {
                        'Authorization': token,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'api' // ¡USAR EL PARTNER-ID CORRECTO!
                    },
                    timeout: 30000
                });
                
                console.log(`✅ Página ${page}: ${response.data?.results?.length || 0} productos`);
                
                if (response.data?.results?.length > 0) {
                    allProducts.push(...response.data.results);
                } else {
                    break; // No hay más productos
                }
                
                page++;
                
            } catch (error) {
                if (error.response?.status === 429) {
                    const waitTime = 10000; // 10 segundos si hay rate limit
                    console.log(`⏳ Rate limit - esperando ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue; // Reintentar la misma página
                } else {
                    console.log(`❌ Error en página ${page}:`, error.message);
                    break;
                }
            }
        }
        
        console.log(`\n📊 TOTAL DE PRODUCTOS OBTENIDOS: ${allProducts.length}`);
        
        if (allProducts.length === 0) {
            console.log('❌ No se pudieron obtener productos');
            return;
        }
        
        // Analizar TODOS los campos únicos de TODOS los productos
        console.log('\n🔍 ANALIZANDO TODOS LOS CAMPOS...');
        const allFields = new Map(); // Campo -> Set de tipos de valores
        
        allProducts.forEach((product, index) => {
            function analyzeFields(obj, prefix = '') {
                Object.keys(obj).forEach(key => {
                    const value = obj[key];
                    const fullKey = prefix ? `${prefix}_${key}` : key;
                    
                    if (!allFields.has(fullKey)) {
                        allFields.set(fullKey, new Set());
                    }
                    
                    if (value === null) {
                        allFields.get(fullKey).add('NULL');
                    } else if (typeof value === 'object' && !Array.isArray(value)) {
                        allFields.get(fullKey).add('OBJECT');
                        analyzeFields(value, fullKey);
                    } else if (Array.isArray(value)) {
                        allFields.get(fullKey).add('ARRAY');
                    } else {
                        allFields.get(fullKey).add(typeof value);
                    }
                });
            }
            
            analyzeFields(product);
        });
        
        console.log('\n📋 ESTRUCTURA COMPLETA PARA LA TABLA DE PRODUCTOS:');
        console.log('=' .repeat(80));
        
        const tableFields = [];
        const sortedFields = Array.from(allFields.keys()).sort();
        
        sortedFields.forEach(field => {
            const types = Array.from(allFields.get(field));
            let mysqlType = 'TEXT';
            
            // Determinar el mejor tipo de MySQL basado en los valores encontrados
            if (types.includes('NULL') && types.length === 1) {
                mysqlType = 'TEXT NULL';
            } else if (types.includes('number') && !types.includes('string')) {
                mysqlType = 'DECIMAL(15,2)';
            } else if (types.includes('boolean') && !types.includes('string')) {
                mysqlType = 'BOOLEAN';
            } else if (types.includes('ARRAY') || types.includes('OBJECT')) {
                mysqlType = 'JSON';
            } else if (types.includes('string')) {
                mysqlType = 'TEXT';
            }
            
            tableFields.push(`  ${field} ${mysqlType}`);
            console.log(`${field.padEnd(40)} -> ${mysqlType.padEnd(15)} (tipos: ${types.join(', ')})`);
        });
        
        console.log('\n🗃️  SCRIPT SQL PARA CREAR/ACTUALIZAR LA TABLA PRODUCTS:');
        console.log('=' .repeat(80));
        
        const createTableSQL = `
-- Crear tabla products actualizada con todos los campos de SIIGO
DROP TABLE IF EXISTS products_siigo_complete;
CREATE TABLE products_siigo_complete (
  id INT AUTO_INCREMENT PRIMARY KEY,
${tableFields.join(',\n')},
  -- Campos adicionales del sistema
  internal_barcode VARCHAR(255),
  internal_category VARCHAR(255),
  stock_quantity DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices
  INDEX idx_siigo_id (id),
  INDEX idx_code (code),
  INDEX idx_name (name),
  INDEX idx_active (is_active)
);`;
        
        console.log(createTableSQL);
        
        console.log('\n📦 EJEMPLOS DE PRODUCTOS OBTENIDOS:');
        console.log('─' .repeat(60));
        
        // Mostrar los primeros 3 productos como ejemplo
        allProducts.slice(0, 3).forEach((product, index) => {
            console.log(`\nProducto ${index + 1}:`);
            console.log(`  ID: ${product.id}`);
            console.log(`  Nombre: ${product.name}`);
            console.log(`  Código: ${product.code || 'N/A'}`);
            console.log(`  Tipo: ${product.type?.name || 'N/A'}`);
            console.log(`  Activo: ${product.active}`);
            
            if (product.prices && product.prices.length > 0) {
                console.log(`  Precios: ${product.prices.length} configurados`);
            }
            
            if (product.taxes && product.taxes.length > 0) {
                console.log(`  Impuestos: ${product.taxes.length} configurados`);
            }
        });
        
        console.log('\n✅ ANÁLISIS COMPLETO TERMINADO');
        console.log(`📊 Productos analizados: ${allProducts.length}`);
        console.log(`🔧 Campos únicos encontrados: ${allFields.size}`);
        
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

obtenerEstructuraCompleta().catch(console.error);
