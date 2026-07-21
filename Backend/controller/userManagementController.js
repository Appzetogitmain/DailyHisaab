import moment from 'moment-timezone';
import connection from '../connection/dbConfig.js';
import languageMessage from './languageMessage.js';
import { getUserInfoSchema, manageUserStatusSchema } from '../validations/signUpWithMobile.js';
import { FCMAPI } from './notificationController.js';

/**
 * Get Detailed User Information Controller (Admin)
 * Retrieves comprehensive information about a specific user
 */
const getDetailedUserInfo = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate query parameters
    const { error, value } = getUserInfoSchema.validate(request.query);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id } = value;

    // Get basic user information - only required fields
    const userQuery = `
      SELECT 
        user_id, name, email, mobile, phone_code, user_type, 
        active_flag, gender, 
        dob, image,
        notification_status, app_lock_status,
        createtime, source, medium, campaign, installed_at
      FROM user_master 
      WHERE user_id = ? AND delete_flag = 0
    `;

    connection.query(userQuery, [user_id], (userErr, userResult) => {
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
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      const user = userResult[0];

      // Get user accounts
      const accountsQuery = `
        SELECT 
          user_account_id, user_type, account_name, createtime
        FROM user_account_master 
        WHERE user_id = ? AND delete_flag = 0
        ORDER BY user_type, createtime
      `;

      connection.query(accountsQuery, [user_id], (accountsErr, accountsResult) => {
        if (accountsErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: accountsErr.message
          });
        }

        // Get current subscription
        const subscriptionQuery = `
          SELECT 
            usm.user_subscription_id, usm.amount, usm.subscription_type,
            usm.start_date, usm.end_date, usm.createtime,
            sm.description as plan_name, sm.amount as plan_amount
          FROM user_subscription_master usm
          LEFT JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id AND sm.delete_flag = 0
          WHERE usm.user_id = ? AND usm.delete_flag = 0
          ORDER BY (usm.end_date > NOW()) DESC, usm.user_subscription_id DESC
          LIMIT 1
        `;

        connection.query(subscriptionQuery, [user_id], (subErr, subResult) => {
          if (subErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: subErr.message
            });
          }

          // Get user statistics - using safe queries for tables that exist
          // Check if app_ratings table exists first, then query safely
          const checkTableQuery = `
            SELECT COUNT(*) as table_exists 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'app_ratings'
          `;

          connection.query(checkTableQuery, [], (tableCheckErr, tableCheckResult) => {
            if (tableCheckErr) {
              // If we can't check table, just use 0 for ratings
              const statsQuery = `
            SELECT 
              (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as total_transactions,
              (SELECT COUNT(*) FROM udhari_customer_master WHERE user_id = ? AND delete_flag = 0) as total_customers,
              (SELECT COUNT(*) FROM business_manager_master WHERE owner_user_id = ? AND delete_flag = 0) as total_managers,
              (SELECT COUNT(*) FROM feedback_master WHERE user_id = ?) as total_feedback,
              0 as total_ratings
          `;

              connection.query(statsQuery, [user_id, user_id, user_id, user_id], (statsErr, statsResult) => {
                if (statsErr) {
                  return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: statsErr.message
                  });
                }
                processStatsResult(statsResult[0]);
              });
              return;
            }

            const tableExists = tableCheckResult[0]?.table_exists > 0;

            // Build stats query based on whether app_ratings table exists
            let statsQuery;
            if (tableExists) {
              statsQuery = `
                SELECT 
                  (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as total_transactions,
                  (SELECT COUNT(*) FROM udhari_customer_master WHERE user_id = ? AND delete_flag = 0) as total_customers,
                  (SELECT COUNT(*) FROM business_manager_master WHERE owner_user_id = ? AND delete_flag = 0) as total_managers,
                  (SELECT COUNT(*) FROM feedback_master WHERE user_id = ?) as total_feedback,
                  (SELECT COUNT(*) FROM app_ratings WHERE user_id = ?) as total_ratings
              `;
            } else {
              statsQuery = `
                SELECT 
                  (SELECT COUNT(*) FROM expense_income_master WHERE user_id = ? AND delete_flag = 0) as total_transactions,
                  (SELECT COUNT(*) FROM udhari_customer_master WHERE user_id = ? AND delete_flag = 0) as total_customers,
                  (SELECT COUNT(*) FROM business_manager_master WHERE owner_user_id = ? AND delete_flag = 0) as total_managers,
                  (SELECT COUNT(*) FROM feedback_master WHERE user_id = ?) as total_feedback,
                  0 as total_ratings
              `;
            }

            const queryParams = tableExists
              ? [user_id, user_id, user_id, user_id, user_id]
              : [user_id, user_id, user_id, user_id];

            connection.query(statsQuery, queryParams, (statsErr, statsResult) => {
              if (statsErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: statsErr.message
                });
              }

              processStatsResult(statsResult[0]);
            });
          });

          // Helper function to process stats result
          const processStatsResult = (stats) => {

            // Calculate age from DOB
            let calculatedAge = null;
            if (user.dob) {
              const dobDate = new Date(user.dob);
              const today = new Date();
              let age = today.getFullYear() - dobDate.getFullYear();
              const monthDiff = today.getMonth() - dobDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
                age--;
              }
              calculatedAge = age;
            }

            const userInfo = {
              user_id: user.user_id,
              personal_info: {
                name: user.name,
                email: user.email,
                mobile: user.mobile,
                phone_code: user.phone_code,
                dob: user.dob,
                age: calculatedAge,
                gender: user.gender,
                profile_photo: user.image || null
              },
              account_info: {
                user_type: user.user_type,
                user_type_label: user.user_type === 0 ? 'Manager' : user.user_type === 1 ? 'User' : 'Unknown'
              },
              status_info: {
                active_flag: user.active_flag,
                active_status: user.active_flag === 1 ? 'Active' : 'Inactive',
                notification_status: user.notification_status,
                notification_status_label: user.notification_status === 1 ? 'Enabled' : 'Disabled',
                app_lock_status: user.app_lock_status,
                app_lock_status_label: user.app_lock_status === 1 ? 'Enabled' : 'Disabled'
              },
              timestamps: {
                created_at: moment(user.createtime).format('DD MMM, YYYY HH:mm A'),
                installed_at: user.installed_at ? moment(user.installed_at).format('DD MMM, YYYY HH:mm A') : 'N/A'
              },
              acquisition_info: {
                source: user.source || 'organic',
                medium: user.medium || 'playstore',
                campaign: user.campaign || 'none'
              },
              accounts: accountsResult.map(account => ({
                account_id: account.user_account_id,
                account_name: account.account_name,
                account_type: account.user_type,
                account_type_label: account.user_type === 1 ? 'Personal' : account.user_type === 2 ? 'Business' : 'Freelance',
                created_at: moment(account.createtime).format('DD MMM, YYYY HH:mm A')
              })),
              current_subscription: subResult.length > 0 ? {
                subscription_id: subResult[0].user_subscription_id,
                plan_name: subResult[0].plan_name,
                plan_amount: subResult[0].plan_amount,
                amount_paid: subResult[0].amount,
                subscription_type: subResult[0].subscription_type,
                start_date: moment(subResult[0].start_date).format('DD MMM, YYYY'),
                end_date: moment(subResult[0].end_date).format('DD MMM, YYYY'),
                days_remaining: Math.max(0, moment(subResult[0].end_date).diff(moment(), 'days')),
                status: moment(subResult[0].end_date).isAfter(moment()) ? 'Active' : 'Expired',
                created_at: moment(subResult[0].createtime).format('DD MMM, YYYY HH:mm A')
              } : null,
              statistics: {
                total_transactions: stats.total_transactions || 0,
                total_customers: stats.total_customers || 0,
                total_managers: stats.total_managers || 0,
                total_feedback: stats.total_feedback || 0,
                total_ratings: stats.total_ratings || 0
              }
            };

            return response.status(200).json({
              success: true,
              msg: ['User information retrieved successfully', 'उपयोगकर्ता जानकारी सफलतापूर्वक प्राप्त', 'वापरकर्ता माहिती यशस्वीरित्या मिळाले'],
              data: userInfo
            });
          };
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
 * Suspend/Activate User Controller (Admin)
 * Allows admin to suspend or activate user accounts
 */
const manageUserStatus = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = manageUserStatusSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, action, reason } = value;

    // Check if user exists
    const userCheckQuery = "SELECT user_id, name, mobile, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], (userErr, userResult) => {
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
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      const user = userResult[0];
      const newStatus = action === 'suspend' ? 0 : 1;
      const currentStatus = user.active_flag;

      // Check if user is already in the desired state
      if (currentStatus === newStatus) {
        const statusText = newStatus === 1 ? 'active' : 'suspended';
        return response.status(200).json({
          success: false,
          msg: [`User is already ${statusText}`, `उपयोगकर्ता पहले से ही ${statusText} है`, `वापरकर्ता आधीच ${statusText} आहे`]
        });
      }

      // Update user status
      const updateQuery = `
        UPDATE user_master 
        SET active_flag = ?, updatetime = NOW() 
        WHERE user_id = ? AND delete_flag = 0
      `;

      connection.query(updateQuery, [newStatus, user_id], async (updateErr, updateResult) => {
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
            msg: ['Failed to update user status', 'उपयोगकर्ता स्थिति अपडेट करने में विफल', 'वापरकर्ता स्थिती अपडेट करण्यात अयशस्वी']
          });
        }

        // If user is suspended, send Firebase notification
        if (action === 'suspend') {
          try {
            // Get user's FCM token
            const fcmTokenQuery = `
              SELECT fcm_token 
              FROM user_device_tokens 
              WHERE user_id = ? AND fcm_token IS NOT NULL AND fcm_token != '' AND fcm_token != 'test_fcm_token'
              ORDER BY updatetime DESC 
              LIMIT 1
            `;

            connection.query(fcmTokenQuery, [user_id], async (fcmErr, fcmResult) => {
              if (!fcmErr && fcmResult.length > 0) {
                const fcmToken = fcmResult[0].fcm_token;
                const notificationTitle = 'Account Suspended';
                const notificationMessage = reason
                  ? `Your account has been suspended. Reason: ${reason}`
                  : 'Your account has been suspended. Please contact support for more information.';

                const notificationData = {
                  type: 'account_suspended',
                  user_id: String(user_id),
                  reason: reason || '',
                  action: 'suspend'
                };

                // Send Firebase notification
                const fcmResponse = await FCMAPI.sendToUsers(
                  [fcmToken],
                  notificationTitle,
                  notificationMessage,
                  notificationData
                );

                if (fcmResponse.success) {
                  console.log(`✅ Suspension notification sent to user ${user_id}`);
                } else {
                  console.error(`❌ Failed to send suspension notification to user ${user_id}:`, fcmResponse.error);
                }
              }
            });
          } catch (notifError) {
            console.error('Error sending suspension notification:', notifError);
            // Don't fail the request if notification fails
          }
        }

        // Log the action (optional - you can create a user_action_log table)
        const actionText = action === 'suspend' ? 'suspended' : 'activated';
        const reasonText = reason ? ` Reason: ${reason}` : '';

        return response.status(200).json({
          success: true,
          msg: [
            `User ${actionText} successfully${reasonText}`,
            `उपयोगकर्ता सफलतापूर्वक ${actionText}${reasonText}`,
            `वापरकर्ता यशस्वीरित्या ${actionText}${reasonText}`
          ],
          data: {
            user_id: user_id,
            user_name: user.name,
            user_mobile: user.mobile,
            previous_status: currentStatus === 1 ? 'Active' : 'Suspended',
            new_status: newStatus === 1 ? 'Active' : 'Suspended',
            action: action,
            reason: reason || null,
            updated_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Unsuspend User Controller (Admin)
 * Specifically for unsuspending users via PUT request
 */
const unsuspendUser = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { user_id, reason } = request.body;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'उपयोगकर्ता ID आवश्यक है', 'वापरकर्ता ID आवश्यक आहे']
      });
    }

    // Check if user exists
    const userCheckQuery = "SELECT user_id, name, mobile, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], (userErr, userResult) => {
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
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      const user = userResult[0];
      const currentStatus = user.active_flag;

      // Check if user is already active
      if (currentStatus === 1) {
        return response.status(200).json({
          success: false,
          msg: ['User is already active', 'उपयोगकर्ता पहले से ही active है', 'वापरकर्ता आधीच active आहे']
        });
      }

      // Update user status to active
      const updateQuery = `
        UPDATE user_master 
        SET active_flag = 1, updatetime = NOW() 
        WHERE user_id = ? AND delete_flag = 0
      `;

      connection.query(updateQuery, [user_id], async (updateErr, updateResult) => {
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
            msg: ['Failed to unsuspend user', 'उपयोगकर्ता को unsuspend करने में विफल', 'वापरकर्ता unsuspend करण्यात अयशस्वी']
          });
        }

        // Send Firebase notification when user is unsuspended
        try {
          // Get user's FCM token
          const fcmTokenQuery = `
            SELECT fcm_token 
            FROM user_device_tokens 
            WHERE user_id = ? AND fcm_token IS NOT NULL AND fcm_token != '' AND fcm_token != 'test_fcm_token'
            ORDER BY updatetime DESC 
            LIMIT 1
          `;

          connection.query(fcmTokenQuery, [user_id], async (fcmErr, fcmResult) => {
            if (!fcmErr && fcmResult.length > 0) {
              const fcmToken = fcmResult[0].fcm_token;
              const notificationTitle = 'Account Activated';
              const notificationMessage = reason
                ? `Your account has been activated. Reason: ${reason}`
                : 'Your account has been activated. You can now login and use the app.';

              const notificationData = {
                type: 'account_activated',
                user_id: String(user_id),
                reason: reason || '',
                action: 'unsuspend'
              };

              // Send Firebase notification
              const fcmResponse = await FCMAPI.sendToUsers(
                [fcmToken],
                notificationTitle,
                notificationMessage,
                notificationData
              );

              if (fcmResponse.success) {
                console.log(`✅ Activation notification sent to user ${user_id}`);
              } else {
                console.error(`❌ Failed to send activation notification to user ${user_id}:`, fcmResponse.error);
              }
            }
          });
        } catch (notifError) {
          console.error('Error sending activation notification:', notifError);
          // Don't fail the request if notification fails
        }

        const reasonText = reason ? ` Reason: ${reason}` : '';

        return response.status(200).json({
          success: true,
          msg: [
            `User unsuspended successfully${reasonText}`,
            `उपयोगकर्ता सफलतापूर्वक unsuspended${reasonText}`,
            `वापरकर्ता यशस्वीरित्या unsuspended${reasonText}`
          ],
          data: {
            user_id: user_id,
            user_name: user.name,
            user_mobile: user.mobile,
            previous_status: 'Suspended',
            new_status: 'Active',
            action: 'unsuspend',
            reason: reason || 'Account unsuspended by admin',
            updated_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Force Logout Users Controller (Admin)
 * Allows admin to force logout specific users or all users
 */
const forceLogoutUsers = async (request, response) => {
  try {
    const { user_ids, select_all } = request.body;

    if (!select_all && (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0)) {
      return response.status(200).json({
        success: false,
        msg: ['User IDs are required', 'उपयोगकर्ता ID आवश्यक है', 'वापरकर्ता ID आवश्यक आहे']
      });
    }

    let updateQuery;
    let queryParams = [];

    if (select_all) {
      updateQuery = "UPDATE user_master SET force_logout_at = NOW(), updatetime = NOW() WHERE user_type = 1 AND delete_flag = 0";
    } else {
      updateQuery = "UPDATE user_master SET force_logout_at = NOW(), updatetime = NOW() WHERE user_id IN (?) AND delete_flag = 0";
      queryParams.push(user_ids);
    }

    connection.query(updateQuery, queryParams, async (updateErr, updateResult) => {
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
          msg: ['No users found to logout', 'लॉगआउट करने के लिए कोई उपयोगकर्ता नहीं मिला', 'लॉगआउट करण्यासाठी कोणताही वापरकर्ता सापडला नाही']
        });
      }

      // Send silent FCM notification to trigger immediate logout in the app
      try {
        let fcmTokenQuery;
        let fcmParams = [];

        if (select_all) {
          fcmTokenQuery = `
            SELECT fcm_token 
            FROM user_device_tokens udt
            JOIN user_master u ON udt.user_id = u.user_id
            WHERE u.user_type = 1 AND u.delete_flag = 0 AND udt.is_active = 1
            AND udt.fcm_token IS NOT NULL AND udt.fcm_token != '' AND udt.fcm_token != 'test_fcm_token'
          `;
        } else {
          fcmTokenQuery = `
            SELECT fcm_token 
            FROM user_device_tokens 
            WHERE user_id IN (?) AND is_active = 1
            AND fcm_token IS NOT NULL AND fcm_token != '' AND fcm_token != 'test_fcm_token'
          `;
          fcmParams.push(user_ids);
        }

        connection.query(fcmTokenQuery, fcmParams, async (fcmErr, fcmResult) => {
          if (!fcmErr && fcmResult.length > 0) {
            const tokens = fcmResult.map(row => row.fcm_token);
            
            // Send dynamic data message (silent notification)
            const notificationTitle = 'Session Expired';
            const notificationMessage = 'Your session has been terminated by the administrator. Please login again.';
            const notificationData = {
              type: 'FORCE_LOGOUT',
              action: 'logout',
              timestamp: new Date().toISOString()
            };

            // Use FCMAPI to send
            await FCMAPI.sendToUsers(tokens, notificationTitle, notificationMessage, notificationData);
          }
        });
      } catch (notifError) {
        console.error('Error sending force logout notifications:', notifError);
      }

      return response.status(200).json({
        success: true,
        msg: [
          `Force logout initiated for ${updateResult.affectedRows} users`,
          `${updateResult.affectedRows} उपयोगकर्ताओं के लिए बलपूर्वक लॉगआउट शुरू किया गया`,
          `${updateResult.affectedRows} वापरकर्त्यांसाठी सक्तीने लॉगआउट सुरू केले`
        ],
        affectedRows: updateResult.affectedRows
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
  getDetailedUserInfo,
  manageUserStatus,
  unsuspendUser,
  forceLogoutUsers
};
