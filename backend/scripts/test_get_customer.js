const siigoService = require('../services/siigoService');

async function testGetCustomer() {
    try {
        await siigoService.authenticate();
        const identification = '1110508719';
        console.log(`Searching for customer with identification: ${identification}`);
        const customer = await siigoService.getCustomerByIdentification(identification);

        if (customer) {
            console.log('✅ Customer found:', customer.id, customer.name);
        } else {
            console.log('❌ Customer not found');
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

testGetCustomer();
