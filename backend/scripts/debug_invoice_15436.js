const siigoService = require('../services/siigoService');

async function debugInvoice() {
    try {
        await siigoService.authenticate();
        // Assuming we can search by number or just list and filter. 
        // Or if we have a getInvoice method.
        // Let's try to list invoices with a specific number if possible, or just fetch recent ones.
        // Based on previous context, there might be a getInvoices method.

        console.log('Searching for invoice FV-2-15436...');

        // Try to find the specific invoice. 
        // If there isn't a direct search by number exposed easily in the service wrapper, 
        // we might need to use the raw axios instance or a known method.
        // Let's check siigoService.js content first to be sure, but for now I'll assume I can list/search.
        // Actually, I'll use the list method and filter, or if I can't, I'll try to find a specific endpoint.

        // Better approach: The user said "pedido 15436". It might be an order or an invoice. 
        // The screenshot shows "FV-2-15436", which is an invoice.

        const response = await siigoService.getInvoices({ page: 1, page_size: 50, name: '15436' });
        // 'name' param often works for number search in Siigo or we filter manually.

        if (response && response.results) {
            const invoice = response.results.find(inv => inv.name === 'FV-2-15436' || inv.number === 15436);

            if (invoice) {
                console.log('✅ Invoice Found:', invoice.id);
                console.log('Total Gross:', invoice.total); // Usually total is net, let's see.
                console.log('Data:', JSON.stringify(invoice, null, 2));

                // Also get full details if the list item is partial
                const fullInvoice = await siigoService.getInvoice(invoice.id);
                console.log('📦 Full Invoice Items:', JSON.stringify(fullInvoice.items, null, 2));
                console.log('💰 Totals:', {
                    total: fullInvoice.total,
                    balance: fullInvoice.balance,
                    gross_value: fullInvoice.gross_value // if available
                });
            } else {
                console.log('❌ Invoice 15436 not found in search results.');
                console.log('Results found:', response.results.map(i => i.name));
            }
        } else {
            console.log('❌ No results from getInvoices');
        }

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) console.error('Response:', error.response.data);
    }
}

debugInvoice();
