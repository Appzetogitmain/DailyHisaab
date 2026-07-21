/**
 * Recurring Payments Execution Script
 * This script should be run daily via cron job to execute due recurring payments
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.RECURRING_PAYMENTS_API_KEY || 'recurring_payments_2024';

/**
 * Execute recurring payments
 */
async function executeRecurringPayments() {
  try {
    console.log(`[${new Date().toISOString()}] Starting recurring payments execution...`);

    const response = await fetch(`${API_BASE_URL}/daliyhisab/server/execute_recurring_payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log(`[${new Date().toISOString()}] Successfully executed ${result.data.executed_count} recurring payments`);

      if (result.data.executed_payments && result.data.executed_payments.length > 0) {
        console.log('Executed payments:');
        result.data.executed_payments.forEach(payment => {
          console.log(`  - ${payment.payment_type}: ₹${payment.amount} (${payment.note})`);
        });
      }

      if (result.data.errors && result.data.errors.length > 0) {
        console.log('Errors encountered:');
        result.data.errors.forEach(error => {
          console.log(`  - ID ${error.id}: ${error.error}`);
        });
      }
    } else {
      console.error(`[${new Date().toISOString()}] Failed to execute recurring payments:`, result.msg);
    }

  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error executing recurring payments:`, error.message);
    process.exit(1);
  }
}

// Run the script
executeRecurringPayments();
