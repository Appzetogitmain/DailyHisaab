import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';

/**
 * Search Users by Mobile Number (Autocomplete)
 * Returns list of users matching the mobile number (partial match for autocomplete)
 */
const searchUsersByMobileAutocomplete = async (request, response) => {
  try {
    const { mobile, limit = 10 } = request.query;

    if (!mobile || mobile.trim() === '') {
      return response.status(200).json({
        success: true,
        data: {
          users: []
        }
      });
    }

    // Clean mobile number (remove spaces, dashes, etc.)
    const cleanMobile = mobile.replace(/[^0-9]/g, '');

    if (cleanMobile.length < 3) {
      return response.status(200).json({
        success: true,
        data: {
          users: []
        }
      });
    }

    // Search users by partial mobile number match
    const userQuery = `
      SELECT 
        um.user_id,
        um.name,
        um.email,
        um.mobile,
        um.phone_code,
        um.active_flag,
        um.createtime as user_created_at,
        um.user_type
      FROM user_master um
      WHERE um.mobile LIKE ? AND um.delete_flag = 0
      ORDER BY um.mobile ASC
      LIMIT ?
    `;

    connection.query(userQuery, [`%${cleanMobile}%`, parseInt(limit)], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      const users = userResult.map(user => ({
        user_id: user.user_id,
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        mobile: user.mobile,
        phone_code: user.phone_code,
        active_flag: user.active_flag,
        user_type: user.user_type,
        created_at: moment(user.user_created_at).format('DD/MM/YYYY')
      }));

      return response.status(200).json({
        success: true,
        msg: ['Users found', 'उपयोगकर्ता मिले', 'वापरकर्ते सापडले'],
        data: {
          users: users,
          count: users.length
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
 * Search User by Mobile Number Controller
 * Returns user details including current subscription for manual upgrade
 */
const searchUserByMobile = async (request, response) => {
  try {
    const { mobile } = request.query;

    if (!mobile || mobile.trim() === '') {
      return response.status(200).json({
        success: false,
        msg: ['Mobile number is required', 'मोबाइल नंबर आवश्यक है', 'मोबाइल नंबर आवश्यक आहे'],
        key: "mobile_required"
      });
    }

    // Clean mobile number (remove spaces, dashes, etc.)
    const cleanMobile = mobile.replace(/[^0-9]/g, '');

    if (cleanMobile.length < 10) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid mobile number format', 'अमान्य मोबाइल नंबर प्रारूप', 'अवैध मोबाइल नंबर स्वरूप'],
        key: "invalid_mobile"
      });
    }

    // Search user by mobile number
    const userQuery = `
      SELECT 
        um.user_id,
        um.name,
        um.email,
        um.mobile,
        um.phone_code,
        um.active_flag,
        um.createtime as user_created_at,
        um.user_type
      FROM user_master um
      WHERE um.mobile = ? AND um.delete_flag = 0
      LIMIT 1
    `;

    connection.query(userQuery, [cleanMobile], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['User not found with this mobile number', 'इस मोबाइल नंबर से कोई उपयोगकर्ता नहीं मिला', 'या मोबाइल नंबरसह कोणतेही वापरकर्ते सापडले नाहीत'],
          key: "user_not_found"
        });
      }

      const user = userResult[0];

      if (user.active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: ['User account is deactivated', 'उपयोगकर्ता खाता निष्क्रिय है', 'वापरकर्ता खाते निष्क्रिय आहे'],
          key: "account_deactivated",
          user: {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            phone_code: user.phone_code,
            active_flag: user.active_flag
          }
        });
      }

      // Get user's current subscription
      const currentSubQuery = `
        SELECT 
          usm.user_subscription_id,
          usm.subscription_id,
          usm.amount,
          usm.subscription_type,
          usm.start_date,
          usm.end_date,
          sm.description as plan_name,
          sm.text as plan_text,
          sm.amount as plan_amount,
          sm.validity_days
        FROM user_subscription_master usm
        LEFT JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id AND sm.delete_flag = 0
        WHERE usm.user_id = ? AND usm.delete_flag = 0
        ORDER BY usm.end_date DESC
        LIMIT 1
      `;

      connection.query(currentSubQuery, [user.user_id], (subErr, subResult) => {
        if (subErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: subErr.message
          });
        }

        const currentSubscription = subResult.length > 0 ? subResult[0] : null;
        const now = moment();
        let subscriptionStatus = null;

        if (currentSubscription) {
          const endDate = moment(currentSubscription.end_date);
          const remainingDays = Math.max(0, Math.ceil(endDate.diff(now, 'days', true)));
          const isActive = endDate.isAfter(now);

          subscriptionStatus = {
            has_subscription: true,
            is_active: isActive,
            subscription_id: currentSubscription.subscription_id,
            plan_name: currentSubscription.plan_name || 'Unknown Plan',
            plan_text: currentSubscription.plan_text || 'Unknown',
            amount: currentSubscription.amount,
            subscription_type: currentSubscription.subscription_type,
            subscription_type_label:
              currentSubscription.subscription_type == 0 ? "Free or Referral" :
                currentSubscription.subscription_type == 1 ? "Yearly" :
                  currentSubscription.subscription_type == 2 ? "Monthly" :
                    currentSubscription.subscription_type == 3 ? "Lifetime" :
                      currentSubscription.subscription_type == 4 ? "Other" :
                        "Unknown",
            start_date: moment(currentSubscription.start_date).format('DD/MM/YYYY'),
            end_date: moment(currentSubscription.end_date).format('DD/MM/YYYY'),
            remaining_days: remainingDays,
            validity_days: currentSubscription.validity_days
          };
        } else {
          subscriptionStatus = {
            has_subscription: false,
            is_active: false,
            subscription_id: null,
            plan_name: 'No Plan',
            remaining_days: 0
          };
        }

        return response.status(200).json({
          success: true,
          msg: ['User found successfully', 'उपयोगकर्ता सफलतापूर्वक मिला', 'वापरकर्ता यशस्वीरित्या सापडला'],
          data: {
            user: {
              user_id: user.user_id,
              name: user.name || 'N/A',
              email: user.email || 'N/A',
              mobile: user.mobile,
              phone_code: user.phone_code,
              user_type: user.user_type,
              active_flag: user.active_flag,
              created_at: moment(user.user_created_at).format('DD/MM/YYYY HH:mm A')
            },
            current_subscription: subscriptionStatus
          }
        });
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
 * Get All Available Subscription Plans Controller
 * Returns all active subscription plans for manual upgrade selection
 */
const getAvailablePlans = async (request, response) => {
  try {
    const plansQuery = `
      SELECT 
        subscription_id,
        description as plan_name,
        text as plan_description,
        amount as plan_price,
        subscription_type,
        validity_days,
        features
      FROM subscription_master 
      WHERE delete_flag = 0 
      ORDER BY subscription_id ASC
    `;

    connection.query(plansQuery, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const availablePlans = result.map(plan => {
        // Parse features from JSON string to array
        let featuresArray = [];
        if (plan.features) {
          try {
            const parsed = JSON.parse(plan.features);
            if (Array.isArray(parsed)) {
              featuresArray = parsed;
            }
          } catch (e) {
            featuresArray = [];
          }
        }

        return {
          subscription_id: plan.subscription_id,
          plan_name: plan.plan_name,
          plan_description: plan.plan_description,
          plan_price: plan.plan_price,
          subscription_type: plan.subscription_type,
          subscription_type_label:
            plan.subscription_type == 0 ? "Free or Referral" :
              plan.subscription_type == 1 ? "Yearly" :
                plan.subscription_type == 2 ? "Monthly" :
                  plan.subscription_type == 3 ? "Lifetime" :
                    plan.subscription_type == 4 ? "Other" :
                      "Unknown",
          validity_days: plan.validity_days,
          features: featuresArray.length > 0 ? featuresArray : (getPlanFeatures ? getPlanFeatures(plan.subscription_type) : [])
        };
      });

      return response.status(200).json({
        success: true,
        msg: [
          "Available plans retrieved successfully",
          "उपलब्ध प्लान सफलतापूर्वक प्राप्त",
          "उपलब्ध प्लॅन्स यशस्वीरित्या पुनर्प्राप्त"
        ],
        data: {
          total_plans: availablePlans.length,
          plans: availablePlans
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
 * Manual Upgrade User Subscription Controller
 * Upgrades user subscription manually by admin
 */
const manualUpgradeUser = async (request, response) => {
  try {
    // Log request body for debugging
    console.log('Manual Upgrade Request Body:', JSON.stringify(request.body));
    console.log('Request Body Type:', typeof request.body);
    console.log('Request Body Keys:', Object.keys(request.body || {}));

    const { user_mobile, subscription_id, upgrade_reason } = request.body;

    // Validate required fields - check for null, undefined, or empty string
    // Note: subscription_id can be 0, so we check for null/undefined specifically
    if (!user_mobile || user_mobile.trim() === '' || subscription_id === null || subscription_id === undefined || subscription_id === '') {
      console.log('Validation failed - user_mobile:', user_mobile, 'subscription_id:', subscription_id);
      return response.status(200).json({
        success: false,
        msg: ['user_mobile and subscription_id are required', 'user_mobile और subscription_id आवश्यक हैं', 'user_mobile आणि subscription_id आवश्यक आहेत'],
        key: "required_fields",
        received_data: {
          user_mobile: user_mobile || null,
          subscription_id: subscription_id !== null && subscription_id !== undefined ? subscription_id : null
        }
      });
    }

    // Convert subscription_id to integer if it's a string
    const subscriptionIdInt = parseInt(subscription_id, 10);
    if (isNaN(subscriptionIdInt)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid subscription_id format', 'अमान्य subscription_id प्रारूप', 'अवैध subscription_id स्वरूप'],
        key: "invalid_subscription_id"
      });
    }

    // Check if user exists
    const userQuery = "SELECT user_id, name, email, mobile FROM user_master WHERE mobile = ? AND delete_flag = 0";

    connection.query(userQuery, [user_mobile], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['User not found with this mobile number', 'इस मोबाइल नंबर से कोई उपयोगकर्ता नहीं मिला', 'या मोबाइल नंबरसह कोणतेही वापरकर्ते सापडले नाहीत'],
          key: "user_not_found"
        });
      }

      const user = userResult[0];

      // Check if subscription plan exists
      const planQuery = "SELECT subscription_id, description, amount, subscription_type, validity_days FROM subscription_master WHERE subscription_id = ? AND delete_flag = 0";

      connection.query(planQuery, [subscriptionIdInt], (planErr, planResult) => {
        if (planErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: planErr.message
          });
        }

        if (planResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Subscription plan not found', 'सब्सक्रिप्शन प्लान नहीं मिला', 'सब्सक्रिप्शन प्लॅन सापडले नाही'],
            key: "plan_not_found"
          });
        }

        const plan = planResult[0];

        // Get user's current subscription
        const currentSubQuery = `
          SELECT 
            usm.user_subscription_id,
            usm.subscription_id as current_subscription_id,
            usm.amount as current_amount,
            usm.start_date,
            usm.end_date,
            sm.description as current_plan_name
          FROM user_subscription_master usm
          LEFT JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
          WHERE usm.user_id = ? AND usm.delete_flag = 0
          ORDER BY usm.user_subscription_id DESC
          LIMIT 1
        `;

        connection.query(currentSubQuery, [user.user_id], (currentSubErr, currentSubResult) => {
          if (currentSubErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: currentSubErr.message
            });
          }

          const currentSubscription = currentSubResult.length > 0 ? currentSubResult[0] : null;
          const fromPlan = currentSubscription ? currentSubscription.current_plan_name : "No Plan";

          // Calculate new subscription dates
          const now = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata');
          const startDate = now.format('YYYY-MM-DD HH:mm:ss');
          const endDate = now.clone().add(plan.validity_days, 'days').format('YYYY-MM-DD HH:mm:ss');

          // Expire current active subscription if exists
          const expireCurrentPlanPromise = new Promise((resolve, reject) => {
            if (currentSubscription && moment(currentSubscription.end_date).isAfter(now)) {
              const expireQuery = "UPDATE user_subscription_master SET end_date = ? WHERE user_subscription_id = ?";
              connection.query(expireQuery, [startDate, currentSubscription.user_subscription_id], (expireErr) => {
                if (expireErr) {
                  console.error("Failed to expire current subscription:", expireErr);
                  // We continue even if expire fails, or should we stop? 
                  // Ideally we should stop or at least log. Proceeding logic wise.
                }
                resolve();
              });
            } else {
              resolve();
            }
          });

          expireCurrentPlanPromise.then(() => {


            // Create new subscription record
            const insertSubscriptionQuery = `
            INSERT INTO user_subscription_master 
            (user_id, subscription_id, amount, subscription_type, start_date, end_date, 
             razorpay_order_id, razorpay_payment_id, upgrade_type, upgrade_reason, 
             createtime, updatetime) 
            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'manual', ?, ?, ?)
          `;

            const insertValues = [
              user.user_id,
              subscriptionIdInt,
              plan.amount,
              plan.subscription_type,
              startDate,
              endDate,
              upgrade_reason || 'Manual upgrade by admin',
              startDate,
              startDate
            ];

            connection.query(insertSubscriptionQuery, insertValues, (insertErr, insertResult) => {
              if (insertErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: insertErr.message
                });
              }

              const newSubscriptionId = insertResult.insertId;

              // Log the manual upgrade
              const logUpgradeQuery = `
              INSERT INTO manual_upgrade_log 
              (user_id, user_mobile, from_subscription_id, to_subscription_id, 
               from_plan_name, to_plan_name, upgrade_amount, upgrade_reason, 
               admin_id, status, createtime) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)
            `;

              const logValues = [
                user.user_id,
                user_mobile,
                currentSubscription ? currentSubscription.current_subscription_id : null,
                subscriptionIdInt,
                fromPlan,
                plan.description,
                plan.amount,
                upgrade_reason || 'Manual upgrade by admin',
                request.adminId || 1, // Admin ID from token
                startDate
              ];

              connection.query(logUpgradeQuery, logValues, (logErr) => {
                if (logErr) {
                  console.error('Error logging manual upgrade:', logErr.message);
                }

                return response.status(200).json({
                  success: true,
                  msg: [
                    "User subscription upgraded successfully",
                    "उपयोगकर्ता सब्सक्रिप्शन सफलतापूर्वक अपग्रेड किया गया",
                    "वापरकर्ता सब्सक्रिप्शन यशस्वीरित्या अपग्रेड केले"
                  ],
                  data: {
                    upgrade_id: newSubscriptionId,
                    user: {
                      user_id: user.user_id,
                      name: user.name,
                      email: user.email,
                      mobile: user.mobile
                    },
                    from_plan: fromPlan,
                    to_plan: plan.description,
                    plan_price: plan.amount,
                    subscription_type: plan.subscription_type,
                    subscription_type_label:
                      plan.subscription_type == 0 ? "Free or Referral" :
                        plan.subscription_type == 1 ? "Yearly" :
                          plan.subscription_type == 2 ? "Monthly" :
                            plan.subscription_type == 3 ? "Lifetime" :
                              plan.subscription_type == 4 ? "Other" :
                                "Unknown",
                    validity_days: plan.validity_days,
                    start_date: moment(startDate).format('DD/MM/YYYY'),
                    end_date: moment(endDate).format('DD/MM/YYYY'),
                    upgrade_reason: upgrade_reason || 'Manual upgrade by admin',
                    upgraded_at: moment(startDate).format('DD/MM/YYYY HH:mm:ss')
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
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Get Manual Upgrade History Controller
 * Returns all manual upgrades performed by admin
 */
const getManualUpgradeHistory = async (request, response) => {
  try {
    const {
      page = 1,
      limit = 50,
      status = 'all',
      search = '',
      start_date = null,
      end_date = null
    } = request.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build the main query
    let query = `
      SELECT 
        mul.upgrade_id,
        mul.user_id,
        mul.user_mobile,
        mul.from_subscription_id,
        mul.to_subscription_id,
        mul.from_plan_name,
        mul.to_plan_name,
        mul.upgrade_amount,
        mul.upgrade_reason,
        mul.admin_id,
        mul.status,
        mul.createtime,
        u.name as user_name,
        u.email as user_email,
        sm.description as plan_description,
        sm.subscription_type
      FROM manual_upgrade_log mul
      LEFT JOIN user_master u ON mul.user_id = u.user_id
      LEFT JOIN subscription_master sm ON mul.to_subscription_id = sm.subscription_id
      WHERE 1=1
    `;

    const queryParams = [];

    // Filter by status
    if (status !== 'all') {
      query += ` AND mul.status = ?`;
      queryParams.push(status);
    }

    // Search by mobile, email, or name
    if (search) {
      query += ` AND (mul.user_mobile LIKE ? OR u.email LIKE ? OR u.name LIKE ?)`;
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Filter by date range
    if (start_date) {
      query += ` AND DATE(mul.createtime) >= ?`;
      queryParams.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(mul.createtime) <= ?`;
      queryParams.push(end_date);
    }

    // Get total count for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const totalRecords = countResult[0].total;

      // Add ordering and pagination
      query += ` ORDER BY mul.createtime DESC LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), offset);

      connection.query(query, queryParams, (err, result) => {
        if (err) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: err.message
          });
        }

        const upgradeHistory = result.map(upgrade => ({
          upgrade_id: upgrade.upgrade_id,
          user: {
            user_id: upgrade.user_id,
            name: upgrade.user_name,
            email: upgrade.user_email,
            mobile: upgrade.user_mobile
          },
          from_plan: upgrade.from_plan_name,
          to_plan: upgrade.to_plan_name,
          plan_description: upgrade.plan_description,
          upgrade_amount: upgrade.upgrade_amount,
          upgrade_reason: upgrade.upgrade_reason,
          subscription_type: upgrade.subscription_type,
          subscription_type_label:
            upgrade.subscription_type == 0 ? "Free or Referral" :
              upgrade.subscription_type == 1 ? "Yearly" :
                upgrade.subscription_type == 2 ? "Monthly" :
                  upgrade.subscription_type == 3 ? "Lifetime" :
                    upgrade.subscription_type == 4 ? "Other" :
                      "Unknown",
          status: upgrade.status,
          status_label: upgrade.status === 'success' ? 'Success' :
            upgrade.status === 'failed' ? 'Failed' : 'Pending',
          upgraded_at: moment(upgrade.createtime).format('DD/MM/YYYY'),
          upgraded_timestamp: moment(upgrade.createtime).format('DD/MM/YYYY HH:mm:ss')
        }));

        // Calculate summary statistics
        const summary = {
          total_upgrades: totalRecords,
          successful_upgrades: result.filter(u => u.status === 'success').length,
          failed_upgrades: result.filter(u => u.status === 'failed').length,
          pending_upgrades: result.filter(u => u.status === 'pending').length,
          total_revenue: result.reduce((sum, upgrade) => sum + parseFloat(upgrade.upgrade_amount || 0), 0),
          successful_revenue: result.filter(u => u.status === 'success').reduce((sum, upgrade) => sum + parseFloat(upgrade.upgrade_amount || 0), 0)
        };

        return response.status(200).json({
          success: true,
          msg: [
            "Manual upgrade history retrieved successfully",
            "मैनुअल अपग्रेड इतिहास सफलतापूर्वक प्राप्त",
            "मॅन्युअल अपग्रेड इतिहास यशस्वीरित्या पुनर्प्राप्त"
          ],
          data: {
            upgrade_history: upgradeHistory,
            summary: summary,
            pagination: {
              current_page: parseInt(page),
              per_page: parseInt(limit),
              total_records: totalRecords,
              total_pages: Math.ceil(totalRecords / parseInt(limit)),
              has_next_page: offset + parseInt(limit) < totalRecords,
              has_prev_page: parseInt(page) > 1
            }
          }
        });
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
 * Get Manual Upgrade Statistics Controller
 * Returns summary statistics for manual upgrades
 */
const getManualUpgradeStats = async (request, response) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_upgrades,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_upgrades,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_upgrades,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_upgrades,
        SUM(CASE WHEN status = 'success' THEN upgrade_amount ELSE 0 END) as total_revenue,
        COUNT(CASE WHEN DATE(createtime) = CURDATE() THEN 1 END) as today_upgrades,
        COUNT(CASE WHEN DATE(createtime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as weekly_upgrades,
        COUNT(CASE WHEN DATE(createtime) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 END) as monthly_upgrades
      FROM manual_upgrade_log
    `;

    connection.query(statsQuery, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const stats = result[0];

      return response.status(200).json({
        success: true,
        msg: [
          "Manual upgrade statistics retrieved successfully",
          "मैनुअल अपग्रेड आंकड़े सफलतापूर्वक प्राप्त",
          "मॅन्युअल अपग्रेड आकडेवारी यशस्वीरित्या पुनर्प्राप्त"
        ],
        data: {
          total_upgrades: stats.total_upgrades,
          successful_upgrades: stats.successful_upgrades,
          failed_upgrades: stats.failed_upgrades,
          pending_upgrades: stats.pending_upgrades,
          total_revenue: stats.total_revenue || 0,
          today_upgrades: stats.today_upgrades,
          weekly_upgrades: stats.weekly_upgrades,
          monthly_upgrades: stats.monthly_upgrades,
          success_rate: stats.total_upgrades > 0 ? Math.round((stats.successful_upgrades / stats.total_upgrades) * 100 * 100) / 100 : 0
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

// Helper function to get plan features based on subscription type
function getPlanFeatures(subscriptionType) {
  const features = {
    0: ["Special Access", "Limited Features"], // Special plans
    1: ["Yearly Access", "All Features", "Priority Support"], // Yearly
    2: ["Monthly Access", "Basic Features", "Email Support"], // Monthly
    3: ["Lifetime Access", "All Features", "Premium Support"] // Lifetime
  };
  return features[subscriptionType] || ["Basic Access"];
}

/**
 * Bulk Manual Upgrade User Subscriptions Controller
 * Upgrades multiple user subscriptions manually by admin
 */
const bulkManualUpgradeUsers = async (request, response) => {
  try {
    const { user_mobiles, subscription_id, upgrade_reason } = request.body;

    // Validate required fields
    if (!user_mobiles || !Array.isArray(user_mobiles) || user_mobiles.length === 0 || subscription_id === null || subscription_id === undefined || subscription_id === '') {
      return response.status(200).json({
        success: false,
        msg: ['user_mobiles (array) and subscription_id are required', 'user_mobiles (array) और subscription_id आवश्यक हैं', 'user_mobiles (array) आणि subscription_id आवश्यक आहेत'],
        key: "required_fields"
      });
    }

    const subscriptionIdInt = parseInt(subscription_id, 10);
    if (isNaN(subscriptionIdInt)) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid subscription_id format', 'अमान्य subscription_id प्रारूप', 'अवैध subscription_id स्वरूप'],
        key: "invalid_subscription_id"
      });
    }

    // Check if subscription plan exists
    const planQuery = "SELECT subscription_id, description, amount, subscription_type, validity_days FROM subscription_master WHERE subscription_id = ? AND delete_flag = 0";

    connection.query(planQuery, [subscriptionIdInt], async (planErr, planResult) => {
      if (planErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: planErr.message
        });
      }

      if (planResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Subscription plan not found', 'सब्सक्रिप्शन प्लान नहीं मिला', 'सब्सक्रिप्शन प्लॅन सापडले नाही'],
          key: "plan_not_found"
        });
      }

      const plan = planResult[0];
      const now = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata');
      const startDate = now.format('YYYY-MM-DD HH:mm:ss');
      const endDate = now.clone().add(plan.validity_days, 'days').format('YYYY-MM-DD HH:mm:ss');
      const upgradeReasonText = upgrade_reason || 'Bulk manual upgrade by admin';
      const adminId = request.adminId || 1;

      const results = {
        success: [],
        failed: []
      };

      // Process each user
      for (const mobile of user_mobiles) {
        try {
          // Wrap each user upgrade in a promise to handle it sequentially or using Promise.all (loop is easier for complex logic)
          await new Promise((resolve, reject) => {
            // Check if user exists
            const userQuery = "SELECT user_id, name FROM user_master WHERE mobile = ? AND delete_flag = 0";
            connection.query(userQuery, [mobile], (userErr, userResult) => {
              if (userErr || userResult.length === 0) {
                results.failed.push({ mobile, reason: userErr ? userErr.message : 'User not found' });
                return resolve();
              }

              const user = userResult[0];

              // Get current subscription to expire it
              const currentSubQuery = `
                SELECT user_subscription_id, end_date, sm.description as current_plan_name, usm.subscription_id as current_subscription_id
                FROM user_subscription_master usm
                LEFT JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
                WHERE usm.user_id = ? AND usm.delete_flag = 0
                ORDER BY usm.user_subscription_id DESC
                LIMIT 1
              `;

              connection.query(currentSubQuery, [user.user_id], (currentErr, currentResult) => {
                const currentSub = currentResult && currentResult.length > 0 ? currentResult[0] : null;
                const fromPlan = currentSub ? currentSub.current_plan_name : "No Plan";

                // Expire current plan if active
                const proceedToUpgrade = () => {
                  // Create new subscription
                  const insertSubQuery = `
                    INSERT INTO user_subscription_master 
                    (user_id, subscription_id, amount, subscription_type, start_date, end_date, 
                     upgrade_type, upgrade_reason, createtime, updatetime) 
                    VALUES (?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)
                  `;
                  const insertValues = [user.user_id, subscriptionIdInt, plan.amount, plan.subscription_type, startDate, endDate, upgradeReasonText, startDate, startDate];

                  connection.query(insertSubQuery, insertValues, (insertErr) => {
                    if (insertErr) {
                      results.failed.push({ mobile, reason: 'Failed to insert subscription: ' + insertErr.message });
                      return resolve();
                    }

                    // Log the upgrade
                    const logQuery = `
                      INSERT INTO manual_upgrade_log 
                      (user_id, user_mobile, from_subscription_id, to_subscription_id, 
                       from_plan_name, to_plan_name, upgrade_amount, upgrade_reason, 
                       admin_id, status, createtime) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', ?)
                    `;
                    const logValues = [user.user_id, mobile, currentSub ? currentSub.current_subscription_id : null, subscriptionIdInt, fromPlan, plan.description, plan.amount, upgradeReasonText, adminId, startDate];

                    connection.query(logQuery, logValues, (logErr) => {
                      if (logErr) console.error(`Error logging bulk upgrade for ${mobile}:`, logErr.message);
                      results.success.push({ mobile, name: user.name });
                      resolve();
                    });
                  });
                };

                if (currentSub && moment(currentSub.end_date).isAfter(now)) {
                  const expireQuery = "UPDATE user_subscription_master SET end_date = ? WHERE user_subscription_id = ?";
                  connection.query(expireQuery, [startDate, currentSub.user_subscription_id], (expireErr) => {
                    if (expireErr) console.error(`Failed to expire sub for ${mobile}:`, expireErr.message);
                    proceedToUpgrade();
                  });
                } else {
                  proceedToUpgrade();
                }
              });
            });
          });
        } catch (err) {
          results.failed.push({ mobile, reason: err.message });
        }
      }

      return response.status(200).json({
        success: true,
        msg: [
          `Bulk upgrade completed: ${results.success.length} succeeded, ${results.failed.length} failed`,
          `बल्क अपग्रेड पूरा हुआ: ${results.success.length} सफल, ${results.failed.length} विफल`,
          `बल्क अपग्रेड पूर्ण झाले: ${results.success.length} यशस्वी, ${results.failed.length} अपयशी`
        ],
        data: results
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

export {
  searchUsersByMobileAutocomplete,
  searchUserByMobile,
  getAvailablePlans,
  manualUpgradeUser,
  bulkManualUpgradeUsers,
  getManualUpgradeHistory,
  getManualUpgradeStats
};
