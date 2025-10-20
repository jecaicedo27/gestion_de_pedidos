
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function resetPassword() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_pedidos_dev'
        });

        console.log('✅ Conectado a la base de datos');

        const newPassword = 'admin123';
        console.log('🔑 Nueva contraseña: admin123');

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
        console.log('🔐 Hash generado');

        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE username = ?',
            [hashedPassword, 'admin']
        );

        if (result.affectedRows > 0) {
            console.log('✅ Contraseña actualizada exitosamente');
        } else {
            console.log('❌ Usuario admin no encontrado');
        }

        await connection.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

resetPassword();
