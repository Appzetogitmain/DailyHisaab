import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';
import { createNotificationCampaignSchema, sendNotificationCampaignSchema, updateUserDeviceTokenSchema, getAllNotificationCampaignsSchema, getNotificationPerformanceStatsSchema, updateNotificationCampaignSchema, deleteNotificationCampaignSchema, updateNotificationStatusSchema } from '../validations/signUpWithMobile.js';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Get current directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

try {
  const serviceAccountPath = join(__dirname, '../daily-hisab-ecb74-firebase-adminsdk-fbsvc-f15a966d3e.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
  } else {
    console.log('✅ Firebase Admin SDK already initialized');
  }
  firebaseInitialized = true;
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error.message);
}

/**
 * Firebase Cloud Messaging (FCM) API Helper Functions
 */
const FCMAPI = {
  // Send notification to specific users (FCM tokens)
  sendToUsers: async (fcmTokens, title, message, data = {}) => {
    try {
      if (!firebaseInitialized) {
        return { success: false, error: 'Firebase Admin SDK not initialized' };
      }

      if (!fcmTokens || fcmTokens.length === 0) {
        return { success: false, error: 'No FCM tokens provided' };
      }

      // Clean and validate tokens before sending
      const validTokens = fcmTokens
        .filter(token => {
          if (!token) return false;
          const trimmed = String(token).trim();
          return trimmed.length > 10 && // FCM tokens are typically longer
            trimmed !== 'test_fcm_token' &&
            trimmed !== 'null' &&
            trimmed !== 'undefined';
        })
        .map(token => String(token).trim())
        .filter((token, index, self) => self.indexOf(token) === index); // Remove duplicates

      if (validTokens.length === 0) {
        return { success: false, error: 'No valid FCM tokens after filtering' };
      }

      // Use cleaned tokens
      fcmTokens = validTokens;

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // If only one token, use simple send() method (same as test API)
      if (fcmTokens.length === 1) {
        try {
          const fcmMessage = {
            token: fcmTokens[0],
            notification: {
              title: title,
              body: message
            },
            data: {
              ...data,
              title: title,
              body: message,
              messageId: messageId
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'default',
                icon: 'ic_notification',
                color: '#FF0000'
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
            }
          };

          const response = await admin.messaging().send(fcmMessage);
          console.log('Single token FCM sent successfully:', response);

          return {
            success: true,
            data: {
              id: messageId,
              successCount: 1,
              failureCount: 0,
              total: 1,
              results: [{ successCount: 1, failureCount: 0, responses: [] }]
            }
          };
        } catch (error) {
          console.error('Error sending to single token:', error);

          // Check if token is invalid and should be removed
          const errorCode = error.code;
          if (errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode === 'messaging/invalid-argument') {
            // Remove invalid token from database
            const removeQuery = `
              UPDATE user_device_tokens 
              SET is_active = 0, updatetime = NOW()
              WHERE fcm_token = ?
            `;
            connection.query(removeQuery, [fcmTokens[0]], (removeError) => {
              if (removeError) {
                console.error('Error removing invalid token:', removeError);
              } else {
                console.log('Successfully deactivated invalid FCM token');
              }
            });
          }

          return {
            success: false,
            error: error.message,
            data: {
              id: messageId,
              successCount: 0,
              failureCount: 1,
              total: 1
            }
          };
        }
      }

      // FCM supports sending to multiple tokens (max 500 per request)
      const batchSize = 500;
      const batches = [];

      for (let i = 0; i < fcmTokens.length; i += batchSize) {
        batches.push(fcmTokens.slice(i, i + batchSize));
      }

      const results = [];

      for (const batch of batches) {
        const messageConfig = {
          notification: {
            title: title,
            body: message
          },
          data: {
            ...data,
            title: title,
            body: message,
            messageId: messageId
          },
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'default',
              icon: 'ic_notification',
              color: '#FF0000'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          },
          tokens: batch
        };

        try {
          const response = await admin.messaging().sendEachForMulticast(messageConfig);

          // Log detailed response for debugging
          console.log(`FCM Batch Response: Success=${response.successCount}, Failed=${response.failureCount}`);

          // Track invalid tokens to remove from database
          const invalidTokens = [];

          // Log failed tokens if any and collect invalid tokens
          if (response.failureCount > 0) {
            response.responses.forEach((resp, index) => {
              if (!resp.success) {
                const errorCode = resp.error?.code;
                const token = batch[index];

                console.error(`Failed token ${index}:`, errorCode, resp.error?.message);
                console.error(`Token:`, token?.substring(0, 30) + '...');

                // Check if token is invalid/expired and should be removed
                if (errorCode === 'messaging/invalid-registration-token' ||
                  errorCode === 'messaging/registration-token-not-registered' ||
                  errorCode === 'messaging/invalid-argument') {
                  invalidTokens.push(token);
                  console.log(`Marking token as invalid for removal: ${token?.substring(0, 30)}...`);
                }
              }
            });

            // Remove invalid tokens from database
            if (invalidTokens.length > 0) {
              const placeholders = invalidTokens.map(() => '?').join(',');
              const removeQuery = `
                UPDATE user_device_tokens 
                SET is_active = 0, updatetime = NOW()
                WHERE fcm_token IN (${placeholders})
              `;

              connection.query(removeQuery, invalidTokens, (removeError) => {
                if (removeError) {
                  console.error('Error removing invalid tokens:', removeError);
                } else {
                  console.log(`Successfully deactivated ${invalidTokens.length} invalid FCM tokens`);
                }
              });
            }
          }

          results.push({
            successCount: response.successCount,
            failureCount: response.failureCount,
            responses: response.responses,
            invalidTokens: invalidTokens
          });
        } catch (batchError) {
          console.error('Error in FCM batch send:', batchError);
          // If batch fails, try sending individually
          console.log('Attempting individual sends for batch...');
          let batchSuccess = 0;
          let batchFailure = 0;

          for (const token of batch) {
            try {
              const individualMessage = {
                token: token,
                notification: {
                  title: title,
                  body: message
                },
                data: {
                  ...data,
                  title: title,
                  body: message,
                  messageId: messageId
                },
                android: {
                  priority: 'high',
                  notification: {
                    sound: 'default',
                    channelId: 'default',
                    icon: 'ic_notification',
                    color: '#FF0000'
                  }
                },
                apns: {
                  payload: {
                    aps: {
                      sound: 'default',
                      badge: 1
                    }
                  }
                }
              };
              await admin.messaging().send(individualMessage);
              batchSuccess++;
            } catch (individualError) {
              console.error(`Failed to send to token: ${token.substring(0, 20)}...`, individualError.message);

              // Check if token is invalid and should be removed
              const errorCode = individualError.code;
              if (errorCode === 'messaging/invalid-registration-token' ||
                errorCode === 'messaging/registration-token-not-registered' ||
                errorCode === 'messaging/invalid-argument') {
                // Remove invalid token from database
                const removeQuery = `
                  UPDATE user_device_tokens 
                  SET is_active = 0, updatetime = NOW()
                  WHERE fcm_token = ?
                `;
                connection.query(removeQuery, [token], (removeError) => {
                  if (removeError) {
                    console.error('Error removing invalid token:', removeError);
                  } else {
                    console.log('Successfully deactivated invalid FCM token');
                  }
                });
              }

              batchFailure++;
            }
          }

          results.push({
            successCount: batchSuccess,
            failureCount: batchFailure,
            responses: []
          });
        }
      }

      const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
      const totalFailure = results.reduce((sum, r) => sum + r.failureCount, 0);

      return {
        success: true,
        data: {
          id: messageId,
          successCount: totalSuccess,
          failureCount: totalFailure,
          total: fcmTokens.length,
          results: results
        }
      };
    } catch (error) {
      console.error('❌ FCM send error:', error);
      return { success: false, error: error.message };
    }
  },

  // Send notification to all users (topic-based or multicast)
  sendToAll: async (title, message, data = {}) => {
    try {
      if (!firebaseInitialized) {
        return { success: false, error: 'Firebase Admin SDK not initialized' };
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const messageConfig = {
        notification: {
          title: title,
          body: message
        },
        data: {
          ...data,
          title: title,
          body: message,
          messageId: messageId
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
            icon: 'ic_notification',
            color: '#FF0000'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        topic: 'all_users' // Using topic for broadcast
      };

      const response = await admin.messaging().send(messageConfig);

      return {
        success: true,
        data: {
          id: messageId,
          messageId: response,
          topic: 'all_users'
        }
      };
    } catch (error) {
      console.error('❌ FCM send error:', error);
      return { success: false, error: error.message };
    }
  },

  // Validate FCM token
  validateToken: async (token) => {
    try {
      if (!firebaseInitialized) {
        return { success: false, error: 'Firebase Admin SDK not initialized' };
      }

      await admin.messaging().send({
        token: token,
        notification: {
          title: 'Test',
          body: 'Test'
        }
      }, true); // dry run mode

      return { success: true, valid: true };
    } catch (error) {
      if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
        return { success: true, valid: false, error: error.message };
      }
      return { success: false, error: error.message };
    }
  }
};

/**
 * Create Notification Campaign Controller
 * Admin creates a new notification campaign
 */
const createNotificationCampaign = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = createNotificationCampaignSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const {
      title,
      message,
      notification_type,
      target_audience,
      target_language
    } = value;

    const adminId = request.adminInfo.admin_id;

    // Validate target_audience before insert
    const validTargetAudiences = ['all_users', 'free_users', 'paid_users', 'active_users', 'inactive_users', 'expired_users'];
    if (!validTargetAudiences.includes(target_audience)) {
      return response.status(200).json({
        success: false,
        msg: [
          `Invalid target_audience: ${target_audience}. Valid values are: all_users, free_users, paid_users, active_users, inactive_users, expired_users`,
          `अमान्य target_audience: ${target_audience}. वैध मान हैं: all_users, free_users, paid_users, active_users, inactive_users, expired_users`,
          `अवैध target_audience: ${target_audience}. वैध मूल्ये आहेत: all_users, free_users, paid_users, active_users, inactive_users, expired_users`
        ],
        key: 'invalid_target_audience',
        valid_values: validTargetAudiences
      });
    }

    const createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Insert campaign
    // Note: Assuming target_language column has been added to the table
    const insertQuery = `
      INSERT INTO notification_campaigns 
      (title, message, notification_type, target_audience, target_language, status, created_by, createtime, updatetime) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const status = 'draft';
    const insertValues = [title, message, notification_type, target_audience, target_language || null, status, adminId, createtime, createtime];

    connection.query(insertQuery, insertValues, (error, result) => {
      if (error) {
        console.error('Error creating notification campaign:', error);
        // Check if it's an ENUM constraint error
        if (error.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD' || error.message.includes('ENUM')) {
          return response.status(200).json({
            success: false,
            msg: [
              `Invalid target_audience value: ${target_audience}. Please run the database migration to add 'paid_users' to the ENUM.`,
              `अमान्य target_audience मान: ${target_audience}. कृपया ENUM में 'paid_users' जोड़ने के लिए डेटाबेस माइग्रेशन चलाएं।`,
              `अवैध target_audience मूल्य: ${target_audience}. कृपया ENUM मध्ये 'paid_users' जोडण्यासाठी डेटाबेस मायग्रेशन चालवा.`
            ],
            error: error.message,
            key: 'enum_constraint_error',
            migration_file: 'migrations/update_notification_campaigns_target_audience.sql'
          });
        }
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      const campaignId = result.insertId;

      return response.status(200).json({
        success: true,
        msg: ['Notification campaign created successfully', 'अधिसूचना अभियान सफलतापूर्वक बनाया गया', 'सूचना मोहीम यशस्वीरित्या तयार केली'],
        data: {
          campaign_id: campaignId,
          title,
          message,
          notification_type,
          target_audience,
          status
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
 * Send Notification Campaign Controller
 * Sends the notification campaign to targeted users
 */
const sendNotificationCampaign = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = sendNotificationCampaignSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { campaign_id } = value;

    // Get campaign details
    const campaignQuery = `
      SELECT * FROM notification_campaigns 
      WHERE campaign_id = ? AND status = 'draft'
    `;

    connection.query(campaignQuery, [campaign_id], async (error, campaignResult) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      if (campaignResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Campaign not found or already sent', 'अभियान नहीं मिला या पहले से भेजा गया', 'मोहीम सापडली नाही किंवा आधीच पाठविली'],
          key: 'campaign_not_found'
        });
      }

      const campaign = campaignResult[0];

      // Map empty or older target audience values for backward compatibility
      let targetAudience = campaign.target_audience;
      if (!targetAudience || targetAudience === '' || targetAudience === null) {
        targetAudience = 'all_users';
      }
      const mapping = {
        'monthly_subscribers': 'paid_users',
        'yearly_subscribers': 'paid_users',
        'inactive_users': 'all_users'
      };
      if (mapping[targetAudience]) {
        targetAudience = mapping[targetAudience];
      }
      campaign.target_audience = targetAudience;

      // Validate target audience - only allow the 6 valid values
      const validTargetAudiences = ['all_users', 'free_users', 'paid_users', 'active_users', 'inactive_users', 'expired_users'];
      if (!validTargetAudiences.includes(campaign.target_audience)) {
        return response.status(200).json({
          success: false,
          msg: [
            `Invalid target audience: ${campaign.target_audience}. Valid values are: all_users, free_users, paid_users, active_users, inactive_users, expired_users.`,
            `अमान्य लक्षित दर्शक: ${campaign.target_audience}. वैध मान हैं: all_users, free_users, paid_users, active_users, inactive_users, expired_users।`,
            `अवैध लक्ष्य दर्शक: ${campaign.target_audience}. वैध मूल्ये आहेत: all_users, free_users, paid_users, active_users, inactive_users, expired_users.`
          ],
          key: 'invalid_target_audience',
          current_value: campaign.target_audience,
          valid_values: validTargetAudiences
        });
      }

      // Get target users based on audience
      let targetUsersQuery = '';
      let queryParams = [];

      switch (campaign.target_audience) {
        case 'all_users':
          targetUsersQuery = `
            SELECT DISTINCT 
              udt.user_id, 
              udt.fcm_token, 
              u.name, 
              u.email
            FROM user_device_tokens udt
            INNER JOIN user_master u ON udt.user_id = u.user_id
            WHERE u.delete_flag = 0 AND u.active_flag = 1
            AND udt.is_active = 1
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
          `;
          break;

        case 'free_users':
          // Free users: Users with current active subscriptions where subscription_type = 0
          // OR users with no active subscription at all
          // Get only the most recent active subscription (highest user_subscription_id = most recent)
          targetUsersQuery = `
            SELECT DISTINCT udt.user_id, udt.fcm_token, u.name, u.email
            FROM user_device_tokens udt
            JOIN user_master u ON udt.user_id = u.user_id
            LEFT JOIN (
              SELECT usm1.user_id, sm1.subscription_type
              FROM user_subscription_master usm1
              JOIN subscription_master sm1 ON usm1.subscription_id = sm1.subscription_id
              WHERE usm1.delete_flag = 0 
              AND usm1.end_date >= CURDATE()
              AND usm1.user_subscription_id = (
                SELECT MAX(usm2.user_subscription_id)
                FROM user_subscription_master usm2
                WHERE usm2.user_id = usm1.user_id
                AND usm2.delete_flag = 0
                AND usm2.end_date >= CURDATE()
              )
            ) current_sub ON u.user_id = current_sub.user_id
            WHERE udt.is_active = 1 
            AND u.delete_flag = 0 
            AND u.active_flag = 1
            AND (current_sub.user_id IS NULL OR current_sub.subscription_type = 0 OR current_sub.subscription_type IS NULL)
            AND NOT EXISTS (
              SELECT 1 FROM user_subscription_master usm2
              JOIN subscription_master sm2 ON usm2.subscription_id = sm2.subscription_id
              WHERE usm2.user_id = u.user_id
              AND usm2.end_date < CURDATE()
              AND usm2.delete_flag = 0
              AND sm2.subscription_type != 0
              AND sm2.subscription_type IS NOT NULL
            )
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
          `;
          break;

        case 'paid_users':
          // Paid users: Users with current active subscriptions where subscription_type != 0
          // Get only the most recent active subscription (highest user_subscription_id = most recent)
          targetUsersQuery = `
            SELECT DISTINCT udt.user_id, udt.fcm_token, u.name, u.email
            FROM user_device_tokens udt
            JOIN user_master u ON udt.user_id = u.user_id
            JOIN (
              SELECT usm1.user_id, sm1.subscription_type
              FROM user_subscription_master usm1
              JOIN subscription_master sm1 ON usm1.subscription_id = sm1.subscription_id
              WHERE usm1.delete_flag = 0 
              AND usm1.end_date >= CURDATE()
              AND usm1.user_subscription_id = (
                SELECT MAX(usm2.user_subscription_id)
                FROM user_subscription_master usm2
                WHERE usm2.user_id = usm1.user_id
                AND usm2.delete_flag = 0
                AND usm2.end_date >= CURDATE()
              )
              AND sm1.subscription_type != 0
              AND sm1.subscription_type IS NOT NULL
            ) current_sub ON u.user_id = current_sub.user_id
            WHERE udt.is_active = 1 
            AND u.delete_flag = 0 
            AND u.active_flag = 1
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
          `;
          break;

        case 'active_users':
          // Active users: Users who have logged in within the last 30 days
          const activeDays = 30;
          const activeThresholdDate = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').subtract(activeDays, 'days').format('YYYY-MM-DD HH:mm:ss');
          targetUsersQuery = `
            SELECT DISTINCT udt.user_id, udt.fcm_token, u.name, u.email
            FROM user_device_tokens udt
            INNER JOIN user_master u ON udt.user_id = u.user_id
            WHERE u.delete_flag = 0 
            AND udt.is_active = 1
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
            AND u.last_login_date_time >= ?
          `;
          queryParams.push(activeThresholdDate);
          break;

        case 'inactive_users':
          // Inactive users: Users who have NOT logged in for 30+ days (or never logged in)
          const inactiveDays = 30;
          const inactiveThresholdDate = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').subtract(inactiveDays, 'days').format('YYYY-MM-DD HH:mm:ss');
          targetUsersQuery = `
            SELECT DISTINCT udt.user_id, udt.fcm_token, u.name, u.email
            FROM user_device_tokens udt
            INNER JOIN user_master u ON udt.user_id = u.user_id
            WHERE u.delete_flag = 0 
            AND udt.is_active = 1
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
            AND (u.last_login_date_time < ? OR u.last_login_date_time IS NULL)
          `;
          queryParams.push(inactiveThresholdDate);
          break;

        case 'expired_users':
          // Expired users: Users who HAD a paid subscription but it's now expired
          // AND they don't have any current active paid subscription
          targetUsersQuery = `
            SELECT DISTINCT udt.user_id, udt.fcm_token, u.name, u.email
            FROM user_device_tokens udt
            INNER JOIN user_master u ON udt.user_id = u.user_id
            LEFT JOIN (
              SELECT usm1.user_id
              FROM user_subscription_master usm1
              JOIN subscription_master sm1 ON usm1.subscription_id = sm1.subscription_id
              WHERE usm1.delete_flag = 0 
              AND usm1.end_date >= CURDATE()
              AND sm1.subscription_type != 0
              AND sm1.subscription_type IS NOT NULL
            ) active_sub ON u.user_id = active_sub.user_id
            WHERE udt.is_active = 1 
            AND u.delete_flag = 0 
            AND u.active_flag = 1
            AND active_sub.user_id IS NULL
            AND EXISTS (
              SELECT 1 FROM user_subscription_master usm2
              JOIN subscription_master sm2 ON usm2.subscription_id = sm2.subscription_id
              WHERE usm2.user_id = u.user_id
              AND usm2.end_date < CURDATE()
              AND usm2.delete_flag = 0
              AND sm2.subscription_type != 0
              AND sm2.subscription_type IS NOT NULL
            )
            AND udt.fcm_token IS NOT NULL
            AND udt.fcm_token != ''
            AND TRIM(udt.fcm_token) != ''
            AND udt.fcm_token != 'test_fcm_token'
          `;
          break;

        default:
          return response.status(200).json({
            success: false,
            msg: ['Invalid target audience', 'अमान्य लक्षित दर्शक', 'अवैध लक्ष्य दर्शक'],
            key: 'invalid_target_audience'
          });
      }

      // Add language filter if target_language is set
      // Only if targetUsersQuery is populated (i.e., not default case)
      if (campaign.target_language && targetUsersQuery) {
        targetUsersQuery += ` AND COALESCE(u.language_code, 'en') = ?`;
        queryParams.push(campaign.target_language);
      }

      connection.query(targetUsersQuery, queryParams, async (usersError, usersResult) => {
        if (usersError) {
          console.error('Error querying target users:', usersError);
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: usersError.message
          });
        }

        // Add diagnostic logging
        console.log(`Target audience: ${campaign.target_audience}`);
        console.log(`Query executed: ${targetUsersQuery}`);
        console.log(`Users found: ${usersResult.length}`);

        // Additional debug for paid_users
        if (campaign.target_audience === 'paid_users' && usersResult.length === 0) {
          // Check if there are any active subscriptions with subscription_type != 0
          const debugQuery = `
            SELECT COUNT(*) as count, 
                   COUNT(CASE WHEN usm.subscription_type != 0 THEN 1 END) as paid_count,
                   COUNT(CASE WHEN usm.subscription_type = 0 THEN 1 END) as free_count
            FROM user_subscription_master usm
            WHERE usm.delete_flag = 0 
            AND usm.end_date >= CURDATE()
          `;
          connection.query(debugQuery, [], (debugError, debugResult) => {
            if (!debugError && debugResult.length > 0) {
              console.log('Debug - Active subscriptions:', debugResult[0]);
            }
          });
        }

        if (usersResult.length === 0) {
          // Check if there are any users in the system at all
          const checkUsersQuery = `
            SELECT COUNT(*) as total_users FROM user_master WHERE delete_flag = 0 AND active_flag = 1
          `;

          connection.query(checkUsersQuery, [], (checkError, checkResult) => {
            if (checkError) {
              console.error('Error checking total users:', checkError);
            }

            const totalUsers = checkResult[0]?.total_users || 0;
            console.log(`Total active users in system: ${totalUsers}`);

            // Check if there are any device tokens
            const checkTokensQuery = `
              SELECT COUNT(*) as total_tokens FROM user_device_tokens WHERE is_active = 1
            `;

            connection.query(checkTokensQuery, [], (tokenError, tokenResult) => {
              if (tokenError) {
                console.error('Error checking device tokens:', tokenError);
              }

              const totalTokens = tokenResult[0]?.total_tokens || 0;
              console.log(`Total active device tokens: ${totalTokens}`);

              // If no device tokens but users exist, try a fallback approach
              if (totalUsers > 0 && totalTokens === 0) {
                console.log('No device tokens found, attempting fallback query...');

                // Fallback: Get users without device tokens (for testing)
                const fallbackQuery = `
                  SELECT DISTINCT u.user_id, 'test_fcm_token' as fcm_token, u.name, u.email
                  FROM user_master u
                  WHERE u.delete_flag = 0 AND u.active_flag = 1
                  LIMIT 10
                `;

                connection.query(fallbackQuery, [], (fallbackError, fallbackResult) => {
                  if (fallbackError) {
                    console.error('Fallback query error:', fallbackError);
                  }

                  console.log(`Fallback query found ${fallbackResult.length} users`);

                  return response.status(200).json({
                    success: false,
                    msg: [
                      `No target users with device tokens found for audience: ${campaign.target_audience}. Total active users: ${totalUsers}, Total device tokens: ${totalTokens}. Fallback found: ${fallbackResult.length} users without tokens.`,
                      `लक्षित दर्शक के लिए कोई डिवाइस टोकन वाले उपयोगकर्ता नहीं मिले: ${campaign.target_audience}. कुल सक्रिय उपयोगकर्ता: ${totalUsers}, कुल डिवाइस टोकन: ${totalTokens}. फॉलबैक में मिले: ${fallbackResult.length} बिना टोकन के उपयोगकर्ता।`,
                      `लक्ष्य दर्शकांसाठी कोणतेही डिव्हाइस टोकन असलेले वापरकर्ते सापडले नाहीत: ${campaign.target_audience}. एकूण सक्रिय वापरकर्ते: ${totalUsers}, एकूण डिव्हाइस टोकन: ${totalTokens}. फॉलबॅकमध्ये सापडले: ${fallbackResult.length} टोकनशिवाय वापरकर्ते.`
                    ],
                    key: 'no_target_users',
                    debug_info: {
                      target_audience: campaign.target_audience,
                      total_active_users: totalUsers,
                      total_device_tokens: totalTokens,
                      fallback_users_found: fallbackResult.length,
                      query_executed: targetUsersQuery,
                      query_params: queryParams,
                      fallback_query: fallbackQuery
                    }
                  });
                });
              } else {
                // If no users found and it's paid_users, return success with 0 recipients instead of error
                if (campaign.target_audience === 'paid_users') {
                  const sendTime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

                  // Update campaign status to sent with 0 recipients
                  const updateCampaignQuery = `
                    UPDATE notification_campaigns 
                    SET status = 'sent', sendtime = ?, total_recipients = 0, updatetime = ?
                    WHERE campaign_id = ?
                  `;

                  connection.query(updateCampaignQuery, [sendTime, sendTime, campaign_id], (updateError) => {
                    if (updateError) {
                      console.error('Error updating campaign:', updateError);
                    }

                    return response.status(200).json({
                      success: true,
                      msg: [
                        'Notification campaign sent successfully. No paid users found.',
                        'अधिसूचना अभियान सफलतापूर्वक भेजा गया। कोई भुगतानकर्ता उपयोगकर्ता नहीं मिला।',
                        'सूचना मोहीम यशस्वीरित्या पाठविली. कोणतेही पैसे देणारे वापरकर्ते सापडले नाहीत.'
                      ],
                      data: {
                        campaign_id: campaign_id,
                        total_recipients: 0,
                        total_sent: 0,
                        total_failed: 0,
                        send_time: sendTime
                      }
                    });
                  });
                  return; // Exit early
                }

                return response.status(200).json({
                  success: false,
                  msg: [
                    `No target users found for audience: ${campaign.target_audience}. Total active users: ${totalUsers}, Total device tokens: ${totalTokens}`,
                    `लक्षित दर्शक के लिए कोई उपयोगकर्ता नहीं मिला: ${campaign.target_audience}. कुल सक्रिय उपयोगकर्ता: ${totalUsers}, कुल डिवाइस टोकन: ${totalTokens}`,
                    `लक्ष्य दर्शकांसाठी कोणतेही वापरकर्ते सापडले नाहीत: ${campaign.target_audience}. एकूण सक्रिय वापरकर्ते: ${totalUsers}, एकूण डिव्हाइस टोकन: ${totalTokens}`
                  ],
                  key: 'no_target_users',
                  debug_info: {
                    target_audience: campaign.target_audience,
                    total_active_users: totalUsers,
                    total_device_tokens: totalTokens,
                    query_executed: targetUsersQuery,
                    query_params: queryParams
                  }
                });
              }
            });
          });

          return; // Exit early to prevent further execution
        }

        // Prepare notification data - filter and deduplicate tokens
        const fcmTokens = usersResult
          .map(user => user.fcm_token)
          .filter(token => {
            // Remove null, undefined, empty strings, whitespace-only, and test tokens
            if (!token) return false;
            const trimmedToken = String(token).trim();
            return trimmedToken.length > 0 &&
              trimmedToken !== 'test_fcm_token' &&
              trimmedToken !== 'null' &&
              trimmedToken !== 'undefined';
          })
          .map(token => String(token).trim())
          .filter((token, index, self) => self.indexOf(token) === index); // Remove duplicates

        if (fcmTokens.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['No valid FCM tokens found', 'कोई वैध FCM टोकन नहीं मिला', 'कोणतेही वैध FCM टोकन सापडले नाहीत'],
            key: 'no_valid_tokens'
          });
        }

        const notificationData = {
          campaign_id: String(campaign_id),
          notification_type: campaign.notification_type || ''
        };

        // Send notification via Firebase Cloud Messaging
        const fcmResult = await FCMAPI.sendToUsers(
          fcmTokens,
          campaign.title,
          campaign.message,
          notificationData
        );

        if (!fcmResult.success) {
          return response.status(200).json({
            success: false,
            msg: ['Failed to send notification via FCM', 'FCM के माध्यम से अधिसूचना भेजने में विफल', 'FCM द्वारे सूचना पाठविण्यात अयशस्वी'],
            error: fcmResult.error
          });
        }

        const sendTime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        // Update campaign status
        const updateCampaignQuery = `
          UPDATE notification_campaigns 
          SET status = 'sent', sendtime = ?, total_recipients = ?, updatetime = ?
          WHERE campaign_id = ?
        `;

        connection.query(updateCampaignQuery, [sendTime, usersResult.length, sendTime, campaign_id], (updateError) => {
          if (updateError) {
            console.error('Error updating campaign:', updateError);
          }

          // Insert individual notification records
          const notificationInserts = usersResult
            .filter(user => user.fcm_token && user.fcm_token !== 'test_fcm_token')
            .map(user => [
              campaign_id,
              user.user_id,
              fcmResult.data.id || null,
              campaign.title,
              campaign.message,
              campaign.notification_type,
              'sent',
              sendTime
            ]);

          const insertNotificationQuery = `
            INSERT INTO user_notifications 
            (campaign_id, user_id, fcm_message_id, title, message, notification_type, status, sent_time) 
            VALUES ?
          `;

          connection.query(insertNotificationQuery, [notificationInserts], (insertError) => {
            if (insertError) {
              console.error('Error inserting notification records:', insertError);
            }

            // Update analytics
            updateNotificationAnalytics(campaign_id, usersResult.length, 0, 0, 0, 0);

            return response.status(200).json({
              success: true,
              msg: ['Notification sent successfully', 'अधिसूचना सफलतापूर्वक भेजी गई', 'सूचना यशस्वीरित्या पाठविली'],
              data: {
                campaign_id: campaign_id,
                total_recipients: fcmTokens.length,
                total_sent: fcmResult.data.successCount || 0,
                total_failed: fcmResult.data.failureCount || 0,
                fcm_message_id: fcmResult.data.id,
                send_time: sendTime
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
 * Get All Notification Campaigns Controller
 * Returns all notification campaigns with analytics
 */
const getAllNotificationCampaigns = async (request, response) => {
  try {
    const { page = 1, limit = 10, status, notification_type, target_language } = request.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (status) {
      whereClause += ' AND nc.status = ?';
      queryParams.push(status);
    }

    if (notification_type) {
      whereClause += ' AND nc.notification_type = ?';
      queryParams.push(notification_type);
    }

    if (target_language) {
      whereClause += ' AND nc.target_language = ?';
      queryParams.push(target_language);
    }

    const campaignsQuery = `
      SELECT 
        nc.*,
        u.name as created_by_name,
        COUNT(un.notification_id) as total_sent,
        SUM(CASE WHEN un.status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
        SUM(CASE WHEN un.status = 'opened' THEN 1 ELSE 0 END) as total_opened,
        SUM(CASE WHEN un.status = 'clicked' THEN 1 ELSE 0 END) as total_clicked
      FROM notification_campaigns nc
      LEFT JOIN user_master u ON nc.created_by = u.user_id
      LEFT JOIN user_notifications un ON nc.campaign_id = un.campaign_id
      ${whereClause}
      GROUP BY nc.campaign_id
      ORDER BY nc.createtime DESC
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);

    connection.query(campaignsQuery, queryParams, (error, result) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM notification_campaigns nc ${whereClause}`;
      connection.query(countQuery, queryParams.slice(0, -2), (countError, countResult) => {
        if (countError) {
          console.error('Error getting count:', countError);
        }

        const campaigns = result.map(campaign => {
          // Handle empty or invalid target_audience - map to valid value
          let targetAudience = campaign.target_audience;
          if (!targetAudience || targetAudience === '' || targetAudience === null) {
            // If empty, check if we can determine from campaign data or default to all_users
            targetAudience = 'all_users';
          }

          return {
            campaign_id: campaign.campaign_id,
            title: campaign.title,
            message: campaign.message,
            notification_type: campaign.notification_type,
            target_audience: targetAudience,
            status: campaign.status,
            created_by_name: campaign.created_by_name,
            total_recipients: campaign.total_recipients,
            total_sent: campaign.total_sent || 0,
            total_delivered: campaign.total_delivered || 0,
            total_opened: campaign.total_opened || 0,
            total_clicked: campaign.total_clicked || 0,
            delivery_rate: campaign.total_sent > 0 ? ((campaign.total_delivered || 0) / campaign.total_sent * 100).toFixed(2) : 0,
            open_rate: campaign.total_delivered > 0 ? ((campaign.total_opened || 0) / campaign.total_delivered * 100).toFixed(2) : 0,
            click_rate: campaign.total_opened > 0 ? ((campaign.total_clicked || 0) / campaign.total_opened * 100).toFixed(2) : 0,
            createtime: moment(campaign.createtime).format('DD/MM/YYYY HH:mm'),
            sendtime: campaign.sendtime ? moment(campaign.sendtime).format('DD/MM/YYYY HH:mm') : null
          };
        });

        return response.status(200).json({
          success: true,
          msg: ['Notification campaigns retrieved successfully', 'अधिसूचना अभियान सफलतापूर्वक प्राप्त', 'सूचना मोहिमा यशस्वीरित्या पुनर्प्राप्त'],
          data: {
            campaigns,
            pagination: {
              current_page: parseInt(page),
              total_pages: Math.ceil((countResult[0]?.total || 0) / limit),
              total_campaigns: countResult[0]?.total || 0,
              limit: parseInt(limit)
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
 * Update User Device Token Controller
 * Updates or adds user's FCM token
 */
const updateUserDeviceToken = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = updateUserDeviceTokenSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { fcm_token, device_type, device_id, app_version } = value;
    const userId = request.userId || request.user?.user_id;

    if (!userId) {
      return response.status(200).json({
        success: false,
        msg: ['User ID not found', 'उपयोगकर्ता ID नहीं मिला', 'वापरकर्ता ID सापडला नाही'],
        key: 'user_id_not_found'
      });
    }

    const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

    // Validate FCM token format (basic validation)
    if (!fcm_token || fcm_token.length < 10) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid FCM token', 'अमान्य FCM टोकन', 'अवैध FCM टोकन'],
        key: 'invalid_fcm_token'
      });
    }

    // Optional: Validate token with Firebase (can be commented out for performance)
    // const tokenValidation = await FCMAPI.validateToken(fcm_token);
    // if (!tokenValidation.valid) {
    //   return response.status(200).json({
    //     success: false,
    //     msg: ['Invalid or expired FCM token', 'अमान्य या समाप्त FCM टोकन', 'अवैध किंवा समाप्त FCM टोकन'],
    //     key: 'invalid_fcm_token'
    //   });
    // }

    // Check if a record already exists for this user_id
    const checkQuery = 'SELECT token_id FROM user_device_tokens WHERE user_id = ?';

    connection.query(checkQuery, [userId], (checkError, checkResult) => {
      if (checkError) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkError.message
        });
      }

      if (checkResult.length > 0) {
        // Update existing record for this user_id
        const updateQuery = `
          UPDATE user_device_tokens 
          SET fcm_token = ?, device_type = ?, device_id = ?, app_version = ?, is_active = 1, last_used = ?, updatetime = ?
          WHERE user_id = ?
        `;

        connection.query(updateQuery, [fcm_token, device_type, device_id, app_version, updatetime, updatetime, userId], (updateError) => {
          if (updateError) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: updateError.message
            });
          }

          return response.status(200).json({
            success: true,
            msg: ['Device token updated successfully', 'डिवाइस टोकन सफलतापूर्वक अपडेट किया गया', 'डिवाइस टोकन यशस्वीरित्या अपडेट केले'],
            data: { fcm_token, device_type }
          });
        });
      } else {
        // Insert new record for this user_id (first time)
        const insertQuery = `
          INSERT INTO user_device_tokens 
          (user_id, fcm_token, device_type, device_id, app_version, is_active, last_used, createtime, updatetime) 
          VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `;

        connection.query(insertQuery, [userId, fcm_token, device_type, device_id, app_version, updatetime, updatetime, updatetime], (insertError) => {
          if (insertError) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: insertError.message
            });
          }

          return response.status(200).json({
            success: true,
            msg: ['Device token added successfully', 'डिवाइस टोकन सफलतापूर्वक जोड़ा गया', 'डिवाइस टोकन यशस्वीरित्या जोडले'],
            data: { fcm_token, device_type }
          });
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
 * Update Notification Analytics Helper Function
 */
const updateNotificationAnalytics = (campaignId, totalSent, totalDelivered, totalOpened, totalClicked, totalFailed) => {
  const today = moment().format('YYYY-MM-DD');

  const analyticsQuery = `
    INSERT INTO notification_analytics 
    (campaign_id, date, total_sent, total_delivered, total_opened, total_clicked, total_failed, delivery_rate, open_rate, click_rate, createtime, updatetime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
    total_sent = total_sent + VALUES(total_sent),
    total_delivered = total_delivered + VALUES(total_delivered),
    total_opened = total_opened + VALUES(total_opened),
    total_clicked = total_clicked + VALUES(total_clicked),
    total_failed = total_failed + VALUES(total_failed),
    delivery_rate = CASE 
      WHEN (total_sent + VALUES(total_sent)) > 0 THEN 
        ((total_delivered + VALUES(total_delivered)) / (total_sent + VALUES(total_sent))) * 100
      ELSE 0 
    END,
    open_rate = CASE 
      WHEN (total_delivered + VALUES(total_delivered)) > 0 THEN 
        ((total_opened + VALUES(total_opened)) / (total_delivered + VALUES(total_delivered))) * 100
      ELSE 0 
    END,
    click_rate = CASE 
      WHEN (total_opened + VALUES(total_opened)) > 0 THEN 
        ((total_clicked + VALUES(total_clicked)) / (total_opened + VALUES(total_opened))) * 100
      ELSE 0 
    END,
    updatetime = NOW()
  `;

  const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;
  const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
  const clickRate = totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0;

  connection.query(analyticsQuery, [campaignId, today, totalSent, totalDelivered, totalOpened, totalClicked, totalFailed, deliveryRate, openRate, clickRate], (error) => {
    if (error) {
      console.error('Error updating notification analytics:', error);
    }
  });
};


/**
 * Get Notification Performance Stats Controller
 * Returns detailed performance statistics for notifications
 */
const getNotificationPerformanceStats = async (request, response) => {
  try {
    const { campaign_id, days = 30 } = request.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (campaign_id) {
      whereClause += ' AND na.campaign_id = ?';
      queryParams.push(campaign_id);
    } else {
      whereClause += ' AND na.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)';
      queryParams.push(parseInt(days));
    }

    const statsQuery = `
      SELECT 
        na.date,
        na.campaign_id,
        nc.title as campaign_title,
        na.total_sent,
        na.total_delivered,
        na.total_opened,
        na.total_clicked,
        na.total_failed,
        na.delivery_rate,
        na.open_rate,
        na.click_rate
      FROM notification_analytics na
      LEFT JOIN notification_campaigns nc ON na.campaign_id = nc.campaign_id
      ${whereClause}
      ORDER BY na.date DESC
    `;

    connection.query(statsQuery, queryParams, (error, result) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      // Calculate overall stats
      const overallStats = result.reduce((acc, stat) => {
        acc.total_sent += stat.total_sent;
        acc.total_delivered += stat.total_delivered;
        acc.total_opened += stat.total_opened;
        acc.total_clicked += stat.total_clicked;
        acc.total_failed += stat.total_failed;
        return acc;
      }, { total_sent: 0, total_delivered: 0, total_opened: 0, total_clicked: 0, total_failed: 0 });

      overallStats.overall_delivery_rate = overallStats.total_sent > 0 ?
        ((overallStats.total_delivered / overallStats.total_sent) * 100).toFixed(2) : 0;
      overallStats.overall_open_rate = overallStats.total_delivered > 0 ?
        ((overallStats.total_opened / overallStats.total_delivered) * 100).toFixed(2) : 0;
      overallStats.overall_click_rate = overallStats.total_opened > 0 ?
        ((overallStats.total_clicked / overallStats.total_opened) * 100).toFixed(2) : 0;

      const formattedStats = result.map(stat => ({
        date: moment(stat.date).format('DD/MM/YYYY'),
        campaign_id: stat.campaign_id,
        campaign_title: stat.campaign_title,
        total_sent: stat.total_sent,
        total_delivered: stat.total_delivered,
        total_opened: stat.total_opened,
        total_clicked: stat.total_clicked,
        total_failed: stat.total_failed,
        delivery_rate: parseFloat(stat.delivery_rate).toFixed(2),
        open_rate: parseFloat(stat.open_rate).toFixed(2),
        click_rate: parseFloat(stat.click_rate).toFixed(2)
      }));

      return response.status(200).json({
        success: true,
        msg: ['Notification performance stats retrieved successfully', 'अधिसूचना प्रदर्शन आंकड़े सफलतापूर्वक प्राप्त', 'सूचना कामगिरी आकडेवारी यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          overall_stats: overallStats,
          daily_stats: formattedStats
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
 * Get User Notification Details
 * Get all notifications for a specific user or campaign
 */
const getUserNotificationDetails = async (request, response) => {
  try {
    const { user_id, campaign_id } = request.query;

    if (!user_id && !campaign_id) {
      return response.status(200).json({
        success: false,
        msg: ['user_id or campaign_id is required', 'user_id या campaign_id आवश्यक है', 'user_id किंवा campaign_id आवश्यक आहे'],
        key: 'missing_params'
      });
    }

    let whereClause = 'WHERE 1=1';
    let queryParams = [];

    if (user_id) {
      whereClause += ' AND un.user_id = ?';
      queryParams.push(user_id);
    }

    if (campaign_id) {
      whereClause += ' AND un.campaign_id = ?';
      queryParams.push(campaign_id);
    }

    const query = `
      SELECT 
        un.notification_id,
        un.campaign_id,
        un.user_id,
        u.name as user_name,
        u.mobile as user_mobile,
        un.fcm_message_id,
        un.title,
        un.message,
        un.notification_type,
        un.status,
        un.sent_time,
        nc.title as campaign_title,
        nc.target_audience
      FROM user_notifications un
      LEFT JOIN user_master u ON un.user_id = u.user_id
      LEFT JOIN notification_campaigns nc ON un.campaign_id = nc.campaign_id
      ${whereClause}
      ORDER BY un.sent_time DESC
      LIMIT 100
    `;

    connection.query(query, queryParams, (error, results) => {
      if (error) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: error.message
        });
      }

      // Group by status
      const statusCounts = {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        failed: 0
      };

      results.forEach(notif => {
        if (notif.status && statusCounts.hasOwnProperty(notif.status)) {
          statusCounts[notif.status]++;
        }
      });

      return response.status(200).json({
        success: true,
        msg: ['Notification details retrieved successfully', 'अधिसूचना विवरण सफलतापूर्वक प्राप्त', 'सूचना तपशील यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          notifications: results,
          total: results.length,
          status_counts: statusCounts,
          summary: {
            total_sent: statusCounts.sent,
            total_delivered: statusCounts.delivered,
            total_opened: statusCounts.opened,
            total_clicked: statusCounts.clicked,
            total_failed: statusCounts.failed,
            delivery_rate: statusCounts.sent > 0 ? ((statusCounts.delivered / statusCounts.sent) * 100).toFixed(2) : 0,
            open_rate: statusCounts.delivered > 0 ? ((statusCounts.opened / statusCounts.delivered) * 100).toFixed(2) : 0
          }
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
 * Update Notification Status
 * Updates notification status (delivered, opened, clicked, failed)
 */
const updateNotificationStatus = async (request, response) => {
  try {
    const { error, value } = updateNotificationStatusSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { notification_id, status } = value;
    const userId = request.userId || request.adminInfo?.admin_id; // Support both user and admin

    // Check if notification exists
    const checkQuery = `
      SELECT un.*, nc.campaign_id 
      FROM user_notifications un
      LEFT JOIN notification_campaigns nc ON un.campaign_id = nc.campaign_id
      WHERE un.notification_id = ?
    `;

    connection.query(checkQuery, [notification_id], (checkError, checkResult) => {
      if (checkError) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkError.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Notification not found', 'अधिसूचना नहीं मिली', 'सूचना सापडली नाही'],
          key: 'notification_not_found'
        });
      }

      const notification = checkResult[0];

      // Validate status transition (can only move forward: sent -> delivered -> opened -> clicked)
      const validTransitions = {
        'sent': ['delivered', 'failed'],
        'delivered': ['opened', 'clicked', 'failed'],
        'opened': ['clicked'],
        'clicked': [],
        'failed': []
      };

      const currentStatus = notification.status || 'sent';
      if (!validTransitions[currentStatus]?.includes(status)) {
        return response.status(200).json({
          success: false,
          msg: [`Invalid status transition from ${currentStatus} to ${status}`, `अमान्य स्थिति संक्रमण ${currentStatus} से ${status} तक`, `अवैध स्थिती संक्रमण ${currentStatus} पासून ${status} पर्यंत`],
          key: 'invalid_status_transition'
        });
      }

      // Update notification status
      const updateQuery = `
        UPDATE user_notifications 
        SET status = ?, updatetime = NOW()
        WHERE notification_id = ?
      `;

      connection.query(updateQuery, [status, notification_id], (updateError, updateResult) => {
        if (updateError) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateError.message
          });
        }

        // Update analytics based on status
        const campaignId = notification.campaign_id;
        let analyticsUpdate = {
          total_delivered: status === 'delivered' ? 1 : 0,
          total_opened: status === 'opened' ? 1 : 0,
          total_clicked: status === 'clicked' ? 1 : 0,
          total_failed: status === 'failed' ? 1 : 0
        };

        // Update notification analytics
        if (campaignId) {
          updateNotificationAnalytics(
            campaignId,
            0, // totalSent (no change)
            analyticsUpdate.total_delivered,
            analyticsUpdate.total_opened,
            analyticsUpdate.total_clicked,
            analyticsUpdate.total_failed
          );
        }

        return response.status(200).json({
          success: true,
          msg: ['Notification status updated successfully', 'अधिसूचना स्थिति सफलतापूर्वक अपडेट की गई', 'सूचना स्थिती यशस्वीरित्या अपडेट केली'],
          data: {
            notification_id: notification_id,
            old_status: currentStatus,
            new_status: status,
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
 * Get Notification System Statistics
 * Provides diagnostic information about users and device tokens
 */
const getNotificationSystemStats = async (request, response) => {
  try {
    // Get total active users
    const totalUsersQuery = `
      SELECT COUNT(*) as total_users FROM user_master WHERE delete_flag = 0 AND active_flag = 1
    `;

    // Get total device tokens
    const totalTokensQuery = `
      SELECT COUNT(*) as total_tokens FROM user_device_tokens WHERE is_active = 1
    `;

    // Get users with device tokens
    const usersWithTokensQuery = `
      SELECT COUNT(DISTINCT u.user_id) as users_with_tokens
      FROM user_master u
      JOIN user_device_tokens udt ON u.user_id = udt.user_id
      WHERE u.delete_flag = 0 AND u.active_flag = 1 AND udt.is_active = 1
    `;

    // Get subscription statistics - only free_users and paid_users
    // Use current active subscription (most recent by user_subscription_id - highest ID = most recent)
    const subscriptionStatsQuery = `
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN current_sub.user_id IS NULL OR current_sub.subscription_type = 0 OR current_sub.subscription_type IS NULL 
          THEN u.user_id 
        END) as free_users,
        COUNT(DISTINCT CASE 
          WHEN current_sub.subscription_type != 0 AND current_sub.subscription_type IS NOT NULL 
          THEN u.user_id 
        END) as paid_users
      FROM user_master u
      LEFT JOIN (
        SELECT usm1.user_id, usm1.subscription_type
        FROM user_subscription_master usm1
        WHERE usm1.delete_flag = 0 
        AND usm1.end_date >= CURDATE()
        AND usm1.user_subscription_id = (
          SELECT MAX(usm2.user_subscription_id)
          FROM user_subscription_master usm2
          WHERE usm2.user_id = usm1.user_id
          AND usm2.delete_flag = 0
          AND usm2.end_date >= CURDATE()
        )
      ) current_sub ON u.user_id = current_sub.user_id
      WHERE u.delete_flag = 0 AND u.active_flag = 1
    `;

    connection.query(totalUsersQuery, [], (error1, result1) => {
      if (error1) {
        console.error('Error getting total users:', error1);
        return response.status(200).json({
          success: false,
          msg: ['Error getting system statistics', 'सिस्टम सांख्यिकी प्राप्त करने में त्रुटि', 'सिस्टम आकडेवारी मिळवण्यात त्रुटी'],
          error: error1.message
        });
      }

      connection.query(totalTokensQuery, [], (error2, result2) => {
        if (error2) {
          console.error('Error getting total tokens:', error2);
          return response.status(200).json({
            success: false,
            msg: ['Error getting system statistics', 'सिस्टम सांख्यिकी प्राप्त करने में त्रुटि', 'सिस्टम आकडेवारी मिळवण्यात त्रुटी'],
            error: error2.message
          });
        }

        connection.query(usersWithTokensQuery, [], (error3, result3) => {
          if (error3) {
            console.error('Error getting users with tokens:', error3);
            return response.status(200).json({
              success: false,
              msg: ['Error getting system statistics', 'सिस्टम सांख्यिकी प्राप्त करने में त्रुटि', 'सिस्टम आकडेवारी मिळवण्यात त्रुटी'],
              error: error3.message
            });
          }

          connection.query(subscriptionStatsQuery, [], (error4, result4) => {
            if (error4) {
              console.error('Error getting subscription stats:', error4);
              return response.status(200).json({
                success: false,
                msg: ['Error getting system statistics', 'सिस्टम सांख्यिकी प्राप्त करने में त्रुटि', 'सिस्टम आकडेवारी मिळवण्यात त्रुटी'],
                error: error4.message
              });
            }

            const stats = {
              total_active_users: result1[0]?.total_users || 0,
              total_device_tokens: result2[0]?.total_tokens || 0,
              users_with_tokens: result3[0]?.users_with_tokens || 0,
              free_users: result4[0]?.free_users || 0,
              paid_users: result4[0]?.paid_users || 0
            };

            return response.status(200).json({
              success: true,
              msg: ['Notification system statistics retrieved successfully', 'अधिसूचना सिस्टम सांख्यिकी सफलतापूर्वक प्राप्त', 'सूचना सिस्टम आकडेवारी यशस्वीरित्या मिळाली'],
              data: stats
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
 * Update Notification Campaign Controller
 * Updates a draft notification campaign (cannot update sent campaigns)
 */
const updateNotificationCampaign = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = updateNotificationCampaignSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { campaign_id, title, message, notification_type, target_audience, target_language } = value;
    const adminId = request.adminInfo.admin_id;

    // Check if campaign exists and is in draft status
    const checkQuery = `
      SELECT campaign_id, status, created_by, title, message, notification_type, target_audience, target_language
      FROM notification_campaigns 
      WHERE campaign_id = ?
    `;

    connection.query(checkQuery, [campaign_id], (checkError, checkResult) => {
      if (checkError) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkError.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Campaign not found', 'अभियान नहीं मिला', 'मोहीम सापडली नाही'],
          key: 'campaign_not_found'
        });
      }

      const campaign = checkResult[0];

      // Only allow updating draft campaigns
      if (campaign.status !== 'draft') {
        return response.status(200).json({
          success: false,
          msg: ['Cannot update sent campaign. Only draft campaigns can be updated.', 'भेजे गए अभियान को अपडेट नहीं किया जा सकता। केवल ड्राफ्ट अभियान अपडेट किए जा सकते हैं।', 'पाठविलेल्या मोहिमेचे अपडेट करता येत नाही. केवळ ड्राफ्ट मोहिमा अपडेट केल्या जाऊ शकतात.'],
          key: 'campaign_already_sent'
        });
      }

      // Use provided values or keep existing ones
      const finalTitle = (title !== undefined && title !== null && title !== '') ? title : campaign.title;
      const finalMessage = (message !== undefined && message !== null && message !== '') ? message : campaign.message;
      const finalNotificationType = (notification_type !== undefined && notification_type !== null && notification_type !== '') ? notification_type : campaign.notification_type;
      const finalTargetAudience = (target_audience !== undefined && target_audience !== null && target_audience !== '') ? target_audience : campaign.target_audience;
      const finalTargetLanguage = (target_language !== undefined) ? target_language : campaign.target_language;

      const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

      // Update campaign
      const updateQuery = `
        UPDATE notification_campaigns 
        SET title = ?, message = ?, notification_type = ?, target_audience = ?, target_language = ?, updatetime = ?
        WHERE campaign_id = ? AND status = 'draft'
      `;

      connection.query(updateQuery, [finalTitle, finalMessage, finalNotificationType, finalTargetAudience, finalTargetLanguage || null, updatetime, campaign_id], (updateError, updateResult) => {
        if (updateError) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateError.message
          });
        }

        if (updateResult.affectedRows === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Campaign not found or cannot be updated', 'अभियान नहीं मिला या अपडेट नहीं किया जा सकता', 'मोहीम सापडली नाही किंवा अपडेट करता येत नाही'],
            key: 'update_failed'
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Notification campaign updated successfully', 'अधिसूचना अभियान सफलतापूर्वक अपडेट किया गया', 'सूचना मोहीम यशस्वीरित्या अपडेट केली'],
          data: {
            campaign_id,
            title: finalTitle,
            message: finalMessage,
            notification_type: finalNotificationType,
            target_audience: finalTargetAudience,
            target_language: finalTargetLanguage || null,
            status: 'draft'
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
 * Delete Notification Campaign Controller
 * Deletes a draft notification campaign (cannot delete sent campaigns)
 */
const deleteNotificationCampaign = async (request, response) => {
  try {
    // Validate request body using Joi schema
    const { error, value } = deleteNotificationCampaignSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { campaign_id } = value;
    const adminId = request.adminInfo.admin_id;

    // Check if campaign exists and get its status
    const checkQuery = `
      SELECT campaign_id, status, created_by 
      FROM notification_campaigns 
      WHERE campaign_id = ?
    `;

    connection.query(checkQuery, [campaign_id], (checkError, checkResult) => {
      if (checkError) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkError.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Campaign not found', 'अभियान नहीं मिला', 'मोहीम सापडली नाही'],
          key: 'campaign_not_found'
        });
      }

      const campaign = checkResult[0];

      // Only allow deleting draft campaigns
      if (campaign.status !== 'draft') {
        return response.status(200).json({
          success: false,
          msg: ['Cannot delete sent campaign. Only draft campaigns can be deleted.', 'भेजे गए अभियान को हटाया नहीं जा सकता। केवल ड्राफ्ट अभियान हटाए जा सकते हैं।', 'पाठविलेल्या मोहिमेचे हटवता येत नाही. केवळ ड्राफ्ट मोहिमा हटवल्या जाऊ शकतात.'],
          key: 'campaign_already_sent'
        });
      }

      // Delete campaign (permanent delete for draft campaigns)
      const deleteQuery = `
        DELETE FROM notification_campaigns 
        WHERE campaign_id = ? AND status = 'draft'
      `;

      connection.query(deleteQuery, [campaign_id], (deleteError, deleteResult) => {
        if (deleteError) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteError.message
          });
        }

        if (deleteResult.affectedRows === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Campaign not found or cannot be deleted', 'अभियान नहीं मिला या हटाया नहीं जा सकता', 'मोहीम सापडली नाही किंवा हटवता येत नाही'],
            key: 'delete_failed'
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Notification campaign deleted successfully', 'अधिसूचना अभियान सफलतापूर्वक हटाया गया', 'सूचना मोहीम यशस्वीरित्या हटवली'],
          data: {
            campaign_id
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
 * Simple Test Send Notification API
 * For testing Firebase notifications directly
 */
const sendTestNotification = async (req, res) => {
  try {
    const { token, title, body } = req.body;

    if (!token || !title || !body) {
      return res.status(400).json({
        success: false,
        message: "token, title, and body are required!",
      });
    }

    if (!firebaseInitialized) {
      return res.status(500).json({
        success: false,
        message: "Firebase Admin SDK not initialized",
      });
    }

    const message = {
      token,
      notification: {
        title,
        body,
      },
    };

    const response = await admin.messaging().send(message);
    console.log("Successfully sent:", response);

    res.status(200).json({
      success: true,
      message: "Notification sent successfully!",
      response,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notification",
      error: error.message,
    });
  }
};

export {
  createNotificationCampaign,
  sendNotificationCampaign,
  getAllNotificationCampaigns,
  updateNotificationCampaign,
  deleteNotificationCampaign,
  getNotificationSystemStats,
  updateUserDeviceToken,
  getNotificationPerformanceStats,
  getUserNotificationDetails,
  updateNotificationStatus,
  sendTestNotification,
  FCMAPI
};
