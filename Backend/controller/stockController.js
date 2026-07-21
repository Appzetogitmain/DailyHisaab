import connection from '../connection/dbConfig.js';
import { addOpeningStockSchema, addPurchaseStockSchema } from '../validations/signUpWithMobile.js';
import { fetchUserData } from './function.js';
import languageMessage from './languageMessage.js';
import moment from 'moment-timezone';

const addOpeningStock = async (request, response) => {
  try {
    const { error, value } = addOpeningStockSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        message: ['Validation failed'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, account_id, opening_stock } = value;

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

        // Check if stock record already exists for this user and account (lifetime check)
        const checkStockQuery = "SELECT stock_id FROM stock_ledger WHERE user_id = ? AND account_id = ?";
        connection.query(checkStockQuery, [user_id, account_id], (stockErr, stockResult) => {
          if (stockErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError,
              error: stockErr.message
            });
          }

          if (stockResult.length > 0) {
            return response.status(200).json({
              success: false,
              msg: 'Opening stock already exists. You can only add opening stock once in your lifetime.'
            });
          }

          // Generate current month_year for the record
          const currentMonthYear = moment().format('YYYY-MM');

          // Insert new stock record with closing_stock = 0
          const insertStockQuery = `
                    INSERT INTO stock_ledger (user_id, account_id, month_year, opening_stock, stock_sold, closing_stock, createtime, updatetime) 
                    VALUES (?, ?, ?, ?, 0.00, 0.00, NOW(), NOW())
                `;
          const values = [user_id, account_id, currentMonthYear, opening_stock];

          connection.query(insertStockQuery, values, (insertErr, insertResult) => {
            if (insertErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: insertErr.message
              });
            }

            if (insertResult.affectedRows === 0) {
              return response.status(200).json({
                success: false,
                msg: 'Failed to add opening stock'
              });
            }

            const stock_id = insertResult.insertId;

            // Get purchase details for this month and user
            const getPurchaseQuery = `
                        SELECT 
                            purchase_id,
                            purchase_date,
                            purchase_amount,
                            createtime,
                            updatetime
                        FROM purchase_stock 
                        WHERE stock_id = ? AND user_id = ? AND account_id = ?
                    `;

            connection.query(getPurchaseQuery, [stock_id, user_id, account_id], (purchaseErr, purchaseResult) => {
              if (purchaseErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: purchaseErr.message
                });
              }

              // Calculate total purchase amount
              const totalPurchaseAmount = purchaseResult.length > 0
                ? purchaseResult.reduce((sum, purchase) => sum + parseFloat(purchase.purchase_amount), 0)
                : 0.00;

              // Return success response with stock and purchase information
              return response.status(200).json({
                success: true,
                msg: 'Opening stock added successfully',
                data: {
                  stock_ledger: {
                    stock_id: stock_id,
                    user_id: user_id,
                    month_year: currentMonthYear,
                    opening_stock: opening_stock,
                    closing_stock: 0.00,
                    stock_sold: 0.00,
                    createtime: new Date().toISOString(),
                    updatetime: new Date().toISOString()
                  },
                  purchase_details: {
                    total_purchases: purchaseResult.length,
                    total_purchase_amount: totalPurchaseAmount,
                    purchases: purchaseResult.length > 0 ? purchaseResult.map(purchase => ({
                      purchase_id: purchase.purchase_id,
                      purchase_date: purchase.purchase_date,
                      purchase_amount: parseFloat(purchase.purchase_amount),
                      createtime: purchase.createtime,
                      updatetime: purchase.updatetime
                    })) : []
                  }
                }
              });
            });
          });
        });
      });
    });
  }
  catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
}

const getStockLedger = async (request, response) => {
  try {
    const { user_id, account_id, month_year } = request.query;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: 'user_id is required'
      });
    }

    if (!account_id) {
      return response.status(200).json({
        success: false,
        msg: 'account_id is required'
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

        let stockQuery = "SELECT * FROM stock_ledger WHERE user_id = ? AND account_id = ?";
        let queryParams = [user_id, account_id];

        if (month_year) {
          stockQuery += " AND month_year = ?";
          queryParams.push(month_year);
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

          if (stockResult.length === 0) {
            return response.status(200).json({
              success: true,
              msg: languageMessage.msgDataFound || 'Data found',
              data: []
            });
          }

          // Get purchase details for each stock record
          const stockIds = stockResult.map(stock => stock.stock_id);
          const purchaseQuery = `
                    SELECT 
                        ps.purchase_id,
                        ps.stock_id,
                        ps.purchase_date,
                        ps.purchase_amount,
                        ps.createtime,
                        ps.updatetime
                    FROM purchase_stock ps
                    WHERE ps.stock_id IN (${stockIds.map(() => '?').join(',')}) AND ps.user_id = ? AND ps.account_id = ?
                `;

          const purchaseParams = [...stockIds, user_id, account_id];

          connection.query(purchaseQuery, purchaseParams, (purchaseErr, purchaseResult) => {
            if (purchaseErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: purchaseErr.message
              });
            }

            // Group purchases by stock_id
            const purchasesByStock = {};
            purchaseResult.forEach(purchase => {
              if (!purchasesByStock[purchase.stock_id]) {
                purchasesByStock[purchase.stock_id] = [];
              }
              purchasesByStock[purchase.stock_id].push({
                purchase_id: purchase.purchase_id,
                purchase_date: purchase.purchase_date,
                purchase_amount: parseFloat(purchase.purchase_amount),
                createtime: purchase.createtime,
                updatetime: purchase.updatetime
              });
            });

            // Combine stock and purchase data with transaction history
            const combinedData = stockResult.map(stock => {
              const purchases = purchasesByStock[stock.stock_id] || [];
              const totalPurchaseAmount = purchases.length > 0
                ? purchases.reduce((sum, purchase) => sum + purchase.purchase_amount, 0)
                : 0.00;

              // Create transaction history array
              const transactionHistory = [];

              // Add opening stock transaction
              transactionHistory.push({
                transaction_type: 'opening_stock',
                transaction_id: stock.stock_id,
                amount: parseFloat(stock.opening_stock),
                date: stock.createtime,
                description: `Opening stock added: ${parseFloat(stock.opening_stock)}`,
                createtime: stock.createtime,
                updatetime: stock.updatetime
              });

              // Add purchase transactions
              purchases.forEach(purchase => {
                transactionHistory.push({
                  transaction_type: 'purchase',
                  transaction_id: purchase.purchase_id,
                  amount: purchase.purchase_amount,
                  date: purchase.purchase_date,
                  description: `Stock purchased: ${purchase.purchase_amount}`,
                  createtime: purchase.createtime,
                  updatetime: purchase.updatetime
                });
              });

              // Add stock sold transaction if there are sales
              if (parseFloat(stock.stock_sold) > 0) {
                transactionHistory.push({
                  transaction_type: 'stock_sold',
                  transaction_id: stock.stock_id,
                  amount: parseFloat(stock.stock_sold),
                  date: stock.updatetime,
                  description: `Stock sold: ${parseFloat(stock.stock_sold)}`,
                  createtime: stock.createtime,
                  updatetime: stock.updatetime
                });
              }

              // Add closing stock transaction if different from opening
              if (parseFloat(stock.closing_stock) !== parseFloat(stock.opening_stock)) {
                transactionHistory.push({
                  transaction_type: 'closing_stock',
                  transaction_id: stock.stock_id,
                  amount: parseFloat(stock.closing_stock),
                  date: stock.updatetime,
                  description: `Closing stock: ${parseFloat(stock.closing_stock)}`,
                  createtime: stock.createtime,
                  updatetime: stock.updatetime
                });
              }

              // Sort transactions by date (newest first)
              transactionHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

              return {
                stock_ledger: {
                  stock_id: stock.stock_id,
                  user_id: stock.user_id,
                  month_year: stock.month_year,
                  opening_stock: parseFloat(stock.opening_stock),
                  closing_stock: parseFloat(stock.closing_stock),
                  stock_sold: parseFloat(stock.stock_sold),
                  createtime: stock.createtime,
                  updatetime: stock.updatetime
                },
                purchase_details: {
                  total_purchases: purchases.length,
                  total_purchase_amount: totalPurchaseAmount,
                  purchases: purchases
                },
                transaction_history: {
                  total_transactions: transactionHistory.length,
                  transactions: transactionHistory,
                  summary: {
                    opening_stock_date: stock.createtime,
                    last_purchase_date: purchases.length > 0 ? purchases[purchases.length - 1].purchase_date : null,
                    last_update_date: stock.updatetime,
                    total_purchase_amount: totalPurchaseAmount,
                    net_stock_change: parseFloat(stock.closing_stock) - parseFloat(stock.opening_stock)
                  }
                }
              };
            });

            return response.status(200).json({
              success: true,
              msg: languageMessage.msgDataFound || 'Data found',
              data: combinedData
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

const addPurchaseStock = async (request, response) => {
  try {
    const { error, value } = addPurchaseStockSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        message: ['Validation failed'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, account_id, stock_id, purchase_date, purchase_amount } = value;

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

        // Check if stock record exists and belongs to the user and account
        const checkStockQuery = "SELECT stock_id, user_id, account_id, month_year FROM stock_ledger WHERE stock_id = ? AND user_id = ? AND account_id = ?";
        connection.query(checkStockQuery, [stock_id, user_id, account_id], (stockErr, stockResult) => {
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
              msg: 'Stock record not found or does not belong to this user'
            });
          }

          // Insert new purchase record
          const insertPurchaseQuery = `
          INSERT INTO purchase_stock (stock_id, user_id, account_id, purchase_date, purchase_amount, createtime, updatetime) 
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        `;
          const values = [stock_id, user_id, account_id, purchase_date, purchase_amount];

          connection.query(insertPurchaseQuery, values, (insertErr, insertResult) => {
            if (insertErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: insertErr.message
              });
            }

            if (insertResult.affectedRows === 0) {
              return response.status(200).json({
                success: false,
                msg: 'Failed to add purchase stock'
              });
            }

            const purchase_id = insertResult.insertId;

            // Get updated stock ledger information
            const getStockQuery = "SELECT * FROM stock_ledger WHERE stock_id = ?";
            connection.query(getStockQuery, [stock_id], (getStockErr, getStockResult) => {
              if (getStockErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError,
                  error: getStockErr.message
                });
              }

              // Get all purchases for this stock
              const getPurchasesQuery = "SELECT * FROM purchase_stock WHERE stock_id = ? AND user_id = ? AND account_id = ?";
              connection.query(getPurchasesQuery, [stock_id, user_id, account_id], (getPurchaseErr, getPurchaseResult) => {
                if (getPurchaseErr) {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: getPurchaseErr.message
                  });
                }

                const stock = getStockResult[0];
                const purchases = getPurchaseResult;

                // Calculate total purchase amount
                const totalPurchaseAmount = purchases.length > 0
                  ? purchases.reduce((sum, purchase) => sum + parseFloat(purchase.purchase_amount), 0)
                  : 0.00;

                // Create transaction history
                const transactionHistory = [];

                // Add opening stock transaction
                transactionHistory.push({
                  transaction_type: 'opening_stock',
                  transaction_id: stock.stock_id,
                  amount: parseFloat(stock.opening_stock),
                  date: stock.createtime,
                  description: `Opening stock added: ${parseFloat(stock.opening_stock)}`,
                  createtime: stock.createtime,
                  updatetime: stock.updatetime
                });

                // Add purchase transactions
                purchases.forEach(purchase => {
                  transactionHistory.push({
                    transaction_type: 'purchase',
                    transaction_id: purchase.purchase_id,
                    amount: parseFloat(purchase.purchase_amount),
                    date: purchase.purchase_date,
                    description: `Stock purchased: ${parseFloat(purchase.purchase_amount)}`,
                    createtime: purchase.createtime,
                    updatetime: purchase.updatetime
                  });
                });

                // Add stock sold transaction if there are sales
                if (parseFloat(stock.stock_sold) > 0) {
                  transactionHistory.push({
                    transaction_type: 'stock_sold',
                    transaction_id: stock.stock_id,
                    amount: parseFloat(stock.stock_sold),
                    date: stock.updatetime,
                    description: `Stock sold: ${parseFloat(stock.stock_sold)}`,
                    createtime: stock.createtime,
                    updatetime: stock.updatetime
                  });
                }

                // Add closing stock transaction if different from opening
                if (parseFloat(stock.closing_stock) !== parseFloat(stock.opening_stock)) {
                  transactionHistory.push({
                    transaction_type: 'closing_stock',
                    transaction_id: stock.stock_id,
                    amount: parseFloat(stock.closing_stock),
                    date: stock.updatetime,
                    description: `Closing stock: ${parseFloat(stock.closing_stock)}`,
                    createtime: stock.createtime,
                    updatetime: stock.updatetime
                  });
                }

                // Sort transactions by date (newest first)
                transactionHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

                // Return success response with complete stock information
                return response.status(200).json({
                  success: true,
                  msg: 'Purchase stock added successfully',
                  data: {
                    purchase_record: {
                      purchase_id: purchase_id,
                      stock_id: stock_id,
                      user_id: user_id,
                      purchase_date: purchase_date,
                      purchase_amount: purchase_amount,
                      createtime: new Date().toISOString(),
                      updatetime: new Date().toISOString()
                    },
                    stock_ledger: {
                      stock_id: stock.stock_id,
                      user_id: stock.user_id,
                      month_year: stock.month_year,
                      opening_stock: parseFloat(stock.opening_stock),
                      closing_stock: parseFloat(stock.closing_stock),
                      stock_sold: parseFloat(stock.stock_sold),
                      createtime: stock.createtime,
                      updatetime: stock.updatetime
                    },
                    purchase_details: {
                      total_purchases: purchases.length,
                      total_purchase_amount: totalPurchaseAmount,
                      purchases: purchases.map(purchase => ({
                        purchase_id: purchase.purchase_id,
                        purchase_date: purchase.purchase_date,
                        purchase_amount: parseFloat(purchase.purchase_amount),
                        createtime: purchase.createtime,
                        updatetime: purchase.updatetime
                      }))
                    },
                    transaction_history: {
                      total_transactions: transactionHistory.length,
                      transactions: transactionHistory,
                      summary: {
                        opening_stock_date: stock.createtime,
                        last_purchase_date: purchases.length > 0 ? purchases[purchases.length - 1].purchase_date : null,
                        last_update_date: stock.updatetime,
                        total_purchase_amount: totalPurchaseAmount,
                        net_stock_change: parseFloat(stock.closing_stock) - parseFloat(stock.opening_stock)
                      }
                    }
                  }
                });
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

export { addOpeningStock, getStockLedger, addPurchaseStock };
