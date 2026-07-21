import connection from '../connection/dbConfig.js';

const executeQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

async function run() {
  try {
    const installs = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0");
    const active = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND active_flag = 1");
    const paid = await executeQuery(`
      SELECT COUNT(DISTINCT us.user_id) as count 
      FROM user_subscription_master us
      JOIN subscription_master s ON us.subscription_id = s.subscription_id
      WHERE us.delete_flag = 0 
      AND s.delete_flag = 0
      AND s.subscription_type > 0
      AND us.end_date >= CURDATE()
    `);
    const free = await executeQuery(`
      SELECT COUNT(DISTINCT u.user_id) as count
      FROM user_master u
      LEFT JOIN (
        SELECT DISTINCT us.user_id
        FROM user_subscription_master us
        JOIN subscription_master s ON us.subscription_id = s.subscription_id
        WHERE us.delete_flag = 0 
        AND s.delete_flag = 0
        AND s.subscription_type > 0
        AND us.end_date >= CURDATE()
      ) paid_users ON u.user_id = paid_users.user_id
      WHERE u.delete_flag = 0 
      AND u.active_flag = 1
      AND paid_users.user_id IS NULL
    `);

    console.log("=== Conversion Funnel Diagnostic Output ===");
    console.log(`Installs : ${installs[0].count}`);
    console.log(`Active   : ${active[0].count}`);
    console.log(`Free     : ${free[0].count}`);
    console.log(`Paid     : ${paid[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
