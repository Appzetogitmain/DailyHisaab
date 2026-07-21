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
    const activeFlag = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND active_flag = 1");
    const hasLogin = await executeQuery("SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0 AND last_login_date_time IS NOT NULL");

    console.log("=== Active User Definitions ===");
    console.log(`Total Installs: ${total[0].count}`);
    console.log(`Active Flag = 1: ${activeFlag[0].count}`);
    console.log(`Has Last Login DateTime: ${hasLogin[0].count}`);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
