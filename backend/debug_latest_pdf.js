const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function debugPdf() {
    try {
        const filePath = '/var/www/gestion_de_pedidos/backend/uploads/receptions/invoice-1765752458160-279398392.pdf';
        console.log('Reading file:', filePath);
        const dataBuffer = fs.readFileSync(filePath);

        console.log('Parsing PDF...');
        const data = await pdf(dataBuffer);

        console.log('--- RAW TEXT START ---');
        console.log(data.text);
        console.log('--- RAW TEXT END ---');

        // Test NIT extraction
        const lines = data.text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 0);
        console.log('\n--- NIT EXTRACTION TEST ---');
        for (let i = 0; i < Math.min(lines.length, 20); i++) {
            const line = lines[i];
            console.log(`Line ${i}: "${line}"`);
            const nitMatch = line.match(/NIT[:\s]*([0-9]{9,10}[-]?[0-9]?)/i) ||
                line.match(/([0-9]{9,10}[-][0-9])/);
            if (nitMatch) {
                console.log(`MATCH FOUND: ${nitMatch[1]}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

debugPdf();
