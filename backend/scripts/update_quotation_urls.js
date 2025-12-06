const { query } = require('../config/database');

async function updateQuotationUrls() {
    try {
        console.log('Updating quotation URLs from nube.siigo.com to q.siigo.com...');

        const result = await query(`
      UPDATE quotations 
      SET siigo_quotation_url = REPLACE(siigo_quotation_url, 'nube.siigo.com', 'q.siigo.com')
      WHERE siigo_quotation_url LIKE '%nube.siigo.com%'
    `);

        console.log(`✅ Updated ${result.affectedRows} quotation URLs`);
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating URLs:', error);
        process.exit(1);
    }
}

updateQuotationUrls();
