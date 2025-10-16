const { query } = require('./backend/config/database');

async function fixChatGPTForeignKeyConstraint() {
    try {
        console.log('🔧 Fixing ChatGPT processing log foreign key constraint...');

        // 1. Drop the existing foreign key constraint
        console.log('🗑️ Dropping existing foreign key constraint...');
        await query(`
            ALTER TABLE chatgpt_processing_log 
            DROP FOREIGN KEY chatgpt_processing_log_ibfk_1
        `);

        // 2. Make quotation_id nullable
        console.log('📝 Making quotation_id column nullable...');
        await query(`
            ALTER TABLE chatgpt_processing_log 
            MODIFY COLUMN quotation_id INT NULL
        `);

        // 3. Add a new foreign key constraint that allows NULL values
        console.log('🔗 Adding new foreign key constraint with NULL support...');
        await query(`
            ALTER TABLE chatgpt_processing_log 
            ADD CONSTRAINT chatgpt_processing_log_ibfk_1 
            FOREIGN KEY (quotation_id) REFERENCES quotations(id) 
            ON DELETE SET NULL ON UPDATE CASCADE
        `);

        // 4. Clean up any existing invalid records
        console.log('🧹 Cleaning up invalid records...');
        const invalidRecords = await query(`
            SELECT COUNT(*) as count
            FROM chatgpt_processing_log cpl
            LEFT JOIN quotations q ON cpl.quotation_id = q.id
            WHERE cpl.quotation_id IS NOT NULL AND q.id IS NULL
        `);

        if (invalidRecords[0].count > 0) {
            console.log(`🗑️ Found ${invalidRecords[0].count} invalid records, cleaning up...`);
            await query(`
                UPDATE chatgpt_processing_log cpl
                LEFT JOIN quotations q ON cpl.quotation_id = q.id
                SET cpl.quotation_id = NULL
                WHERE cpl.quotation_id IS NOT NULL AND q.id IS NULL
            `);
        }

        // 5. Add an index for better performance
        console.log('⚡ Adding index for better performance...');
        await query(`
            CREATE INDEX IF NOT EXISTS idx_chatgpt_quotation_id 
            ON chatgpt_processing_log(quotation_id)
        `);

        // 6. Add processing session ID for better tracking
        console.log('📊 Adding processing session ID column...');
        try {
            await query(`
                ALTER TABLE chatgpt_processing_log 
                ADD COLUMN processing_session_id VARCHAR(100) NULL AFTER quotation_id
            `);
            console.log('✅ Processing session ID column added');
        } catch (error) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ Processing session ID column already exists');
            } else {
                throw error;
            }
        }

        // 7. Add request_source column for tracking where the request came from
        console.log('📍 Adding request source column...');
        try {
            await query(`
                ALTER TABLE chatgpt_processing_log 
                ADD COLUMN request_source VARCHAR(50) DEFAULT 'api' AFTER processing_session_id
            `);
            console.log('✅ Request source column added');
        } catch (error) {
            if (error.message.includes('Duplicate column name')) {
                console.log('ℹ️ Request source column already exists');
            } else {
                throw error;
            }
        }

        console.log('✅ ChatGPT foreign key constraint fixed successfully!');
        console.log('');
        console.log('📋 Summary of changes:');
        console.log('   • quotation_id is now nullable');
        console.log('   • Foreign key constraint allows NULL values');
        console.log('   • Invalid records cleaned up');
        console.log('   • Performance index added');
        console.log('   • Processing session tracking added');
        console.log('   • Request source tracking added');
        
        return { success: true };
    } catch (error) {
        console.error('❌ Error fixing ChatGPT foreign key constraint:', error);
        return { success: false, error: error.message };
    }
}

// Execute the fix
fixChatGPTForeignKeyConstraint()
    .then(result => {
        if (result.success) {
            console.log('🎉 Foreign key constraint fix completed successfully!');
            process.exit(0);
        } else {
            console.error('💥 Fix failed:', result.error);
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
