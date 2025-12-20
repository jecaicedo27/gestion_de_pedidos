const { getExecutiveStats } = require('./controllers/adminController');
const { poolEnd } = require('./config/database');

const req = {};
const res = {
    json: (data) => {
        console.log('Response:', JSON.stringify(data, null, 2));
    },
    status: (code) => {
        console.log('Status:', code);
        return res;
    }
};

getExecutiveStats(req, res)
    .then(() => {
        console.log('Test completed');
    })
    .catch(err => {
        console.error('Test failed', err);
    })
    .finally(() => {
        poolEnd();
    });
