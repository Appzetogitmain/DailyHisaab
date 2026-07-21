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
    const total = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0");
    const d1 = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND last_login_date_time >= DATE_ADD(createtime, INTERVAL 1 DAY)");
    const d7 = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND last_login_date_time >= DATE_ADD(createtime, INTERVAL 7 DAY)");
    const d30 = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND last_login_date_time >= DATE_ADD(createtime, INTERVAL 30 DAY)");
    const churned = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND (last_login_date_time < DATE_SUB(NOW(), INTERVAL 30 DAY) OR last_login_date_time IS NULL)");

    console.log("=== Retention Raw Counts ===");
    console.log(`Total Active Users: ${total[0].count}`);
    console.log(`D1 Users (Logged in after 1 day): ${d1[0].count}`);
    console.log(`D7 Users (Logged in after 7 days): ${d7[0].count}`);
    console.log(`D30 Users (Logged in after 30 days): ${d30[0].count}`);
    console.log(`Churned Users (Inactive > 30 days): ${churned[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
