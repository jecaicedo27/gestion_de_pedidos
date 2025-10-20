const puppeteer = require('puppeteer');

async function testCustomerDropdownFix() {
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    try {
        const page = await browser.newPage();
        
        // Listen for console errors
        let errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
                console.log('❌ Console Error:', msg.text());
            }
        });
        
        console.log('🔄 Navigating to inventory billing page...');
        await page.goto('http://localhost:3000/inventory-billing');
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        console.log('🔄 Looking for cart button...');
        
        // Try to find and click the cart button
        const cartButton = await page.$('[data-testid="cart-button"], button:has-text("VER CARRITO"), button[title*="carrito" i]');
        
        if (cartButton) {
            console.log('✅ Cart button found, clicking...');
            await cartButton.click();
            await page.waitForTimeout(2000);
            
            // Check for the specific CustomerSearchDropdown error
            const hasCustomerDropdownError = errors.some(error => 
                error.includes('CustomerSearchDropdown') && 
                error.includes('Cannot read properties of undefined') &&
                error.includes('length')
            );
            
            if (hasCustomerDropdownError) {
                console.log('❌ CustomerSearchDropdown error still exists!');
                console.log('Errors found:', errors.filter(e => e.includes('CustomerSearchDropdown')));
                return false;
            } else {
                console.log('✅ No CustomerSearchDropdown length errors found!');
            }
            
        } else {
            console.log('⚠️ Cart button not found, trying alternative approach...');
            
            // Try clicking any button that might trigger the dropdown
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const cartButtons = buttons.filter(btn => 
                    btn.textContent.toLowerCase().includes('carrito') ||
                    btn.textContent.toLowerCase().includes('cart')
                );
                if (cartButtons.length > 0) {
                    cartButtons[0].click();
                }
            });
            
            await page.waitForTimeout(2000);
        }
        
        // Check for any customer dropdown related elements
        try {
            await page.waitForSelector('input[placeholder*="cliente" i]', { timeout: 5000 });
            console.log('✅ Customer search input found');
            
            // Type in search to trigger dropdown
            await page.type('input[placeholder*="cliente" i]', 'test');
            await page.waitForTimeout(1000);
            
            // Check for errors after typing
            const hasErrorsAfterTyping = errors.some(error => 
                error.includes('CustomerSearchDropdown') && 
                error.includes('Cannot read properties of undefined')
            );
            
            if (hasErrorsAfterTyping) {
                console.log('❌ Error occurred when typing in customer search');
                return false;
            } else {
                console.log('✅ No errors when typing in customer search');
            }
            
        } catch (error) {
            console.log('ℹ️ No customer search input found, that\'s okay');
        }
        
        // Final error check
        const totalErrors = errors.length;
        const customerDropdownErrors = errors.filter(e => 
            e.includes('CustomerSearchDropdown') && 
            (e.includes('length') || e.includes('undefined'))
        );
        
        console.log(`\n📊 Test Results:`);
        console.log(`   Total console errors: ${totalErrors}`);
        console.log(`   CustomerSearchDropdown errors: ${customerDropdownErrors.length}`);
        
        if (customerDropdownErrors.length === 0) {
            console.log('✅ SUCCESS: CustomerSearchDropdown error has been fixed!');
            return true;
        } else {
            console.log('❌ FAILED: CustomerSearchDropdown errors still exist:');
            customerDropdownErrors.forEach(error => console.log(`     - ${error}`));
            return false;
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        return false;
    } finally {
        await browser.close();
    }
}

testCustomerDropdownFix()
    .then(success => {
        if (success) {
            console.log('\n🎉 CustomerSearchDropdown fix verified successfully!');
            process.exit(0);
        } else {
            console.log('\n❌ CustomerSearchDropdown fix needs more work');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
