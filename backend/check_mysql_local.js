const mysql = require('mysql2/promise');

(async () => {
  const tests = [
    { host: 'localhost', label: 'localhost' },
    { host: '127.0.0.1', label: '127.0.0.1' },
    { host: '::1', label: '::1' }
  ];

  for (const t of tests) {
    console.log(`\n🔎 Probando conexión MySQL a ${t.label}:3306 ...`);
    let conn;
    try {
      const start = Date.now();
      conn = await mysql.createConnection({
        host: t.host,
        port: 3306,
        user: 'root',
        password: '',
        connectTimeout: 10000
      });
      const [rows] = await conn.query('SELECT 1 AS ok');
      const ms = Date.now() - start;
      console.log(`✅ Conexión exitosa a ${t.label} en ${ms}ms. Resultado:`, rows);
    } catch (err) {
      console.error(`❌ Falló conexión a ${t.label}:`, err.code || err.message);
    } finally {
      if (conn) await conn.end().catch(() => {});
    }
  }

  console.log('\n🏁 Pruebas de conexión finalizadas.\n');
})().catch(e => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
