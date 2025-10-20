const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3001/api';

// 1x1 PNG (red pixel) base64
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

(async function run() {
  try {
    console.log('🧪 Subiendo evidencia como mensajero "julian"...');

    // 1) Login
    console.log('🔑 Iniciando sesión...');
    const login = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'julian',
      password: 'mensajero123'
    });

    if (!login.data?.success) {
      console.log('❌ Login falló:', login.data);
      process.exit(1);
    }

    const token = login.data.data.token;
    const user = login.data.data.user;
    console.log(`✅ Login OK - userId=${user?.id} username=${user?.username} role=${user?.role}`);

    const headersAuth = {
      Authorization: `Bearer ${token}`
    };

    // 2) Obtener pedidos del mensajero
    console.log('\n📦 Consultando /api/messenger/orders ...');
    const resp = await axios.get(`${BASE_URL}/messenger/orders`, { headers: headersAuth });

    if (!resp.data?.success) {
      console.error('❌ Error obteniendo pedidos:', resp.data);
      process.exit(1);
    }
    const orders = resp.data?.data || [];
    console.log(`📊 Pedidos encontrados: ${orders.length}`);

    if (!orders.length) {
      console.log('⚠️ No hay pedidos para probar la subida de evidencia.');
      process.exit(0);
    }

    // Intentar usar el pedido 607 si existe, sino el primero
    let order = orders.find(o => o.id === 607) || orders[0];
    console.log(`🎯 Usando orderId=${order.id} order_number=${order.order_number} status=${order.status} messenger_status=${order.messenger_status}`);

    // 3) Preparar archivo temporal PNG
    const tmpDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    const imgPath = path.join(tmpDir, `evidence_${Date.now()}.png`);
    fs.writeFileSync(imgPath, PNG_BASE64, 'base64');
    console.log(`🖼️ Imagen temporal creada: ${imgPath}`);

    // 4) Subir evidencia (payment photo)
    const fd1 = new FormData();
    fd1.append('photo', fs.createReadStream(imgPath), { filename: path.basename(imgPath), contentType: 'image/png' });
    fd1.append('description', 'Pago recibido - prueba automatizada');

    console.log('⬆️ Subiendo evidencia (payment photo)...');
    const up1 = await axios.post(
      `${BASE_URL}/messenger/orders/${order.id}/upload-evidence`,
      fd1,
      {
        headers: { 
          ...fd1.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log('✅ Evidencia 1 subida:', up1.data);

    // 5) Subir evidencia (delivery photo)
    const fd2 = new FormData();
    fd2.append('photo', fs.createReadStream(imgPath), { filename: path.basename(imgPath), contentType: 'image/png' });
    fd2.append('description', 'Evidencia de entrega - prueba automatizada');

    console.log('⬆️ Subiendo evidencia (delivery photo)...');
    const up2 = await axios.post(
      `${BASE_URL}/messenger/orders/${order.id}/upload-evidence`,
      fd2,
      {
        headers: { 
          ...fd2.getHeaders(),
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log('✅ Evidencia 2 subida:', up2.data);

    console.log('\n🎉 Prueba de upload-evidence finalizada correctamente.');
  } catch (err) {
    console.error('❌ Error en prueba de evidencia:', err.message);
    if (err.response) {
      console.error('📋 Status:', err.response.status);
      console.error('📋 Data:', err.response.data);
    }
    process.exit(1);
  }
})();
