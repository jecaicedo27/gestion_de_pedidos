const axios = require('axios');

class SiigoAPITester {
  constructor() {
    this.baseURL = 'https://api.siigo.com';
    this.username = 'COMERCIAL@PERLAS-EXPLOSIVAS.COM';
    this.accessKey = 'ODVjN2RlNDItY2I3MS00MmI5LWFiNjItMWM5MDkyZTFjMzY5Oih7IzdDMmU+RVk=';
    this.token = null;
  }

  async testAuthentication() {
    console.log('🔐 PROBANDO AUTENTICACIÓN SIIGO...');
    console.log('=====================================');
    
    try {
      console.log(`🔗 URL: ${this.baseURL}/auth`);
      console.log(`👤 Usuario: ${this.username}`);
      console.log(`🔑 Access Key: ${this.accessKey.substring(0, 10)}...`);
      
      const response = await axios.post(`${this.baseURL}/auth`, {
        username: this.username,
        access_key: this.accessKey
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Partner-Id': 'gestion-pedidos'
        },
        timeout: 30000
      });

      this.token = response.data.access_token;
      console.log('✅ Autenticación exitosa');
      console.log(`🎫 Token obtenido: ${this.token.substring(0, 20)}...`);
      return true;
      
    } catch (error) {
      console.error('❌ Error en autenticación:', error.message);
      if (error.response) {
        console.error('📋 Status:', error.response.status);
        console.error('📋 Headers:', error.response.headers);
        console.error('📋 Data:', error.response.data);
      }
      return false;
    }
  }

  async testInvoicesEndpoint() {
    console.log('\n📄 PROBANDO ENDPOINT DE FACTURAS...');
    console.log('====================================');
    
    if (!this.token) {
      console.log('❌ Sin token. Probando autenticación primero...');
      const authSuccess = await this.testAuthentication();
      if (!authSuccess) return false;
    }

    const testUrls = [
      '/v1/invoices',
      '/v1/invoices?page_size=5',
      '/v1/invoices?page_size=5&page=1',
      '/invoices',
      '/invoices?page_size=5'
    ];

    for (const url of testUrls) {
      try {
        console.log(`\n🔍 Probando: ${this.baseURL}${url}`);
        
        const response = await axios.get(`${this.baseURL}${url}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'gestion-pedidos'
          },
          timeout: 30000
        });

        console.log(`✅ ÉXITO - Status: ${response.status}`);
        console.log(`📊 Datos recibidos: ${JSON.stringify(response.data).substring(0, 200)}...`);
        return { url, data: response.data };
        
      } catch (error) {
        console.log(`❌ Error - Status: ${error.response?.status || 'Sin respuesta'}`);
        console.log(`📋 Mensaje: ${error.message}`);
        if (error.response?.data) {
          console.log(`📋 Response data: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
    
    return false;
  }

  async testSpecificInvoice() {
    console.log('\n🎯 PROBANDO FACTURA ESPECÍFICA...');
    console.log('=================================');
    
    const invoiceId = '304eb3e4-f182-415a-a1da-1c1ed86d4758';
    
    if (!this.token) {
      console.log('❌ Sin token. Probando autenticación primero...');
      const authSuccess = await this.testAuthentication();
      if (!authSuccess) return false;
    }

    const testUrls = [
      `/v1/invoices/${invoiceId}`,
      `/invoices/${invoiceId}`
    ];

    for (const url of testUrls) {
      try {
        console.log(`\n🔍 Probando: ${this.baseURL}${url}`);
        
        const response = await axios.get(`${this.baseURL}${url}`, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Partner-Id': 'gestion-pedidos'
          },
          timeout: 30000
        });

        console.log(`✅ ÉXITO - Status: ${response.status}`);
        console.log(`📊 Factura obtenida: ${response.data.name || 'Sin nombre'}`);
        console.log(`📦 Items: ${response.data.items?.length || 0}`);
        return response.data;
        
      } catch (error) {
        console.log(`❌ Error - Status: ${error.response?.status || 'Sin respuesta'}`);
        console.log(`📋 Mensaje: ${error.message}`);
        if (error.response?.data) {
          console.log(`📋 Response data: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
    
    return false;
  }

  async testDifferentBaseUrls() {
    console.log('\n🌐 PROBANDO DIFERENTES URLs BASE...');
    console.log('===================================');
    
    const baseUrls = [
      'https://api.siigo.com',
      'https://private-anon-b3bfc4a7d1-siigo.apiary-mock.com',
      'https://api.siigo.co'
    ];

    for (const baseUrl of baseUrls) {
      console.log(`\n🔍 Probando base URL: ${baseUrl}`);
      this.baseURL = baseUrl;
      
      const authSuccess = await this.testAuthentication();
      if (authSuccess) {
        console.log(`✅ Base URL funcional: ${baseUrl}`);
        const invoicesTest = await this.testInvoicesEndpoint();
        if (invoicesTest) {
          console.log(`🎉 URL COMPLETA FUNCIONAL: ${baseUrl}`);
          return baseUrl;
        }
      }
    }
    
    return false;
  }

  async runCompleteTest() {
    console.log('🧪 DIAGNÓSTICO COMPLETO DE SIIGO API');
    console.log('=====================================');
    
    // Test 1: Autenticación
    const authSuccess = await this.testAuthentication();
    if (!authSuccess) {
      console.log('\n❌ FALLO CRÍTICO: No se puede autenticar');
      return;
    }

    // Test 2: Endpoint de facturas
    const invoicesSuccess = await this.testInvoicesEndpoint();
    if (!invoicesSuccess) {
      console.log('\n⚠️ Endpoint de facturas falla. Probando URLs alternativas...');
      const workingUrl = await this.testDifferentBaseUrls();
      if (!workingUrl) {
        console.log('\n❌ NINGUNA URL BASE FUNCIONA');
        return;
      }
    }

    // Test 3: Factura específica
    const specificInvoice = await this.testSpecificInvoice();
    if (!specificInvoice) {
      console.log('\n❌ No se puede obtener factura específica');
      return;
    }

    console.log('\n🎉 DIAGNÓSTICO COMPLETADO');
    console.log('========================');
    console.log(`✅ Base URL funcional: ${this.baseURL}`);
    console.log(`✅ Autenticación: OK`);
    console.log(`✅ Listado de facturas: OK`);
    console.log(`✅ Factura específica: OK`);
    
    return {
      baseUrl: this.baseURL,
      token: this.token,
      testInvoice: specificInvoice
    };
  }
}

async function main() {
  const tester = new SiigoAPITester();
  await tester.runCompleteTest();
  process.exit(0);
}

main().catch(console.error);
