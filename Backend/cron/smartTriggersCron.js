import cron from 'node-cron';
import fetch from 'node-fetch';
// Note: Smart triggers controller functions are commented out until implemented
// import {
//   checkInactiveUsers,
//   sendFestivalGreetings,
//   checkFailedPayments,
//   checkLowEngagementUsers,
//   checkSubscriptionExpiry
// } from '../controller/smartTriggersController.js';

/**
 * Smart Triggers Cron Jobs
 * Automated notification triggers using node-cron
 */

// Run every day at 10:00 AM IST
// NOTE: Commented out until smartTriggersController.js is implemented
// cron.schedule('0 10 * * *', async () => {
//   console.log('🕙 Daily Smart Triggers - 10:00 AM IST');
//   await checkInactiveUsers();
//   await checkFailedPayments();
//   await checkSubscriptionExpiry();
// }, {
//   timezone: 'Asia/Kolkata'
// });

// Run every day at 9:00 AM IST for festival greetings
// cron.schedule('0 9 * * *', async () => {
//   console.log('🌅 Festival Greetings Check - 9:00 AM IST');
//   await sendFestivalGreetings();
// }, {
//   timezone: 'Asia/Kolkata'
// });

// Run every Monday at 11:00 AM IST for low engagement users
// cron.schedule('0 11 * * 1', async () => {
//   console.log('📊 Weekly Low Engagement Check - Monday 11:00 AM IST');
//   await checkLowEngagementUsers();
// }, {
//   timezone: 'Asia/Kolkata'
// });

// Run every hour to check for immediate triggers (failed payments, etc.)
// cron.schedule('0 * * * *', async () => {
//   console.log('⏰ Hourly Smart Triggers Check');
//   await checkFailedPayments();
// }, {
//   timezone: 'Asia/Kolkata'
// });

/**
 * Execute Recurring Payments Daily at Midnight
 * This ensures all due recurring payments are processed automatically
 */
const executeRecurringPaymentsTask = async () => {
  console.log('💳 Running Recurring Payments Execution');
  try {
    const port = process.env.PORT || 3000;
    // Always call local server for cron (avoid external DNS / old domain issues)
    const API_BASE_URL = `http://127.0.0.1:${port}/daliyhisab/server`;
    const API_KEY = process.env.RECURRING_PAYMENTS_API_KEY || 'recurring_payments_2024_secure_key_appzeto';

    const response = await fetch(`${API_BASE_URL}/execute_recurring_payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Recurring Payments Execution Completed`);
        console.log(`   📊 Executed: ${result.data.executed_count} payments`);
        if (result.data.errors && result.data.errors.length > 0) {
          console.warn(`   ⚠️  Errors: ${result.data.errors.length} payments failed`);
        }
      } else {
        console.error(`❌ Recurring Payments Execution Failed:`, result.msg);
      }
    } else {
      console.error(`❌ Recurring Payments API Error: Status ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Error executing recurring payments cron:', error.message);
  }
};

cron.schedule('*/5 * * * *', executeRecurringPaymentsTask, {
  timezone: 'Asia/Kolkata'
});

console.log('🚀 Recurring Payments Cron Job Started');
console.log('📅 Active Schedule:');
console.log('   ✅ Every 5 minutes: Execute recurring payments');
console.log('   ✅ On Server Startup: Execute recurring payments');
console.log('');
console.log('💡 Note: Other smart triggers cron jobs are commented out');
console.log('   until smartTriggersController.js is implemented.');
