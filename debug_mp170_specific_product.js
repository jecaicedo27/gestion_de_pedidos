const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

console.log('🔍 Testing MP170 Specific Product Synchronization Issue...\n');

async function debugMP170Product() {
    let connection;
    
    try {
        // Connect to database
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'gestion_de_pedidos'
        });

        console.log('✅ Connected to database');

        // Get SIIGO authentication token
        const authResponse = await axios.post('https://api.siigo.com/auth', {
            username: process.env.SIIGO_API_USERNAME,
            access_key: process.env.SIIGO_API_ACCESS_KEY
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const token = authResponse.data.access_token;
        console.log('✅ SIIGO authentication successful');

        // Check MP170 in local database
        console.log('\n🔍 CHECKING MP170 IN LOCAL DATABASE...');
        console.log('=====================================');
        
        const [localProduct] = await connection.execute(`
            SELECT id, code, name, active, available_quantity, siigo_id 
            FROM products 
            WHERE code = 'MP170'
        `);

        if (localProduct.length > 0) {
            const product = localProduct[0];
            console.log(`Local Product Found:`);
            console.log(`  ID: ${product.id}`);
            console.log(`  Code: ${product.code}`);
            console.log(`  Name: ${product.name}`);
            console.log(`  Status: ${product.active ? 'ACTIVO' : 'INACTIVO'}`);
            console.log(`  Stock: ${product.available_quantity}`);
            console.log(`  SIIGO ID: ${product.siigo_id}`);
        } else {
            console.log('❌ MP170 not found in local database');
            return;
        }

        // Check MP170 in SIIGO
        console.log('\n🔍 CHECKING MP170 IN SIIGO API...');
        console.log('==================================');

        try {
            const siigoResponse = await axios.get(`https://api.siigo.com/v1/products?code=MP170`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Partner-Id': 'siigo'
                }
            });

            if (siigoResponse.data && siigoResponse.data.results && siigoResponse.data.results.length > 0) {
                const siigoProduct = siigoResponse.data.results[0];
                
                console.log(`SIIGO Product Found:`);
                console.log(`  ID: ${siigoProduct.id}`);
                console.log(`  Code: ${siigoProduct.code}`);
                console.log(`  Name: ${siigoProduct.name}`);
                console.log(`  Status: ${siigoProduct.active ? 'ACTIVO' : 'INACTIVO'}`);
                console.log(`  Stock: ${siigoProduct.available_quantity}`);
                console.log(`  Raw Active Value: ${siigoProduct.active}`);

                // Compare statuses
                const localActive = localProduct[0].active !== 0;
                const siigoActive = siigoProduct.active !== false;

                console.log('\n📊 STATUS COMPARISON:');
                console.log('=====================');
                console.log(`Local Database: ${localActive ? 'ACTIVO' : 'INACTIVO'}`);
                console.log(`SIIGO System:   ${siigoActive ? 'ACTIVO' : 'INACTIVO'}`);

                if (localActive !== siigoActive) {
                    console.log('⚠️  STATUS MISMATCH DETECTED!');
                    console.log(`Should be: ${siigoActive ? 'ACTIVO' : 'INACTIVO'}`);
                    console.log(`Currently showing: ${localActive ? 'ACTIVO' : 'INACTIVO'}`);
                    
                    // Fix the status
                    console.log('\n🔧 CORRECTING THE STATUS...');
                    console.log('============================');
                    
                    await connection.execute(`
                        UPDATE products 
                        SET active = ?,
                            available_quantity = ?,
                            updated_at = NOW()
                        WHERE code = 'MP170'
                    `, [siigoActive ? 1 : 0, siigoProduct.available_quantity]);

                    console.log(`✅ STATUS CORRECTED TO: ${siigoActive ? 'ACTIVO' : 'INACTIVO'}`);
                    console.log(`✅ STOCK UPDATED TO: ${siigoProduct.available_quantity}`);

                    // Verify the correction
                    console.log('\n🔍 VERIFICATION AFTER CORRECTION...');
                    console.log('====================================');
                    
                    const [updatedProduct] = await connection.execute(`
                        SELECT code, name, active, available_quantity 
                        FROM products 
                        WHERE code = 'MP170'
                    `);

                    if (updatedProduct.length > 0) {
                        const updated = updatedProduct[0];
                        console.log(`Updated Product:`);
                        console.log(`  Code: ${updated.code}`);
                        console.log(`  Name: ${updated.name}`);
                        console.log(`  Status: ${updated.active ? 'ACTIVO' : 'INACTIVO'}`);
                        console.log(`  Stock: ${updated.available_quantity}`);
                        
                        if ((updated.active !== 0) === siigoActive) {
                            console.log('✅ STATUS NOW MATCHES SIIGO!');
                        } else {
                            console.log('❌ STATUS STILL DOES NOT MATCH');
                        }
                    }
                } else {
                    console.log('✅ STATUS ALREADY MATCHES SIIGO');
                }

            } else {
                console.log('❌ MP170 not found in SIIGO');
            }

        } catch (siigoError) {
            console.error('❌ Error accessing SIIGO API:', siigoError.message);
            if (siigoError.response) {
                console.error('SIIGO API Response:', siigoError.response.data);
            }
        }

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

debugMP170Product();
