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
    // 1. Check if user matches 'all_users'
    const allUsers = await executeQuery(`
      SELECT COUNT(*) as count FROM user_device_tokens udt
      INNER JOIN user_master u ON udt.user_id = u.user_id
      WHERE u.delete_flag = 0 AND u.active_flag = 1
      AND udt.is_active = 1 AND u.user_id = 417
    `);
    
    // 2. Check if user matches 'free_users'
    const freeUsers = await executeQuery(`
      SELECT COUNT(*) as count FROM user_device_tokens udt
      INNER JOIN user_master u ON udt.user_id = u.user_id
      LEFT JOIN (
        SELECT usm1.user_id, sm1.subscription_type
        FROM user_subscription_master usm1
        JOIN subscription_master sm1 ON usm1.subscription_id = sm1.subscription_id
        WHERE usm1.delete_flag = 0 
        AND usm1.end_date >= CURDATE()
        AND usm1.user_subscription_id = (
          SELECT MAX(usm2.user_subscription_id)
          FROM user_subscription_master usm2
          WHERE usm2.user_id = usm1.user_id
          AND usm2.delete_flag = 0
          AND usm2.end_date >= CURDATE()
        )
      ) current_sub ON u.user_id = current_sub.user_id
      WHERE udt.is_active = 1 
      AND u.delete_flag = 0 
      AND u.active_flag = 1
      AND (current_sub.user_id IS NULL OR current_sub.subscription_type = 0 OR current_sub.subscription_type IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM user_subscription_master usm2
        JOIN subscription_master sm2 ON usm2.subscription_id = sm2.subscription_id
        WHERE usm2.user_id = u.user_id
        AND usm2.end_date < CURDATE()
        AND usm2.delete_flag = 0
        AND sm2.subscription_type != 0
        AND sm2.subscription_type IS NOT NULL
      )
      AND u.user_id = 417
    `);

    // 3. Check if user matches 'expired_users'
    const expiredUsers = await executeQuery(`
      SELECT COUNT(*) as count FROM user_device_tokens udt
      INNER JOIN user_master u ON udt.user_id = u.user_id
      LEFT JOIN (
        SELECT usm1.user_id
        FROM user_subscription_master usm1
        JOIN subscription_master sm1 ON usm1.subscription_id = sm1.subscription_id
        WHERE usm1.delete_flag = 0 
        AND usm1.end_date >= CURDATE()
        AND sm1.subscription_type != 0
        AND sm1.subscription_type IS NOT NULL
      ) active_sub ON u.user_id = active_sub.user_id
      WHERE udt.is_active = 1 
      AND u.delete_flag = 0 
      AND u.active_flag = 1
      AND active_sub.user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_subscription_master usm2
        JOIN subscription_master sm2 ON usm2.subscription_id = sm2.subscription_id
        WHERE usm2.user_id = u.user_id
        AND usm2.end_date < CURDATE()
        AND usm2.delete_flag = 0
        AND sm2.subscription_type != 0
        AND sm2.subscription_type IS NOT NULL
      )
      AND u.user_id = 417
    `);

    console.log("=== User 417 Audience Matching ===");
    console.log(`Matches 'all_users': ${allUsers[0].count > 0 ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Matches 'free_users': ${freeUsers[0].count > 0 ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Matches 'expired_users': ${expiredUsers[0].count > 0 ? 'YES ✅' : 'NO ❌'}`);

    // Let's check subscription_type for user 417
    const planDetails = await executeQuery(`
      SELECT usm.user_subscription_id, sm.subscription_id, sm.subscription_type, sm.description
      FROM user_subscription_master usm
      JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
      WHERE usm.user_id = 417
    `);
    console.log("\n=== User 417 Subscription Details ===");
    console.table(planDetails);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
