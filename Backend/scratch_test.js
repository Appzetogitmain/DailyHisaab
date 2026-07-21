import connection from './connection/dbConfig.js';
import moment from 'moment-timezone';

console.log('=== User Subscription Statistics Diagnosis ===\n');

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
    // 1. Update user language to Hindi (hi) for mobile 6268204871
    console.log('Updating user with mobile 6268204871 to Hindi...');
    const updateRes = await executeQuery(`
      UPDATE user_master 
      SET language_code = 'hi', updatetime = NOW() 
      WHERE mobile = '6268204871'
    `);
    console.log('Update result:', updateRes);

    // 2. Query and verify updated user
    const userRes = await executeQuery(`
      SELECT user_id, name, mobile, language_code 
      FROM user_master 
      WHERE mobile = '6268204871'
    `);
    console.log('\n=== Updated User Details ===');
    console.table(userRes);

    // Check if test user has device tokens
    const userTokens = await executeQuery(`
      SELECT user_id, fcm_token, device_type, is_active 
      FROM user_device_tokens 
      WHERE user_id = 417
    `);
    console.log('\n=== Test User Device Tokens ===');
    console.table(userTokens);

    // Check languages in system
    const masterLangs = await executeQuery("SELECT * FROM language_master");
    console.log('\n=== Registered Languages in System ===');
    console.table(masterLangs);

    // Check notification campaigns
    const campaignRes = await executeQuery(`
      SELECT campaign_id, title, target_audience, target_language, status 
      FROM notification_campaigns
      LIMIT 10
    `);
    console.log('\n=== Notification Campaigns (First 10) ===');
    console.table(campaignRes);

    // Check user language distribution
    const langRes = await executeQuery(`
      SELECT COALESCE(language_code, 'en') as lang, COUNT(*) as count 
      FROM user_master 
      WHERE delete_flag = 0 
      GROUP BY COALESCE(language_code, 'en')
    `);
    console.log('\n=== User Language Distribution ===');
    console.table(langRes);

    // Check device tokens
    const tokenRes = await executeQuery(`
      SELECT 
        COUNT(*) as total_tokens,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_tokens,
        COUNT(DISTINCT user_id) as distinct_users_with_tokens,
        COUNT(DISTINCT CASE WHEN is_active = 1 THEN user_id END) as distinct_users_with_active_tokens
      FROM user_device_tokens
    `);
    console.log('\n=== Device Tokens Statistics ===');
    console.table(tokenRes);

    // 1. Total Users
    const totalRes = await executeQuery(
      "SELECT COUNT(*) as count FROM user_master WHERE delete_flag = 0"
    );
    const totalUsers = totalRes[0].count;

    // 2. Paid Users (Active sub with type != 0)
    const paidRes = await executeQuery(`
      SELECT COUNT(DISTINCT u.user_id) as count 
      FROM user_master u
      JOIN user_subscription_master usm ON u.user_id = usm.user_id
      JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
      WHERE u.delete_flag = 0 
        AND usm.end_date > NOW() 
        AND usm.delete_flag = 0 
        AND sm.subscription_type != 0
    `);
    const paidUsers = paidRes[0].count;

    // 3. Expired Users (No active sub, but has expired sub in history)
    const expiredRes = await executeQuery(`
      SELECT COUNT(DISTINCT u.user_id) as count 
      FROM user_master u
      WHERE u.delete_flag = 0 
        AND NOT EXISTS (
          SELECT 1 FROM user_subscription_master usm 
          WHERE usm.user_id = u.user_id AND usm.end_date > NOW() AND usm.delete_flag = 0
        )
        AND EXISTS (
          SELECT 1 FROM user_subscription_master usm2 
          WHERE usm2.user_id = u.user_id AND usm2.end_date <= NOW() AND usm2.delete_flag = 0
        )
    `);
    const expiredUsers = expiredRes[0].count;

    // 4. Free Users (No active sub AND no history of subscription, or active sub is type = 0)
    const freeRes = await executeQuery(`
      SELECT COUNT(DISTINCT u.user_id) as count 
      FROM user_master u
      LEFT JOIN (
        SELECT usm.user_id, MAX(usm.user_subscription_id) as user_subscription_id, MAX(sm.subscription_type) as subscription_type
        FROM user_subscription_master usm
        JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
        WHERE usm.end_date > NOW() AND usm.delete_flag = 0
        GROUP BY usm.user_id
      ) active_sub ON u.user_id = active_sub.user_id
      WHERE u.delete_flag = 0
        -- Exclude active paid users
        AND (active_sub.subscription_type IS NULL OR active_sub.subscription_type = 0)
        -- Exclude expired users
        AND NOT EXISTS (
          SELECT 1 FROM user_subscription_master usm2
          WHERE usm2.user_id = u.user_id AND usm2.end_date <= NOW() AND usm2.delete_flag = 0
        )
    `);
    const freeUsers = freeRes[0].count;

    console.log(`\nDiagnostic Results (Time: ${moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}):`);
    console.table([
      { Metric: 'Total Users (Active)', Count: totalUsers },
      { Metric: 'Paid Users (Active subscription > 0)', Count: paidUsers },
      { Metric: 'Expired Users (Past subscription only)', Count: expiredUsers },
      { Metric: 'Free Users (Never subscribed / Trial active)', Count: freeUsers },
      { Metric: 'Sum of parts (Paid + Expired + Free)', Count: paidUsers + expiredUsers + freeUsers }
    ]);

    if (totalUsers !== (paidUsers + expiredUsers + freeUsers)) {
      console.log('⚠️ Note: There is a discrepancy between Total Users and the sum. Let\'s check users with active trial/special plan.');

      const trialRes = await executeQuery(`
        SELECT COUNT(DISTINCT u.user_id) as count 
        FROM user_master u
        JOIN user_subscription_master usm ON u.user_id = usm.user_id
        JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
        WHERE u.delete_flag = 0 
          AND usm.end_date > NOW() 
          AND usm.delete_flag = 0 
          AND sm.subscription_type = 0
      `);
      console.log('Active Trial / Special Plan (Type 0) Users:', trialRes[0].count);
    }

  } catch (err) {
    console.error('❌ Error executing diagnosis:', err.message);
  } finally {
    process.exit(0);
  }
}

run();
