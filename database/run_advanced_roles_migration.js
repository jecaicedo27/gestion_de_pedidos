const mysql = require('mysql2/promise');

async function runAdvancedRolesMigration() {
  let connection;
  
  try {
    console.log('🚀 === EJECUTANDO MIGRACIÓN DE SISTEMA AVANZADO DE ROLES ===');
    
    // Conectar a la base de datos
    connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'gestion_pedidos_dev',
      multipleStatements: true
    });

    console.log('✅ Conectado a la base de datos');

    // Leer el archivo SQL
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'create_advanced_roles_system_fixed.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 Archivo SQL cargado');

    // Ejecutar la migración
    console.log('⚡ Ejecutando migración...');
    const [results] = await connection.query(sqlContent);
    
    console.log('✅ Migración ejecutada exitosamente');

    // Verificar resultados
    console.log('\n📊 === VERIFICANDO RESULTADOS ===');
    
    // Contar roles creados
    const [rolesCount] = await connection.execute('SELECT COUNT(*) as count FROM roles');
    console.log(`✅ Roles creados: ${rolesCount[0].count}`);

    // Contar permisos creados
    const [permissionsCount] = await connection.execute('SELECT COUNT(*) as count FROM permissions');
    console.log(`✅ Permisos creados: ${permissionsCount[0].count}`);

    // Contar usuarios migrados
    const [userRolesCount] = await connection.execute('SELECT COUNT(*) as count FROM user_roles');
    console.log(`✅ Usuarios migrados: ${userRolesCount[0].count}`);

    // Contar vistas configuradas
    const [viewsCount] = await connection.execute('SELECT COUNT(*) as count FROM role_views');
    console.log(`✅ Vistas configuradas: ${viewsCount[0].count}`);

    // Mostrar algunos ejemplos
    console.log('\n👥 === EJEMPLOS DE USUARIOS MIGRADOS ===');
    const [userExamples] = await connection.execute(`
      SELECT 
        u.username, 
        u.email, 
        r.display_name as rol,
        ur.assigned_at
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      LIMIT 5
    `);

    userExamples.forEach(user => {
      console.log(`- ${user.username} (${user.email}) → ${user.rol}`);
    });

    console.log('\n🔐 === EJEMPLOS DE PERMISOS POR ROL ===');
    const [permissionExamples] = await connection.execute(`
      SELECT 
        r.display_name as rol,
        COUNT(rp.permission_id) as total_permisos
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.display_name
      ORDER BY total_permisos DESC
    `);

    permissionExamples.forEach(rolePerms => {
      console.log(`- ${rolePerms.rol}: ${rolePerms.total_permisos} permisos`);
    });

    console.log('\n🖥️ === EJEMPLOS DE VISTAS POR ROL ===');
    const [viewExamples] = await connection.execute(`
      SELECT 
        r.display_name as rol,
        GROUP_CONCAT(rv.view_name ORDER BY rv.sort_order) as vistas
      FROM roles r
      LEFT JOIN role_views rv ON r.id = rv.role_id AND rv.is_visible = 1
      GROUP BY r.id, r.display_name
      LIMIT 5
    `);

    viewExamples.forEach(roleViews => {
      console.log(`- ${roleViews.rol}: ${roleViews.vistas || 'Sin vistas'}`);
    });

    console.log('\n🎉 === MIGRACIÓN COMPLETADA EXITOSAMENTE ===');
    console.log('📋 PRÓXIMOS PASOS:');
    console.log('1. ✅ Estructura de base de datos creada');
    console.log('2. 🔄 Actualizar backend para usar nuevo sistema');
    console.log('3. 🎨 Crear página de gestión de usuarios y roles');
    console.log('4. 🧪 Probar funcionalidades');
    
    console.log('\n📈 BENEFICIOS DEL NUEVO SISTEMA:');
    console.log('- 👥 Usuarios pueden tener múltiples roles');
    console.log('- 🔒 Permisos granulares por módulo y acción');
    console.log('- 👁️ Vistas configurables por rol');
    console.log('- ⏰ Roles temporales con expiración');
    console.log('- 📊 Auditoría completa de asignaciones');
    console.log('- 🎛️ Gestión avanzada desde el admin');

  } catch (error) {
    console.error('❌ Error en la migración:', error.message);
    console.error('💡 Detalles:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔚 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
if (require.main === module) {
  runAdvancedRolesMigration()
    .then(() => {
      console.log('\n🎊 ¡MIGRACIÓN COMPLETADA!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 ERROR EN LA MIGRACIÓN:', error);
      process.exit(1);
    });
}

module.exports = { runAdvancedRolesMigration };
