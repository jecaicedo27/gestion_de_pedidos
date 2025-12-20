const fs = require('fs');

try {
  const content = fs.readFileSync('/root/.pm2/logs/gestion-backend-out.log', 'utf8');
  const lines = content.split('\n');

  // Buscar las últimas líneas con "Error" o "422" o "SIIGO"
  const relevantLines = [];
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 300); i--) {
    const line = lines[i];
    if (line.includes('Error creando factura') ||
      line.includes('422') ||
      line.includes('Error inesperado') ||
      line.includes('SIIGO') ||
      line.includes('Creando factura directa') ||
      line.includes('response') ||
      line.includes('Response')) {
      relevantLines.unshift({ index: i, line });
    }
  }

  if (relevantLines.length > 0) {
    console.log('=== LOGS DE ERROR SIIGO (ÚLTIMOS) ===');
    relevantLines.slice(-50).forEach(item => {
      console.log(item.line);
    });
  } else {
    console.log('No se encontraron logs de error SIIGO recientes');
  }
} catch (error) {
  console.error('Error leyendo logs:', error.message);
}
