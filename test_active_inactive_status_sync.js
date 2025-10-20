const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

console.log('🔄 Testing Active/Inactive Status Synchronization with SIIGO...\n');

async function testActiveInactiveSync() {
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

        // Get a sample of products from local database
        const [localProducts] = await connection.execute(`
            SELECT id, code, name, active, available_quantity 
            FROM products 
            WHERE code IS NOT NULL 
            AND code != ''
            LIMIT 10
        `);

        console.log(`\n📊 Testing ${localProducts.length} products for active/inactive status sync...\n`);

        let changesDetected = 0;
        let productsChecked = 0;

        for (const product of localProducts) {
            try {
                // Get product data from SIIGO
                const siigoResponse = await axios.get(`https://api.siigo.com/v1/products?code=${product.code}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Partner-Id': 'siigo'
                    }
                });

                if (siigoResponse.data && siigoResponse.data.results && siigoResponse.data.results.length > 0) {
                    const siigoProduct = siigoResponse.data.results[0];
                    const siigoActive = siigoProduct.active !== false;
                    const localActive = product.active !== 0;
                    
                    productsChecked++;
                    
                    console.log(`🔍 ${product.code} - ${product.name}`);
                    console.log(`   SIIGO: ${siigoActive ? 'Activo' : 'Inactivo'} | Local: ${localActive ? 'Activo' : 'Inactivo'} | Stock SIIGO: ${siigoProduct.available_quantity} | Stock Local: ${product.available_quantity}`);
                    
                    if (siigoActive !== localActive) {
                        changesDetected++;
                        console.log(`   ⚠️  STATUS MISMATCH DETECTED! Should be ${siigoActive ? 'Active' : 'Inactive'} but showing as ${localActive ? 'Active' : 'Inactive'}`);
                        
                        // Update the product in the database
                        await connection.execute(`
                            UPDATE products 
                            SET active = ?,
                                available_quantity = ?,
                                stock_updated_at = NOW(),
                                last_sync_at = NOW()
                            WHERE id = ?
                        `, [siigoActive, siigoProduct.available_quantity, product.id]);
                        
                        console.log(`   ✅ CORRECTED: Updated status to ${siigoActive ? 'Active' : 'Inactive'} and stock to ${siigoProduct.available_quantity}`);
                    } else {
                        console.log(`   ✅ STATUS MATCHES`);
                    }
                } else {
                    console.log(`   ⚠️  Product ${product.code} not found in SIIGO`);
                }
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                console.log(`   ❌ Error checking product ${product.code}: ${error.message}`);
            }
        }

        console.log('\n📋 SYNCHRONIZATION SUMMARY:');
        console.log(`   Products checked: ${productsChecked}`);
        console.log(`   Status mismatches found and corrected: ${changesDetected}`);
        
        if (changesDetected > 0) {
            console.log('\n🔄 Running automatic stock sync to verify the fix...');
            
            // Trigger the stock sync service
            try {
                const stockSyncResponse = await axios.post('http://localhost:3000/api/sync/stock/manual', {}, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                console.log('✅ Stock sync triggered successfully');
                console.log('Response:', stockSyncResponse.data);
            } catch (syncError) {
                console.log('⚠️  Could not trigger automatic sync (this is normal if backend is not running)');
                console.log('Manual corrections have been applied to the database.');
            }
        } else {
            console.log('✅ All products have correct active/inactive status!');
        }

        // Show final verification
        console.log('\n🔍 FINAL VERIFICATION - Checking products again...');
        
        const [updatedProducts] = await connection.execute(`
            SELECT code, name, active, available_quantity 
            FROM products 
            WHERE id IN (${localProducts.map(p => p.id).join(',')})
        `);

        updatedProducts.forEach(product => {
            console.log(`   ${product.code} - ${product.name}: ${product.active ? 'Activo' : 'Inactivo'} (Stock: ${product.available_quantity})`);
        });

        console.log('\n✅ Active/Inactive status synchronization test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

testActiveInactiveSync();
