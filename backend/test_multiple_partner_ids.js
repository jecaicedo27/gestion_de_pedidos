const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class PartnerIdTester {
  constructor() {
    this.baseURL = 'https://api.siigo.com';
    this.username = process.env.SIIGO_API_USERNAME;
    this.accessKey = process.env.SIIGO_API_ACCESS_KEY;
    this.token = null;
  }

  async authenticate() {
    try {
      const response = await axios.post(`${this.baseURL}/auth`, {
        username: this.username,
        access_key: this.accessKey
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      this.token = response.data.access_token;
      console.log('✅ Autenticación exitosa');
      return this.token;
      
    } catch (error) {
      console.error('❌ Error en autenticación:', error.message);
      throw error;
    }
  }

  async testPartnerIds() {
    const partnerIds = [
      null, // Sin Partner-Id
      'siigo',
      'SIIGO',
      'api-partner',
      'API-PARTNER',
      'partner-app',
      'PARTNER-APP',
      'gestion-pedidos',
      'GESTION-PEDIDOS',
      'perlas-explosivas',
      'PERLAS-EXPLOSIVAS',
      'comercial',
      'COMERCIAL',
      'default',
      'DEFAULT',
      'client',
      'CLIENT',
      'app',
      'APP',
      'invoice-api',
      'INVOICE-API',
      'test',
      'TEST',
      'sandbox',
      'SANDBOX'
    ];

    console.log('🧪 PROBANDO DIFERENTES PARTNER-IDS');
    console.log('==================================');

    for (const partnerId of partnerIds) {
      try {
        console.log(`\n🔍 Probando Partner-Id: "${partnerId || 'SIN PARTNER-ID'}"`);
        
        const headers = {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        };

        if (partnerId) {
          headers['Partner-Id'] = partnerId;
        }

        const response = await axios.get(`${this.baseURL}/v1/invoices`, {
          headers,
          params: { page_size: 1 },
          timeout: 30000
        });

        console.log(`🎉 ¡ÉXITO! Partner-Id funcional: "${partnerId || 'SIN PARTNER-ID'}"`);
        console.log(`📊 Status: ${response.status}`);
        console.log(`📋 Datos: ${JSON.stringify(response.data).substring(0, 100)}...`);
        
        return partnerId;

      } catch (error) {
        const status = error.response?.status || 'Sin respuesta';
        const errorCode = error.response?.data?.Errors?.[0]?.Code || 'Sin código';
        console.log(`❌ Falló - Status: ${status}, Error: ${errorCode}`);
        
        // Si encontramos un error diferente al Partner-Id, es progreso
        if (errorCode !== 'invalid_partner_id' && errorCode !== 'header_required') {
          console.log(`⚠️ Nuevo tipo de error encontrado: ${errorCode}`);
          console.log(`📋 Detalle: ${JSON.stringify(error.response?.data)}`);
        }
      }

      // Pequeña pausa entre pruebas
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n❌ No se encontró un Partner-Id funcional');
    return null;
  }

  async run() {
    try {
      await this.authenticate();
      
      if (!this.token) {
        console.log('❌ No se pudo obtener token');
        return;
      }

      const workingPartnerId = await this.testPartnerIds();
      
      if (workingPartnerId !== null) {
        console.log(`\n🎉 PARTNER-ID FUNCIONAL ENCONTRADO: "${workingPartnerId || 'SIN PARTNER-ID'}"`);
      } else {
        console.log('\n❌ NINGÚN PARTNER-ID FUNCIONÓ');
      }

    } catch (error) {
      console.error('❌ Error general:', error.message);
    }

    process.exit(0);
  }
}

const tester = new PartnerIdTester();
tester.run();
