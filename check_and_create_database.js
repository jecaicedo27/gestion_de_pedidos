const mysql = require('mysql2/promise');

async function checkAndCreateDatabase() {
    // First connect without specifying database
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: ''
    });

    try {
        console.log('🔍 Verificando bases de datos disponibles...');
        
        // List all databases
        const [databases] = await connection.execute('SHOW DATABASES');
        console.log('\n📋 BASES DE DATOS DISPONIBLES:');
        console.log('================================================================================');
        databases.forEach(db => {
            console.log(`- ${db.Database}`);
        });

        // Check if gestion_de_pedidos exists
        const targetDB = databases.find(db => db.Database === 'gestion_de_pedidos');
        
        if (!targetDB) {
            console.log('\n🔧 Creando base de datos gestion_de_pedidos...');
            await connection.execute('CREATE DATABASE gestion_de_pedidos');
            console.log('✅ Base de datos gestion_de_pedidos creada exitosamente');
        } else {
            console.log('\n✅ Base de datos gestion_de_pedidos ya existe');
        }

        // Now switch to the database and check tables
        await connection.execute('USE gestion_de_pedidos');
        
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('\n📊 TABLAS EN gestion_de_pedidos:');
        console.log('================================================================================');
        if (tables.length === 0) {
            console.log('(Sin tablas)');
        } else {
            tables.forEach(table => {
                const tableName = Object.values(table)[0];
                console.log(`- ${tableName}`);
            });
        }

        console.log('\n🎯 Base de datos lista para crear la tabla products');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkAndCreateDatabase();
