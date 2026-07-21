import connection from '../connection/dbConfig.js';
import { addOpeningStockSchema, addPurchaseStockSchema } from '../validations/signUpWithMobile.js';
import languageMessage from './languageMessage.js';
import moment from 'moment-timezone';
import Joi from 'joi';
import { Parser } from 'json2csv';

// Validation schemas for new endpoints
const updateOpeningStockSchema = {
  user_id: Joi.number().integer().positive().required(),
  account_id: Joi.number().integer().positive().required(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  opening_stock: Joi.number().precision(2).min(0).required()
};

const closeStockMonthSchema = {
  user_id: Joi.number().integer().positive().required(),
  account_id: Joi.number().integer().positive().required(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required()
};

const addPurchaseStockMonthlySchema = {
  user_id: Joi.number().integer().positive().required(),
  account_id: Joi.number().integer().positive().required(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
  purchase_date: Joi.date().less('now').required(),
  purchase_amount: Joi.number().precision(2).min(0).required(),
  description: Joi.string().allow('').optional()
};

// Helper function to get current month
const getCurrentMonth = () => moment().format('YYYY-MM');

// Helper function to get next month
const getNextMonth = (monthYear) => moment(monthYear + '-01').add(1, 'month').format('YYYY-MM');

// Helper function to normalize month_year to YYYY-MM format
const normalizeMonthYear = (val) => {
  if (!val) return null;
  const cleaned = String(val).trim();
  if (/^\d{4}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }
  const parsed = moment(cleaned);
  if (parsed.isValid()) {
    return parsed.format('YYYY-MM');
  }
  return cleaned;
};

// Helper function to add stock transaction to history
const addStockTransaction = async (user_id, account_id, month_year, transaction_type, amount, description, reference_id = null) => {
  return new Promise((resolve, reject) => {
    const query = `
            INSERT INTO stock_transactions (user_id, account_id, month_year, transaction_type, amount, description, reference_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
    connection.query(query, [user_id, account_id, month_year, transaction_type, amount, description, reference_id], (err, result) => {
      if (err) return reject(err);
      resolve(result.insertId);
    });
  });
};

// Helper function to calculate COGs (Cost of Goods Sold)
const calculateCOGs = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    // Get opening stock
    const openingQuery = "SELECT opening_stock FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
    connection.query(openingQuery, [user_id, account_id, month_year], (openingErr, openingResult) => {
      if (openingErr) return reject(openingErr);

      const openingStock = openingResult.length > 0 ? parseFloat(openingResult[0].opening_stock) : 0;

      // Get total purchases for the month
      const purchaseQuery = "SELECT SUM(purchase_amount) as total_purchases FROM purchase_stock WHERE user_id = ? AND account_id = ? AND month_year = ?";
      connection.query(purchaseQuery, [user_id, account_id, month_year], (purchaseErr, purchaseResult) => {
        if (purchaseErr) return reject(purchaseErr);

        const totalPurchases = purchaseResult[0].total_purchases ? parseFloat(purchaseResult[0].total_purchases) : 0;

        // Get closing stock for the month
        const closingQuery = "SELECT closing_stock FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
        connection.query(closingQuery, [user_id, account_id, month_year], (closingErr, closingResult) => {
          if (closingErr) return reject(closingErr);

          const closingStock = closingResult.length > 0 ? parseFloat(closingResult[0].closing_stock) : 0;

          // Calculate COGs: opening + purchases - closing
          const cogs = openingStock + totalPurchases - closingStock;

          resolve({
            opening_stock: openingStock,
            total_purchases: totalPurchases,
            closing_stock: closingStock,
            cogs: Math.max(0, cogs) // Ensure non-negative
          });
        });
      });
    });
  });
};

// 1. Add/Update Opening Stock for Current Month
const addOrUpdateOpeningStock = async (request, response) => {
  try {
    const { user_id, account_id, opening_stock, month_year, monthYear } = request.body;
    const inputMonth = month_year || monthYear;
    const currentMonth = normalizeMonthYear(inputMonth) || getCurrentMonth();

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month_year format. Expected YYYY-MM', 'अमान्य महीना_वर्ष प्रारूप। YYYY-MM अपेक्षित', 'अवैध महिना_वर्ष स्वरूप. YYYY-MM अपेक्षित']
      });
    }

    if (!user_id || !account_id || opening_stock === undefined) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Check if account exists and belongs to the user
      const checkAccountQuery = "SELECT user_account_id FROM user_account_master WHERE user_account_id = ? AND user_id = ? AND delete_flag = 0";
      connection.query(checkAccountQuery, [account_id, user_id], (accountErr, accountResult) => {
        if (accountErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: accountErr.message
          });
        }

        if (accountResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: 'Account not found or does not belong to this user'
          });
        }

        // Check if stock record exists for current month
        const checkStockQuery = "SELECT id, opening_stock, is_closed FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
        connection.query(checkStockQuery, [user_id, account_id, currentMonth], (stockErr, stockResult) => {
          if (stockErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: stockErr.message
            });
          }

          if (stockResult.length > 0 && stockResult[0].is_closed) {
            return response.status(200).json({
              success: false,
              msg: ['Cannot modify opening stock for closed month', 'बंद महीने के लिए ओपनिंग स्टॉक नहीं बदल सकते', 'बंद महिन्यासाठी ओपनिंग स्टॉक बदलू शकत नाही']
            });
          }

          if (stockResult.length > 0) {
            // Update existing opening stock
            const updateQuery = `
                        UPDATE monthly_stock_ledger 
                        SET opening_stock = ?, updatetime = NOW() 
                        WHERE user_id = ? AND account_id = ? AND month_year = ?
                    `;
            connection.query(updateQuery, [opening_stock, user_id, account_id, currentMonth], (updateErr, updateResult) => {
              if (updateErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: updateErr.message
                });
              }

              // Add transaction to history
              addStockTransaction(user_id, account_id, currentMonth, 'update_opening_stock', opening_stock,
                `Opening stock updated to ${opening_stock} for ${currentMonth}`)
                .then(() => {
                  return response.status(200).json({
                    success: true,
                    msg: ['Opening stock updated successfully', 'ओपनिंग स्टॉक सफलतापूर्वक अपडेट', 'ओपनिंग स्टॉक यशस्वीरित्या अपडेट'],
                    data: {
                      month_year: currentMonth,
                      opening_stock: opening_stock,
                      is_updated: true
                    }
                  });
                })
                .catch(err => {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: err.message
                  });
                });
            });
          } else {
            // Create new opening stock record
            const insertQuery = `
                        INSERT INTO monthly_stock_ledger (user_id, account_id, month_year, opening_stock, closing_stock, is_closed) 
                        VALUES (?, ?, ?, ?, 0.00, FALSE)
                    `;
            connection.query(insertQuery, [user_id, account_id, currentMonth, opening_stock], (insertErr, insertResult) => {
              if (insertErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: insertErr.message
                });
              }

              // Add transaction to history
              addStockTransaction(user_id, account_id, currentMonth, 'opening_stock', opening_stock,
                `Opening stock set to ${opening_stock} for ${currentMonth}`)
                .then(() => {
                  return response.status(200).json({
                    success: true,
                    msg: ['Opening stock added successfully', 'ओपनिंग स्टॉक सफलतापूर्वक जोड़ा गया', 'ओपनिंग स्टॉक यशस्वीरित्या जोडले'],
                    data: {
                      month_year: currentMonth,
                      opening_stock: opening_stock,
                      is_updated: false
                    }
                  });
                })
                .catch(err => {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: err.message
                  });
                });
            });
          }
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 2. Add Purchase Stock for Current Month
const addPurchaseStockMonthly = async (request, response) => {
  try {
    const { user_id, account_id, month_year, monthYear, purchase_date, purchase_amount, description = '' } = request.body;
    const inputMonth = month_year || monthYear;
    const currentMonth = normalizeMonthYear(inputMonth) || getCurrentMonth();

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month_year format. Expected YYYY-MM', 'अमान्य महीना_वर्ष प्रारूप। YYYY-MM अपेक्षित', 'अवैध महिना_वर्ष स्वरूप. YYYY-MM अपेक्षित']
      });
    }

    if (!user_id || !account_id || !purchase_date || purchase_amount === undefined) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Check if month is closed
      const checkMonthQuery = "SELECT is_closed FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
      connection.query(checkMonthQuery, [user_id, account_id, currentMonth], (monthErr, monthResult) => {
        if (monthErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: monthErr.message
          });
        }

        if (monthResult.length > 0 && monthResult[0].is_closed) {
          return response.status(200).json({
            success: false,
            msg: ['Cannot add purchase for closed month', 'बंद महीने के लिए खरीद नहीं जोड़ सकते', 'बंद महिन्यासाठी खरेदी जोडू शकत नाही']
          });
        }

        // Insert purchase record
        const insertQuery = `
                    INSERT INTO purchase_stock (user_id, account_id, month_year, purchase_date, purchase_amount, description) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
        connection.query(insertQuery, [user_id, account_id, currentMonth, purchase_date, purchase_amount, description], (insertErr, insertResult) => {
          if (insertErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: insertErr.message
            });
          }

          const purchaseId = insertResult.insertId;

          // Add transaction to history
          addStockTransaction(user_id, account_id, currentMonth, 'purchase_stock', purchase_amount,
            `Stock purchased: ${purchase_amount} on ${purchase_date}`, purchaseId)
            .then(() => {
              return response.status(200).json({
                success: true,
                msg: ['Purchase stock added successfully', 'खरीद स्टॉक सफलतापूर्वक जोड़ा गया', 'खरेदी स्टॉक यशस्वीरित्या जोडले'],
                data: {
                  purchase_id: purchaseId,
                  month_year: currentMonth,
                  purchase_date: purchase_date,
                  purchase_amount: purchase_amount,
                  description: description
                }
              });
            })
            .catch(err => {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: err.message
              });
            });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 3. Admin: Manual Close Stock Month (for emergency use)
const adminCloseStockMonth = async (request, response) => {
  try {
    const { user_id, month_year } = request.body;
    const targetMonth = month_year || getCurrentMonth();

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Import the internal function
    const { closeStockMonthInternal } = await import('../services/autoStockCalculationService.js');

    // Use the internal function
    const result = await closeStockMonthInternal(user_id, targetMonth);

    if (result.success) {
      return response.status(200).json({
        success: true,
        msg: ['Month closed successfully', 'महीना सफलतापूर्वक बंद', 'महिना यशस्वीरित्या बंद'],
        data: {
          closed_month: result.month_year,
          next_month: result.next_month,
          calculation: result.calculation
        }
      });
    } else {
      return response.status(200).json({
        success: false,
        msg: [result.message, result.message, result.message]
      });
    }

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 4. Get Monthly Stock Ledger with History
const getMonthlyStockLedger = async (request, response) => {
  try {
    const { user_id, account_id, month_year, monthYear } = request.query;
    const inputMonth = month_year || monthYear;
    const currentMonth = normalizeMonthYear(inputMonth) || getCurrentMonth();

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month_year format. Expected YYYY-MM', 'अमान्य महीना_वर्ष प्रारूप। YYYY-MM अपेक्षित', 'अवैध महिना_वर्ष स्वरूप. YYYY-MM अपेक्षित']
      });
    }

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['Missing user_id parameter', 'user_id पैरामीटर गुम', 'user_id पॅरामीटर गहाळ']
      });
    }

    if (!account_id) {
      return response.status(200).json({
        success: false,
        msg: ['Missing account_id parameter', 'account_id पैरामीटर गुम', 'account_id पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Get stock ledger for the month
      const stockQuery = "SELECT * FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
      connection.query(stockQuery, [user_id, account_id, currentMonth], (stockErr, stockResult) => {
        if (stockErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: stockErr.message
          });
        }

        if (stockResult.length === 0) {
          return response.status(200).json({
            success: true,
            msg: ['No stock record found for this month', 'इस महीने के लिए कोई स्टॉक रिकॉर्ड नहीं मिला', 'या महिन्यासाठी स्टॉक रेकॉर्ड सापडले नाही'],
            data: {
              month_year: currentMonth,
              has_stock_record: false,
              opening_stock: 0,
              closing_stock: 0,
              is_closed: false,
              purchases: [],
              transactions: []
            }
          });
        }

        const stock = stockResult[0];

        // Get purchases for the month
        const purchaseQuery = "SELECT * FROM purchase_stock WHERE user_id = ? AND account_id = ? AND month_year = ? ORDER BY purchase_date DESC";
        connection.query(purchaseQuery, [user_id, account_id, currentMonth], (purchaseErr, purchaseResult) => {
          if (purchaseErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: purchaseErr.message
            });
          }

          // Get transaction history for the month
          const transactionQuery = "SELECT * FROM stock_transactions WHERE user_id = ? AND account_id = ? AND month_year = ? ORDER BY createtime DESC";
          connection.query(transactionQuery, [user_id, account_id, currentMonth], (transactionErr, transactionResult) => {
            if (transactionErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: transactionErr.message
              });
            }

            // Calculate totals
            const totalPurchases = purchaseResult.reduce((sum, purchase) => sum + parseFloat(purchase.purchase_amount), 0);

            // Only calculate COGs if month is closed (manual calculation)
            if (stock.is_closed) {
              calculateCOGs(user_id, account_id, currentMonth)
                .then(cogsCalculation => {
                  return response.status(200).json({
                    success: true,
                    msg: ['Stock ledger retrieved successfully', 'स्टॉक लेजर सफलतापूर्वक प्राप्त', 'स्टॉक लेजर यशस्वीरित्या मिळाले'],
                    data: {
                      month_year: currentMonth,
                      has_stock_record: true,
                      opening_stock: parseFloat(stock.opening_stock),
                      closing_stock: parseFloat(stock.closing_stock),
                      is_closed: stock.is_closed,
                      total_purchases: totalPurchases,
                      total_purchase_count: purchaseResult.length,
                      cogs: cogsCalculation.cogs,
                      purchases: purchaseResult.map(purchase => ({
                        id: purchase.id,
                        purchase_date: purchase.purchase_date,
                        purchase_amount: parseFloat(purchase.purchase_amount),
                        description: purchase.description,
                        createtime: purchase.createtime
                      })),
                      transactions: transactionResult.map(transaction => ({
                        id: transaction.id,
                        transaction_type: transaction.transaction_type,
                        amount: parseFloat(transaction.amount),
                        description: transaction.description,
                        createtime: transaction.createtime
                      })),
                      summary: {
                        can_edit_opening: !stock.is_closed,
                        can_add_purchases: !stock.is_closed,
                        can_edit_closing: !stock.is_closed,
                        next_month: getNextMonth(currentMonth),
                        note: "Closing stock must be manually set before month end"
                      }
                    }
                  });
                })
                .catch(err => {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: err.message
                  });
                });
            } else {
              // Month not closed - return data without COGs calculation
              return response.status(200).json({
                success: true,
                msg: ['Stock ledger retrieved successfully', 'स्टॉक लेजर सफलतापूर्वक प्राप्त', 'स्टॉक लेजर यशस्वीरित्या मिळाले'],
                data: {
                  month_year: currentMonth,
                  has_stock_record: true,
                  opening_stock: parseFloat(stock.opening_stock),
                  closing_stock: parseFloat(stock.closing_stock),
                  is_closed: stock.is_closed,
                  total_purchases: totalPurchases,
                  total_purchase_count: purchaseResult.length,
                  cogs: null, // COGs not calculated until month is closed
                  purchases: purchaseResult.map(purchase => ({
                    id: purchase.id,
                    purchase_date: purchase.purchase_date,
                    purchase_amount: parseFloat(purchase.purchase_amount),
                    description: purchase.description,
                    createtime: purchase.createtime
                  })),
                  transactions: transactionResult.map(transaction => ({
                    id: transaction.id,
                    transaction_type: transaction.transaction_type,
                    amount: parseFloat(transaction.amount),
                    description: transaction.description,
                    createtime: transaction.createtime
                  })),
                  summary: {
                    can_edit_opening: !stock.is_closed,
                    can_add_purchases: !stock.is_closed,
                    can_edit_closing: !stock.is_closed,
                    next_month: getNextMonth(currentMonth),
                    note: "COGs will be calculated when month is closed"
                  }
                }
              });
            }
          });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 5. Get Single Stock Month Data
const getSingleStockMonth = async (request, response) => {
  try {
    const { user_id, account_id, month, year } = request.query;

    if (!user_id || !account_id || !month || !year) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month. Must be between 1-12', 'अमान्य महीना. 1-12 के बीच होना चाहिए', 'अवैध महिना. 1-12 दरम्यान असावा']
      });
    }

    if (yearNum < 2020 || yearNum > 2030) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid year. Must be between 2020-2030', 'अमान्य वर्ष. 2020-2030 के बीच होना चाहिए', 'अवैध वर्ष. 2020-2030 दरम्यान असावा']
      });
    }

    // Create month_year string
    const monthYear = `${year}-${month.toString().padStart(2, '0')}`;
    const currentMonth = getCurrentMonth();

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Get stock data for the specific month
      const stockQuery = "SELECT * FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
      connection.query(stockQuery, [user_id, account_id, monthYear], (stockErr, stockResult) => {
        if (stockErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: stockErr.message
          });
        }

        if (stockResult.length === 0) {
          return response.status(200).json({
            success: true,
            msg: ['No stock record found for the specified month', 'निर्दिष्ट महीने के लिए कोई स्टॉक रिकॉर्ड नहीं मिला', 'निर्दिष्ट महिन्यासाठी स्टॉक रेकॉर्ड सापडले नाही'],
            data: {
              month_year: monthYear,
              month_name: moment(monthYear + '-01').format('MMMM YYYY'),
              month_number: monthNum,
              year: yearNum,
              has_stock_record: false,
              opening_stock: 0,
              closing_stock: 0,
              is_closed: false,
              is_current_month: monthYear === currentMonth,
              month_status: monthYear === currentMonth ? 'current' :
                monthYear < currentMonth ? 'past' : 'future',
              purchases: [],
              transactions: [],
              summary: {
                can_edit_opening: false,
                can_add_purchases: false,
                next_month: getNextMonth(monthYear),
                note: "No stock record exists for this month"
              }
            }
          });
        }

        const stock = stockResult[0];

        // Get purchases for the month
        const purchaseQuery = "SELECT * FROM purchase_stock WHERE user_id = ? AND account_id = ? AND month_year = ? ORDER BY purchase_date DESC";
        connection.query(purchaseQuery, [user_id, account_id, monthYear], (purchaseErr, purchaseResult) => {
          if (purchaseErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: purchaseErr.message
            });
          }

          // Get transaction history for the month
          const transactionQuery = "SELECT * FROM stock_transactions WHERE user_id = ? AND account_id = ? AND month_year = ? ORDER BY createtime DESC";
          connection.query(transactionQuery, [user_id, account_id, monthYear], (transactionErr, transactionResult) => {
            if (transactionErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: transactionErr.message
              });
            }

            // Calculate totals
            const totalPurchases = purchaseResult.reduce((sum, purchase) => sum + parseFloat(purchase.purchase_amount), 0);

            // Only calculate COGs if month is closed (manual calculation)
            if (stock.is_closed) {
              calculateCOGs(user_id, account_id, monthYear)
                .then(cogsCalculation => {
                  return response.status(200).json({
                    success: true,
                    msg: ['Single stock month retrieved successfully', 'एक स्टॉक महीना सफलतापूर्वक प्राप्त', 'एक स्टॉक महिना यशस्वीरित्या मिळाले'],
                    data: {
                      month_year: monthYear,
                      month_name: moment(monthYear + '-01').format('MMMM YYYY'),
                      month_number: monthNum,
                      year: yearNum,
                      has_stock_record: true,
                      opening_stock: parseFloat(stock.opening_stock),
                      closing_stock: parseFloat(stock.closing_stock),
                      is_closed: stock.is_closed,
                      is_current_month: monthYear === currentMonth,
                      month_status: monthYear === currentMonth ? 'current' :
                        monthYear < currentMonth ? 'past' : 'future',
                      total_purchases: totalPurchases,
                      total_purchase_count: purchaseResult.length,
                      cogs: cogsCalculation.cogs,
                      createtime: stock.createtime,
                      updatetime: stock.updatetime,
                      purchases: purchaseResult.map(purchase => ({
                        id: purchase.id,
                        purchase_date: purchase.purchase_date,
                        purchase_amount: parseFloat(purchase.purchase_amount),
                        description: purchase.description,
                        createtime: purchase.createtime
                      })),
                      transactions: transactionResult.map(transaction => ({
                        id: transaction.id,
                        transaction_type: transaction.transaction_type,
                        amount: parseFloat(transaction.amount),
                        description: transaction.description,
                        createtime: transaction.createtime
                      })),
                      summary: {
                        can_edit_opening: !stock.is_closed,
                        can_add_purchases: !stock.is_closed,
                        can_edit_closing: !stock.is_closed,
                        next_month: getNextMonth(monthYear),
                        previous_month: getPreviousMonth(monthYear),
                        note: "Closing stock must be manually set before month end"
                      }
                    }
                  });
                })
                .catch(err => {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: err.message
                  });
                });
            } else {
              // Month not closed - return data without COGs calculation
              return response.status(200).json({
                success: true,
                msg: ['Single stock month retrieved successfully', 'एक स्टॉक महीना सफलतापूर्वक प्राप्त', 'एक स्टॉक महिना यशस्वीरित्या मिळाले'],
                data: {
                  month_year: monthYear,
                  month_name: moment(monthYear + '-01').format('MMMM YYYY'),
                  month_number: monthNum,
                  year: yearNum,
                  has_stock_record: true,
                  opening_stock: parseFloat(stock.opening_stock),
                  closing_stock: parseFloat(stock.closing_stock),
                  is_closed: stock.is_closed,
                  is_current_month: monthYear === currentMonth,
                  month_status: monthYear === currentMonth ? 'current' :
                    monthYear < currentMonth ? 'past' : 'future',
                  total_purchases: totalPurchases,
                  total_purchase_count: purchaseResult.length,
                  cogs: null, // COGs not calculated until month is closed
                  createtime: stock.createtime,
                  updatetime: stock.updatetime,
                  purchases: purchaseResult.map(purchase => ({
                    id: purchase.id,
                    purchase_date: purchase.purchase_date,
                    purchase_amount: parseFloat(purchase.purchase_amount),
                    description: purchase.description,
                    createtime: purchase.createtime
                  })),
                  transactions: transactionResult.map(transaction => ({
                    id: transaction.id,
                    transaction_type: transaction.transaction_type,
                    amount: parseFloat(transaction.amount),
                    description: transaction.description,
                    createtime: transaction.createtime
                  })),
                  summary: {
                    can_edit_opening: !stock.is_closed,
                    can_add_purchases: !stock.is_closed,
                    can_edit_closing: !stock.is_closed,
                    next_month: getNextMonth(monthYear),
                    previous_month: getPreviousMonth(monthYear),
                    note: "COGs will be calculated when month is closed"
                  }
                }
              });
            }
          });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// Helper function to get previous month
const getPreviousMonth = (monthYear) => moment(monthYear + '-01').subtract(1, 'month').format('YYYY-MM');

// 6. Get All Stock Months (History)
const getAllStockMonths = async (request, response) => {
  try {
    const { user_id, account_id } = request.query;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['Missing user_id parameter', 'user_id पैरामीटर गुम', 'user_id पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Get all stock months
      let stockQuery = "SELECT * FROM monthly_stock_ledger WHERE user_id = ?";
      let queryParams = [user_id];

      // Add account_id filter if provided
      if (account_id) {
        stockQuery += " AND account_id = ?";
        queryParams.push(account_id);
      }

      stockQuery += " ORDER BY month_year DESC";
      connection.query(stockQuery, queryParams, (stockErr, stockResult) => {
        if (stockErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: stockErr.message
          });
        }

        // Get summary for each month
        const monthsWithSummary = stockResult.map(stock => ({
          month_year: stock.month_year,
          opening_stock: parseFloat(stock.opening_stock),
          closing_stock: parseFloat(stock.closing_stock),
          is_closed: stock.is_closed,
          createtime: stock.createtime,
          updatetime: stock.updatetime
        }));

        return response.status(200).json({
          success: true,
          msg: ['Stock months retrieved successfully', 'स्टॉक महीने सफलतापूर्वक प्राप्त', 'स्टॉक महिने यशस्वीरित्या मिळाले'],
          data: {
            total_months: monthsWithSummary.length,
            months: monthsWithSummary,
            current_month: getCurrentMonth()
          }
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 4. Update Purchase Stock
const updatePurchaseStock = async (request, response) => {
  try {
    const { purchase_id, user_id, account_id, purchase_date, purchase_amount, description = '' } = request.body;

    if (!purchase_id || !user_id || !account_id || !purchase_date || purchase_amount === undefined) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Check if purchase record exists and belongs to the user
      const checkPurchaseQuery = "SELECT id, user_id, account_id, month_year FROM purchase_stock WHERE id = ? AND user_id = ? AND account_id = ?";
      connection.query(checkPurchaseQuery, [purchase_id, user_id, account_id], (purchaseErr, purchaseResult) => {
        if (purchaseErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: purchaseErr.message
          });
        }

        if (purchaseResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Purchase record not found or does not belong to this user', 'खरीद रिकॉर्ड नहीं मिला', 'खरेदी रेकॉर्ड सापडला नाही']
          });
        }

        const month_year = purchaseResult[0].month_year;

        // Check if month is closed
        const checkMonthQuery = "SELECT is_closed FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
        connection.query(checkMonthQuery, [user_id, account_id, month_year], (monthErr, monthResult) => {
          if (monthErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: monthErr.message
            });
          }

          if (monthResult.length > 0 && monthResult[0].is_closed === 1) {
            return response.status(200).json({
              success: false,
              msg: ['This month is already closed', 'यह महीना पहले से बंद है', 'हा महिना आधीच बंद आहे']
            });
          }

          // Update purchase record
          const updateQuery = `
            UPDATE purchase_stock 
            SET purchase_date = ?, purchase_amount = ?, description = ?, updatetime = NOW()
            WHERE id = ? AND user_id = ? AND account_id = ?
          `;
          connection.query(updateQuery, [purchase_date, purchase_amount, description, purchase_id, user_id, account_id], (updateErr, updateResult) => {
            if (updateErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: updateErr.message
              });
            }

            if (updateResult.affectedRows === 0) {
              return response.status(200).json({
                success: false,
                msg: ['Failed to update purchase record', 'खरीद रिकॉर्ड अपडेट करने में विफल', 'खरेदी रेकॉर्ड अपडेट करण्यात अयशस्वी']
              });
            }

            // Add transaction to history
            addStockTransaction(user_id, account_id, month_year, 'update_purchase_stock', purchase_amount,
              `Purchase stock updated: ${purchase_amount} on ${purchase_date}`, purchase_id)
              .then(() => {
                return response.status(200).json({
                  success: true,
                  msg: ['Purchase stock updated successfully', 'खरीद स्टॉक सफलतापूर्वक अपडेट', 'खरेदी स्टॉक यशस्वीरित्या अपडेट'],
                  data: {
                    purchase_id: purchase_id,
                    month_year: month_year,
                    purchase_date: purchase_date,
                    purchase_amount: purchase_amount,
                    description: description
                  }
                });
              })
              .catch(err => {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: err.message
                });
              });
          });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 7. Add/Update Closing Stock for Current Month
const addOrUpdateClosingStock = async (request, response) => {
  try {
    const { user_id, account_id, closing_stock, month_year, monthYear } = request.body;
    const inputMonth = month_year || monthYear;
    const currentMonth = normalizeMonthYear(inputMonth) || getCurrentMonth();

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month_year format. Expected YYYY-MM', 'अमान्य महीना_वर्ष प्रारूप। YYYY-MM अपेक्षित', 'अवैध महिना_वर्ष स्वरूप. YYYY-MM अपेक्षित']
      });
    }

    if (!user_id || !account_id || closing_stock === undefined) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Check if account exists and belongs to the user
      const checkAccountQuery = "SELECT user_account_id FROM user_account_master WHERE user_account_id = ? AND user_id = ? AND delete_flag = 0";
      connection.query(checkAccountQuery, [account_id, user_id], (accountErr, accountResult) => {
        if (accountErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: accountErr.message
          });
        }

        if (accountResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: 'Account not found or does not belong to this user'
          });
        }

        // Check if stock record exists for current month
        const checkStockQuery = "SELECT id, opening_stock, closing_stock, is_closed FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
        connection.query(checkStockQuery, [user_id, account_id, currentMonth], (stockErr, stockResult) => {
          if (stockErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: stockErr.message
            });
          }

          if (stockResult.length === 0) {
            return response.status(200).json({
              success: false,
              msg: ['No stock record found for current month. Please add opening stock first.', 'वर्तमान महीने के लिए कोई स्टॉक रिकॉर्ड नहीं मिला। कृपया पहले ओपनिंग स्टॉक जोड़ें।', 'वर्तमान महिन्यासाठी स्टॉक रेकॉर्ड सापडले नाही. कृपया प्रथम ओपनिंग स्टॉक जोडा.']
            });
          }

          if (stockResult[0].is_closed) {
            return response.status(200).json({
              success: false,
              msg: ['Cannot modify closing stock for closed month', 'बंद महीने के लिए क्लोजिंग स्टॉक नहीं बदल सकते', 'बंद महिन्यासाठी क्लोजिंग स्टॉक बदलू शकत नाही']
            });
          }

          const stock = stockResult[0];
          const oldClosingStock = parseFloat(stock.closing_stock);

          // Update closing stock
          const updateQuery = `
            UPDATE monthly_stock_ledger 
            SET closing_stock = ?, updatetime = NOW() 
            WHERE user_id = ? AND account_id = ? AND month_year = ?
          `;
          connection.query(updateQuery, [closing_stock, user_id, account_id, currentMonth], (updateErr, updateResult) => {
            if (updateErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: updateErr.message
              });
            }

            // Add transaction to history (COGs will be calculated only when month is closed)
            const transactionType = oldClosingStock === 0 ? 'closing_stock' : 'update_closing_stock';
            const description = oldClosingStock === 0
              ? `Closing stock set to ${closing_stock} for ${currentMonth}`
              : `Closing stock updated from ${oldClosingStock} to ${closing_stock} for ${currentMonth}`;

            addStockTransaction(user_id, account_id, currentMonth, transactionType, closing_stock, description)
              .then(() => {
                return response.status(200).json({
                  success: true,
                  msg: ['Closing stock updated successfully', 'क्लोजिंग स्टॉक सफलतापूर्वक अपडेट', 'क्लोजिंग स्टॉक यशस्वीरित्या अपडेट'],
                  data: {
                    month_year: currentMonth,
                    opening_stock: parseFloat(stock.opening_stock),
                    closing_stock: closing_stock,
                    cogs: null, // COGs not calculated until month is closed
                    is_updated: oldClosingStock !== 0,
                    note: "COGs will be calculated when month is closed"
                  }
                });
              })
              .catch(err => {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: err.message
                });
              });
          });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

// 8. Close Stock Month and Update Next Month Opening Stock
const closeStockMonth = async (request, response) => {
  try {
    const { user_id, account_id, month_year, monthYear } = request.body;
    const inputMonth = month_year || monthYear;
    const currentMonth = normalizeMonthYear(inputMonth) || getCurrentMonth();
    const nextMonth = getNextMonth(currentMonth);

    if (currentMonth && !/^\d{4}-\d{2}$/.test(currentMonth)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid month_year format. Expected YYYY-MM', 'अमान्य महीना_वर्ष प्रारूप। YYYY-MM अपेक्षित', 'अवैध महिना_वर्ष स्वरूप. YYYY-MM अपेक्षित']
      });
    }

    if (!user_id || !account_id) {
      return response.status(200).json({
        success: false,
        msg: ['Missing required parameters', 'आवश्यक पैरामीटर गुम', 'आवश्यक पॅरामीटर गहाळ']
      });
    }

    // Check if user exists and is active
    const checkUserQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || 'Account is deactivated',
          active_status: 0
        });
      }

      // Check if account exists and belongs to the user
      const checkAccountQuery = "SELECT user_account_id FROM user_account_master WHERE user_account_id = ? AND user_id = ? AND delete_flag = 0";
      connection.query(checkAccountQuery, [account_id, user_id], (accountErr, accountResult) => {
        if (accountErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: accountErr.message
          });
        }

        if (accountResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: 'Account not found or does not belong to this user'
          });
        }

        // Check if current month stock record exists
        const checkStockQuery = "SELECT id, opening_stock, closing_stock, is_closed FROM monthly_stock_ledger WHERE user_id = ? AND account_id = ? AND month_year = ?";
        connection.query(checkStockQuery, [user_id, account_id, currentMonth], (stockErr, stockResult) => {
          if (stockErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: stockErr.message
            });
          }

          if (stockResult.length === 0) {
            return response.status(200).json({
              success: false,
              msg: ['No stock record found for current month', 'वर्तमान महीने के लिए कोई स्टॉक रिकॉर्ड नहीं मिला', 'वर्तमान महिन्यासाठी स्टॉक रेकॉर्ड सापडले नाही']
            });
          }

          const stock = stockResult[0];

          if (stock.is_closed) {
            return response.status(200).json({
              success: false,
              msg: ['Current month is already closed', 'वर्तमान महीना पहले से बंद है', 'वर्तमान महिना आधीच बंद आहे']
            });
          }

          if (parseFloat(stock.closing_stock) === 0) {
            return response.status(200).json({
              success: false,
              msg: ['Please set closing stock before closing the month', 'महीना बंद करने से पहले क्लोजिंग स्टॉक सेट करें', 'महिना बंद करण्यापूर्वी क्लोजिंग स्टॉक सेट करा']
            });
          }

          // Calculate COGs for current month
          calculateCOGs(user_id, account_id, currentMonth)
            .then(cogsCalculation => {
              // Mark current month as closed
              const closeMonthQuery = `
                UPDATE monthly_stock_ledger 
                SET is_closed = TRUE, updatetime = NOW() 
                WHERE user_id = ? AND account_id = ? AND month_year = ?
              `;
              connection.query(closeMonthQuery, [user_id, account_id, currentMonth], (closeErr, closeResult) => {
                if (closeErr) {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: closeErr.message
                  });
                }

                // Create next month's opening stock record
                const nextMonthQuery = `
                  INSERT INTO monthly_stock_ledger (user_id, account_id, month_year, opening_stock, closing_stock, is_closed) 
                  VALUES (?, ?, ?, ?, 0.00, FALSE)
                  ON DUPLICATE KEY UPDATE opening_stock = VALUES(opening_stock), updatetime = NOW()
                `;
                connection.query(nextMonthQuery, [user_id, account_id, nextMonth, stock.closing_stock], (nextMonthErr, nextMonthResult) => {
                  if (nextMonthErr) {
                    return response.status(200).json({
                      success: false,
                      msg: languageMessage.internalServerError,
                      error: nextMonthErr.message
                    });
                  }

                  // Add transactions to history
                  const currentMonthTransaction = addStockTransaction(user_id, account_id, currentMonth, 'month_closed', stock.closing_stock,
                    `Month closed: ${currentMonth} with closing stock ${stock.closing_stock}`);

                  const nextMonthTransaction = addStockTransaction(user_id, account_id, nextMonth, 'month_rollover', stock.closing_stock,
                    `Month rollover: ${stock.closing_stock} from ${currentMonth} to ${nextMonth}`);

                  Promise.all([currentMonthTransaction, nextMonthTransaction])
                    .then(() => {
                      return response.status(200).json({
                        success: true,
                        msg: ['Month closed successfully and next month opening stock updated', 'महीना सफलतापूर्वक बंद और अगले महीने का ओपनिंग स्टॉक अपडेट', 'महिना यशस्वीरित्या बंद आणि पुढच्या महिन्याचा ओपनिंग स्टॉक अपडेट'],
                        data: {
                          closed_month: currentMonth,
                          next_month: nextMonth,
                          closing_stock: parseFloat(stock.closing_stock),
                          next_month_opening_stock: parseFloat(stock.closing_stock),
                          cogs: cogsCalculation.cogs,
                          calculation: {
                            opening_stock: cogsCalculation.opening_stock,
                            total_purchases: cogsCalculation.total_purchases,
                            closing_stock: cogsCalculation.closing_stock,
                            cogs: cogsCalculation.cogs
                          }
                        }
                      });
                    })
                    .catch(err => {
                      return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError,
                        error: err.message
                      });
                    });
                });
              });
            })
            .catch(err => {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: err.message
              });
            });
        });
      });
    });

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

/**
 * Export Monthly Stock Data for a Selected Year as CSV
 * @route GET /export_monthly_stock
 * @param {number} user_id - User ID
 * @param {number} account_id - Account ID
 * @param {number} year - Year to export (e.g., 2024)
 * @returns CSV file download
 */
const exportMonthlyStock = async (req, res) => {
  const { user_id, account_id, year, preview = false } = req.query;

  // Validate required parameters
  if (!user_id) {
    return res.status(200).json({
      success: false,
      msg: languageMessage.empt_params,
      key: "user_id"
    });
  }

  if (!account_id) {
    return res.status(200).json({
      success: false,
      msg: languageMessage.empt_params,
      key: "account_id"
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

    // Build query to fetch monthly stock records for all months in the year
    const stockQuery = `
            SELECT 
                msl.user_id,
                msl.account_id,
                msl.month_year,
                msl.opening_stock,
                msl.closing_stock,
                msl.is_closed,
                DATE_FORMAT(msl.createtime, '%d/%m/%Y') as created_date,
                DATE_FORMAT(msl.createtime, '%d/%m/%Y %h:%i %p') as created_at,
                DATE_FORMAT(msl.updatetime, '%d/%m/%Y %h:%i %p') as updated_at
            FROM monthly_stock_ledger msl
            WHERE msl.user_id = ? 
            AND msl.account_id = ?
            AND YEAR(CONCAT(msl.month_year, '-01')) = ?
            ORDER BY msl.month_year ASC
        `;

    // Execute query
    const stockRecords = await new Promise((resolve, reject) => {
      connection.query(stockQuery, [user_id, account_id, yearNum], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    if (stockRecords.length === 0) {
      return res.status(200).json({
        success: false,
        msg: ["No monthly stock records found for export", "निर्यात के लिए कोई मासिक स्टॉक रिकॉर्ड नहीं मिला", "निर्यातसाठी कोणतेही मासिक स्टॉक रेकॉर्ड सापडले नाही"],
        key: "no_data"
      });
    }

    // Get purchases for all months in the year
    const purchaseQuery = `
            SELECT 
                ps.purchase_id,
                ps.month_year,
                ps.purchase_date,
                ps.purchase_amount,
                ps.description,
                DATE_FORMAT(ps.purchase_date, '%d/%m/%Y') as purchase_date_formatted
            FROM purchase_stock ps
            WHERE ps.user_id = ? 
            AND ps.account_id = ?
            AND YEAR(CONCAT(ps.month_year, '-01')) = ?
            ORDER BY ps.month_year ASC, ps.purchase_date ASC
        `;

    const purchases = await new Promise((resolve, reject) => {
      connection.query(purchaseQuery, [user_id, account_id, yearNum], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });

    // Create a map of purchases by month
    const purchasesByMonth = {};
    purchases.forEach(purchase => {
      if (!purchasesByMonth[purchase.month_year]) {
        purchasesByMonth[purchase.month_year] = [];
      }
      purchasesByMonth[purchase.month_year].push(purchase);
    });

    // Format data for CSV export
    const csvData = [];

    stockRecords.forEach(stock => {
      const monthPurchases = purchasesByMonth[stock.month_year] || [];
      const totalPurchases = monthPurchases.reduce((sum, p) => sum + parseFloat(p.purchase_amount), 0);
      const purchaseCount = monthPurchases.length;

      // Calculate expected closing stock
      const expectedClosing = parseFloat(stock.opening_stock) + totalPurchases;
      const actualClosing = parseFloat(stock.closing_stock);
      const variance = actualClosing - expectedClosing;

      // Month status
      const status = stock.is_closed ? 'Closed' : 'Open';

      csvData.push({
        'Month-Year': moment(stock.month_year + '-01').format('MMMM YYYY'),
        'Month': stock.month_year,
        'Opening Stock (₹)': parseFloat(stock.opening_stock).toFixed(2),
        'Total Purchases (₹)': totalPurchases.toFixed(2),
        'Purchase Count': purchaseCount,
        'Expected Closing (₹)': expectedClosing.toFixed(2),
        'Actual Closing (₹)': actualClosing.toFixed(2),
        'Variance (₹)': variance.toFixed(2),
        'Status': status,
        'Created Date': stock.created_date,
        'Created At': stock.created_at,
        'Updated At': stock.updated_at
      });
    });

    // Calculate yearly summary statistics
    let totalOpeningStock = 0;
    let totalPurchases = 0;
    let totalClosingStock = 0;
    let totalVariance = 0;
    let closedMonths = 0;
    let openMonths = 0;

    stockRecords.forEach((stock, index) => {
      // Only count first month's opening stock
      if (index === 0) {
        totalOpeningStock = parseFloat(stock.opening_stock);
      }

      const monthPurchases = purchasesByMonth[stock.month_year] || [];
      const monthPurchaseAmount = monthPurchases.reduce((sum, p) => sum + parseFloat(p.purchase_amount), 0);
      totalPurchases += monthPurchaseAmount;

      // Only count last month's closing stock
      if (index === stockRecords.length - 1) {
        totalClosingStock = parseFloat(stock.closing_stock);
      }

      const expectedClosing = parseFloat(stock.opening_stock) + monthPurchaseAmount;
      const variance = parseFloat(stock.closing_stock) - expectedClosing;
      totalVariance += variance;

      if (stock.is_closed) closedMonths++;
      else openMonths++;
    });

    // Add summary rows at the end
    csvData.push({});
    csvData.push({ 'Month-Year': 'YEARLY SUMMARY' });
    csvData.push({ 'Month-Year': 'Total Months', 'Opening Stock (₹)': stockRecords.length });
    csvData.push({ 'Month-Year': 'Starting Stock (Year Begin)', 'Opening Stock (₹)': totalOpeningStock.toFixed(2) });
    csvData.push({ 'Month-Year': 'Total Purchases (Year)', 'Opening Stock (₹)': totalPurchases.toFixed(2) });
    csvData.push({ 'Month-Year': 'Ending Stock (Year End)', 'Opening Stock (₹)': totalClosingStock.toFixed(2) });
    csvData.push({ 'Month-Year': 'Total Variance', 'Opening Stock (₹)': totalVariance.toFixed(2) });
    csvData.push({});
    csvData.push({ 'Month-Year': 'MONTH STATUS' });
    csvData.push({ 'Month-Year': 'Closed Months', 'Opening Stock (₹)': closedMonths });
    csvData.push({ 'Month-Year': 'Open Months', 'Opening Stock (₹)': openMonths });
    csvData.push({ 'Month-Year': 'Average Monthly Purchases', 'Opening Stock (₹)': (totalPurchases / stockRecords.length).toFixed(2) });

    // Define CSV fields
    const fields = [
      'Month-Year',
      'Month',
      'Opening Stock (₹)',
      'Total Purchases (₹)',
      'Purchase Count',
      'Expected Closing (₹)',
      'Actual Closing (₹)',
      'Variance (₹)',
      'Status',
      'Created Date',
      'Created At',
      'Updated At'
    ];

    // Check if preview is requested
    if (preview === 'true' || preview === true) {
      return res.status(200).json({
        success: true,
        msg: ["Preview data retrieved successfully", "पूर्वावलोकन डेटा सफलतापूर्वक प्राप्त हुआ", "पूर्वावलोकन डेटा यशस्वीरित्या मिळाला"],
        preview: {
          total_records: csvData.length,
          export_info: {
            year: yearNum,
            account_id: account_id,
            filename: `DailyHisab_MonthlyStock_${year}_Account${account_id}_${Date.now()}.csv`
          },
          summary: {
            total_months: stockRecords.length,
            starting_stock_year_begin: totalOpeningStock.toFixed(2),
            total_purchases_year: totalPurchases.toFixed(2),
            ending_stock_year_end: totalClosingStock.toFixed(2),
            total_variance: totalVariance.toFixed(2),
            closed_months: closedMonths,
            open_months: openMonths,
            average_monthly_purchases: stockRecords.length > 0 ? (totalPurchases / stockRecords.length).toFixed(2) : '0.00'
          },
          data: csvData.slice(0, 12), // Show first 12 records as preview (all months)
          total_records_shown: Math.min(12, csvData.length),
          note: csvData.length > 12 ? `Showing first 12 of ${csvData.length} records. Full export will include all records.` : `Showing all ${csvData.length} records.`
        }
      });
    }

    // Generate CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(csvData);

    // Set response headers for file download
    const filename = `DailyHisab_MonthlyStock_${year}_Account${account_id}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Send CSV without BOM for better mobile compatibility
    return res.send(csv);

  } catch (error) {
    console.error('Export monthly stock error:', error);
    return res.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

export {
  addOrUpdateOpeningStock,
  addPurchaseStockMonthly,
  updatePurchaseStock,
  adminCloseStockMonth,
  getMonthlyStockLedger,
  getSingleStockMonth,
  getAllStockMonths,
  addOrUpdateClosingStock,
  closeStockMonth,
  exportMonthlyStock
};
