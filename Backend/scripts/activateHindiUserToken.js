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
    const result = await executeQuery("UPDATE user_device_tokens SET is_active = 1 WHERE user_id = 417");
    console.log("=== Activation Result ===");
    console.log(`Rows affected: ${result.affectedRows}`);
    
    // Check it
    const tokens = await executeQuery("SELECT * FROM user_device_tokens WHERE user_id = 417");
    console.log("=== Updated Tokens for User 417 ===");
    console.table(tokens);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
