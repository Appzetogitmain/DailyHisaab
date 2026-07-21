import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';

const mobile = process.argv[2];

if (!mobile) {
  console.log('\n❌ Please provide a mobile number!');
  console.log('Usage: node scripts/checkUser.js <mobile_number>\n');
  process.exit(1);
}

const executeQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

async function checkUser() {
  try {
    const users = await executeQuery(`
      SELECT 
        um.user_id,
        um.name,
        um.mobile,
        um.phone_code,
        COALESCE(um.language_code, 'en') as language,
        um.active_flag,
        um.createtime
      FROM user_master um
      WHERE um.mobile = ? AND um.delete_flag = 0
    `, [mobile]);

    if (users.length === 0) {
      console.log(`\n❌ No active user found with mobile number: ${mobile}\n`);
      process.exit(0);
    }

    const user = users[0];
    
    // Get their subscription info
    const subs = await executeQuery(`
      SELECT 
        usm.user_subscription_id,
        sm.description as plan_name,
        sm.subscription_type,
        usm.start_date,
        usm.end_date,
        CASE 
          WHEN usm.end_date > NOW() THEN 'Active'
          ELSE 'Expired'
        END as status
      FROM user_subscription_master usm
      JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
      WHERE usm.user_id = ? AND usm.delete_flag = 0
      ORDER BY usm.user_subscription_id DESC
      LIMIT 1
    `, [user.user_id]);

    const activePlan = subs.length > 0 ? `${subs[0].plan_name} (${subs[0].status})` : 'No Subscription';

    console.log(`\n=== User Profile Details: ${user.mobile} ===`);
    console.table([
      { Field: 'User ID', Value: user.user_id },
      { Field: 'Name', Value: user.name || 'Unknown' },
      { Field: 'Mobile', Value: `${user.phone_code} ${user.mobile}` },
      { Field: 'Selected Language', Value: user.language.toUpperCase() === 'HI' ? 'Hindi 🇮🇳 (hi)' : user.language.toUpperCase() === 'MR' ? 'Marathi 🚩 (mr)' : 'English 🇬🇧 (en)' },
      { Field: 'Account Status', Value: user.active_flag === 1 ? 'Active ✅' : 'Suspended ❌' },
      { Field: 'Registration Date', Value: moment(user.createtime).format('DD MMMM, YYYY') },
      { Field: 'Current Subscription', Value: activePlan }
    ]);
    console.log('\n');

  } catch (err) {
    console.error('\n❌ Error inspecting user:', err.message);
  } finally {
    process.exit(0);
  }
}

checkUser();
