import connection from '../connection/dbConfig.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';
import { adminRegisterSchema, adminLoginSchema, adminCreateCategorySchema, adminUpdateCategorySchema, adminDeleteCategorySchema } from '../validations/signUpWithMobile.js';
import { FCMAPI } from './notificationController.js';

const SECRET_KEY = process.env.SECRET_KEY || 'DaliyHisab';
const SALT_ROUNDS = 10;

/**
 * Admin Registration Controller
 * Creates a new admin account with hashed password
 */
const adminRegister = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = adminRegisterSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { username, email, password } = value;

    const createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Check if username already exists
    const checkUsernameQuery = "SELECT admin_id FROM admin_master WHERE username = ? AND status = 1";
    connection.query(checkUsernameQuery, [username], (usernameErr, usernameResult) => {
      if (usernameErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: usernameErr.message
        });
      }

      if (usernameResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Username already exists', 'उपयोगकर्ता नाम पहले से मौजूद है', 'वापरकर्तानाव आधीपासून अस्तित्वात आहे']
        });
      }

      // Check if email already exists
      const checkEmailQuery = "SELECT admin_id FROM admin_master WHERE email = ? AND status = 1";
      connection.query(checkEmailQuery, [email], (emailErr, emailResult) => {
        if (emailErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: emailErr.message
          });
        }

        if (emailResult.length > 0) {
          return response.status(200).json({
            success: false,
            msg: ['Email already exists', 'ईमेल पहले से मौजूद है', 'ईमेल आधीपासून अस्तित्वात आहे']
          });
        }

        // Hash the password
        bcrypt.hash(password, SALT_ROUNDS, (hashErr, hashedPassword) => {
          if (hashErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: hashErr.message
            });
          }

          // Insert new admin
          const insertQuery = "INSERT INTO admin_master (username, email, password, status, createtime, updatetime) VALUES (?, ?, ?, ?, ?, ?)";
          const insertValues = [username, email, hashedPassword, 1, createtime, createtime];

          connection.query(insertQuery, insertValues, (insertErr, insertResult) => {
            if (insertErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: insertErr.message
              });
            }

            // Generate JWT token
            const payload = {
              admin_id: insertResult.insertId,
              username: username,
              type: 'admin'
            };
            const token = jwt.sign(payload, SECRET_KEY);

            // Return success response
            return response.status(200).json({
              success: true,
              msg: ['Admin registered successfully', 'एडमिन सफलतापूर्वक पंजीकृत', 'प्रशासक यशस्वीरित्या नोंदणीकृत'],
              data: {
                admin_id: insertResult.insertId,
                username: username,
                email: email,
                status: 1,
                createtime: createtime,
                token: token
              }
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
 * Admin Login Controller
 * Authenticates admin with email and password
 */
const adminLogin = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = adminLoginSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { email, password } = value;

    // Check if admin exists (search by email only)
    const checkAdminQuery = "SELECT admin_id, username, email, password, status FROM admin_master WHERE email = ? AND status = 1";

    connection.query(checkAdminQuery, [email], (dbErr, adminResult) => {
      if (dbErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: dbErr.message
        });
      }

      if (adminResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Invalid credentials', 'अमान्य क्रेडेंशियल', 'अवैध क्रेडेन्शियल']
        });
      }

      const admin = adminResult[0];

      // Verify password
      bcrypt.compare(password, admin.password, (compareErr, isMatch) => {
        if (compareErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: compareErr.message
          });
        }

        if (!isMatch) {
          return response.status(200).json({
            success: false,
            msg: ['Invalid credentials', 'अमान्य क्रेडेंशियल', 'अवैध क्रेडेन्शियल']
          });
        }

        // Generate JWT token
        const payload = {
          admin_id: admin.admin_id,
          username: admin.username,
          type: 'admin'
        };
        const token = jwt.sign(payload, SECRET_KEY);

        // Update last login time
        const updateLoginQuery = "UPDATE admin_master SET updatetime = NOW() WHERE admin_id = ?";
        connection.query(updateLoginQuery, [admin.admin_id], (updateErr) => {
          if (updateErr) {
            console.error('Error updating admin login time:', updateErr.message);
          }
        });

        // Return success response
        return response.status(200).json({
          success: true,
          msg: ['Login successful', 'लॉगिन सफल', 'लॉगिन यशस्वी'],
          data: {
            admin_id: admin.admin_id,
            username: admin.username,
            email: admin.email,
            status: admin.status,
            token: token
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
 * Get All Users with Their Accounts Controller
 * Returns all users with their personal, business, and freelance accounts
 */
const getAllUsersWithAccounts = async (request, response) => {
  try {
    const { filter_status, search_query, page = 1, limit = 10 } = request.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Base query structure
    const baseJoins = `
      FROM user_master u
      LEFT JOIN (
        SELECT usm.user_id, MAX(usm.user_subscription_id) as user_subscription_id, MAX(sm.subscription_type) as subscription_type, MAX(sm.text) as subscription_name
        FROM user_subscription_master usm
        JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
        WHERE usm.end_date > NOW() AND usm.delete_flag = 0
        GROUP BY usm.user_id
      ) active_sub ON u.user_id = active_sub.user_id
    `;

    let whereClause = `WHERE u.delete_flag = 0`;
    const queryParams = [];

    // Apply filtering based on search query
    if (search_query) {
      whereClause += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`;
      const searchPattern = `%${search_query}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Apply filtering based on status
    if (filter_status === 'paid') {
      whereClause += ` AND active_sub.subscription_type IS NOT NULL AND active_sub.subscription_type != 0`;
    } else if (filter_status === 'free') {
      whereClause += ` AND (active_sub.user_subscription_id IS NULL OR active_sub.subscription_type = 0) AND NOT EXISTS (SELECT 1 FROM user_subscription_master usm2 WHERE usm2.user_id = u.user_id AND usm2.end_date <= NOW() AND usm2.delete_flag = 0)`;
    } else if (filter_status === 'expired') {
      whereClause += ` AND active_sub.user_subscription_id IS NULL AND EXISTS (SELECT 1 FROM user_subscription_master usm2 WHERE usm2.user_id = u.user_id AND usm2.end_date <= NOW() AND usm2.delete_flag = 0)`;
    } else if (filter_status === 'inactive') {
      const days = 30;
      const thresholdDate = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD HH:mm:ss');
      whereClause += ` AND (u.last_login_date_time < '${thresholdDate}' OR u.last_login_date_time IS NULL)`;
    } else if (filter_status === 'active') {
      const days = 30;
      const thresholdDate = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD HH:mm:ss');
      whereClause += ` AND u.last_login_date_time >= '${thresholdDate}'`;
    } else if (filter_status === 'profile_complete') {
      whereClause += ` AND u.profile_complete = 1`;
    } else if (filter_status === 'profile_incomplete') {
      whereClause += ` AND u.profile_complete = 0`;
    }

    // First, get total count for pagination
    const countQuery = `SELECT COUNT(DISTINCT u.user_id) as total ${baseJoins} ${whereClause}`;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const totalUsers = countResult[0].total;
      const totalPages = Math.ceil(totalUsers / limitNum);

      // Fetch paginated users
      let usersQuery = `
        SELECT 
          u.user_id, u.name, u.email, u.mobile, u.phone_code, u.user_type, 
          u.profile_complete, u.active_flag, u.image,
          u.createtime, u.updatetime, u.last_login_date_time,
          CASE 
            WHEN active_sub.subscription_type IS NOT NULL AND active_sub.subscription_type != 0 THEN 1 
            ELSE 0 
          END as is_paid_user,
          CASE 
            WHEN active_sub.subscription_type IS NOT NULL AND active_sub.subscription_type != 0 THEN 'PAID'
            WHEN active_sub.user_subscription_id IS NULL AND EXISTS (
              SELECT 1 FROM user_subscription_master usm2 
              WHERE usm2.user_id = u.user_id AND usm2.end_date <= NOW() AND usm2.delete_flag = 0
            ) THEN 'EXPIRED'
            ELSE 'FREE'
          END as subscription_status,
          active_sub.subscription_name
        ${baseJoins}
        ${whereClause}
        GROUP BY u.user_id 
        ORDER BY u.user_id DESC 
        LIMIT ? OFFSET ?
      `;

      connection.query(usersQuery, [...queryParams, limitNum, offset], (usersErr, usersResult) => {
        if (usersErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: usersErr.message
          });
        }

        if (usersResult.length === 0) {
          return response.status(200).json({
            success: true,
            msg: ['No users found', 'कोई उपयोगकर्ता नहीं मिला', 'कोणतेही वापरकर्ते सापडले नाहीत'],
            users: [],
            pagination: {
              total_users: totalUsers,
              total_pages: totalPages,
              current_page: pageNum,
              limit: limitNum
            }
          });
        }

        const userIds = usersResult.map(u => u.user_id);

        let accountsQuery = `
          SELECT user_account_id, user_id, user_type, account_name, createtime 
          FROM user_account_master 
          WHERE delete_flag = 0 AND user_id IN (${userIds.join(',')})
          ORDER BY user_id, user_type
        `;

        connection.query(accountsQuery, (accountsErr, accountsResult) => {
          if (accountsErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: accountsErr.message
            });
          }

          const accountsByUser = {};
          accountsResult.forEach(account => {
            if (!accountsByUser[account.user_id]) {
              accountsByUser[account.user_id] = { personal: [], business: [], freelance: [] };
            }

            if (account.user_type === 1) {
              accountsByUser[account.user_id].personal.push({
                user_account_id: account.user_account_id,
                account_name: account.account_name,
                createtime: moment(account.createtime).format('DD MMM, YYYY')
              });
            } else if (account.user_type === 2) {
              accountsByUser[account.user_id].business.push({
                user_account_id: account.user_account_id,
                account_name: account.account_name,
                createtime: moment(account.createtime).format('DD MMM, YYYY')
              });
            } else if (account.user_type === 3) {
              accountsByUser[account.user_id].freelance.push({
                user_account_id: account.user_account_id,
                account_name: account.account_name,
                createtime: moment(account.createtime).format('DD MMM, YYYY')
              });
            }
          });

          const usersWithAccounts = usersResult.map(user => {
            let userTypeLabel = user.user_type == 0 ? 'Manager' : 'User';

            return {
              user_id: user.user_id,
              name: user.name,
              email: user.email,
              mobile: user.mobile,
              phone_code: user.phone_code,
              user_type: user.user_type,
              user_type_label: userTypeLabel,
              profile_complete: user.profile_complete,
              active_flag: user.active_flag,
              profile_photo: user.image || null,
              createtime: moment(user.createtime).format('DD MMM, YYYY HH:mm A'),
              updatetime: moment(user.updatetime).format('DD MMM, YYYY HH:mm A'),
              is_paid_user: user.is_paid_user,
              subscription_name: user.subscription_name,
              accounts: accountsByUser[user.user_id] || { personal: [], business: [], freelance: [] },
              account_counts: {
                personal: (accountsByUser[user.user_id]?.personal || []).length,
                business: (accountsByUser[user.user_id]?.business || []).length,
                freelance: (accountsByUser[user.user_id]?.freelance || []).length,
                total: ((accountsByUser[user.user_id]?.personal || []).length +
                  (accountsByUser[user.user_id]?.business || []).length +
                  (accountsByUser[user.user_id]?.freelance || []).length)
              }
            };
          });

          return response.status(200).json({
            success: true,
            msg: ['Users retrieved successfully', 'उपयोगकर्ता सफलतापूर्वक प्राप्त', 'वापरकर्ते यशस्वीरित्या पुनर्प्राप्त'],
            users: usersWithAccounts,
            pagination: {
              total_users: totalUsers,
              total_pages: totalPages,
              current_page: pageNum,
              limit: limitNum
            }
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
 * Get Inactive Users Controller
 * Returns users who haven't logged in for a specific number of days
 */
const getInactiveUsers = async (request, response) => {
  try {
    const days = parseInt(request.query.days) || 30; // Default 30 days

    // Calculate the threshold date
    const thresholdDate = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD HH:mm:ss');

    const query = `
      SELECT 
        u.user_id, 
        u.name, 
        u.email, 
        u.mobile, 
        u.phone_code, 
        u.user_type, 
        u.profile_complete, 
        u.active_flag, 
        u.image,
        u.createtime, 
        u.updatetime, 
        u.last_login_date_time,
        CASE 
          WHEN active_sub.subscription_type IS NOT NULL AND active_sub.subscription_type != 0 THEN 1 
          ELSE 0 
        END as is_paid_user,
        active_sub.subscription_name
      FROM user_master u
      LEFT JOIN (
        SELECT usm.user_id, usm.user_subscription_id, sm.subscription_type, sm.text as subscription_name
        FROM user_subscription_master usm
        JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id
        WHERE usm.end_date > NOW() AND usm.delete_flag = 0
      ) active_sub ON u.user_id = active_sub.user_id
      WHERE u.delete_flag = 0 
      AND (u.last_login_date_time < ? OR u.last_login_date_time IS NULL)
      ORDER BY u.last_login_date_time ASC, u.user_id DESC
    `;

    connection.query(query, [thresholdDate], (err, results) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Inactive users retrieved successfully', 'निष्क्रिय उपयोगकर्ता सफलतापूर्वक प्राप्त किए गए', 'निष्क्रिय वापरकर्ते यशस्वीरित्या मिळवले'],
        count: results.length,
        days_inactive: days,
        threshold_date: thresholdDate,
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


/**
 * Create Subscription Plan Controller
 * Creates a new subscription plan in subscription_master table
 */
const createSubscriptionPlan = async (request, response) => {
  try {
    const { description, text, amount, subscription_type, validity_days, features } = request.body;

    // Validate required fields (allow amount to be 0)
    if (!description || !text || amount === undefined || amount === null || !subscription_type) {
      return response.status(200).json({
        success: false,
        msg: ['All fields are required: description, text, amount, subscription_type', 'सभी फ़ील्ड आवश्यक हैं', 'सर्व फील्ड आवश्यक आहेत'],
        key: "description, text, amount, subscription_type"
      });
    }

    // Validate subscription_type - allow 1 (Yearly), 2 (Monthly), 3 (Lifetime), or 4 (Other)
    // Prevent creating special plans (type 0)
    const validTypes = [1, 2, 3, 4];
    if (!validTypes.includes(parseInt(subscription_type))) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid subscription_type. Must be 1 (Yearly), 2 (Monthly), 3 (Lifetime), or 4 (Other). Special plans (type 0) cannot be created by admin.', 'अमान्य सब्सक्रिप्शन प्रकार। विशेष प्लान (प्रकार 0) एडमिन द्वारा नहीं बनाए जा सकते।', 'अवैध सब्सक्रिप्शन प्रकार। विशेष प्लॅन्स (प्रकार 0) एडमिन द्वारा तयार केले जाऊ शकत नाहीत।'],
        key: "subscription_type"
      });
    }

    // For "Other" type (4), validity_days is required
    if (parseInt(subscription_type) === 4 && (!validity_days || validity_days <= 0)) {
      return response.status(200).json({
        success: false,
        msg: ['For "Other" subscription type, validity_days is required', '"Other" सब्सक्रिप्शन प्रकार के लिए validity_days आवश्यक है', '"Other" सब्सक्रिप्शन प्रकारसाठी validity_days आवश्यक आहे'],
        key: "validity_days_required"
      });
    }

    // Validate amount (allow zero amount)
    if (isNaN(amount) || parseFloat(amount) < 0) {
      return response.status(200).json({
        success: false,
        msg: ['Amount must be a non-negative number', 'राशि एक गैर-नकारात्मक संख्या होनी चाहिए', 'रक्कम गैर-नकारात्मक संख्या असणे आवश्यक आहे'],
        key: "amount"
      });
    }

    // Determine validity days based on subscription type if not provided
    // For type 4 (Other), validity_days must be provided (already validated above)
    let finalValidityDays = validity_days;
    if (!validity_days || validity_days <= 0) {
      switch (parseInt(subscription_type)) {
        case 1: // Yearly
          finalValidityDays = 365;
          break;
        case 2: // Monthly
          finalValidityDays = 30;
          break;
        case 3: // Lifetime
          finalValidityDays = 3650;
          break;
        case 4: // Other - should not reach here as it's validated above
          finalValidityDays = 30;
          break;
        default:
          finalValidityDays = 30;
      }
    }

    // Validate validity_days
    if (finalValidityDays <= 0 || finalValidityDays > 36500) { // Max 100 years
      return response.status(200).json({
        success: false,
        msg: ['Validity days must be between 1 and 36500', 'वैधता दिन 1 और 36500 के बीच होना चाहिए', 'वैधता दिवस 1 आणि 36500 दरम्यान असणे आवश्यक आहे'],
        key: "validity_days"
      });
    }

    const createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Process features - convert array to JSON string if provided
    let featuresJson = null;
    if (features !== undefined && features !== null) {
      if (Array.isArray(features)) {
        // Filter out empty strings and null values
        const validFeatures = features.filter(f => f && typeof f === 'string' && f.trim() !== '');
        featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
      } else if (typeof features === 'string') {
        // If it's already a JSON string, validate it
        try {
          const parsed = JSON.parse(features);
          if (Array.isArray(parsed)) {
            const validFeatures = parsed.filter(f => f && typeof f === 'string' && f.trim() !== '');
            featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
          }
        } catch (e) {
          // If not valid JSON, treat as single feature
          if (features.trim() !== '') {
            featuresJson = JSON.stringify([features.trim()]);
          }
        }
      }
    }

    // Insert new subscription plan
    const insertQuery = "INSERT INTO subscription_master (description, text, amount, subscription_type, validity_days, features, delete_flag, createtime, updatetime) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)";
    const insertValues = [description, text, amount, subscription_type, finalValidityDays, featuresJson, createtime, createtime];

    connection.query(insertQuery, insertValues, (insertErr, insertResult) => {
      if (insertErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: insertErr.message
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Subscription plan created successfully', 'सब्सक्रिप्शन प्लान सफलतापूर्वक बनाया गया', 'सब्सक्रिप्शन प्लॅन यशस्वीरित्या तयार केले'],
        data: {
          subscription_id: insertResult.insertId,
          description: description,
          text: text,
          amount: amount,
          subscription_type: subscription_type,
          subscription_type_label: subscription_type == 1 ? "Yearly" : subscription_type == 2 ? "Monthly" : subscription_type == 3 ? "Lifetime" : subscription_type == 4 ? "Other" : "Unknown",
          validity_days: finalValidityDays,
          features: featuresJson ? JSON.parse(featuresJson) : [],
          createtime: createtime
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
 * Update Subscription Plan Controller
 * Updates an existing subscription plan
 */
const updateSubscriptionPlan = async (request, response) => {
  try {
    const { subscription_id, description, text, amount, subscription_type, validity_days, features } = request.body;

    // Validate required fields
    if (!subscription_id) {
      return response.status(200).json({
        success: false,
        msg: ['subscription_id is required', 'subscription_id आवश्यक है', 'subscription_id आवश्यक आहे'],
        key: "subscription_id"
      });
    }

    // Check if this is a special plan (Free Trial or Referral Reward)
    const isSpecialPlan = [0, 1].includes(parseInt(subscription_id));

    if (isSpecialPlan) {
      // For special plans, allow description, text, and validity_days to be updated
      // But prevent amount and subscription_type from being changed

      // Validate required fields for special plans
      if (!description || !text) {
        return response.status(200).json({
          success: false,
          msg: ['Description and text are required for special plans', 'विशेष प्लान्स के लिए description और text आवश्यक हैं', 'विशेष प्लॅन्ससाठी description आणि text आवश्यक आहेत'],
          key: "description_text_required"
        });
      }

      if (validity_days === undefined || validity_days === null) {
        return response.status(200).json({
          success: false,
          msg: ['Validity days is required for special plans', 'विशेष प्लान्स के लिए validity_days आवश्यक है', 'विशेष प्लॅन्ससाठी validity_days आवश्यक आहे'],
          key: "validity_days_required"
        });
      }

      // Validate validity_days for special plans
      if (isNaN(validity_days) || parseInt(validity_days) <= 0 || parseInt(validity_days) > 36500) {
        return response.status(200).json({
          success: false,
          msg: ['Validity days must be between 1 and 36500', 'वैधता दिन 1 और 36500 के बीच होना चाहिए', 'वैधता दिवस 1 आणि 36500 दरम्यान असणे आवश्यक आहे'],
          key: "validity_days"
        });
      }

      // Prevent amount and subscription_type from being changed for special plans
      // Get current plan to ensure amount and subscription_type are not changed
      const getCurrentPlanQuery = "SELECT amount, subscription_type FROM subscription_master WHERE subscription_id = ?";
      connection.query(getCurrentPlanQuery, [subscription_id], (getErr, getResult) => {
        if (getErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: getErr.message
          });
        }

        if (getResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Special plan not found', 'विशेष प्लान नहीं मिला', 'विशेष प्लॅन सापडले नाही'],
            key: "plan_not_found"
          });
        }

        const currentPlan = getResult[0];

        // Verify that amount and subscription_type are not being changed
        if (amount !== undefined && amount !== null && parseFloat(amount) !== parseFloat(currentPlan.amount)) {
          return response.status(200).json({
            success: false,
            msg: ['Amount cannot be changed for special plans', 'विशेष प्लान्स के लिए amount नहीं बदला जा सकता', 'विशेष प्लॅन्ससाठी amount बदलता येत नाही'],
            key: "amount_cannot_change"
          });
        }

        if (subscription_type !== undefined && subscription_type !== null && parseInt(subscription_type) !== parseInt(currentPlan.subscription_type)) {
          return response.status(200).json({
            success: false,
            msg: ['Subscription type cannot be changed for special plans', 'विशेष प्लान्स के लिए subscription_type नहीं बदला जा सकता', 'विशेष प्लॅन्ससाठी subscription_type बदलता येत नाही'],
            key: "subscription_type_cannot_change"
          });
        }

        // Process features for special plans
        let featuresJson = null;
        if (features !== undefined && features !== null) {
          if (Array.isArray(features)) {
            const validFeatures = features.filter(f => f && typeof f === 'string' && f.trim() !== '');
            featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
          } else if (typeof features === 'string') {
            try {
              const parsed = JSON.parse(features);
              if (Array.isArray(parsed)) {
                const validFeatures = parsed.filter(f => f && typeof f === 'string' && f.trim() !== '');
                featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
              }
            } catch (e) {
              if (features.trim() !== '') {
                featuresJson = JSON.stringify([features.trim()]);
              }
            }
          }
        }

        // For special plans, update description, text, validity_days, and features
        const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        const updateQuery = "UPDATE subscription_master SET description = ?, text = ?, validity_days = ?, features = ?, updatetime = ? WHERE subscription_id = ?";

        connection.query(updateQuery, [description, text, validity_days, featuresJson, updatetime, subscription_id], (updateErr, updateResult) => {
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
              msg: ['Special plan not found', 'विशेष प्लान नहीं मिला', 'विशेष प्लॅन सापडले नाही'],
              key: "plan_not_found"
            });
          }

          return response.status(200).json({
            success: true,
            msg: ['Special plan updated successfully', 'विशेष प्लान सफलतापूर्वक अपडेट किया गया', 'विशेष प्लॅन यशस्वीरित्या अपडेट केले'],
            data: {
              subscription_id: subscription_id,
              description: description,
              text: text,
              validity_days: validity_days,
              features: featuresJson ? JSON.parse(featuresJson) : [],
              amount: currentPlan.amount, // Return original amount
              subscription_type: currentPlan.subscription_type, // Return original subscription_type
              updatetime: updatetime,
              message: 'Description, text, validity_days, and features were updated. Amount and subscription_type cannot be changed for special plans.'
            }
          });
        });
      });

      return; // Exit early for special plans
    }

    // For regular plans, validate all fields (allow amount to be 0)
    if (!description || !text || amount === undefined || amount === null || !subscription_type) {
      return response.status(200).json({
        success: false,
        msg: ['All fields are required: description, text, amount, subscription_type', 'सभी फ़ील्ड आवश्यक हैं', 'सर्व फील्ड आवश्यक आहेत'],
        key: "description, text, amount, subscription_type"
      });
    }

    // Validate subscription_type for regular plans - allow 1, 2, 3, or 4 (Other)
    const validTypes = [1, 2, 3, 4];
    if (!validTypes.includes(parseInt(subscription_type))) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid subscription_type. Must be 1 (Yearly), 2 (Monthly), 3 (Lifetime), or 4 (Other)', 'अमान्य सब्सक्रिप्शन प्रकार', 'अवैध सब्सक्रिप्शन प्रकार'],
        key: "subscription_type"
      });
    }

    // For "Other" type (4), validity_days is required
    if (parseInt(subscription_type) === 4 && (!validity_days || validity_days <= 0)) {
      return response.status(200).json({
        success: false,
        msg: ['For "Other" subscription type, validity_days is required', '"Other" सब्सक्रिप्शन प्रकार के लिए validity_days आवश्यक है', '"Other" सब्सक्रिप्शन प्रकारसाठी validity_days आवश्यक आहे'],
        key: "validity_days_required"
      });
    }

    // Validate amount for regular plans (allow zero amount)
    if (isNaN(amount) || parseFloat(amount) < 0) {
      return response.status(200).json({
        success: false,
        msg: ['Amount must be a non-negative number', 'राशि एक गैर-नकारात्मक संख्या होनी चाहिए', 'रक्कम गैर-नकारात्मक संख्या असणे आवश्यक आहे'],
        key: "amount"
      });
    }

    // Determine validity days based on subscription type if not provided
    // For type 4 (Other), validity_days must be provided (already validated above)
    let finalValidityDays = validity_days;
    if (!validity_days || validity_days <= 0) {
      switch (parseInt(subscription_type)) {
        case 1: // Yearly
          finalValidityDays = 365;
          break;
        case 2: // Monthly
          finalValidityDays = 30;
          break;
        case 3: // Lifetime
          finalValidityDays = 3650;
          break;
        case 4: // Other - should not reach here as it's validated above
          finalValidityDays = 30;
          break;
        default:
          finalValidityDays = 30;
      }
    }

    // Validate validity_days
    if (finalValidityDays <= 0 || finalValidityDays > 36500) { // Max 100 years
      return response.status(200).json({
        success: false,
        msg: ['Validity days must be between 1 and 36500', 'वैधता दिन 1 और 36500 के बीच होना चाहिए', 'वैधता दिवस 1 आणि 36500 दरम्यान असणे आवश्यक आहे'],
        key: "validity_days"
      });
    }

    const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Process features for regular plans
    let featuresJson = null;
    if (features !== undefined && features !== null) {
      if (Array.isArray(features)) {
        const validFeatures = features.filter(f => f && typeof f === 'string' && f.trim() !== '');
        featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
      } else if (typeof features === 'string') {
        try {
          const parsed = JSON.parse(features);
          if (Array.isArray(parsed)) {
            const validFeatures = parsed.filter(f => f && typeof f === 'string' && f.trim() !== '');
            featuresJson = validFeatures.length > 0 ? JSON.stringify(validFeatures) : null;
          }
        } catch (e) {
          if (features.trim() !== '') {
            featuresJson = JSON.stringify([features.trim()]);
          }
        }
      }
    }

    // Check if subscription plan exists (for regular plans)
    const checkQuery = "SELECT subscription_id FROM subscription_master WHERE subscription_id = ? AND delete_flag = 0";
    connection.query(checkQuery, [subscription_id], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Subscription plan not found', 'सब्सक्रिप्शन प्लान नहीं मिला', 'सब्सक्रिप्शन प्लॅन सापडले नाही'],
          key: "subscription_not_found"
        });
      }

      // Update subscription plan (for regular plans) - include features
      const updateQuery = "UPDATE subscription_master SET description = ?, text = ?, amount = ?, subscription_type = ?, validity_days = ?, features = ?, updatetime = ? WHERE subscription_id = ?";
      const updateValues = [description, text, amount, subscription_type, finalValidityDays, featuresJson, updatetime, subscription_id];

      connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Subscription plan updated successfully', 'सब्सक्रिप्शन प्लान सफलतापूर्वक अपडेट किया गया', 'सब्सक्रिप्शन प्लॅन यशस्वीरित्या अपडेट केले'],
          data: {
            subscription_id: subscription_id,
            description: description,
            text: text,
            amount: amount,
            subscription_type: subscription_type,
            subscription_type_label: subscription_type == 1 ? "Yearly" : subscription_type == 2 ? "Monthly" : subscription_type == 3 ? "Lifetime" : subscription_type == 4 ? "Other" : "Unknown",
            validity_days: finalValidityDays,
            features: featuresJson ? JSON.parse(featuresJson) : [],
            updatetime: updatetime
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
 * Delete Subscription Plan Controller
 * Soft deletes a subscription plan
 */
const deleteSubscriptionPlan = async (request, response) => {
  try {
    const { subscription_id } = request.body;

    if (!subscription_id) {
      return response.status(200).json({
        success: false,
        msg: ['subscription_id is required', 'subscription_id आवश्यक है', 'subscription_id आवश्यक आहे'],
        key: "subscription_id"
      });
    }

    // Check if subscription plan exists and get its details
    const checkQuery = "SELECT subscription_id, amount, subscription_type FROM subscription_master WHERE subscription_id = ?";
    connection.query(checkQuery, [subscription_id], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Subscription plan not found', 'सब्सक्रिप्शन प्लान नहीं मिला', 'सब्सक्रिप्शन प्लॅन सापडले नाही'],
          key: "subscription_not_found"
        });
      }

      const plan = checkResult[0];

      // Only prevent deletion of plans with subscription_type = 0 (special plans)
      // All other plans (including amount = 0) can be deleted
      if (parseInt(plan.subscription_type) === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Plans with subscription_type = 0 cannot be deleted', 'subscription_type = 0 वाले प्लान्स को हटाया नहीं जा सकता', 'subscription_type = 0 असलेले प्लॅन्स हटवले जाऊ शकत नाहीत'],
          key: "subscription_type_zero_cannot_delete"
        });
      }

      // Permanently delete subscription plan (DELETE instead of UPDATE)
      const deleteQuery = "DELETE FROM subscription_master WHERE subscription_id = ?";
      connection.query(deleteQuery, [subscription_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Subscription plan permanently deleted successfully', 'सब्सक्रिप्शन प्लान स्थायी रूप से हटाया गया', 'सब्सक्रिप्शन प्लॅन कायमस्वरूपी हटवले'],
          data: {
            subscription_id: subscription_id,
            deleted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Get All Payment History (Admin) Controller
 * Returns all user payment history with user details for admin management
 */
const getAllPaymentHistory = async (request, response) => {
  try {
    const {
      page = 1,
      limit = 50,
      status = 'all',
      user_id = null,
      start_date = null,
      end_date = null,
      subscription_type = 'all'
    } = request.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build the main query with user details
    let query = `
      SELECT 
        ro.razorpay_order_id,
        ro.razorpay_payment_id,
        ro.user_id,
        ro.amount,
        ro.currency,
        ro.status,
        ro.createtime,
        ro.updatetime,
        sm.description as plan_name,
        sm.subscription_type,
        sm.subscription_type as plan_type,
        usm.start_date,
        usm.end_date,
        um.name as user_name,
        um.email as user_email,
        um.mobile as user_mobile,
        um.phone_code as user_phone_code
      FROM razorpay_orders ro
      LEFT JOIN subscription_master sm ON ro.subscription_id = sm.subscription_id
      LEFT JOIN user_subscription_master usm ON ro.razorpay_order_id = usm.razorpay_order_id
      LEFT JOIN user_master um ON ro.user_id = um.user_id
      WHERE 1=1
    `;

    const queryParams = [];

    // Note: Status is now fixed to 'paid' only (see line ~977)
    // The status filter parameter is kept for backward compatibility but not used

    // Filter by user_id
    if (user_id) {
      query += ` AND ro.user_id = ?`;
      queryParams.push(user_id);
    }

    // Filter by subscription type
    if (subscription_type !== 'all') {
      query += ` AND sm.subscription_type = ?`;
      queryParams.push(subscription_type);
    }

    // Filter by date range
    if (start_date) {
      query += ` AND DATE(ro.createtime) >= ?`;
      queryParams.push(start_date);
    }

    if (end_date) {
      query += ` AND DATE(ro.createtime) <= ?`;
      queryParams.push(end_date);
    }

    // MANDATORY: Only show paid/successful payments (filter out created, pending, failed)
    query += ` AND ro.status = 'paid'`;

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
      query += ` ORDER BY ro.createtime DESC LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), offset);

      connection.query(query, queryParams, (err, result) => {
        if (err) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: err.message
          });
        }

        const paymentHistory = result.map(payment => ({
          transaction_id: payment.razorpay_payment_id,
          order_id: payment.razorpay_order_id,
          user_id: payment.user_id,
          user_name: payment.user_name,
          user_email: payment.user_email,
          user_mobile: payment.user_mobile,
          user_phone_code: payment.user_phone_code,
          plan_name: payment.plan_name,
          subscription_type: payment.subscription_type,
          subscription_type_label:
            payment.subscription_type == 0 ? "Free Trial" :
              payment.subscription_type == 1 ? "Yearly" :
                payment.subscription_type == 2 ? "Monthly" :
                  payment.subscription_type == 3 ? "Lifetime" :
                    payment.subscription_type == 4 ? "Other" :
                      "Unknown",
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          status_label: payment.status === 'paid' ? 'Success' :
            payment.status === 'pending' ? 'Pending' :
              payment.status === 'failed' ? 'Failed' : 'Unknown',
          payment_date: moment(payment.createtime).format('DD MMM, YYYY HH:mm A'),
          start_date: payment.start_date ? moment(payment.start_date).format('DD MMM, YYYY') : null,
          end_date: payment.end_date ? moment(payment.end_date).format('DD MMM, YYYY') : null,
          created_at: moment(payment.createtime).format('DD MMM, YYYY HH:mm A'),
          updated_at: moment(payment.updatetime).format('DD MMM, YYYY HH:mm A')
        }));

        // Calculate summary statistics
        const summary = {
          total_payments: totalRecords,
          successful_payments: result.filter(p => p.status === 'paid').length,
          pending_payments: result.filter(p => p.status === 'pending').length,
          failed_payments: result.filter(p => p.status === 'failed').length,
          total_amount: result.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0),
          successful_amount: result.filter(p => p.status === 'paid').reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0)
        };

        return response.status(200).json({
          success: true,
          msg: ['Payment history retrieved successfully', 'भुगतान इतिहास सफलतापूर्वक प्राप्त', 'पेमेंट इतिहास यशस्वीरित्या पुनर्प्राप्त'],
          data: {
            payments: paymentHistory,
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
 * Get All Users Subscription History (Admin) Controller
 * Returns comprehensive user subscription history with active plan status, purchase count, and remaining days
 */
const getAllUsersSubscriptionHistory = async (request, response) => {
  try {
    const {
      page = 1,
      limit = 50,
      subscription_status = 'all', // all, active, expired, none
      subscription_type = 'all', // all, 1 (Yearly), 2 (Monthly)
      user_id = null,
      search_term = null
    } = request.query;

    // Calculate offset for pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build the main query to get all users with their subscription details
    let query = `
      SELECT 
        um.user_id,
        um.name as user_name,
        um.email as user_email,
        um.mobile as user_mobile,
        um.phone_code as user_phone_code,
        um.active_flag as user_active_status,
        um.createtime as user_created_at,
        
        -- Current active subscription details
        current_sub.user_subscription_id as current_subscription_id,
        current_sub.amount as current_amount,
        current_sub.subscription_type as current_subscription_type,
        current_sub.start_date as current_start_date,
        current_sub.end_date as current_end_date,
        current_sub.createtime as current_subscription_created_at,
        
        -- Current subscription plan details
        current_plan.description as current_plan_name,
        current_plan.amount as current_plan_amount,
        
        -- Purchase count for current plan type
        purchase_counts.total_purchases,
        purchase_counts.first_purchase_date,
        purchase_counts.last_purchase_date,
        
        -- Calculate subscription status and remaining days
        CASE 
          WHEN current_sub.end_date IS NULL THEN 'no_subscription'
          WHEN current_sub.end_date > NOW() THEN 'active'
          ELSE 'expired'
        END as subscription_status,
        
        CASE 
          WHEN current_sub.end_date IS NULL THEN 0
          WHEN current_sub.end_date > NOW() THEN DATEDIFF(current_sub.end_date, NOW())
          ELSE 0
        END as days_remaining
        
      FROM user_master um
      
      -- Get current active subscription (most recent)
      LEFT JOIN (
        SELECT 
          usm1.user_id,
          usm1.user_subscription_id,
          usm1.subscription_id,
          usm1.amount,
          usm1.subscription_type,
          usm1.start_date,
          usm1.end_date,
          usm1.createtime
        FROM user_subscription_master usm1
        WHERE usm1.delete_flag = 0
        AND usm1.user_subscription_id = (
          SELECT MAX(usm2.user_subscription_id)
          FROM user_subscription_master usm2
          WHERE usm2.user_id = usm1.user_id
          AND usm2.delete_flag = 0
        )
      ) current_sub ON um.user_id = current_sub.user_id
      
      -- Get current subscription plan details (FIXED: Join by subscription_id instead of subscription_type)
      LEFT JOIN subscription_master current_plan ON current_sub.subscription_id = current_plan.subscription_id
      
      -- Get purchase counts for current subscription (FIXED: Use subscription_id instead of subscription_type)
      LEFT JOIN (
        SELECT 
          usm.user_id,
          usm.subscription_id,
          COUNT(*) as total_purchases,
          MIN(usm.createtime) as first_purchase_date,
          MAX(usm.createtime) as last_purchase_date
        FROM user_subscription_master usm
        WHERE usm.delete_flag = 0
        GROUP BY usm.user_id, usm.subscription_id
      ) purchase_counts ON um.user_id = purchase_counts.user_id 
        AND current_sub.subscription_id = purchase_counts.subscription_id
      
      WHERE um.delete_flag = 0
    `;

    const queryParams = [];

    // Filter by subscription status
    if (subscription_status === 'active') {
      query += ` AND current_sub.end_date > NOW()`;
    } else if (subscription_status === 'expired') {
      query += ` AND current_sub.end_date IS NOT NULL AND current_sub.end_date <= NOW()`;
    } else if (subscription_status === 'none') {
      query += ` AND current_sub.user_subscription_id IS NULL`;
    }

    // Filter by subscription type
    if (subscription_type !== 'all' && subscription_type) {
      query += ` AND current_sub.subscription_type = ?`;
      queryParams.push(subscription_type);
    }

    // Filter by user_id
    if (user_id) {
      query += ` AND um.user_id = ?`;
      queryParams.push(user_id);
    }

    // Search by name, email, or mobile
    if (search_term) {
      query += ` AND (um.name LIKE ? OR um.email LIKE ? OR um.mobile LIKE ?)`;
      const searchPattern = `%${search_term}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Filter out users with no purchases (only show users who have made at least one purchase)
    query += ` AND purchase_counts.total_purchases > 0`;

    // Get total count for pagination
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(DISTINCT um.user_id) as total FROM');
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
      query += ` ORDER BY um.user_id DESC LIMIT ? OFFSET ?`;
      queryParams.push(parseInt(limit), offset);

      connection.query(query, queryParams, (err, result) => {
        if (err) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: err.message
          });
        }

        const usersSubscriptionHistory = result.map(user => ({
          user_id: user.user_id,
          user_name: user.user_name,
          user_email: user.user_email,
          user_mobile: user.user_mobile,
          user_phone_code: user.user_phone_code,
          user_active_status: user.user_active_status,
          user_created_at: moment(user.user_created_at).format('DD MMM, YYYY HH:mm A'),

          // Current subscription details
          current_subscription: user.current_subscription_id ? {
            subscription_id: user.current_subscription_id,
            plan_name: user.current_plan_name,
            plan_amount: user.current_plan_amount,
            user_amount: user.current_amount,
            subscription_type: user.current_subscription_type,
            subscription_type_label:
              user.current_subscription_type == 0 ? "Free Trial" :
                user.current_subscription_type == 1 ? "Yearly" :
                  user.current_subscription_type == 2 ? "Monthly" :
                    user.current_subscription_type == 3 ? "Lifetime" :
                      user.current_subscription_type == 4 ? "Other" :
                        "Unknown",
            start_date: moment(user.current_start_date).format('DD MMM, YYYY'),
            end_date: moment(user.current_end_date).format('DD MMM, YYYY'),
            created_at: moment(user.current_subscription_created_at).format('DD MMM, YYYY HH:mm A'),
            status: user.subscription_status,
            status_label: user.subscription_status === 'active' ? 'Active' :
              user.subscription_status === 'expired' ? 'Expired' : 'No Subscription',
            days_remaining: user.days_remaining,
            is_active: user.subscription_status === 'active'
          } : null,

          // Purchase statistics
          purchase_statistics: {
            total_purchases: user.total_purchases || 0,
            first_purchase_date: user.first_purchase_date ? moment(user.first_purchase_date).format('DD MMM, YYYY') : null,
            last_purchase_date: user.last_purchase_date ? moment(user.last_purchase_date).format('DD MMM, YYYY') : null,
            current_plan_purchase_count: user.total_purchases || 0
          }
        }));

        // Calculate summary statistics
        const summary = {
          total_users: totalRecords,
          users_with_subscription: result.filter(u => u.current_subscription_id).length,
          active_subscriptions: result.filter(u => u.subscription_status === 'active').length,
          expired_subscriptions: result.filter(u => u.subscription_status === 'expired').length,
          users_without_subscription: result.filter(u => u.subscription_status === 'no_subscription').length,
          yearly_subscriptions: result.filter(u => u.current_subscription_type == 1).length,
          monthly_subscriptions: result.filter(u => u.current_subscription_type == 2).length
        };

        return response.status(200).json({
          success: true,
          msg: ['Users subscription history retrieved successfully', 'उपयोगकर्ता सब्सक्रिप्शन इतिहास सफलतापूर्वक प्राप्त', 'वापरकर्ते सब्सक्रिप्शन इतिहास यशस्वीरित्या पुनर्प्राप्त'],
          data: {
            users: usersSubscriptionHistory,
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
 * Get All Subscription Plans (Admin) Controller
 * Returns all subscription plans including deleted ones for admin management
 */
const getAllSubscriptionPlans = async (request, response) => {
  try {
    const { include_deleted = false } = request.query;

    let query = "SELECT subscription_id, description, text, amount, subscription_type, validity_days, features, delete_flag, createtime, updatetime FROM subscription_master";

    if (include_deleted === 'false' || include_deleted === false) {
      query += " WHERE delete_flag = 0";
    }

    query += " ORDER BY subscription_id DESC";

    connection.query(query, (error, result) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      const subscriptionPlans = result.map(plan => {
        // Parse features from JSON string to array
        let featuresArray = [];
        if (plan.features) {
          try {
            const parsed = JSON.parse(plan.features);
            if (Array.isArray(parsed)) {
              featuresArray = parsed;
            }
          } catch (e) {
            // If parsing fails, treat as empty array
            featuresArray = [];
          }
        }

        return {
          subscription_id: plan.subscription_id,
          description: plan.description,
          text: plan.text,
          amount: plan.amount,
          subscription_type: plan.subscription_type,
          subscription_type_label:
            plan.subscription_type == 0 ? "Free or Referral" :
              plan.subscription_type == 1 ? "Yearly" :
                plan.subscription_type == 2 ? "Monthly" :
                  plan.subscription_type == 3 ? "Lifetime" :
                    plan.subscription_type == 4 ? "Other" :
                      "Unknown",
          validity_days: plan.validity_days,
          features: featuresArray,
          delete_flag: plan.delete_flag,
          status: plan.delete_flag == 0 ? "Active" : "Deleted",
          createtime: moment(plan.createtime).format('DD MMM, YYYY HH:mm A'),
          updatetime: moment(plan.updatetime).format('DD MMM, YYYY HH:mm A')
        };
      });

      return response.status(200).json({
        success: true,
        msg: ['Subscription plans retrieved successfully', 'सब्सक्रिप्शन प्लान सफलतापूर्वक प्राप्त', 'सब्सक्रिप्शन प्लॅन यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          total_plans: subscriptionPlans.length,
          active_plans: subscriptionPlans.filter(plan => plan.delete_flag == 0).length,
          deleted_plans: subscriptionPlans.filter(plan => plan.delete_flag == 1).length,
          plans: subscriptionPlans
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

// Helper functions for support ticket labels
function getPriorityLabel(priority) {
  const labels = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Urgent'
  };
  return labels[priority] || 'Unknown';
}

function getCategoryLabel(categoryId) {
  const labels = {
    1: 'General',
    2: 'Technical Issue',
    3: 'Account & Login',
    4: 'Payment & Billing',
    5: 'Data & Backup',
    6: 'Feature Request',
    7: 'Bug Report',
    8: 'Other'
  };
  return labels[categoryId] || 'Unknown';
}

function getStatusLabel(status) {
  const labels = {
    0: 'Pending',
    1: 'In Progress',
    2: 'Open',
    3: 'Resolved'
  };
  return labels[status] || 'Unknown';
}

/**
 * Get All Support Tickets (Admin) Controller
 * Returns all support tickets with filtering and pagination
 */
const getAllSupportTickets = async (request, response) => {
  try {
    const {
      status,
      priority,
      category_id,
      page = 1,
      limit = 20,
      search,
      include_deleted = false
    } = request.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereConditions = [];
    let queryParams = [];

    // Build WHERE conditions
    if (status !== undefined && status !== '') {
      whereConditions.push('st.status = ?');
      queryParams.push(status);
    }

    if (priority !== undefined && priority !== '') {
      whereConditions.push('st.priority = ?');
      queryParams.push(priority);
    }

    if (category_id !== undefined && category_id !== '') {
      whereConditions.push('st.category_id = ?');
      queryParams.push(category_id);
    }

    if (search) {
      whereConditions.push('(st.description LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (include_deleted === 'false' || include_deleted === false) {
      whereConditions.push('st.delete_flag = 0');
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM support_tickets_master st
      JOIN user_master u ON st.user_id = u.user_id
      ${whereClause}
    `;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const totalTickets = countResult[0].total;
      const totalPages = Math.ceil(totalTickets / parseInt(limit));

      // Get tickets with pagination
      const ticketsQuery = `
        SELECT 
          st.support_ticket_id,
          st.user_id,
          st.description,
          st.priority,
          st.category_id,
          st.status,
          st.screenshot,
          st.delete_flag,
          st.createtime,
          st.updatetime,
          u.name as user_name,
          u.email as user_email,
          u.mobile as user_mobile
        FROM support_tickets_master st
        JOIN user_master u ON st.user_id = u.user_id
        ${whereClause}
        ORDER BY st.createtime DESC
        LIMIT ? OFFSET ?
      `;

      const finalParams = [...queryParams, parseInt(limit), offset];

      connection.query(ticketsQuery, finalParams, (ticketsErr, ticketsResult) => {
        if (ticketsErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: ticketsErr.message
          });
        }

        const processedTickets = ticketsResult.map(ticket => ({
          support_ticket_id: ticket.support_ticket_id,
          user_id: ticket.user_id,
          user_name: ticket.user_name,
          user_email: ticket.user_email,
          user_mobile: ticket.user_mobile,
          description: ticket.description,
          priority: ticket.priority,
          priority_label: getPriorityLabel(ticket.priority),
          category_id: ticket.category_id,
          category_label: getCategoryLabel(ticket.category_id),
          status: ticket.status,
          status_label: getStatusLabel(ticket.status),
          screenshot: ticket.screenshot,
          delete_flag: ticket.delete_flag,
          is_deleted: ticket.delete_flag == 1,
          createtime: moment(ticket.createtime).format('DD MMM, YYYY HH:mm A'),
          updatetime: moment(ticket.updatetime).format('DD MMM, YYYY HH:mm A'),
          created_ago: moment(ticket.createtime).fromNow()
        }));

        return response.status(200).json({
          success: true,
          msg: ['Support tickets retrieved successfully', 'सहायता टिकट सफलतापूर्वक प्राप्त', 'सहायता टिकट यशस्वीरित्या पुनर्प्राप्त'],
          data: {
            tickets: processedTickets,
            pagination: {
              current_page: parseInt(page),
              total_pages: totalPages,
              total_tickets: totalTickets,
              limit: parseInt(limit),
              has_next: parseInt(page) < totalPages,
              has_prev: parseInt(page) > 1
            },
            filters: {
              status: status || null,
              priority: priority || null,
              category_id: category_id || null,
              search: search || null
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
 * Create Admin Category Controller
 * Creates a new category that will be available to all users as default
 */
const createAdminCategory = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = adminCreateCategorySchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { category_name, category_type, account_type, deletable = 0 } = value;

    // Convert deletable to number if it's a string and validate it
    let deletableValue = 0;
    if (deletable !== undefined) {
      if (typeof deletable === 'string') {
        deletableValue = parseInt(deletable);
      } else if (typeof deletable === 'number') {
        deletableValue = deletable;
      }

      // Validate the deletable value
      if (deletableValue !== 0 && deletableValue !== 1) {
        deletableValue = 0; // Default to 0 if invalid
      }
    }

    const icon = request.file ? request.file.path : ''; // Cloudinary returns the secure_url in the file object
    const createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Check if category already exists (admin categories)
    const checkCategorySql = "SELECT category_id FROM category_master WHERE category_name = ? AND added_by = 0 AND delete_flag = 0 AND category_type = ? AND account_type = ?";
    connection.query(checkCategorySql, [category_name, category_type, account_type], (checkError, checkResult) => {
      if (checkError) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkError.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Category already exists', 'कैटेगरी पहले से मौजूद है', 'श्रेणी आधीपासून अस्तित्वात आहे'],
          key: 'category_name'
        });
      }

      // Insert admin category (added_by = 0, user_id = 0 for admin categories)
      const sqlInsert = "INSERT INTO category_master(category_type, category_name, icon, added_by, user_id, account_type, deletable, createtime, updatetime) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?)";
      connection.query(sqlInsert, [category_type, category_name, icon, account_type, deletableValue, createtime, createtime], (insertError, insertResult) => {
        if (insertError) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: insertError.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Admin category created successfully', 'एडमिन कैटेगरी सफलतापूर्वक बनाई गई', 'प्रशासक श्रेणी यशस्वीरित्या तयार केली'],
          data: {
            category_id: insertResult.insertId,
            category_name: category_name,
            category_type: category_type,
            category_type_label: category_type == 1 ? "Expense" : "Income",
            icon: icon,
            icon_url: icon || null, // Cloudinary URL is already complete
            added_by: 0,
            is_admin_category: true,
            deletable: deletableValue,
            deletable_label: deletableValue == 1 ? "Deletable by users" : "Not deletable by users",
            createtime: createtime
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
 * Update Admin Category Controller
 * Updates an existing admin category
 */
const updateAdminCategory = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = adminUpdateCategorySchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { category_id, category_name, category_type, account_type, deletable } = value;

    // Convert deletable to number if it's a string and validate it
    let deletableValue = 0;
    if (deletable !== undefined) {
      if (typeof deletable === 'string') {
        deletableValue = parseInt(deletable);
      } else if (typeof deletable === 'number') {
        deletableValue = deletable;
      }

      // Validate the deletable value
      if (deletableValue !== 0 && deletableValue !== 1) {
        deletableValue = 0; // Default to 0 if invalid
      }
    }

    // Get icon URL from Cloudinary - check multiple properties to ensure we get the URL
    let icon = null;
    if (request.file) {
      // CloudinaryStorage returns the secure_url in different properties
      // Check path first (most common), then secure_url, then url
      icon = request.file.path || request.file.secure_url || request.file.url || null;
    }
    const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // First check if account_type column exists
    const checkColumnSql = "SHOW COLUMNS FROM category_master LIKE 'account_type'";
    connection.query(checkColumnSql, (columnError, columnResult) => {
      try {
        if (columnError) {
          console.error('Column check error:', columnError);
          return response.status(200).json({
            success: false,
            msg: ['Database error', 'डेटाबेस त्रुटि', 'डेटाबेस त्रुटी'],
            error: columnError.message
          });
        }

        // Check if admin category exists
        const checkQuery = "SELECT category_id, icon FROM category_master WHERE category_id = ? AND added_by = 0 AND delete_flag = 0";
        connection.query(checkQuery, [category_id], (checkErr, checkResult) => {
          try {
            if (checkErr) {
              console.error('Category check error:', checkErr);
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: checkErr.message
              });
            }

            if (checkResult.length === 0) {
              return response.status(200).json({
                success: false,
                msg: ['Admin category not found', 'एडमिन कैटेगरी नहीं मिली', 'प्रशासक श्रेणी सापडली नाही'],
                key: "category_not_found"
              });
            }

            // Check if category name already exists (excluding current category)
            let checkNameQuery, nameQueryParams;
            if (columnResult.length === 0) {
              // If account_type column doesn't exist, use old query
              checkNameQuery = "SELECT category_id FROM category_master WHERE category_name = ? AND added_by = 0 AND delete_flag = 0 AND category_type = ? AND category_id != ?";
              nameQueryParams = [category_name, category_type, category_id];
            } else {
              // If account_type column exists, use new query
              checkNameQuery = "SELECT category_id FROM category_master WHERE category_name = ? AND added_by = 0 AND delete_flag = 0 AND category_type = ? AND account_type = ? AND category_id != ?";
              nameQueryParams = [category_name, category_type, account_type, category_id];
            }

            connection.query(checkNameQuery, nameQueryParams, (nameErr, nameResult) => {
              try {
                if (nameErr) {
                  console.error('Name check error:', nameErr);
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: nameErr.message
                  });
                }

                if (nameResult.length > 0) {
                  return response.status(200).json({
                    success: false,
                    msg: ['Category name already exists', 'कैटेगरी नाम पहले से मौजूद है', 'श्रेणी नाव आधीपासून अस्तित्वात आहे'],
                    key: 'category_name'
                  });
                }

                // Update admin category
                let updateQuery, updateValues;
                if (columnResult.length === 0) {
                  // If account_type column doesn't exist, use old query
                  if (icon) {
                    updateQuery = "UPDATE category_master SET category_name = ?, category_type = ?, icon = ?, deletable = ?, updatetime = ? WHERE category_id = ?";
                    updateValues = [category_name, category_type, icon, deletableValue, updatetime, category_id];
                  } else {
                    updateQuery = "UPDATE category_master SET category_name = ?, category_type = ?, deletable = ?, updatetime = ? WHERE category_id = ?";
                    updateValues = [category_name, category_type, deletableValue, updatetime, category_id];
                  }
                } else {
                  // If account_type column exists, use new query
                  if (icon) {
                    updateQuery = "UPDATE category_master SET category_name = ?, category_type = ?, icon = ?, account_type = ?, deletable = ?, updatetime = ? WHERE category_id = ?";
                    updateValues = [category_name, category_type, icon, account_type, deletableValue, updatetime, category_id];
                  } else {
                    updateQuery = "UPDATE category_master SET category_name = ?, category_type = ?, account_type = ?, deletable = ?, updatetime = ? WHERE category_id = ?";
                    updateValues = [category_name, category_type, account_type, deletableValue, updatetime, category_id];
                  }
                }

                connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
                  try {
                    if (updateErr) {
                      console.error('Update error:', updateErr);
                      return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: updateErr.message
                      });
                    }

                    // Prepare response data
                    const responseData = {
                      category_id: category_id,
                      category_name: category_name,
                      category_type: category_type,
                      category_type_label: category_type == 1 ? "Expense" : "Income",
                      icon: icon || checkResult[0].icon,
                      icon_url: icon || checkResult[0].icon || null,
                      added_by: 0,
                      is_admin_category: true,
                      deletable: deletableValue,
                      deletable_label: deletableValue == 1 ? "Deletable by users" : "Not deletable by users",
                      updatetime: updatetime
                    };

                    // Add account_type information if column exists
                    if (columnResult.length > 0) {
                      responseData.account_type = account_type;
                      responseData.account_type_label = account_type == 1 ? "Personal" : account_type == 2 ? "Business" : "Freelance";
                    }

                    return response.status(200).json({
                      success: true,
                      msg: ['Admin category updated successfully', 'एडमिन कैटेगरी सफलतापूर्वक अपडेट की गई', 'प्रशासक श्रेणी यशस्वीरित्या अपडेट केली'],
                      data: responseData
                    });
                  } catch (updateError) {
                    console.error('Update process error:', updateError);
                    return response.status(200).json({
                      success: false,
                      msg: ['Update process error', 'अपडेट प्रक्रिया त्रुटि', 'अपडेट प्रक्रिया त्रुटी'],
                      error: updateError.message
                    });
                  }
                });
              } catch (nameError) {
                console.error('Name check process error:', nameError);
                return response.status(200).json({
                  success: false,
                  msg: ['Name check process error', 'नाम जांच प्रक्रिया त्रुटि', 'नाव तपासणी प्रक्रिया त्रुटी'],
                  error: nameError.message
                });
              }
            });
          } catch (checkError) {
            console.error('Category check process error:', checkError);
            return response.status(200).json({
              success: false,
              msg: ['Category check process error', 'कैटेगरी जांच प्रक्रिया त्रुटि', 'श्रेणी तपासणी प्रक्रिया त्रुटी'],
              error: checkError.message
            });
          }
        });
      } catch (columnError) {
        console.error('Column check process error:', columnError);
        return response.status(200).json({
          success: false,
          msg: ['Column check process error', 'कॉलम जांच प्रक्रिया त्रुटि', 'स्तंभ तपासणी प्रक्रिया त्रुटी'],
          error: columnError.message
        });
      }
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
 * Delete Admin Category Controller
 * Soft deletes an admin category
 */
const deleteAdminCategory = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = adminDeleteCategorySchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { category_id } = value;

    // Check if admin category exists
    const checkQuery = "SELECT category_id FROM category_master WHERE category_id = ? AND added_by = 0 AND delete_flag = 0";
    connection.query(checkQuery, [category_id], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Admin category not found', 'एडमिन कैटेगरी नहीं मिली', 'प्रशासक श्रेणी सापडली नाही'],
          key: "category_not_found"
        });
      }

      // Soft delete admin category
      const deleteQuery = "UPDATE category_master SET delete_flag = 1, updatetime = NOW() WHERE category_id = ?";
      connection.query(deleteQuery, [category_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Admin category deleted successfully', 'एडमिन कैटेगरी सफलतापूर्वक हटाई गई', 'प्रशासक श्रेणी यशस्वीरित्या हटवली'],
          data: {
            category_id: category_id,
            deleted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Get All Admin Categories Controller
 * Returns all admin categories for management
 */
const getAllAdminCategories = async (request, response) => {
  try {
    // Set cache control headers to prevent caching
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { include_deleted = false, category_type, account_type } = request.query;

    let whereConditions = ['added_by = 0'];
    let queryParams = [];

    if (include_deleted === 'false' || include_deleted === false) {
      whereConditions.push('delete_flag = 0');
    }

    if (category_type) {
      whereConditions.push('category_type = ?');
      queryParams.push(category_type);
    }

    if (account_type) {
      whereConditions.push('account_type = ?');
      queryParams.push(account_type);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
      SELECT category_id, category_name, category_type, account_type, icon, delete_flag, deletable, createtime, updatetime 
      FROM category_master 
      ${whereClause}
      ORDER BY category_id DESC
    `;

    // First check if account_type column exists
    const checkColumnSql = "SHOW COLUMNS FROM category_master LIKE 'account_type'";
    connection.query(checkColumnSql, (columnError, columnResult) => {
      if (columnError) {
        return response.status(200).json({
          success: false,
          msg: ['Database error', 'डेटाबेस त्रुटि', 'डेटाबेस त्रुटी'],
          error: columnError.message
        });
      }

      // If account_type column doesn't exist, modify the query
      let finalQuery = query;
      if (columnResult.length === 0) {
        // Remove account_type from SELECT and WHERE clauses
        finalQuery = query.replace(/account_type,?\s*/g, '');
      }

      connection.query(finalQuery, queryParams, (error, result) => {
        if (error) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: error.message
          });
        }

        const categories = result.map(category => ({
          category_id: category.category_id,
          category_name: category.category_name,
          category_type: category.category_type,
          category_type_label: category.category_type == 1 ? "Expense" : "Income",
          account_type: category.account_type,
          account_type_label: category.account_type == 1 ? "Personal" : category.account_type == 2 ? "Business" : category.account_type == 3 ? "Freelance" : "Unknown",
          icon: category.icon,
          icon_url: category.icon ? `${process.env.BASE_URL || 'http://localhost:3000'}/images/${category.icon}` : null,
          delete_flag: category.delete_flag,
          status: category.delete_flag == 0 ? "Active" : "Deleted",
          is_admin_category: true,
          deletable: category.deletable,
          deletable_label: category.deletable == 1 ? "Deletable by users" : "Not deletable by users",
          createtime: moment(category.createtime).format('DD MMM, YYYY HH:mm A'),
          updatetime: moment(category.updatetime).format('DD MMM, YYYY HH:mm A')
        }));

        return response.status(200).json({
          success: true,
          msg: ['Admin categories retrieved successfully', 'एडमिन कैटेगरी सफलतापूर्वक प्राप्त', 'प्रशासक श्रेणी यशस्वीरित्या पुनर्प्राप्त'],
          data: {
            total_categories: categories.length,
            active_categories: categories.filter(cat => cat.delete_flag == 0).length,
            deleted_categories: categories.filter(cat => cat.delete_flag == 1).length,
            categories: categories
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
 * Permanently Delete User (Admin Only)
 * Deletes user and all related data permanently from database
 */
const permanentlyDeleteUser = async (request, response) => {
  try {
    const { user_id } = request.body;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'उपयोगकर्ता ID आवश्यक है', 'वापरकर्ता ID आवश्यक आहे'],
        key: 'user_id_required'
      });
    }

    // Check if user exists
    const checkUserQuery = "SELECT user_id, name, mobile, email FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(checkUserQuery, [user_id], async (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही'],
          key: 'user_not_found'
        });
      }

      const userInfo = checkResult[0];

      // Get user's FCM tokens before deletion to send notification
      const getFCMTokensQuery = "SELECT fcm_token FROM user_device_tokens WHERE user_id = ? AND is_active = 1 AND fcm_token IS NOT NULL AND fcm_token != '' AND fcm_token != 'test_fcm_token'";

      connection.query(getFCMTokensQuery, [user_id], async (tokenErr, tokenResult) => {
        if (tokenErr) {
          console.error('Error fetching FCM tokens for user deletion notification:', tokenErr);
        }

        // Send notification to user BEFORE deletion (wait for it to complete)
        let notificationSent = false;
        if (!tokenErr && tokenResult && tokenResult.length > 0) {
          const fcmTokens = tokenResult.map(row => row.fcm_token).filter(token => token);

          if (fcmTokens.length > 0) {
            const notificationTitle = 'Account Deleted';
            const notificationMessage = 'Your account has been permanently deleted by the administrator.';

            try {
              // Send notification and WAIT for it to complete
              const notificationResult = await FCMAPI.sendToUsers(
                fcmTokens,
                notificationTitle,
                notificationMessage,
                {
                  type: 'account_deleted',
                  user_id: user_id.toString(),
                  timestamp: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
                }
              );

              if (notificationResult && notificationResult.success) {
                notificationSent = true;
                console.log(`✅ Account deletion notification sent successfully to user ${user_id} (${fcmTokens.length} device(s))`);
              } else {
                console.error(`⚠️ Failed to send notification to user ${user_id}:`, notificationResult?.error);
              }
            } catch (notifError) {
              console.error('❌ Error sending account deletion notification:', notifError);
              // Continue with deletion even if notification fails
            }
          } else {
            console.log(`ℹ️ No valid FCM tokens found for user ${user_id}`);
          }
        } else {
          console.log(`ℹ️ No FCM tokens found for user ${user_id}`);
        }

        // Wait a moment to ensure notification is delivered before deletion
        if (notificationSent) {
          console.log(`⏳ Waiting 5 seconds to ensure notification delivery before deletion...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // NOW proceed with deletion AFTER notification is sent
        console.log(`🗑️ Starting deletion process for user ${user_id}...`);

        // Start transaction - Delete all related data first, then user
        // Note: Using DELETE instead of UPDATE delete_flag for permanent deletion

        // 1. Delete user subscriptions
        const deleteSubscriptionsQuery = "DELETE FROM user_subscription_master WHERE user_id = ?";

        // 2. Delete user accounts
        const deleteAccountsQuery = "DELETE FROM user_account_master WHERE user_id = ?";

        // 3. Delete expense/income records
        const deleteExpenseIncomeQuery = "DELETE FROM expense_income_master WHERE user_id = ?";

        // 4. Delete budget records
        const deleteBudgetQuery = "DELETE FROM budget_master WHERE user_id = ?";

        // 5. Delete udhari customers
        const deleteUdhariCustomersQuery = "DELETE FROM udhari_customer_master WHERE user_id = ?";

        // 6. Delete team members
        const deleteTeamMembersQuery = "DELETE FROM team_member_master WHERE user_id = ?";

        // 7. Delete support tickets
        const deleteSupportTicketsQuery = "DELETE FROM support_tickets_master WHERE user_id = ?";

        // 8. Delete reminders
        const deleteRemindersQuery = "DELETE FROM reminder_master WHERE user_id = ?";

        // 9. Delete recurring payments
        const deleteRecurringPaymentsQuery = "DELETE FROM recurring_payment_master WHERE user_id = ?";

        // 10. Delete notifications
        const deleteNotificationsQuery = "DELETE FROM notification_master WHERE user_id = ?";

        // 11. Delete feedback
        const deleteFeedbackQuery = "DELETE FROM feedback_master WHERE user_id = ?";

        // 12. Delete business manager associations and manager users
        // Define deleteUserQuery here so it can be used in manager deletion
        const deleteUserQuery = "DELETE FROM user_master WHERE user_id = ?";

        // Function to proceed with main user deletion after managers are deleted
        const proceedWithMainUserDeletion = () => {
          // Delete business manager associations (both where user is owner and where user is manager)
          const deleteBusinessManagerQuery = "DELETE FROM business_manager_master WHERE owner_user_id = ? OR manager_user_id = ?";

          connection.query(deleteBusinessManagerQuery, [user_id, user_id], (err12) => {
            if (err12) {
              console.error('Error deleting business manager associations:', err12);
            } else {
              console.log(`✅ Deleted business manager associations for user ${user_id}`);
            }

            // 13. Finally delete user from user_master
            // Execute deletions in sequence for main user
            connection.query(deleteSubscriptionsQuery, [user_id], (err1) => {
              if (err1) {
                console.error('Error deleting subscriptions:', err1);
              }

              connection.query(deleteAccountsQuery, [user_id], (err2) => {
                if (err2) {
                  console.error('Error deleting accounts:', err2);
                }

                connection.query(deleteExpenseIncomeQuery, [user_id], (err3) => {
                  if (err3) {
                    console.error('Error deleting expense/income:', err3);
                  }

                  connection.query(deleteBudgetQuery, [user_id], (err4) => {
                    if (err4) {
                      console.error('Error deleting budgets:', err4);
                    }

                    connection.query(deleteUdhariCustomersQuery, [user_id], (err5) => {
                      if (err5) {
                        console.error('Error deleting udhari customers:', err5);
                      }

                      connection.query(deleteTeamMembersQuery, [user_id], (err6) => {
                        if (err6) {
                          console.error('Error deleting team members:', err6);
                        }

                        connection.query(deleteSupportTicketsQuery, [user_id], (err7) => {
                          if (err7) {
                            console.error('Error deleting support tickets:', err7);
                          }

                          connection.query(deleteRemindersQuery, [user_id], (err8) => {
                            if (err8) {
                              console.error('Error deleting reminders:', err8);
                            }

                            connection.query(deleteRecurringPaymentsQuery, [user_id], (err9) => {
                              if (err9) {
                                console.error('Error deleting recurring payments:', err9);
                              }

                              connection.query(deleteNotificationsQuery, [user_id], (err10) => {
                                if (err10) {
                                  console.error('Error deleting notifications:', err10);
                                }

                                connection.query(deleteFeedbackQuery, [user_id], (err11) => {
                                  if (err11) {
                                    console.error('Error deleting feedback:', err11);
                                  }

                                  // Finally delete the user
                                  connection.query(deleteUserQuery, [user_id], (err13, deleteResult) => {
                                    if (err13) {
                                      return response.status(200).json({
                                        success: false,
                                        msg: ['Failed to delete user', 'उपयोगकर्ता हटाने में विफल', 'वापरकर्ता हटवण्यात अयशस्वी'],
                                        error: err13.message
                                      });
                                    }

                                    return response.status(200).json({
                                      success: true,
                                      msg: ['User permanently deleted successfully', 'उपयोगकर्ता स्थायी रूप से सफलतापूर्वक हटाया गया', 'वापरकर्ता कायमस्वरूपी यशस्वीरित्या काढले'],
                                      data: {
                                        user_id,
                                        user_name: userInfo.name,
                                        user_mobile: userInfo.mobile,
                                        deleted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
                                      }
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            }); // Close deleteSubscriptionsQuery callback
          }); // Close deleteBusinessManagerQuery callback
        }; // End of proceedWithMainUserDeletion function definition

        // First, find all managers where this user is the owner (owner_user_id = user_id)
        const findManagersQuery = `
          SELECT DISTINCT manager_user_id 
          FROM business_manager_master 
          WHERE owner_user_id = ? AND delete_flag = 0
        `;

        connection.query(findManagersQuery, [user_id], (findManagerErr, managerResults) => {
          if (findManagerErr) {
            console.error('Error finding managers for deletion:', findManagerErr);
            // Continue with deletion even if finding managers fails
            proceedWithMainUserDeletion();
            return;
          }

          // Get list of manager user IDs to delete (only managers, not the main user)
          const managerUserIds = [];
          if (managerResults && managerResults.length > 0) {
            managerResults.forEach(row => {
              if (row.manager_user_id && row.manager_user_id !== user_id) {
                managerUserIds.push(row.manager_user_id);
              }
            });
          }

          console.log(`📋 Found ${managerUserIds.length} manager(s) associated with user ${user_id}: ${managerUserIds.join(', ')}`);

          // Delete manager users first (if any exist)
          if (managerUserIds.length > 0) {
            let deletedManagers = 0;
            const totalManagers = managerUserIds.length;

            managerUserIds.forEach((managerUserId) => {
              // Delete manager user's related data
              connection.query(deleteSubscriptionsQuery, [managerUserId], () => { });
              connection.query(deleteAccountsQuery, [managerUserId], () => { });
              connection.query(deleteExpenseIncomeQuery, [managerUserId], () => { });
              connection.query(deleteBudgetQuery, [managerUserId], () => { });
              connection.query(deleteUdhariCustomersQuery, [managerUserId], () => { });
              connection.query(deleteTeamMembersQuery, [managerUserId], () => { });
              connection.query(deleteSupportTicketsQuery, [managerUserId], () => { });
              connection.query(deleteRemindersQuery, [managerUserId], () => { });
              connection.query(deleteRecurringPaymentsQuery, [managerUserId], () => { });
              connection.query(deleteNotificationsQuery, [managerUserId], () => { });
              connection.query(deleteFeedbackQuery, [managerUserId], () => { });

              // Delete manager user
              connection.query(deleteUserQuery, [managerUserId], (managerUserErr) => {
                if (managerUserErr) {
                  console.error(`❌ Error deleting manager user ${managerUserId}:`, managerUserErr);
                } else {
                  console.log(`✅ Deleted manager user ${managerUserId}`);
                }

                deletedManagers++;

                // When all managers are processed, proceed with main user deletion
                if (deletedManagers === totalManagers) {
                  console.log(`✅ All ${totalManagers} manager(s) deleted. Proceeding with main user deletion...`);
                  proceedWithMainUserDeletion();
                }
              });
            });
          } else {
            // No managers to delete, proceed directly with main user deletion
            proceedWithMainUserDeletion();
          }
        });
      }); // Close the FCM tokens query callback
    }); // Close checkUserQuery callback

  } catch (error) {
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

export { adminRegister, adminLogin, getAllUsersWithAccounts, getInactiveUsers, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, getAllSubscriptionPlans, getAllPaymentHistory, getAllUsersSubscriptionHistory, getAllSupportTickets, createAdminCategory, updateAdminCategory, deleteAdminCategory, getAllAdminCategories, permanentlyDeleteUser };
