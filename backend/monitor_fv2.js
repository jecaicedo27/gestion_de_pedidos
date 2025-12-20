const fs = require('fs');
const { execSync } = require('child_process');

console.log('📋 Monitoreando logs para FV-2...');
console.log('Esperando creación de factura FV-2...\n');

let lastSize = 0;
try {
    const stats = fs.statSync('/root/.pm2/logs/gestion-backend-out.log');
    lastSize = stats.size;
} catch (e) {
    console.error('Error obteniendo tamaño inicial:', e.message);
}

setInterval(() => {
    try {
        const stats = fs.statSync('/root/.pm2/logs/gestion-backend-out.log');
        if (stats.size > lastSize) {
            const content = fs.readFileSync('/root/.pm2/logs/gestion-backend-out.log', 'utf8');
            const newLines = content.substring(lastSize).split('\n');

            newLines.forEach(line => {
                if (line.trim()) {
                    // Highlight important lines
                    if (line.includes('Error') || line.includes('FV-2') || line.includes('27081') ||
                        line.includes('Creando factura') || line.includes('importación') ||
                        line.includes('Importación')) {
                        console.log('\x1b[33m%s\x1b[0m', line); // Yellow
                    } else {
                        console.log(line);
                    }
                }
            });

            lastSize = stats.size;
        }
    } catch (e) {
        console.error('Error leyendo logs:', e.message);
    }
}, 500); // Check every 500ms

console.log('Presiona Ctrl+C para detener el monitoreo');
