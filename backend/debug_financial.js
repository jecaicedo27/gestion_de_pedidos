
const { query } = require('./config/database');
const financialController = require('./controllers/financialController');

// Mock req and res
const req = { query: {} };
const res = {
    json: (data) => {
        console.log('--- RESPONSE DATA ---');
        if (data.success) {
            const history = data.data;
            console.log(`Total Records: ${history.length}`);
            if (history.length > 0) {
                const last = history[history.length - 1];
                const prev = history.length > 1 ? history[history.length - 2] : null;

                console.log('LAST RECORD (Should be Today):');
                console.log(JSON.stringify(last, null, 2));

                if (prev) {
                    console.log('PREVIOUS RECORD:');
                    console.log(JSON.stringify(prev, null, 2));
                }

                // Debug Date calculations
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                console.log('Server Calculated Today (Bogota):', today);

                const lastDate = new Date(last.date).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
                console.log('Last Record Date Parsed (Bogota):', lastDate);

                console.log('Match?', lastDate >= today);
            }
        } else {
            console.log('Error:', data.message);
        }
    },
    status: (code) => {
        console.log('Status Code:', code);
        return { json: (d) => console.log('Error Data:', d) };
    }
};

(async () => {
    try {
        console.log('Running getEquityHistory...');
        await financialController.getEquityHistory(req, res);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
