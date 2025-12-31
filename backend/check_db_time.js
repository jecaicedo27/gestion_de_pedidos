
const { query } = require('./config/database');

(async () => {
    try {
        const result = await query("SELECT NOW() as db_now, CURDATE() as db_date, @@global.time_zone, @@session.time_zone");
        console.log('DB Time Info:', result[0]);

        const jsDate = new Date();
        console.log('JS UTC:', jsDate.toISOString());
        console.log('JS Local (Container):', jsDate.toString());
        console.log('JS Bogota:', jsDate.toLocaleString('en-US', { timeZone: 'America/Bogota' }));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
