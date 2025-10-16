const siigoService = require('./backend/services/siigoService');

// Función de prueba para extraer método de pago de envío
function testExtraction() {
  console.log('🧪 PROBANDO EXTRACCIÓN DE MÉTODO DE PAGO DE ENVÍO');
  console.log('==============================================\n');

  // Casos de prueba
  const testCases = [
    {
      name: 'Caso 1: En línea con otros datos',
      text: `ESTADO DE PAGO: Confirmado
MEDIO DE PAGO: Mercado pago
FORMA DE PAGO DE ENVIO: Contado
NOMBRE: ARIADNA BARBOSA`,
      expected: 'contado'
    },
    {
      name: 'Caso 2: Solo la línea',
      text: `FORMA DE PAGO DE ENVIO: Contraentrega`,
      expected: 'contraentrega'
    },
    {
      name: 'Caso 3: Con espacios extras',
      text: `FORMA DE PAGO DE ENVIO:     Contado    `,
      expected: 'contado'
    },
    {
      name: 'Caso 4: Mayúsculas/minúsculas',
      text: `forma de pago de envio: CONTRAENTREGA`,
      expected: 'contraentrega'
    },
    {
      name: 'Caso 5: Sin el campo',
      text: `ESTADO DE PAGO: Confirmado
MEDIO DE PAGO: Mercado pago
NOMBRE: ARIADNA BARBOSA`,
      expected: null
    }
  ];

  // Función interna del servicio simulada
  const extractShippingPaymentMethod = (text) => {
    if (!text) return null;
    
    const normalizedText = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ');
    
    const lines = normalizedText.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Buscar específicamente "FORMA DE PAGO DE ENVIO:" en cualquier parte de la línea
      if (trimmedLine.match(/FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:/i)) {
        const paymentMethodMatch = trimmedLine.replace(/.*FORMA\s+DE\s+PAGO\s+DE\s+ENVIO\s*:\s*/i, '').trim();
        if (paymentMethodMatch) {
          const normalized = paymentMethodMatch.toLowerCase();
          if (normalized.includes('contado')) return 'contado';
          if (normalized.includes('contraentrega') || normalized.includes('contra entrega')) return 'contraentrega';
          return paymentMethodMatch;
        }
      }
    }
    
    return null;
  };

  // Ejecutar pruebas
  testCases.forEach((testCase, index) => {
    console.log(`📋 ${testCase.name}`);
    console.log(`📝 Texto: "${testCase.text.substring(0, 50)}..."`);
    
    const result = extractShippingPaymentMethod(testCase.text);
    const passed = result === testCase.expected;
    
    console.log(`🎯 Esperado: ${testCase.expected || 'null'}`);
    console.log(`📊 Obtenido: ${result || 'null'}`);
    console.log(`${passed ? '✅ PASÓ' : '❌ FALLÓ'}\n`);
  });
}

// Ejecutar test
testExtraction();
