import moment from 'moment-timezone';
import connection from '../connection/dbConfig.js';
import languageMessage from './languageMessage.js';
import { Parser } from 'json2csv';
import fetch from 'node-fetch';

/**
 * Helper function to calculate the next execution date based on frequency
 */
const calculateNextExecutionDate = (frequency, startDate, executionCount) => {
  const start = moment(startDate);

  switch (frequency) {
    case 'daily':
      return start.add(executionCount, 'days').format('YYYY-MM-DD');
    case 'weekly':
      return start.add(executionCount, 'weeks').format('YYYY-MM-DD');
    case 'monthly':
      return start.add(executionCount, 'months').format('YYYY-MM-DD');
    default:
      return moment(startDate).format('YYYY-MM-DD');
  }
};

/**
 * Create Recurring Payment
 * Creates a new recurring payment configuration
 */
const createRecurringPayment = async (request, response) => {
  const {
    user_id,
    account_id,
    payment_type,
    amount,
    category_id,
    frequency,
    start_date,
    total_occurrences,
    note,
    payment_name
  } = request.body;

  try {
    // Validate required fields
    if (!user_id || !account_id || !payment_type || !amount || !category_id || !frequency || !start_date) {
      return response.status(200).json({
        success: false,
        msg: ['All required fields must be provided', 'सभी आवश्यक फ़ील्ड प्रदान किए जाने चाहिए', 'सर्व आवश्यक फील्ड प्रदान केले जावे'],
        key: "user_id, account_id, payment_type, amount, category_id, frequency, start_date"
      });
    }

    // Validate payment_type
    if (!['income', 'expense'].includes(payment_type)) {
      return response.status(200).json({
        success: false,
        msg: ['payment_type must be "income" or "expense"', 'payment_type "income" या "expense" होना चाहिए', 'payment_type "income" किंवा "expense" असणे आवश्यक आहे'],
        key: "payment_type"
      });
    }

    // Validate frequency
    if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
      return response.status(200).json({
        success: false,
        msg: ['frequency must be "daily", "weekly", or "monthly"', 'frequency "daily", "weekly", या "monthly" होना चाहिए', 'frequency "daily", "weekly", किंवा "monthly" असणे आवश्यक आहे'],
        key: "frequency"
      });
    }

    // Validate amount
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return response.status(200).json({
        success: false,
        msg: ['Amount must be a positive number', 'राशि एक सकारात्मक संख्या होनी चाहिए', 'रक्कम सकारात्मक संख्या असणे आवश्यक आहे'],
        key: "amount"
      });
    }

    // Validate start_date
    const startDate = moment(start_date);
    if (!startDate.isValid()) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid start_date format', 'अमान्य start_date प्रारूप', 'अवैध start_date स्वरूप'],
        key: "start_date"
      });
    }

    // Calculate next execution date strictly based on start_date
    let nextExecutionDate = startDate.format('YYYY-MM-DD');
    const today = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD');

    // We will let the execution process handle all backfilling or immediate execution.
    // The execute_recurring_payments will be pinged instantly after creation to process anything due today or in the past.
    let executeImmediately = false;

    // Calculate end_date if total_occurrences is provided
    let endDate = null;
    if (total_occurrences && total_occurrences > 0) {
      let tempDate = moment(startDate);
      if (frequency === 'daily') {
        endDate = tempDate.add(total_occurrences - 1, 'days').format('YYYY-MM-DD');
      } else if (frequency === 'weekly') {
        endDate = tempDate.add(total_occurrences - 1, 'weeks').format('YYYY-MM-DD');
      } else if (frequency === 'monthly') {
        endDate = tempDate.add(total_occurrences - 1, 'months').format('YYYY-MM-DD');
      }
    }

    const createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Insert recurring payment
    const insertQuery = `
            INSERT INTO recurring_payments 
            (user_id, account_id, payment_type, amount, category_id, frequency, start_date, total_occurrences, note, payment_name, next_execution_date, execution_count, last_executed_date, createtime, updatetime) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    const insertValues = [
      user_id, account_id, payment_type, amount, category_id, frequency,
      start_date, total_occurrences, note, payment_name || null, nextExecutionDate,
      executeImmediately ? 1 : 0, executeImmediately ? today : null, createtime, createtime
    ];

    connection.query(insertQuery, insertValues, async (insertErr, insertResult) => {
      if (insertErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: insertErr.message
        });
      }

      const recurringPaymentId = insertResult.insertId;

      // Ping the recurring payments execution API asynchronously so that if the 
      // start_date is <= today, it instantly executes and catches up transactions.
      if (startDate.isSameOrBefore(moment(today))) {
        try {
          const port = process.env.PORT || 3000;
          const API_KEY = process.env.RECURRING_PAYMENTS_API_KEY || 'recurring_payments_2024_secure_key_appzeto';
          fetch(`https://appzetoapp.com/daliyhisab/server/execute_recurring_payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
            body: JSON.stringify({})
          }).catch(err => console.error('Immediate execution trigger error:', err));
        } catch (e) {
          console.error('Failed to dispatch execution trigger', e);
        }
      }

      return response.status(200).json({
        success: true,
        msg: ['Recurring payment created successfully', 'आवर्ती भुगतान सफलतापूर्वक बनाया गया', 'आवर्ती पेमेंट यशस्वीरित्या तयार केले'],
        data: {
          id: recurringPaymentId,
          user_id: user_id,
          account_id: account_id,
          payment_type: payment_type,
          amount: parseFloat(amount),
          category_id: category_id,
          frequency: frequency,
          start_date: start_date,
          total_occurrences: total_occurrences,
          note: note,
          payment_name: payment_name || null,
          next_execution_date: nextExecutionDate,
          executed_immediately: executeImmediately,
          created_at: createtime
        }
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Get All Recurring Payments
 * Retrieves all recurring payments for a user
 */
const getAllRecurringPayments = async (request, response) => {
  const { user_id, account_id } = request.query;

  try {
    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['user_id is required', 'user_id आवश्यक है', 'user_id आवश्यक आहे'],
        key: "user_id"
      });
    }

    let query = `
            SELECT rp.*, 
                   cm.category_name,
                   uam.account_name,
                   um.name as user_name
            FROM recurring_payments rp
            LEFT JOIN category_master cm ON rp.category_id = cm.category_id
            LEFT JOIN user_account_master uam ON rp.account_id = uam.user_account_id
            LEFT JOIN user_master um ON rp.user_id = um.user_id
            WHERE rp.user_id = ? AND rp.delete_flag = 0
        `;

    const params = [user_id];

    if (account_id) {
      query += ` AND rp.account_id = ?`;
      params.push(account_id);
    }

    query += ` ORDER BY rp.next_execution_date ASC`;

    connection.query(query, params, (err, results) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const recurringPayments = results.map(row => ({
        id: row.id,
        user_id: row.user_id,
        account_id: row.account_id,
        account_name: row.account_name,
        payment_type: row.payment_type,
        amount: parseFloat(row.amount),
        category_id: row.category_id,
        category_name: row.category_name,
        frequency: row.frequency,
        start_date: row.start_date ? moment(row.start_date).format('YYYY-MM-DD') : null,
        total_occurrences: row.total_occurrences,
        executed_count: row.execution_count,
        remaining_occurrences: row.total_occurrences ? row.total_occurrences - row.execution_count : null,
        note: row.note,
        payment_name: row.payment_name || null,
        status: row.status,
        last_executed_date: row.last_executed_date ? moment(row.last_executed_date).format('YYYY-MM-DD') : null,
        next_execution_date: row.next_execution_date ? moment(row.next_execution_date).format('YYYY-MM-DD') : null,
        created_at: moment(row.createtime).format('DD MMM, YYYY HH:mm A'),
        updated_at: moment(row.updatetime).format('DD MMM, YYYY HH:mm A')
      }));

      return response.status(200).json({
        success: true,
        msg: languageMessage.msgDataFound || ['Data found successfully', 'डेटा सफलतापूर्वक मिला', 'डेटा यशस्वीरित्या सापडले'],
        data: {
          recurring_payments: recurringPayments.length > 0 ? recurringPayments : [],
          total_count: recurringPayments.length
        }
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Execute Recurring Payments
 * Processes all due recurring payments and creates income/expense entries
 * This endpoint can be called without authentication for system automation
 */
const executeRecurringPayments = async (request, response) => {
  try {
    // Simple security check - verify API key for system automation
    const apiKey = request.headers['x-api-key'] || request.body.api_key;
    const expectedApiKey = process.env.RECURRING_PAYMENTS_API_KEY || 'recurring_payments_2024_secure_key_appzeto';

    if (apiKey !== expectedApiKey) {
      return response.status(200).json({
        success: false,
        msg: ['Unauthorized access', 'अनधिकृत पहुंच', 'अनधिकृत प्रवेश'],
        key: "unauthorized"
      });
    }

    const today = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD');

    // Get all active recurring payments that are due today
    const query = `
            SELECT * FROM recurring_payments 
            WHERE status = 'active' 
            AND delete_flag = 0 
            AND next_execution_date <= ?
            AND (total_occurrences IS NULL OR execution_count < total_occurrences)
        `;

    connection.query(query, [today], async (err, results) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const executedPayments = [];
      const errors = [];

      for (const recurringPayment of results) {
        try {
          // Wrap each ongoing payment processing in a database transaction to prevent duplicate entries on failure
          await new Promise((resolve, reject) => {
            connection.beginTransaction(err => {
              if (err) reject(err);
              else resolve();
            });
          });

          let currentNextDate = moment(recurringPayment.next_execution_date).format('YYYY-MM-DD');
          let currentExecutionCount = recurringPayment.execution_count;
          let occurrencesExecuted = 0;

          // Catch-up logic: Loop through all missed occurrences until today
          while (currentNextDate <= today && (recurringPayment.total_occurrences === null || currentExecutionCount < recurringPayment.total_occurrences)) {
            // Create income/expense entry
            const type = recurringPayment.payment_type === 'income' ? 2 : 1; // 1=Expense, 2=Income
            const note = `${recurringPayment.note || recurringPayment.payment_name || 'Recurring Payment'} (Recurring - ${recurringPayment.frequency})`;

            // For backfilled entries, use the theoretical execution date as transaction date
            const theoreticalTime = moment(currentNextDate).tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
            const creationTime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

            const insertQuery = `
                          INSERT INTO expense_income_master 
                          (account_id, user_id, type, amount, category_id, note, receivable_payable, transaction_date, delete_flag, createtime, updatetime) 
                          VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)
                      `;

            const insertValues = [
              recurringPayment.account_id,
              recurringPayment.user_id,
              type,
              recurringPayment.amount,
              recurringPayment.category_id,
              note,
              theoreticalTime,
              creationTime,
              creationTime
            ];

            // Execute the insert
            const insertResult = await new Promise((resolve, reject) => {
              connection.query(insertQuery, insertValues, (insertErr, insertRes) => {
                if (insertErr) reject(insertErr);
                else resolve(insertRes);
              });
            });

            // Log the execution
            const logQuery = `
                          INSERT INTO recurring_payment_executions 
                          (recurring_payment_id, expense_income_id, execution_date, status) 
                          VALUES (?, ?, ?, 'success')
                      `;

            await new Promise((resolve, reject) => {
              connection.query(logQuery, [
                recurringPayment.id,
                insertResult.insertId,
                currentNextDate
              ], (logErr, logRes) => {
                if (logErr) reject(logErr);
                else resolve(logRes);
              });
            });

            occurrencesExecuted++;
            currentExecutionCount++;
            currentNextDate = calculateNextExecutionDate(recurringPayment.frequency, recurringPayment.start_date, currentExecutionCount);
          }

          if (occurrencesExecuted > 0) {
            let newStatus = recurringPayment.status;
            // IMPORTANT: Flag completed once we hit total occurrences to avoid permanent 'active' status
            if (recurringPayment.total_occurrences !== null && currentExecutionCount >= recurringPayment.total_occurrences) {
              newStatus = 'completed';
            }

            // Update recurring payment with the new next_execution_date, updated execution_count, and status
            const updateQuery = `
                          UPDATE recurring_payments 
                          SET execution_count = ?,
                              last_executed_date = ?,
                              next_execution_date = ?,
                              status = ?,
                              updatetime = NOW()
                          WHERE id = ?
                      `;

            await new Promise((resolve, reject) => {
              connection.query(updateQuery, [
                currentExecutionCount,
                today,
                currentNextDate,
                newStatus,
                recurringPayment.id
              ], (updateErr, updateRes) => {
                if (updateErr) reject(updateErr);
                else resolve(updateRes);
              });
            });

            executedPayments.push({
              id: recurringPayment.id,
              payment_type: recurringPayment.payment_type,
              amount: parseFloat(recurringPayment.amount),
              note: recurringPayment.note,
              executions_count: occurrencesExecuted,
              last_execution_date: today,
              status: newStatus
            });
          }

          // Commit transaction
          await new Promise((resolve, reject) => {
            connection.commit(err => {
              if (err) reject(err);
              else resolve();
            });
          });
        } catch (error) {
          // Rollback on any failure
          await new Promise(resolve => connection.rollback(() => resolve()));
          
          errors.push({
            id: recurringPayment.id,
            error: error.message
          });
        }
      }

      return response.status(200).json({
        success: true,
        msg: ['Recurring payments executed successfully', 'आवर्ती भुगतान सफलतापूर्वक निष्पादित', 'आवर्ती पेमेंट यशस्वीरित्या कार्यान्वित'],
        data: {
          executed_count: executedPayments.length,
          executed_payments: executedPayments,
          errors: errors.length > 0 ? errors : null,
          execution_date: today
        }
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Calculate Next Execution Date
 * Helper function to calculate the next execution date based on frequency
 */

/**
 * Update Recurring Payment
 * Updates an existing recurring payment configuration
 */
const updateRecurringPayment = async (request, response) => {
  const {
    id,
    user_id,
    account_id,
    payment_type,
    amount,
    category_id,
    frequency,
    start_date,
    total_occurrences,
    note,
    status,
    payment_name
  } = request.body;

  try {
    // Validate required fields
    if (!id || !user_id) {
      return response.status(200).json({
        success: false,
        msg: ['id and user_id are required', 'id और user_id आवश्यक हैं', 'id आणि user_id आवश्यक आहेत'],
        key: "id, user_id"
      });
    }

    // Build update query dynamically
    let updateFields = [];
    let updateValues = [];

    if (account_id !== undefined) {
      updateFields.push('account_id = ?');
      updateValues.push(account_id);
    }
    if (payment_type !== undefined) {
      updateFields.push('payment_type = ?');
      updateValues.push(payment_type);
    }
    if (amount !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(amount);
    }
    if (category_id !== undefined) {
      updateFields.push('category_id = ?');
      updateValues.push(category_id);
    }
    if (frequency !== undefined) {
      updateFields.push('frequency = ?');
      updateValues.push(frequency);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
    }
    if (total_occurrences !== undefined) {
      updateFields.push('total_occurrences = ?');
      updateValues.push(total_occurrences);
    }
    if (note !== undefined) {
      updateFields.push('note = ?');
      updateValues.push(note);
    }
    if (payment_name !== undefined) {
      updateFields.push('payment_name = ?');
      updateValues.push(payment_name);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      return response.status(200).json({
        success: false,
        msg: ['No fields to update', 'अपडेट करने के लिए कोई फ़ील्ड नहीं', 'अपडेट करण्यासाठी कोणतेही फील्ड नाही'],
        key: "no_fields"
      });
    }

    updateFields.push('updatetime = NOW()');
    updateValues.push(id, user_id);

    const updateQuery = `
            UPDATE recurring_payments 
            SET ${updateFields.join(', ')}
            WHERE id = ? AND user_id = ? AND delete_flag = 0
        `;

    connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
      if (updateErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: updateErr.message
        });
      }

      if (updateResult.affectedRows === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Recurring payment not found or access denied', 'आवर्ती भुगतान नहीं मिला या पहुंच अस्वीकृत', 'आवर्ती पेमेंट सापडले नाही किंवा प्रवेश नाकारले'],
          key: "not_found"
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Recurring payment updated successfully', 'आवर्ती भुगतान सफलतापूर्वक अपडेट', 'आवर्ती पेमेंट यशस्वीरित्या अपडेट'],
        data: {
          id: id,
          updated_fields: updateFields.length - 1, // Exclude updatetime
          updated_at: moment().format('DD MMM, YYYY HH:mm A')
        }
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Delete Recurring Payment
 * Soft deletes a recurring payment
 */
const deleteRecurringPayment = async (request, response) => {
  const { id, user_id } = request.body;

  try {
    if (!id || !user_id) {
      return response.status(200).json({
        success: false,
        msg: ['id and user_id are required', 'id और user_id आवश्यक हैं', 'id आणि user_id आवश्यक आहेत'],
        key: "id, user_id"
      });
    }

    const deleteQuery = `
            UPDATE recurring_payments 
            SET delete_flag = 1, updatetime = NOW()
            WHERE id = ? AND user_id = ? AND delete_flag = 0
        `;

    connection.query(deleteQuery, [id, user_id], (deleteErr, deleteResult) => {
      if (deleteErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: deleteErr.message
        });
      }

      if (deleteResult.affectedRows === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Recurring payment not found or access denied', 'आवर्ती भुगतान नहीं मिला या पहुंच अस्वीकृत', 'आवर्ती पेमेंट सापडले नाही किंवा प्रवेश नाकारले'],
          key: "not_found"
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Recurring payment deleted successfully', 'आवर्ती भुगतान सफलतापूर्वक हटाया गया', 'आवर्ती पेमेंट यशस्वीरित्या हटवले'],
        data: {
          id: id,
          deleted_at: moment().format('DD MMM, YYYY HH:mm A')
        }
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Export Recurring Payments Data for a Selected Year as CSV
 * @route GET /export_recurring_payments
 * @param {number} user_id - User ID
 * @param {number} account_id - Account ID (optional)
 * @param {number} year - Year to export (e.g., 2024)
 * @param {string} status - Optional: Filter by status (active, paused, completed, all) - default is all
 * @param {string} payment_type - Optional: Filter by type (income, expense, all) - default is all
 * @returns CSV file download
 */
const exportRecurringPayments = async (req, res) => {
  const { user_id, account_id, year, status = 'all', payment_type = 'all', preview = false } = req.query;

  // Validate required parameters
  if (!user_id) {
    return res.status(200).json({
      success: false,
      msg: languageMessage.empt_params,
      key: "user_id"
    });
  }

  if (!year) {
    return res.status(200).json({
      success: false,
      msg: languageMessage.empt_params,
      key: "year"
    });
  }

  // Validate year format
  const yearNum = parseInt(year);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return res.status(200).json({
      success: false,
      msg: ["Invalid year format", "अमान्य वर्ष प्रारूप", "अवैध वर्ष स्वरूप"],
      key: "invalid_year"
    });
  }

  try {
    // Check if user exists and is active
    const userCheck = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
        [user_id],
        (err, result) => {
          if (err) return reject(err);
          resolve(result);
        }
      );
    });

    if (userCheck.length === 0) {
      return res.status(200).json({
        success: false,
        msg: languageMessage.msgUserNotFound
      });
    }

    if (userCheck[0].active_flag === 0) {
      return res.status(200).json({
        success: false,
        msg: languageMessage.accountdeactivated,
        active_status: 0
      });
    }

    // Build query to fetch recurring payments created in the selected year
    let query = `
            SELECT 
                rp.id,
                rp.user_id,
                rp.account_id,
                rp.payment_type,
                rp.amount,
                rp.category_id,
                rp.frequency,
                rp.start_date,
                rp.total_occurrences,
                rp.execution_count,
                rp.note,
                rp.payment_name,
                rp.status,
                rp.last_executed_date,
                rp.next_execution_date,
                DATE_FORMAT(rp.createtime, '%d/%m/%Y') as created_date,
                DATE_FORMAT(rp.createtime, '%d/%m/%Y %h:%i %p') as created_at,
                DATE_FORMAT(rp.updatetime, '%d/%m/%Y %h:%i %p') as updated_at,
                cm.category_name,
                uam.account_name
            FROM recurring_payments rp
            LEFT JOIN category_master cm ON rp.category_id = cm.category_id AND cm.delete_flag = 0
            LEFT JOIN user_account_master uam ON rp.account_id = uam.user_account_id AND uam.delete_flag = 0
            WHERE rp.user_id = ? 
            AND YEAR(rp.createtime) = ?
            AND rp.delete_flag = 0
        `;

    const params = [user_id, yearNum];

    // Filter by account_id if provided
    if (account_id) {
      query += ` AND rp.account_id = ?`;
      params.push(account_id);
    }

    // Filter by status if specified
    if (status !== 'all') {
      query += ` AND rp.status = ?`;
      params.push(status);
    }

    // Filter by payment_type if specified
    if (payment_type !== 'all') {
      query += ` AND rp.payment_type = ?`;
      params.push(payment_type);
    }

    query += ` ORDER BY rp.createtime DESC`;

    // Execute query
    const recurringPayments = await new Promise((resolve, reject) => {
      connection.query(query, params, (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (recurringPayments.length === 0) {
      return res.status(200).json({
        success: false,
        msg: ["No recurring payments found for export", "निर्यात के लिए कोई आवर्ती भुगतान नहीं मिला", "निर्यातसाठी कोणतेही आवर्ती पेमेंट सापडले नाही"],
        key: "no_data"
      });
    }

    // Now get execution history for each recurring payment
    const recurringPaymentIds = recurringPayments.map(rp => rp.id);

    let executionHistoryQuery = `
            SELECT 
                rpe.recurring_payment_id,
                rpe.expense_income_id,
                DATE_FORMAT(rpe.execution_date, '%d/%m/%Y') as execution_date,
                rpe.status as execution_status,
                eim.amount as executed_amount
            FROM recurring_payment_executions rpe
            LEFT JOIN expense_income_master eim ON rpe.expense_income_id = eim.expense_income_id
            WHERE rpe.recurring_payment_id IN (?)
            AND YEAR(rpe.execution_date) = ?
            ORDER BY rpe.execution_date DESC
        `;

    const executionHistory = await new Promise((resolve, reject) => {
      connection.query(executionHistoryQuery, [recurringPaymentIds, yearNum], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    // Create a map of execution history by recurring payment id
    const executionMap = {};
    executionHistory.forEach(exec => {
      if (!executionMap[exec.recurring_payment_id]) {
        executionMap[exec.recurring_payment_id] = [];
      }
      executionMap[exec.recurring_payment_id].push(exec);
    });

    // Format data for CSV export
    const csvData = recurringPayments.map(row => {
      const executions = executionMap[row.id] || [];
      const executionsInYear = executions.length;
      const remainingOccurrences = row.total_occurrences ? (row.total_occurrences - row.execution_count) : 'Unlimited';

      return {
        'Recurring Payment ID': row.id,
        'Payment Name': row.payment_name || 'N/A',
        'Account': row.account_name || 'N/A',
        'Payment Type': row.payment_type === 'income' ? 'Income' : 'Expense',
        'Category': row.category_name || 'N/A',
        'Amount (₹)': parseFloat(row.amount).toFixed(2),
        'Frequency': row.frequency.charAt(0).toUpperCase() + row.frequency.slice(1),
        'Start Date': moment(row.start_date).format('DD/MM/YYYY'),
        'Status': row.status.charAt(0).toUpperCase() + row.status.slice(1),
        'Total Occurrences': row.total_occurrences || 'Unlimited',
        'Executed Count': row.execution_count || 0,
        'Remaining': remainingOccurrences,
        'Executions in Year': executionsInYear,
        'Last Executed': row.last_executed_date ? moment(row.last_executed_date).format('DD/MM/YYYY') : 'Not Yet',
        'Next Execution': row.next_execution_date ? moment(row.next_execution_date).format('DD/MM/YYYY') : 'N/A',
        'Note': row.note || '',
        'Created Date': row.created_date,
        'Created At': row.created_at,
        'Updated At': row.updated_at
      };
    });

    // Calculate summary statistics
    let totalActiveIncome = 0;
    let totalActiveExpense = 0;
    let totalPausedIncome = 0;
    let totalPausedExpense = 0;
    let totalCompletedIncome = 0;
    let totalCompletedExpense = 0;
    let totalExecutionsInYear = 0;

    recurringPayments.forEach(row => {
      const amount = parseFloat(row.amount);
      const executions = executionMap[row.id] || [];
      totalExecutionsInYear += executions.length;

      if (row.status === 'active') {
        if (row.payment_type === 'income') totalActiveIncome += amount;
        else totalActiveExpense += amount;
      } else if (row.status === 'paused') {
        if (row.payment_type === 'income') totalPausedIncome += amount;
        else totalPausedExpense += amount;
      } else if (row.status === 'completed') {
        if (row.payment_type === 'income') totalCompletedIncome += amount;
        else totalCompletedExpense += amount;
      }
    });

    // Add summary rows at the end
    csvData.push({});
    csvData.push({ 'Recurring Payment ID': 'SUMMARY' });
    csvData.push({ 'Recurring Payment ID': 'Total Recurring Payments', 'Amount (₹)': recurringPayments.length });
    csvData.push({ 'Recurring Payment ID': 'Total Executions in Year', 'Amount (₹)': totalExecutionsInYear });
    csvData.push({});
    csvData.push({ 'Recurring Payment ID': 'ACTIVE PAYMENTS' });
    csvData.push({ 'Recurring Payment ID': 'Active Income', 'Amount (₹)': totalActiveIncome.toFixed(2) });
    csvData.push({ 'Recurring Payment ID': 'Active Expense', 'Amount (₹)': totalActiveExpense.toFixed(2) });
    csvData.push({ 'Recurring Payment ID': 'Net Active', 'Amount (₹)': (totalActiveIncome - totalActiveExpense).toFixed(2) });
    csvData.push({});
    csvData.push({ 'Recurring Payment ID': 'PAUSED PAYMENTS' });
    csvData.push({ 'Recurring Payment ID': 'Paused Income', 'Amount (₹)': totalPausedIncome.toFixed(2) });
    csvData.push({ 'Recurring Payment ID': 'Paused Expense', 'Amount (₹)': totalPausedExpense.toFixed(2) });
    csvData.push({});
    csvData.push({ 'Recurring Payment ID': 'COMPLETED PAYMENTS' });
    csvData.push({ 'Recurring Payment ID': 'Completed Income', 'Amount (₹)': totalCompletedIncome.toFixed(2) });
    csvData.push({ 'Recurring Payment ID': 'Completed Expense', 'Amount (₹)': totalCompletedExpense.toFixed(2) });

    // Define CSV fields
    const fields = [
      'Recurring Payment ID',
      'Payment Name',
      'Account',
      'Payment Type',
      'Category',
      'Amount (₹)',
      'Frequency',
      'Start Date',
      'Status',
      'Total Occurrences',
      'Executed Count',
      'Remaining',
      'Executions in Year',
      'Last Executed',
      'Next Execution',
      'Note',
      'Created Date',
      'Created At',
      'Updated At'
    ];

    // Check if preview is requested
    if (preview === 'true' || preview === true) {
      const accountSuffix = account_id ? `_Account${account_id}` : '_AllAccounts';
      return res.status(200).json({
        success: true,
        msg: ["Preview data retrieved successfully", "पूर्वावलोकन डेटा सफलतापूर्वक प्राप्त हुआ", "पूर्वावलोकन डेटा यशस्वीरित्या मिळाला"],
        preview: {
          total_records: csvData.length,
          export_info: {
            year: yearNum,
            account_id: account_id,
            status_filter: status,
            payment_type_filter: payment_type,
            filename: `DailyHisab_RecurringPayments_${year}${accountSuffix}_${Date.now()}.csv`
          },
          summary: {
            total_recurring_payments: recurringPayments.length,
            total_executions_in_year: totalExecutionsInYear,
            active_income: totalActiveIncome.toFixed(2),
            active_expense: totalActiveExpense.toFixed(2),
            net_active: (totalActiveIncome - totalActiveExpense).toFixed(2),
            paused_income: totalPausedIncome.toFixed(2),
            paused_expense: totalPausedExpense.toFixed(2),
            completed_income: totalCompletedIncome.toFixed(2),
            completed_expense: totalCompletedExpense.toFixed(2)
          },
          data: csvData.slice(0, 10), // Show first 10 records as preview
          total_records_shown: Math.min(10, csvData.length),
          note: csvData.length > 10 ? `Showing first 10 of ${csvData.length} records. Full export will include all records.` : `Showing all ${csvData.length} records.`
        }
      });
    }

    // Generate CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    // Set response headers for file download
    const accountSuffix = account_id ? `_Account${account_id}` : '_AllAccounts';
    const filename = `DailyHisab_RecurringPayments_${year}${accountSuffix}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send CSV without BOM for better mobile compatibility
    return res.send(csv);

  } catch (error) {
    console.error('Export recurring payments error:', error);
    return res.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

export {
  createRecurringPayment,
  getAllRecurringPayments,
  executeRecurringPayments,
  updateRecurringPayment,
  deleteRecurringPayment,
  exportRecurringPayments
};
