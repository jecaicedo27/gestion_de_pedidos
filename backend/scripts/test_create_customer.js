const siigoService = require('../services/siigoService');

async function testCreateCustomer() {
    try {
        await siigoService.authenticate();

        const payload = {
            person_type: 'Person',
            id_type: '13', // Cédula
            identification: '1110508719',
            first_name: 'janifer',
            last_name: 'rojas',
            email: 'flak147@hotmail.com',
            phone: '3175126054',
            address: {
                address: 'calle 5 # 10 - 41 barrio centro ortega',
                city: {
                    country_code: 'Co',
                    state_code: '73',
                    city_code: '73504'
                }
            }
        };

        console.log('Sending payload:', JSON.stringify(payload, null, 2));
        const result = await siigoService.createCustomer(payload);
        console.log('Success:', result);

    } catch (error) {
        console.error('Error creating customer:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

testCreateCustomer();
