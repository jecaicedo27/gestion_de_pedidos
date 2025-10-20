const mysql = require('mysql2/promise');

async function reasignarProductosACategorias() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('=== REASIGNANDO PRODUCTOS A CATEGORÍAS CORRECTAS ===\n');

        // Obtener productos sin categoría
        const [productosReasignar] = await connection.execute(`
            SELECT id, product_name, internal_code
            FROM products 
            WHERE is_active = TRUE AND (category IS NULL OR category = '' OR category = 'Sin categoría')
            LIMIT 10
        `);

        console.log(`Productos a reasignar: ${productosReasignar.length}`);

        // Reglas de asignación basadas en patrones en nombres/códigos
        const reglasAsignacion = [
            {
                categoria: 'LIQUIPOPS',
                patrones: ['LIQUIPP', 'liquipp', 'LIQUI', 'POP']
            },
            {
                categoria: 'GENIALITY',
                patrones: ['GENIALITY', 'geniality', 'GEN']
            },
            {
                categoria: 'MEZCLAS EN POLVO',
                patrones: ['MEZCLA', 'mezcla', 'POLVO', 'polvo', 'MIX']
            },
            {
                categoria: 'Materia prima gravadas 19%',
                patrones: ['MATERIA', 'materia', 'prima', 'PRIMA', 'MP']
            },
            {
                categoria: 'Materia prima gravadas 5%',
                patrones: ['MP5', 'PRIMA5', '5%']
            },
            {
                categoria: 'productos Fabricados shotboom NO USAR',
                patrones: ['shotboom', 'SHOTBOOM', 'fabricado', 'FABRICADO']
            },
            {
                categoria: 'productos en proceso',
                patrones: ['proceso', 'PROCESO', 'WIP', 'wip']
            },
            {
                categoria: 'SHOT NO FABRICADOS',
                patrones: ['SHOT', 'shot', 'NO FAB', 'no fab']
            },
            {
                categoria: 'SKARCHA FABRICADOS NO USAR',
                patrones: ['SKARCHA', 'skarcha', 'SKAR']
            },
            {
                categoria: 'SKARCHA NO FABRICADOS 19%',
                patrones: ['SKARCHA', 'skarcha', 'NO FABRICADO', 'no fabricado']
            },
            {
                categoria: 'licores materia prima',
                patrones: ['licor', 'LICOR', 'alcohol', 'ALCOHOL', 'LIC']
            },
            {
                categoria: 'YEXIS',
                patrones: ['YEXIS', 'yexis', 'YEX']
            },
            {
                categoria: 'Servicios',
                patrones: ['servicio', 'SERVICIO', 'SRV', 'srv']
            },
            {
                categoria: 'VENTA PROPIEDAD PLANTA Y EQUIPO NUEVO',
                patrones: ['EQUIPO', 'equipo', 'PLANTA', 'planta', 'NUEVO', 'nuevo']
            },
            {
                categoria: 'VENTA PROPIEDAD PLANTA Y EQUIPO NO USAR',
                patrones: ['EQUIPO NO USAR', 'equipo no usar', 'NO USAR']
            }
        ];

        let productosReasignados = 0;

        for (const producto of productosReasignar) {
            const nombreProducto = (producto.product_name || '').toLowerCase();
            const codigoProducto = (producto.internal_code || '').toLowerCase();
            
            console.log(`\nAnalizando: ${producto.product_name} [${producto.internal_code}]`);
            
            let categoriaAsignada = null;

            // Buscar coincidencias con patrones
            for (const regla of reglasAsignacion) {
                const coincide = regla.patrones.some(patron => 
                    nombreProducto.includes(patron.toLowerCase()) || 
                    codigoProducto.includes(patron.toLowerCase())
                );

                if (coincide) {
                    categoriaAsignada = regla.categoria;
                    console.log(`   ✅ Asignado a: ${categoriaAsignada}`);
                    break;
                }
            }

            if (!categoriaAsignada) {
                // Si no encuentra patrón específico, asignar basado en código
                if (codigoProducto.includes('temp') || codigoProducto.includes('tmp')) {
                    categoriaAsignada = 'productos en proceso';
                } else if (codigoProducto.includes('srv') || nombreProducto.includes('servicio')) {
                    categoriaAsignada = 'Servicios';
                } else {
                    // Por defecto, asignar a "Productos No fabricados 19%" si no se encuentra patrón
                    categoriaAsignada = 'Productos No fabricados 19%';
                }
                console.log(`   ⚠️  Asignación por defecto: ${categoriaAsignada}`);
            }

            // Actualizar producto
            try {
                await connection.execute(
                    'UPDATE products SET category = ? WHERE id = ?',
                    [categoriaAsignada, producto.id]
                );
                productosReasignados++;
            } catch (error) {
                console.log(`   ❌ Error actualizando producto ${producto.id}: ${error.message}`);
            }
        }

        console.log(`\n✅ Productos reasignados: ${productosReasignados}`);

        // Verificar estado después de reasignación
        console.log('\n=== ESTADO DESPUÉS DE REASIGNACIÓN ===');
        const [estadoFinal] = await connection.execute(`
            SELECT 
                c.name as categoria,
                COUNT(p.id) as productos
            FROM categories c
            LEFT JOIN products p ON p.category = c.name AND p.is_active = TRUE
            WHERE c.is_active = TRUE
            GROUP BY c.id, c.name
            ORDER BY productos DESC, c.name ASC
        `);

        estadoFinal.forEach(cat => {
            const status = cat.productos > 0 ? '✅' : '❌';
            console.log(`${status} ${cat.categoria}: ${cat.productos} productos`);
        });

        // Verificar productos restantes sin categoría
        const [sinCategoria] = await connection.execute(`
            SELECT COUNT(*) as count
            FROM products 
            WHERE is_active = TRUE AND (category IS NULL OR category = '' OR category = 'Sin categoría')
        `);

        console.log(`\n⚠️  Productos aún sin categoría: ${sinCategoria[0].count}`);

        if (sinCategoria[0].count > 0) {
            console.log('\n💡 RECOMENDACIÓN:');
            console.log('Ejecuta este script varias veces para procesar todos los productos');
            console.log('o ajusta los patrones de asignación para cubrir más casos');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

reasignarProductosACategorias();
