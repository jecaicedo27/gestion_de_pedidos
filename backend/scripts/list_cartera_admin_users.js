const { query, poolEnd } = require('../config/database');
(async () => {
  try {
    const rows = await query(
      "SELECT id, username, full_name, role FROM users WHERE role IN ('cartera','admin') AND (active=1 OR active IS NULL) ORDER BY FIELD(role,'cartera','admin'), id ASC LIMIT 20",
      []
    );
    console.log(rows);
  } catch (e) {
    console.error('Error:', e.message || e);
  } finally {
    await poolEnd();
  }
})();
