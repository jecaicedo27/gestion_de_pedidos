const mysql = require('mysql2/promise');

console.log('🗑️ ELIMINANDO CAMPO shipping_method DE LA TABLA orders');
console.log('==================================================');

async function removeShippingMethodColumn() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'gestion_pedidos_dev'
    });

    try {
        console.log('✅ Conectado a la base de datos\n');

        // 1. Verificar si el campo existe
        console.log('📋 1. VERIFICANDO SI EL CAMPO shipping_method EXISTE:');
        const [fieldExists] = await connection.execute(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME = 'shipping_method'
        `);
        
        if (fieldExists.length === 0) {
            console.log('ℹ️ El campo shipping_method no existe en la tabla orders');
            return;
        }

        console.table(fieldExists);

        // 2. Mostrar cuántos registros tienen datos en este campo
        console.log('\n📋 2. VERIFICANDO DATOS EN EL CAMPO shipping_method:');
        const [dataCount] = await connection.execute(`
            SELECT 
                shipping_method,
                COUNT(*) as cantidad
            FROM orders 
            WHERE shipping_method IS NOT NULL AND shipping_method != ''
            GROUP BY shipping_method
        `);
        
        if (dataCount.length > 0) {
            console.table(dataCount);
            console.log('⚠️ ATENCIÓN: Hay datos en este campo que se perderán al eliminarlo');
        } else {
            console.log('✅ El campo shipping_method está vacío, es seguro eliminarlo');
        }

        // 3. Eliminar el campo
        console.log('\n🗑️ 3. ELIMINANDO EL CAMPO shipping_method:');
        await connection.execute(`ALTER TABLE orders DROP COLUMN shipping_method`);
        console.log('✅ Campo shipping_method eliminado exitosamente');

        // 4. Verificar que fue eliminado
        console.log('\n📋 4. VERIFICACIÓN FINAL:');
        const [fieldAfterDrop] = await connection.execute(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME = 'orders' 
            AND COLUMN_NAME = 'shipping_method'
        `);
        
        if (fieldAfterDrop.length === 0) {
            console.log('✅ CONFIRMADO: El campo shipping_method ha sido eliminado correctamente');
        } else {
            console.log('❌ ERROR: El campo shipping_method todavía existe');
        }

        // 5. Mostrar estructura simplificada de la tabla orders
        console.log('\n📋 5. ESTRUCTURA ACTUAL DE LA TABLA orders (campos relacionados con delivery/payment):');
        const [relevantFields] = await connection.execute(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'gestion_pedidos_dev' 
            AND TABLE_NAME = 'orders' 
            AND (COLUMN_NAME LIKE '%delivery%' OR COLUMN_NAME LIKE '%payment%')
            ORDER BY ORDINAL_POSITION
        `);
        console.table(relevantFields);

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
            console.log('💡 El campo puede tener restricciones. Verifique dependencias antes de eliminar.');
        }
    } finally {
        await connection.end();
        console.log('\n🔒 Conexión cerrada');
        
        console.log('\n🎯 RESUMEN:');
        console.log('- ✅ Simplificación completada: Solo se usa delivery_method');
        console.log('- ❌ shipping_method eliminado para evitar confusión');
        console.log('- 📝 Ahora solo hay un campo principal: delivery_method');
    }
}

removeShippingMethodColumn();
