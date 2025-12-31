
const controller = require('./controllers/financialController');

(async () => {
    try {
        const req = {
            query: {
                startDate: '2025-12-26',
                endDate: '2025-12-30'
            }
        };

        const res = {
            jsonData: null,
            status: function (code) {
                console.log(`Status set to: ${code}`);
                return this;
            },
            json: function (data) {
                this.jsonData = data;
                console.log('JSON response received.');
            }
        };

        console.log('Testing getSiigoIncome (26-30 Dec)...');
        await controller.getSiigoIncome(req, res);

        const data = res.jsonData;
        if (data) {
            console.log('Success:', data.success);
            console.log('Range:', data.range);
            console.log('Total Income:', data.total);
            console.log('Breakdown:', data.byAccount);
            console.log('Detail Count:', data.details?.length);
            if (data.details?.length > 0) {
                console.log('First Item:', data.details[0]);
            }
        } else {
            console.error('No data received in response.');
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
