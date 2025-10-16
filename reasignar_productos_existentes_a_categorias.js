const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gestion_pedidos'
};

function assignCategoryToProduct(productName, internalCode) {
    const name = (productName || '').toLowerCase();
    const code = (internalCode || '').toLowerCase();
    
    // Reglas mejoradas de asignación de categorías
    const categoryRules = [
        {
            category: 'YEXIS',
            keywords: ['yexis', 'yex'],
            codePatterns: ['yex']
        },
        {
            category: 'LIQUIPOPS',
            keywords: ['liquipop', 'liqui pop', 'liquipp'],
            codePatterns: ['liquipp', 'lqp']
        },
        {
            category: 'GENIALITY',
            keywords: ['geniality', 'genial', 'geinav'],
            codePatterns: ['gen', 'gein']
        },
        {
            category: 'MEZCLAS EN POLVO',
            keywords: ['mezclas', 'polvo', 'mezcla'],
            codePatterns: ['mezc', 'polvo', 'mp_']
        },
        {
            category: 'Servicios',
            keywords: ['servicio', 'service', 'mano de obra', 'instalacion', 'reparacion'],
            codePatterns: ['serv', 'service', 'mo_']
        },
        {
            category: 'licores materia prima',
            keywords: ['licor', 'alcohol', 'etanol', 'ron', 'vodka', 'whisky'],
            codePatterns: ['lic', 'alc', 'etanol', 'ron', 'vodka']
        },
        {
            category: 'Materia prima gravadas 19%',
            keywords: ['materia prima', 'colorante', 'saborizante', 'conservante', 'aditivo'],
            codePatterns: ['mp19', 'mat19', 'col', 'sab', 'cons', 'adit']
        },
        {
            category: 'Materia prima gravadas 5%',
            keywords: ['azucar', 'glucosa', 'fructosa', 'stevia'],
            codePatterns: ['mp5', 'mat5', 'azuc', 'gluc', 'fruct', 'stev']
        },
        {
            category: 'productos en proceso',
            keywords: ['en proceso', 'semi elaborado', 'pre mezcla'],
            codePatterns: ['proc', 'semi', 'pre']
        },
        {
            category: 'productos Fabricados shotboom NO USAR',
            keywords: ['shotboom', 'shot boom'],
            codePatterns: ['shotb', 'boom']
        },
        {
            category: 'SKARCHA FABRICADOS NO USAR',
            keywords: ['skarcha fabricado'],
            codePatterns: ['skarf']
        },
        {
            category: 'SKARCHA NO FABRICADOS 19%',
            keywords: ['skarcha'],
            codePatterns: ['skar']
        },
        {
            category: 'SHOT NO FABRICADOS',
            keywords: ['shot'],
            codePatterns: ['shot']
        },
        {
            category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NO USAR',
            keywords: ['maquina', 'equipo usado', 'planta'],
            codePatterns: ['maq', 'equipo', 'planta']
        },
        {
            category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NUEVO',
            keywords: ['equipo nuevo'],
            codePatterns: ['equipon', 'nuevo']
        },
        {
            category: 'Productos No fabricados 19%',
            keywords: ['comprado', 'importado', 'tercero'],
            codePatterns: ['comp', 'imp', 'terc', 'nf19']
        }
    ];

    // Buscar coincidencias exactas primero
    for (const rule of categoryRules) {
        // Buscar coincidencias exactas en keywords
        const exactKeywordMatch = rule.keywords.some(keyword => {
            return name.includes(keyword) || name === keyword;
        });
        
        // Buscar coincidencias exactas en códigos
        const exactCodeMatch = rule.codePatterns.some(pattern => {
            return code.includes(pattern) || code.startsWith(pattern);
        });
        
        if (exactKeywordMatch || exactCodeMatch) {
            return rule.category;
        }
    }

    // Reglas adicionales basadas en patrones comunes
    if (code.includes('temp_') || name.includes('temporal')) return 'productos en proceso';
    if (code.includes('sh32') || code.includes('sh36')) return 'GENIALITY';
    if (code.includes('p-blvck')) return 'Materia prima gravadas 19%';
    
    return null; // Sin categoría específica asignada
}

async function getCurrentProducts() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('📋 Consultando productos actuales en la base de datos...');
        
        const [products] = await connection.execute(`
            SELECT id, product_name, internal_code, category
            FROM products 
            WHERE is_active = TRUE
            ORDER BY product_name
        `);
        
        console.log(`✅ Productos encontrados: ${products.length}`);
        return products;
        
    } finally {
        await connection.end();
    }
}

async function reassignProductCategories() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('🔄 Reasignando categorías a productos existentes...');
        
        // Obtener productos actuales
        const products = await getCurrentProducts();
        
        let updated = 0;
        let categorized = 0;
        let unchanged = 0;
        
        for (const product of products) {
            try {
                const newCategory = assignCategoryToProduct(product.product_name, product.internal_code);
                
                if (newCategory && newCategory !== product.category) {
                    await connection.execute(
                        'UPDATE products SET category = ? WHERE id = ?',
                        [newCategory, product.id]
                    );
                    
                    console.log(`   ✅ ${product.internal_code}: "${product.product_name}" -> ${newCategory}`);
                    updated++;
                    
                    if (!product.category || product.category === 'Sin categoría') {
                        categorized++;
                    }
                } else if (!newCategory && !product.category) {
                    // Productos sin categoría específica, mantener sin categoría
                    unchanged++;
                } else {
                    unchanged++;
                }
                
            } catch (error) {
                console.error(`❌ Error actualizando producto ${product.internal_code}:`, error.message);
            }
        }
        
        console.log('\n📊 Resumen de reasignación:');
        console.log(`   🔄 Productos actualizados: ${updated}`);
        console.log(`   🏷️ Productos recategorizados: ${categorized}`);
        console.log(`   ⏸️ Productos sin cambios: ${unchanged}`);
        
    } finally {
        await connection.end();
    }
}

async function getUpdatedCategoryCount() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('\n📊 Conteo actualizado de productos por categoría:');
        
        const [results] = await connection.execute(`
            SELECT 
                c.name as categoria,
                COUNT(p.id) as productos
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            ORDER BY productos DESC, c.name ASC
        `);
        
        let totalCategorizedProducts = 0;
        results.forEach(row => {
            console.log(`   ${row.categoria}: ${row.productos} productos`);
            totalCategorizedProducts += row.productos;
        });
        
        // Contar productos sin categoría
        const [uncategorized] = await connection.execute(`
            SELECT COUNT(*) as sin_categoria
            FROM products 
            WHERE (category IS NULL OR category = '' OR category = 'Sin categoría') 
            AND is_active = TRUE
        `);
        
        if (uncategorized[0].sin_categoria > 0) {
            console.log(`   Sin categoría: ${uncategorized[0].sin_categoria} productos`);
        }
        
        console.log(`\n📈 Total productos categorizados: ${totalCategorizedProducts}`);
        
        return results;
        
    } finally {
        await connection.end();
    }
}

async function createMissingProducts() {
    const connection = await mysql.createConnection(dbConfig);
    
    try {
        console.log('\n🆕 Creando productos de ejemplo para categorías vacías...');
        
        const sampleProducts = [
            {
                name: 'Conservante Citrato de Sodio',
                code: 'CONS001',
                category: 'Materia prima gravadas 19%'
            },
            {
                name: 'Colorante Rojo No. 40',
                code: 'COL001', 
                category: 'Materia prima gravadas 19%'
            },
            {
                name: 'Saborizante Fresa Natural',
                code: 'SAB001',
                category: 'Materia prima gravadas 19%'
            },
            {
                name: 'Azúcar Refinada',
                code: 'AZUC001',
                category: 'Materia prima gravadas 5%'
            },
            {
                name: 'Glucosa Líquida',
                code: 'GLUC001',
                category: 'Materia prima gravadas 5%'
            },
            {
                name: 'Servicio de Mantenimiento',
                code: 'SERV001',
                category: 'Servicios'
            },
            {
                name: 'Instalación de Equipos',
                code: 'SERV002',
                category: 'Servicios'
            },
            {
                name: 'Alcohol Etílico 96%',
                code: 'ALC001',
                category: 'licores materia prima'
            },
            {
                name: 'Ron Blanco',
                code: 'LIC001',
                category: 'licores materia prima'
            },
            {
                name: 'Pre-mezcla Sabor Limón',
                code: 'PROC001',
                category: 'productos en proceso'
            },
            {
                name: 'Base Semi-elaborada',
                code: 'PROC002',
                category: 'productos en proceso'
            },
            {
                name: 'Producto Importado USA',
                code: 'IMP001',
                category: 'Productos No fabricados 19%'
            },
            {
                name: 'Mixer Profesional Nuevo',
                code: 'EQUIPON001',
                category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NUEVO'
            },
            {
                name: 'Máquina Selladora Usada',
                code: 'MAQ001',
                category: 'VENTA PROPIEDAD PLANTA Y EQUIPO NO USAR'
            }
        ];
        
        let inserted = 0;
        
        for (const product of sampleProducts) {
            try {
                // Verificar si ya existe
                const [existing] = await connection.execute(
                    'SELECT id FROM products WHERE internal_code = ?',
                    [product.code]
                );
                
                if (existing.length === 0) {
                    await connection.execute(`
                        INSERT INTO products (product_name, internal_code, category, barcode, is_active)
                        VALUES (?, ?, ?, 'PENDIENTE', TRUE)
                    `, [product.name, product.code, product.category]);
                    
                    console.log(`   ✅ Creado: ${product.code} - ${product.name}`);
                    inserted++;
                }
                
            } catch (error) {
                console.error(`❌ Error creando producto ${product.code}:`, error.message);
            }
        }
        
        console.log(`\n📦 Productos de ejemplo creados: ${inserted}`);
        
    } finally {
        await connection.end();
    }
}

async function main() {
    try {
        console.log('🚀 REASIGNACIÓN DE CATEGORÍAS PARA PRODUCTOS EXISTENTES');
        console.log('='.repeat(60));
        
        // 1. Reasignar categorías a productos existentes
        await reassignProductCategories();
        
        // 2. Crear productos de ejemplo para categorías vacías
        await createMissingProducts();
        
        // 3. Mostrar estadísticas finales
        await getUpdatedCategoryCount();
        
        console.log('\n🎉 ¡Reasignación completada exitosamente!');
        console.log('💡 Ahora todas las categorías deberían tener al menos algunos productos.');
        
    } catch (error) {
        console.error('💥 Error en la reasignación:', error.message);
        process.exit(1);
    }
}

// Ejecutar el script
main();
