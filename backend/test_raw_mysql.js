const net = require('net');

const targets = [
  { host: '127.0.0.1', label: '127.0.0.1' },
  { host: 'localhost', label: 'localhost' },
  { host: '::1', label: '::1' }
];

function toHex(buf, max = 64) {
  const slice = buf.subarray(0, Math.min(buf.length, max));
  return Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

(async () => {
  for (const t of targets) {
    await new Promise((resolve) => {
      console.log(`\n🔗 Intentando conexión TCP a ${t.label}:3306 ...`);
      const socket = new net.Socket();
      let gotData = false;

      socket.setTimeout(5000);

      socket.once('connect', () => {
        console.log(`✅ Conectado a ${t.label}:3306 (TCP connect OK)`);
      });

      socket.once('timeout', () => {
        console.error(`⏱️ Timeout esperando datos de handshake desde ${t.label}`);
        socket.destroy();
      });

      socket.once('error', (err) => {
        console.error(`❌ Error TCP a ${t.label}:`, err.code || err.message);
      });

      socket.on('data', (chunk) => {
        if (!gotData) {
          gotData = true;
          console.log(`📦 Recibidos ${chunk.length} bytes del servidor (handshake esperado).`);
          console.log(`🔣 HEX: ${toHex(chunk)}`);
          // Cerrar después de primer paquete (suficiente para verificar servicio)
          socket.end();
        }
      });

      socket.once('close', () => {
        resolve();
      });

      socket.connect({ host: t.host, port: 3306 });
    });
  }
  console.log('\n🏁 Pruebas TCP finalizadas.\n');
})().catch((e) => {
  console.error('Error inesperado:', e);
  process.exit(1);
});
