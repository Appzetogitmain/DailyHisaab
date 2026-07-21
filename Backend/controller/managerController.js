import connection from '../connection/dbConfig.js';
import { generateRandomOTP, fetchManagerData } from './function.js';
import smsIndiaHubService from '../services/smsIndiaHubService.js';
import languageMessage from './languageMessage.js';
import jwt from 'jsonwebtoken';
import { managerResendOTPSchema } from '../validations/signUpWithMobile.js';

const SECRET_KEY = process.env.SECRET_KEY || 'DaliyHisab';

/**
 * Generate Manager Token
 * Creates JWT token for manager authentication
 */
const generateManagerToken = (manager_id, manager_user_id) => {
  const payload = {
    manager_id: manager_id,
    manager_user_id: manager_user_id,
    type: 'manager'
  };

  return  jwt.sign(payload, SECRET_KEY , {
                  expiresIn: "365d",
                });
};

/**
 * Manager Login with OTP (Step 1)
 * Sends OTP to manager's mobile number
 */
const managerLoginWithOTP = async (request, response) => {
  try {
    const { mobile, phone_code } = request.body;

    if (!mobile || !phone_code) {
      return response.status(200).json({
        success: false,
        msg: ['Mobile and phone code are required', 'मोबाइल और फोन कोड आवश्यक है', 'मोबाइल आणि फोन कोड आवश्यक आहे']
      });
    }

    // Check if user exists
    const userQuery = "SELECT user_id, name, mobile, phone_code, active_flag FROM user_master WHERE mobile = ? AND phone_code = ? AND delete_flag = 0";

    connection.query(userQuery, [mobile, phone_code], (userErr, userResult) => {
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
          msg: ['Manager not found with this mobile number', 'इस मोबाइल नंबर से कोई मैनेजर नहीं मिला', 'या मोबाइल नंबरवर कोणताही मॅनेजर सापडला नाही']
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Manager account deactivated', 'मैनेजर खाता निष्क्रिय', 'मॅनेजर खाते निष्क्रिय'],
          error: 'ACCOUNT_DEACTIVATED'
        });
      }

      const userId = userResult[0].user_id;

      // Check if user is a manager
      const managerQuery = `
        SELECT 
          bmm.manager_id,
          bmm.manager_user_id,
          bmm.owner_user_id,
          bmm.business_account_id,
          bmm.manager_role,
          bmm.permissions,
          bmm.status,
          owner.name as owner_name,
          uam.account_name as business_account_name
        FROM business_manager_master bmm
        LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
        LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
        WHERE bmm.manager_user_id = ? AND bmm.status = 'active' AND bmm.delete_flag = 0
      `;

      connection.query(managerQuery, [userId], (managerErr, managerResult) => {
        if (managerErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: managerErr.message
          });
        }

        if (managerResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['No manager access found', 'कोई मैनेजर पहुंच नहीं मिली', 'कोणतेही मॅनेजर प्रवेश सापडले नाही']
          });
        }

        // Generate OTP
        const otp = generateRandomOTP(6, mobile);

        // Update OTP in business_manager_master table
        const updateOTPQuery = "UPDATE business_manager_master SET otp = ?, otp_generated_at = NOW(), last_otp_sent_at = NOW() WHERE manager_user_id = ? AND status = 'active' AND delete_flag = 0";

        connection.query(updateOTPQuery, [otp, userId], (otpUpdateErr, otpUpdateResult) => {
          if (otpUpdateErr) {
            return response.status(200).json({
              message: 'Failed to generate OTP',
              success: false
            });
          }

          if (otpUpdateResult.affectedRows > 0) {
            // Send OTP via SMS India Hub
            const formattedMobile = smsIndiaHubService.formatMobileNumber(phone_code, mobile);
            smsIndiaHubService.sendOTP(formattedMobile, otp).then(smsResult => {
              if (!smsResult.success) {
                console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                // Continue with response even if SMS fails - OTP is still stored in DB
              }

              // Log the OTP send activity
              const logQuery = `
                                INSERT INTO manager_activity_log 
                (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
                VALUES (?, ?, ?, 'otp_sent', ?, ?, ?, NOW())
                            `;

              connection.query(logQuery, [
                managerResult[0].manager_id,
                managerResult[0].owner_user_id,
                managerResult[0].business_account_id,
                `OTP sent to manager ${userResult[0].name} (${mobile})`,
                request.ip || request.connection.remoteAddress,
                request.get('User-Agent')
              ]);

              // Fetch manager data using the new function
              fetchManagerData(managerResult[0].manager_id, (error, managerDataArray) => {
                if (error) {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: error.message
                  });
                }

                return response.status(200).json({
                  success: true,
                  msg: ['OTP sent successfully', 'ओटीपी सफलतापूर्वक भेजा गया', 'ओटीपी यशस्वीरित्या पाठवला गेला'],
                  managerDataArray: managerDataArray,
                  token: generateManagerToken(managerResult[0].manager_id, managerResult[0].manager_user_id),
                  otp: otp,
                  otp_expires_in: 300
                });
              });
            }).catch(error => {
              console.error('SMS sending error:', error);
              // Continue with response even if SMS fails - OTP is still stored in DB

              // Log the OTP send activity
              const logQuery = `
                                INSERT INTO manager_activity_log 
                (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
                VALUES (?, ?, ?, 'otp_sent', ?, ?, ?, NOW())
                            `;

              connection.query(logQuery, [
                managerResult[0].manager_id,
                managerResult[0].owner_user_id,
                managerResult[0].business_account_id,
                `OTP sent to manager ${userResult[0].name} (${mobile}) - SMS failed but OTP stored`,
                request.ip || request.connection.remoteAddress,
                request.get('User-Agent')
              ]);

              // Fetch manager data using the new function
              fetchManagerData(managerResult[0].manager_id, (error, managerDataArray) => {
                if (error) {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: error.message
                  });
                }

                return response.status(200).json({
                  success: true,
                  msg: ['OTP sent successfully', 'ओटीपी सफलतापूर्वक भेजा गया', 'ओटीपी यशस्वीरित्या पाठवला गेला'],
                  managerDataArray: managerDataArray,
                  token: generateManagerToken(managerResult[0].manager_id, managerResult[0].manager_user_id),
                  otp: otp,
                  otp_expires_in: 300
                });
              });
            });
          } else {
            return response.status(200).json({
              success: false,
              msg: ['Failed to generate OTP', 'OTP उत्पन्न करने में विफल', 'OTP निर्माण करण्यात अयशस्वी']
            });
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
 * Manager OTP Verification (Step 2)
 * Verifies OTP and logs in manager
 */
const managerVerifyOTP = async (request, response) => {
  try {
    const { mobile, phone_code, otp } = request.body;

    if (!mobile || !phone_code || !otp) {
      return response.status(200).json({
        success: false,
        msg: ['Mobile, phone code and OTP are required', 'मोबाइल, फोन कोड और OTP आवश्यक है', 'मोबाइल, फोन कोड आणि OTP आवश्यक आहे']
      });
    }

    // Check if user exists
    const userQuery = "SELECT user_id, name, mobile, phone_code, active_flag FROM user_master WHERE mobile = ? AND phone_code = ? AND delete_flag = 0";

    connection.query(userQuery, [mobile, phone_code], (userErr, userResult) => {
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
          msg: ['Manager not found with this mobile number', 'इस मोबाइल नंबर से कोई मैनेजर नहीं मिला', 'या मोबाइल नंबरवर कोणताही मॅनेजर सापडला नाही']
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Manager account deactivated', 'मैनेजर खाता निष्क्रिय', 'मॅनेजर खाते निष्क्रिय'],
          error: 'ACCOUNT_DEACTIVATED'
        });
      }

      const userId = userResult[0].user_id;

      // Check if user is a manager and verify OTP
      // Ensure manager user is active and not deleted, and owner is not deleted
      const managerQuery = `
        SELECT 
          bmm.manager_id,
          bmm.manager_user_id,
          bmm.owner_user_id,
          bmm.business_account_id,
          bmm.manager_role,
          bmm.permissions,
          bmm.status,
          bmm.otp,
          bmm.otp_generated_at,
          owner.name as owner_name,
          uam.account_name as business_account_name
        FROM business_manager_master bmm
        LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
        LEFT JOIN user_master manager ON bmm.manager_user_id = manager.user_id AND manager.delete_flag = 0 AND manager.active_flag = 1
        LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
        WHERE bmm.manager_user_id = ? 
        AND bmm.status = 'active' 
        AND bmm.delete_flag = 0
        AND manager.user_id IS NOT NULL
        AND manager.active_flag = 1
        AND owner.user_id IS NOT NULL
      `;

      connection.query(managerQuery, [userId], (managerErr, managerResult) => {
        if (managerErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: managerErr.message
          });
        }

        if (managerResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['No manager access found or manager/owner account has been deleted', 'कोई मैनेजर पहुंच नहीं मिली या मैनेजर/मालिक खाता हटा दिया गया है', 'कोणतेही मॅनेजर प्रवेश सापडले नाही किंवा मॅनेजर/मालक खाते हटवले गेले आहे']
          });
        }

        const manager = managerResult[0];

        // Verify OTP
        if (!manager.otp || manager.otp !== otp) {
          return response.status(200).json({
            success: false,
            msg: ['Invalid OTP', 'अमान्य OTP', 'अवैध OTP'],
            error: 'INVALID_OTP'
          });
        }

        // Check OTP expiry (5 minutes)
        const otpGeneratedAt = new Date(manager.otp_generated_at);
        const now = new Date();
        const otpAge = (now - otpGeneratedAt) / 1000 / 60; // in minutes

        if (otpAge > 5) {
          return response.status(200).json({
            success: false,
            msg: ['OTP has expired', 'OTP समाप्त हो गया है', 'OTP कालबाह्य झाले आहे'],
            error: 'OTP_EXPIRED'
          });
        }

        // Clear OTP after successful verification
        const clearOTPQuery = "UPDATE business_manager_master SET otp = NULL WHERE manager_id = ?";
        connection.query(clearOTPQuery, [manager.manager_id]);

        // Generate token for the first manager account (in case user manages multiple accounts)
        const token = generateManagerToken(manager.manager_id, manager.manager_user_id);

        // Update last accessed time
        const updateAccessQuery = "UPDATE business_manager_master SET last_accessed = NOW() WHERE manager_id = ?";
        connection.query(updateAccessQuery, [manager.manager_id]);

        // Log the login activity
        const logQuery = `
                    INSERT INTO manager_activity_log 
          (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
          VALUES (?, ?, ?, 'login', ?, ?, ?, NOW())
                `;

        connection.query(logQuery, [
          manager.manager_id,
          manager.owner_user_id,
          manager.business_account_id,
          `Manager ${userResult[0].name} logged in with OTP`,
          request.ip || request.connection.remoteAddress,
          request.get('User-Agent')
        ]);

        // Check if manager has a regular user account (user_type = 1) with personal data
        // If yes, return both manager and user account info
        const checkUserAccountQuery = `
          SELECT 
            user_id,
            user_type,
            (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as has_transactions,
            (SELECT COUNT(*) FROM budget_master WHERE user_id = ? AND delete_flag = 0) as has_budgets,
            (SELECT COUNT(*) FROM user_account_master WHERE user_id = ? AND delete_flag = 0) as has_accounts
          FROM user_master
          WHERE user_id = ? AND user_type = 1 AND delete_flag = 0
        `;

        connection.query(checkUserAccountQuery, [userId, userId, userId, userId], (userAccountErr, userAccountResult) => {
          const hasUserAccount = !userAccountErr && userAccountResult.length > 0 && 
                                 (userAccountResult[0].has_transactions > 0 || 
                                  userAccountResult[0].has_budgets > 0 || 
                                  userAccountResult[0].has_accounts > 0);

          // Fetch manager data using the new function
          fetchManagerData(manager.manager_id, (error, managerDataArray) => {
            if (error) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: error.message
              });
            }

            const responseData = {
              success: true,
              msg: ['Manager login successful', 'मैनेजर लॉगिन सफल', 'मॅनेजर लॉगिन यशस्वी'],
              managerDataArray: managerDataArray,
              token: token,
              all_managed_accounts: managerResult.map(m => ({
                manager_id: m.manager_id,
                manager_user_id: m.manager_user_id,
                owner_user_id: m.owner_user_id,
                owner_name: m.owner_name,
                business_account_id: m.business_account_id,
                business_account_name: m.business_account_name,
                manager_role: m.manager_role
              }))
            };

            // If manager has a user account, include that info
            if (hasUserAccount) {
              responseData.has_user_account = true;
              responseData.user_account_id = userAccountResult[0].user_id;
              responseData.message = 'Manager login successful. You can access both manager and user accounts.';
            }

            return response.status(200).json(responseData);
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
 * Manager Resend OTP
 * Resends OTP to manager's mobile number
 */
const managerResendOTP = async (request, response) => {
  try {
    // Validate request body
    if (!request.body) {
      return response.status(200).json({
        success: false,
        msg: ['Request body is required', 'अनुरोध बॉडी आवश्यक है', 'विनंती बॉडी आवश्यक आहे']
      });
    }

    const { error, value } = managerResendOTPSchema.validate(request.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(d => d.message)
      });
    }

    // Safety check: ensure value exists and has required fields
    if (!value || !value.mobile || !value.phone_code) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid request data', 'अमान्य अनुरोध डेटा', 'अवैध विनंती डेटा'],
        errors: ['Mobile number and phone code are required']
      });
    }

    const { mobile, phone_code } = value;

    // Check if user exists (with user_type = 0 for Manager)
    const userQuery = "SELECT user_id, name, mobile, phone_code, active_flag, user_type FROM user_master WHERE mobile = ? AND phone_code = ? AND delete_flag = 0";

    connection.query(userQuery, [mobile, phone_code], async (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      let userId;
      let userName;

      // If user not found, create new manager user
      if (userResult.length === 0) {
        console.log(`Manager user not found for mobile ${mobile}. Creating new manager user...`);
        
        // Generate OTP
        const otp = await generateRandomOTP(6, mobile);
        console.log(`Generated OTP for new manager user (mobile: ${mobile}): ${otp}`);
        
        // Create new manager user (user_type = 0 for Manager)
        const createtime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const insertFields = ["mobile", "phone_code", "otp", "otp_verify", "user_type", "login_type", "createtime", "updatetime", "signup_step"];
        const insertValues = [mobile, phone_code, otp, 0, 0, 0, createtime, createtime, 1];
        
        const insertUser = `INSERT INTO user_master (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
        
        connection.query(insertUser, insertValues, async (insertErr, insertResult) => {
          if (insertErr) {
            console.error('Error creating new manager user for resend OTP:', insertErr);
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: insertErr.message
            });
          }
          
          userId = insertResult.insertId;
          userName = null;
          console.log(`New manager user created with user_id: ${userId}`);
          
          // Send OTP via SMS India Hub
          const phoneCodeStr = phone_code ? String(phone_code).replace(/[^0-9]/g, '') : '91';
          const formattedMobile = smsIndiaHubService.formatMobileNumber(phoneCodeStr, mobile);
          
          console.log(`Attempting to send OTP to new manager user: ${formattedMobile}`);
          
          try {
            const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

            if (!smsResult.success) {
              console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
            } else {
              console.log(`OTP sent successfully via SMS to ${formattedMobile}`);
            }
          } catch (smsError) {
            console.error('Exception while sending OTP via SMS:', smsError);
          }
          
          // Return success response for new manager user
          return response.status(200).json({
            success: true,
            msg: ['OTP sent successfully', 'OTP सफलतापूर्वक भेजा गया', 'OTP यशस्वीरित्या पाठवले'],
            message: 'New manager user created. OTP sent successfully.',
            data: {
              mobile: mobile,
              user_id: userId
            }
          });
        });
        
        return; // Exit early after creating new user
      }

      // User exists - check if account is deactivated
      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Manager account deactivated', 'मैनेजर खाता निष्क्रिय', 'मॅनेजर खाते निष्क्रिय'],
          error: 'ACCOUNT_DEACTIVATED'
        });
      }

      userId = userResult[0].user_id;
      userName = userResult[0].name;

      // Check if user_type is 0 (Manager) - if not, update it
      if (userResult[0].user_type !== 0) {
        // Update user_type to 0 (Manager)
        connection.query(
          "UPDATE user_master SET user_type = 0 WHERE user_id = ? AND delete_flag = 0",
          [userId],
          (updateErr) => {
            if (updateErr) {
              console.error('Error updating user_type to Manager:', updateErr);
            }
          }
        );
      }

      // Generate new OTP
      const otp = await generateRandomOTP(6, mobile);
      console.log(`Generated OTP for manager user ${userId} (mobile: ${mobile}): ${otp}`);

      // Update OTP in user_master table (primary storage)
      const updateUserOTPQuery = "UPDATE user_master SET otp = ?, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";

      connection.query(updateUserOTPQuery, [otp, userId], async (otpUpdateErr, otpUpdateResult) => {
        if (otpUpdateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: otpUpdateErr.message
          });
        }

        // Also update OTP in business_manager_master if manager entry exists
        const managerQuery = `
          SELECT 
            bmm.manager_id,
            bmm.manager_user_id,
            bmm.owner_user_id,
            bmm.business_account_id,
            bmm.manager_role,
            bmm.permissions,
            bmm.status,
            owner.name as owner_name,
            uam.account_name as business_account_name
          FROM business_manager_master bmm
          LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
          LEFT JOIN user_master manager ON bmm.manager_user_id = manager.user_id AND manager.delete_flag = 0
          LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
          WHERE bmm.manager_user_id = ? 
          AND bmm.status = 'active' 
          AND bmm.delete_flag = 0
          AND manager.user_id IS NOT NULL
          AND owner.user_id IS NOT NULL
        `;

        connection.query(managerQuery, [userId], (managerErr, managerResult) => {
          // Update business_manager_master OTP if manager entry exists
          if (!managerErr && managerResult.length > 0) {
            const updateManagerOTPQuery = "UPDATE business_manager_master SET otp = ?, otp_generated_at = NOW(), last_otp_sent_at = NOW() WHERE manager_user_id = ? AND status = 'active' AND delete_flag = 0";
            connection.query(updateManagerOTPQuery, [otp, userId], (managerOTPErr) => {
              if (managerOTPErr) {
                console.error('Error updating OTP in business_manager_master:', managerOTPErr);
              }
            });

            // Log the OTP resend activity if manager entry exists
            const logQuery = `
              INSERT INTO manager_activity_log 
              (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
              VALUES (?, ?, ?, 'otp_resent', ?, ?, ?, NOW())
            `;

            connection.query(logQuery, [
              managerResult[0].manager_id,
              managerResult[0].owner_user_id,
              managerResult[0].business_account_id,
              `OTP resent to manager ${userName || mobile} (${mobile})`,
              request.ip || request.connection.remoteAddress,
              request.get('User-Agent')
            ]);
          }
        });

        // Send OTP via SMS India Hub
        const phoneCodeStr = phone_code ? String(phone_code).replace(/[^0-9]/g, '') : '91';
        const formattedMobile = smsIndiaHubService.formatMobileNumber(phoneCodeStr, mobile);
        
        console.log(`Attempting to send OTP to manager: ${formattedMobile}`);
        
        try {
          const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

          if (!smsResult.success) {
            console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
            // Still return success if OTP is stored in DB
          } else {
            console.log(`OTP sent successfully via SMS to ${formattedMobile}`);
          }
        } catch (smsError) {
          console.error('Exception while sending OTP via SMS:', smsError);
        }

        // Return success response
        return response.status(200).json({
          success: true,
          msg: ['OTP resent successfully', 'OTP सफलतापूर्वक फिर से भेजा गया', 'OTP यशस्वीरित्या पुन्हा पाठवले'],
          data: {
            user_id: userId,
            manager_name: userName,
            mobile: mobile,
            message: 'OTP resent via SMS'
          }
        });
      });
    });

  } catch (error) {
    console.error('Exception in managerResendOTP:', error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Add Manager
 * Business owner adds a new manager to their business
 */
const addManager = async (request, response) => {
  try {
    const {
      manager_mobile,
      manager_name,
      manager_email,
      business_account_id,
      manager_role,
      permissions,
      notes
    } = request.body;

    const owner_user_id = request.userId;

    // First, validate that the business_account_id exists and belongs to the owner
    const validateBusinessAccountQuery = `
      SELECT user_account_id FROM user_account_master 
      WHERE user_account_id = ? AND user_id = ? AND delete_flag = 0
    `;

    connection.query(validateBusinessAccountQuery, [business_account_id, owner_user_id], (validateErr, validateResult) => {
      if (validateErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: validateErr.message
        });
      }

      if (validateResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Business account not found or does not belong to you', 'व्यवसाय खाता नहीं मिला या आपका नहीं है', 'व्यवसाय खाते सापडले नाही किंवा तुमचे नाही']
        });
      }

      // Get manager phone code (default to +91 if not provided)
      const manager_phone_code = request.body.manager_phone_code || 91;
      
      // Check if manager mobile already exists in user_master (must be unique)
      const checkUserQuery = "SELECT user_id, user_type FROM user_master WHERE mobile = ? AND phone_code = ? AND delete_flag = 0";

      connection.query(checkUserQuery, [manager_mobile, manager_phone_code], (userErr, userResult) => {
        if (userErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: userErr.message
          });
        }

        let manager_user_id;

        // If mobile number exists, check if it's already a manager or regular user
        if (userResult.length > 0) {
          const existing_user_id = userResult[0].user_id;
          
          // Check if this user is already a manager for any business
          const checkExistingManagerQuery = `
            SELECT manager_id FROM business_manager_master 
            WHERE manager_user_id = ? AND delete_flag = 0
          `;
          
          connection.query(checkExistingManagerQuery, [existing_user_id], (managerCheckErr, managerCheckResult) => {
            if (managerCheckErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: managerCheckErr.message
              });
            }
            
            // If already a manager, reject (mobile must be unique)
            if (managerCheckResult.length > 0) {
              return response.status(200).json({
                success: false,
                msg: ['This mobile number is already registered as a manager. Mobile numbers must be unique.', 'यह मोबाइल नंबर पहले से एक मैनेजर के रूप में पंजीकृत है। मोबाइल नंबर अद्वितीय होने चाहिए।', 'या मोबाइल नंबर आधीपासून मॅनेजर म्हणून नोंदणीकृत आहे. मोबाइल नंबर अद्वितीय असणे आवश्यक आहे.'],
                key: 'mobile_already_manager'
              });
            }
            
            // Check if this user is a regular user (has transactions, budgets, etc.)
            const checkRegularUserQuery = `
              SELECT 
                (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as has_transactions,
                (SELECT COUNT(*) FROM budget_master WHERE user_id = ? AND delete_flag = 0) as has_budgets,
                (SELECT COUNT(*) FROM user_account_master WHERE user_id = ? AND delete_flag = 0) as has_accounts,
                (SELECT COUNT(*) FROM category_master WHERE user_id = ? AND delete_flag = 0) as has_categories,
                (SELECT COUNT(*) FROM udhari_customer_master WHERE user_id = ? AND delete_flag = 0) as has_customers
            `;

            connection.query(checkRegularUserQuery, [
              existing_user_id, existing_user_id, existing_user_id, existing_user_id, existing_user_id
            ], (regularUserErr, regularUserResult) => {
              if (regularUserErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: regularUserErr.message
                });
              }

              const userData = regularUserResult[0];
              const isRegularUser = userData.has_transactions > 0 ||
                userData.has_budgets > 0 ||
                userData.has_accounts > 0 ||
                userData.has_categories > 0 ||
                userData.has_customers > 0;

              if (isRegularUser) {
                return response.status(200).json({
                  success: false,
                  msg: ['This mobile number is already registered as a user. Mobile numbers must be unique.', 'यह मोबाइल नंबर पहले से एक उपयोगकर्ता के रूप में पंजीकृत है। मोबाइल नंबर अद्वितीय होने चाहिए।', 'या मोबाइल नंबर आधीपासून वापरकर्ता म्हणून नोंदणीकृत आहे. मोबाइल नंबर अद्वितीय असणे आवश्यक आहे.'],
                  key: 'mobile_already_user'
                });
              }

              // User exists but has no personal data and is not a manager, can be used
              const manager_user_id = existing_user_id;
              addManagerToBusiness(manager_user_id);
            });
          });
        } else {
          // Mobile number doesn't exist, create new user for manager
          const createUserQuery = `
            INSERT INTO user_master (mobile, phone_code, name, email, createtime, updatetime) 
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `;

          connection.query(createUserQuery, [manager_mobile, manager_phone_code, manager_name, manager_email], (createErr, createResult) => {
            if (createErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: createErr.message
              });
            }

            manager_user_id = createResult.insertId;
            addManagerToBusiness(manager_user_id);
          });
        }

        function addManagerToBusiness(manager_user_id) {
          // Check if manager is already assigned to this business
          const checkManagerQuery = `
            SELECT manager_id FROM business_manager_master 
            WHERE owner_user_id = ? AND manager_user_id = ? AND business_account_id = ? AND delete_flag = 0
          `;

          connection.query(checkManagerQuery, [owner_user_id, manager_user_id, business_account_id], (checkErr, checkResult) => {
            if (checkErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्वर त्रुटी'],
                error: checkErr.message
              });
            }

            if (checkResult.length > 0) {
              return response.status(200).json({
                success: false,
                msg: ['Manager already assigned to this business', 'मैनेजर पहले से ही इस व्यवसाय को सौंपा गया है', 'मॅनेजर आधीपासून या व्यवसायाला नियुक्त केले आहे']
              });
            }

            // Add manager to business
            const addManagerQuery = `
              INSERT INTO business_manager_master (
                owner_user_id, manager_user_id, business_account_id, manager_role, 
                permissions, status, invited_by, notes, createtime, updatetime
              ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())
            `;

            const permissionsJson = JSON.stringify(permissions || {});

            connection.query(addManagerQuery, [
              owner_user_id, manager_user_id, business_account_id, manager_role,
              permissionsJson, owner_user_id, notes
            ], (addErr, addResult) => {
              if (addErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: addErr.message
                });
              }

              // Log activity
              const logQuery = `
                INSERT INTO manager_activity_log (
                  manager_id, owner_user_id, business_account_id, activity_type, 
                  activity_description, createtime
                ) VALUES (?, ?, ?, 'add_manager', 'Manager added to business', NOW())
              `;

              connection.query(logQuery, [addResult.insertId, owner_user_id, business_account_id]);

              return response.status(200).json({
                success: true,
                msg: ['Manager added successfully', 'मैनेजर सफलतापूर्वक जोड़ा गया', 'मॅनेजर यशस्वीरित्या जोडले'],
                data: {
                  manager_id: addResult.insertId,
                  manager_mobile,
                  manager_name,
                  business_account_id,
                  status: 'active'
                }
              });
            });
          });
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
 * Get Managers
 * Get all managers for a business owner
 */
const getManagers = async (request, response) => {
  try {
    const owner_user_id = request.userId;
    const { business_account_id } = request.query;

    let query = `
            SELECT 
                bmm.manager_id,
                bmm.manager_user_id,
                bmm.business_account_id,
                bmm.manager_role,
                bmm.permissions,
                bmm.status,
                bmm.invited_at,
                bmm.accepted_at,
                bmm.last_accessed,
                bmm.notes,
        um.mobile as manager_mobile,
                um.name as manager_name,
                um.email as manager_email,
                uam.account_name as business_account_name
            FROM business_manager_master bmm
            LEFT JOIN user_master um ON bmm.manager_user_id = um.user_id AND um.delete_flag = 0
            LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
            WHERE bmm.owner_user_id = ? AND bmm.delete_flag = 0
        `;

    const queryParams = [owner_user_id];

    if (business_account_id) {
      query += " AND bmm.business_account_id = ?";
      queryParams.push(business_account_id);
    }

    query += " ORDER BY bmm.createtime DESC";

    connection.query(query, queryParams, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      // Parse permissions JSON
      const managers = result.map(manager => ({
        ...manager,
        permissions: manager.permissions ? JSON.parse(manager.permissions) : {}
      }));

      return response.status(200).json({
        success: true,
        msg: ['Managers retrieved successfully', 'मैनेजर सफलतापूर्वक प्राप्त किए गए', 'मॅनेजर यशस्वीरित्या मिळाले'],
        data: managers
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
 * Update Manager
 * Update manager details and permissions
 */
const updateManager = async (request, response) => {
  try {
    const {
      manager_id,
      manager_role,
      permissions,
      business_account_id,
      status,
      notes
    } = request.body;

    const owner_user_id = request.userId;

    // Check if manager exists and belongs to owner
    const checkQuery = `
      SELECT manager_id FROM business_manager_master 
      WHERE manager_id = ? AND owner_user_id = ? AND delete_flag = 0
    `;

    connection.query(checkQuery, [manager_id, owner_user_id], (checkErr, checkResult) => {
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
          msg: ['Manager not found', 'मैनेजर नहीं मिला', 'मॅनेजर सापडला नाही']
        });
      }

      // Build update query dynamically
      let updateFields = [];
      let updateValues = [];

      if (manager_role) {
        updateFields.push("manager_role = ?");
        updateValues.push(manager_role);
      }

      if (permissions) {
        updateFields.push("permissions = ?");
        updateValues.push(JSON.stringify(permissions));
      }

      if (business_account_id) {
        updateFields.push("business_account_id = ?");
        updateValues.push(business_account_id);
      }

      if (status) {
        updateFields.push("status = ?");
        updateValues.push(status);
      }

      if (notes !== undefined) {
        updateFields.push("notes = ?");
        updateValues.push(notes);
      }

      if (updateFields.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['No fields to update', 'अपडेट करने के लिए कोई फील्ड नहीं', 'अपडेट करण्यासाठी कोणतेही फील्ड नाही']
        });
      }

      updateFields.push("updatetime = NOW()");
      updateValues.push(manager_id, owner_user_id);

      const updateQuery = `
        UPDATE business_manager_master 
        SET ${updateFields.join(', ')} 
        WHERE manager_id = ? AND owner_user_id = ? AND delete_flag = 0
      `;

      connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        // Log activity
        const logQuery = `
          INSERT INTO manager_activity_log (
            manager_id, owner_user_id, business_account_id, activity_type, 
            activity_description, createtime
          ) VALUES (?, ?, ?, 'update_manager', 'Manager details updated', NOW())
        `;

        connection.query(logQuery, [manager_id, owner_user_id, business_account_id]);

        return response.status(200).json({
          success: true,
          msg: ['Manager updated successfully', 'मैनेजर सफलतापूर्वक अपडेट किया गया', 'मॅनेजर यशस्वीरित्या अपडेट केले'],
          data: {
            manager_id,
            affected_rows: updateResult.affectedRows
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
 * Remove Manager
 * Remove manager from business (permanent delete)
 */
const removeManager = async (request, response) => {
  try {
    const { manager_id } = request.body;
    const owner_user_id = request.userId;

    // Check if manager exists and belongs to owner - get manager_user_id too
    const checkQuery = `
      SELECT manager_id, manager_user_id, business_account_id FROM business_manager_master 
      WHERE manager_id = ? AND owner_user_id = ? AND delete_flag = 0
    `;

    connection.query(checkQuery, [manager_id, owner_user_id], (checkErr, checkResult) => {
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
          msg: ['Manager not found', 'मैनेजर नहीं मिला', 'मॅनेजर सापडला नाही']
        });
      }

      const business_account_id = checkResult[0].business_account_id;
      const manager_user_id = checkResult[0].manager_user_id;

      // First, delete related activity logs for this manager
      const deleteLogsQuery = `
        DELETE FROM manager_activity_log 
        WHERE manager_id = ?
      `;

      connection.query(deleteLogsQuery, [manager_id], (logsErr) => {
        if (logsErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: logsErr.message
          });
        }

        // Permanent delete manager from business_manager_master
        const deleteQuery = `
          DELETE FROM business_manager_master 
          WHERE manager_id = ? AND owner_user_id = ? AND delete_flag = 0
        `;

        connection.query(deleteQuery, [manager_id, owner_user_id], (deleteErr, deleteResult) => {
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
              msg: ['Manager not found or already deleted', 'मैनेजर नहीं मिला या पहले से हटाया गया', 'मॅनेजर सापडला नाही किंवा आधीच काढले']
            });
          }

          // Check if this user is only a manager (not a regular user)
          // If user has no personal data (transactions, budgets, accounts, categories, customers),
          // and is not a manager for any other business, delete from user_master too
          const checkIfOnlyManagerQuery = `
            SELECT 
              (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as has_transactions,
              (SELECT COUNT(*) FROM budget_master WHERE user_id = ? AND delete_flag = 0) as has_budgets,
              (SELECT COUNT(*) FROM user_account_master WHERE user_id = ? AND delete_flag = 0) as has_accounts,
              (SELECT COUNT(*) FROM category_master WHERE user_id = ? AND delete_flag = 0) as has_categories,
              (SELECT COUNT(*) FROM udhari_customer_master WHERE user_id = ? AND delete_flag = 0) as has_customers,
              (SELECT COUNT(*) FROM business_manager_master WHERE manager_user_id = ? AND delete_flag = 0) as remaining_manager_count
          `;

          connection.query(checkIfOnlyManagerQuery, [
            manager_user_id, manager_user_id, manager_user_id, manager_user_id, manager_user_id, manager_user_id
          ], (checkUserErr, checkUserResult) => {
            if (checkUserErr) {
              // Log error but don't fail the delete operation
              console.error('Error checking if user is only manager:', checkUserErr);
              return response.status(200).json({
                success: true,
                msg: ['Manager permanently deleted successfully', 'मैनेजर स्थायी रूप से सफलतापूर्वक हटाया गया', 'मॅनेजर कायमस्वरूपी यशस्वीरित्या काढले'],
                data: {
                  manager_id,
                  affected_rows: deleteResult.affectedRows,
                  deleted_permanently: true
                }
              });
            }

            const userData = checkUserResult[0];
            const isRegularUser = userData.has_transactions > 0 ||
              userData.has_budgets > 0 ||
              userData.has_accounts > 0 ||
              userData.has_categories > 0 ||
              userData.has_customers > 0;
            const hasOtherManagers = userData.remaining_manager_count > 0;

            // If manager has no other active manager assignments, prevent login by deleting user or setting active_flag = 0
            // This ensures removed managers cannot login even if they have personal data
            if (!hasOtherManagers) {
              // Delete from user_master if user is NOT a regular user
              if (!isRegularUser) {
                const deleteUserQuery = `
                  DELETE FROM user_master 
                  WHERE user_id = ? AND delete_flag = 0
                `;

                connection.query(deleteUserQuery, [manager_user_id], (deleteUserErr, deleteUserResult) => {
                  if (deleteUserErr) {
                    // Log error but don't fail - manager is already deleted
                    console.error('Error deleting user from user_master:', deleteUserErr);
                  }

                  return response.status(200).json({
                    success: true,
                    msg: ['Manager and user permanently deleted successfully', 'मैनेजर और उपयोगकर्ता स्थायी रूप से सफलतापूर्वक हटाया गया', 'मॅनेजर आणि वापरकर्ता कायमस्वरूपी यशस्वीरित्या काढले'],
                    data: {
                      manager_id,
                      manager_user_id,
                      affected_rows: deleteResult.affectedRows,
                      deleted_permanently: true,
                      user_deleted: deleteUserErr ? false : true
                    }
                  });
                });
              } else {
                // User has personal data, so deactivate instead of delete to prevent login
                const deactivateUserQuery = `
                  UPDATE user_master 
                  SET active_flag = 0, updatetime = NOW()
                  WHERE user_id = ? AND delete_flag = 0
                `;

                connection.query(deactivateUserQuery, [manager_user_id], (deactivateErr) => {
                  if (deactivateErr) {
                    console.error('Error deactivating user:', deactivateErr);
                  }

                  return response.status(200).json({
                    success: true,
                    msg: ['Manager removed and account deactivated successfully', 'मैनेजर हटाया गया और खाता निष्क्रिय कर दिया गया', 'मॅनेजर काढले आणि खाते निष्क्रिय केले'],
                    data: {
                      manager_id,
                      manager_user_id,
                      affected_rows: deleteResult.affectedRows,
                      deleted_permanently: true,
                      user_deleted: false,
                      user_deactivated: deactivateErr ? false : true,
                      reason: 'manager_removed_no_other_assignments'
                    }
                  });
                });
              }
            } else {
              // User has other manager assignments, but we still want to prevent login for this specific manager
              // The manager record is already deleted, so login will fail for this business
              // But they can still login to other businesses - this is expected behavior
              return response.status(200).json({
                success: true,
                msg: ['Manager permanently deleted successfully', 'मैनेजर स्थायी रूप से सफलतापूर्वक हटाया गया', 'मॅनेजर कायमस्वरूपी यशस्वीरित्या काढले'],
                data: {
                  manager_id,
                  manager_user_id,
                  affected_rows: deleteResult.affectedRows,
                  deleted_permanently: true,
                  user_deleted: false,
                  reason: 'user_has_other_managers'
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
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Get Manager Activity Log
 * Get activity log for a specific manager
 */
const getManagerActivityLog = async (request, response) => {
  try {
    const owner_user_id = request.userId;
    const { manager_id, business_account_id, limit = 50, offset = 0 } = request.query;

    let query = `
                SELECT 
                    mal.log_id,
        mal.manager_id,
        mal.owner_user_id,
                    mal.activity_type,
                    mal.activity_description,
        mal.business_account_id,
                    mal.createtime,
                    um.name as manager_name,
        um.mobile as manager_mobile,
                    uam.account_name as business_account_name
                FROM manager_activity_log mal
      LEFT JOIN business_manager_master bmm ON mal.manager_id = bmm.manager_id
      LEFT JOIN user_master um ON bmm.manager_user_id = um.user_id AND um.delete_flag = 0
                LEFT JOIN user_account_master uam ON mal.business_account_id = uam.user_account_id
      WHERE bmm.owner_user_id = ? AND bmm.delete_flag = 0
    `;

    const queryParams = [owner_user_id];

    if (manager_id) {
      query += " AND mal.manager_id = ?";
      queryParams.push(manager_id);
    }

    if (business_account_id) {
      query += " AND mal.business_account_id = ?";
      queryParams.push(business_account_id);
    }

    query += " ORDER BY mal.createtime DESC LIMIT ? OFFSET ?";
    queryParams.push(parseInt(limit), parseInt(offset));

    connection.query(query, queryParams, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Activity log retrieved successfully', 'गतिविधि लॉग सफलतापूर्वक प्राप्त किया गया', 'क्रियाकलाप लॉग यशस्वीरित्या मिळाले'],
        data: result
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
 * Get Manager Profile
 * Returns the manager's own profile information
 */
const getManagerProfile = async (request, response) => {
  try {
    const manager_id = request.managerInfo?.manager_id;

    if (!manager_id) {
      return response.status(200).json({
        success: false,
        msg: ['Manager ID not found', 'मैनेजर ID नहीं मिला', 'मॅनेजर ID सापडले नाही'],
        key: "manager_id"
      });
    }

    // Use the existing fetchManagerData function
    fetchManagerData(manager_id, async (error, managerDataArray) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      if (!managerDataArray) {
        return response.status(200).json({
          success: false,
          msg: ['Manager profile not found', 'मैनेजर प्रोफ़ाइल नहीं मिली', 'मॅनेजर प्रोफाइल सापडले नाही'],
          key: "manager_not_found"
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Manager profile retrieved successfully', 'मैनेजर प्रोफ़ाइल सफलतापूर्वक प्राप्त', 'मॅनेजर प्रोफाइल यशस्वीरित्या मिळाले'],
        data: managerDataArray
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
 * Update Manager Profile
 * Allows managers to update their own profile details
 */
const updateManagerProfile = async (request, response) => {
  try {
    const manager_id = request.managerInfo?.manager_id;
    const manager_user_id = request.managerInfo?.manager_user_id;

    if (!manager_id || !manager_user_id) {
      return response.status(200).json({
        success: false,
        msg: ['Manager information not found', 'मैनेजर जानकारी नहीं मिली', 'मॅनेजर माहिती सापडली नाही'],
        key: "manager_info"
      });
    }

    // Extract updateable fields from request body
    const {
      name,
      email,
      f_name,
      l_name,
      dob,
      age,
      gender,
      address,
      zipcode,
      city_id,
      country_id,
      latitude,
      longitude
    } = request.body;

    // Build update fields dynamically
    let updateFields = [];
    let updateValues = [];

    if (name) {
      updateFields.push("name = ?");
      updateValues.push(name);
    }

    if (email) {
      updateFields.push("email = ?");
      updateValues.push(email);
    }

    if (f_name) {
      updateFields.push("f_name = ?");
      updateValues.push(f_name);
    }

    if (l_name) {
      updateFields.push("l_name = ?");
      updateValues.push(l_name);
    }

    if (dob) {
      updateFields.push("dob = ?");
      updateValues.push(dob);
    }

    if (age) {
      updateFields.push("age = ?");
      updateValues.push(age);
    }

    if (gender) {
      updateFields.push("gender = ?");
      updateValues.push(gender);
    }

    if (address) {
      updateFields.push("address = ?");
      updateValues.push(address);
    }

    if (zipcode) {
      updateFields.push("zipcode = ?");
      updateValues.push(zipcode);
    }

    if (city_id) {
      updateFields.push("city_id = ?");
      updateValues.push(city_id);
    }

    if (country_id) {
      updateFields.push("country_id = ?");
      updateValues.push(country_id);
    }

    if (latitude) {
      updateFields.push("latitude = ?");
      updateValues.push(latitude);
    }

    if (longitude) {
      updateFields.push("longitude = ?");
      updateValues.push(longitude);
    }

    // Handle image upload
    if (request.file) {
      updateFields.push("image = ?");
      updateValues.push(request.file.path);
    }

    if (updateFields.length === 0) {
      return response.status(200).json({
        success: false,
        msg: ['No fields to update', 'अपडेट करने के लिए कोई फील्ड नहीं', 'अपडेट करण्यासाठी कोणतेही फील्ड नाही']
      });
    }

    // Add updatetime
    updateFields.push("updatetime = NOW()");
    updateValues.push(manager_user_id);

    // Update the manager's user profile
    const updateQuery = `
      UPDATE user_master 
      SET ${updateFields.join(', ')} 
      WHERE user_id = ? AND delete_flag = 0
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
          msg: ['Manager profile not found', 'मैनेजर प्रोफ़ाइल नहीं मिली', 'मॅनेजर प्रोफाइल सापडले नाही']
        });
      }

      // Log the profile update activity
      const logQuery = `
        INSERT INTO manager_activity_log 
        (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
        VALUES (?, ?, ?, 'profile_update', ?, ?, ?, NOW())
      `;

      connection.query(logQuery, [
        manager_id,
        request.managerInfo.owner_user_id,
        request.managerInfo.business_account_id,
        `Manager ${request.managerInfo.manager_name} updated their profile`,
        request.ip || request.connection.remoteAddress,
        request.get('User-Agent')
      ]);

      // Fetch updated manager data
      fetchManagerData(manager_id, async (error, managerDataArray) => {
        if (error) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: error.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Manager profile updated successfully', 'मैनेजर प्रोफ़ाइल सफलतापूर्वक अपडेट', 'मॅनेजर प्रोफाइल यशस्वीरित्या अपडेट'],
          data: managerDataArray
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

export {
  managerLoginWithOTP,
  managerVerifyOTP,
  managerResendOTP,
  generateManagerToken,
  addManager,
  getManagers,
  updateManager,
  removeManager,
  getManagerActivityLog,
  getManagerProfile,
  updateManagerProfile
};
