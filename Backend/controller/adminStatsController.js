import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';

/**
 * Get Comprehensive Admin Statistics Controller
 * Returns detailed user statistics, subscription information, and analytics for admin dashboard
 */
const getComprehensiveAdminStats = async (request, response) => {
  try {
    const currentDate = new Date();
    const today = moment(currentDate).format('YYYY-MM-DD');
    const sevenDaysFromNow = moment(currentDate).add(7, 'days').format('YYYY-MM-DD');
    const thirtyDaysFromNow = moment(currentDate).add(30, 'days').format('YYYY-MM-DD');

    // Get total active users
    const totalUsersQuery = "SELECT COUNT(*) as total FROM user_master WHERE delete_flag = 0 AND active_flag = 1";

    connection.query(totalUsersQuery, (totalUsersErr, totalUsersResult) => {
      if (totalUsersErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: totalUsersErr.message
        });
      }

      const totalActiveUsers = totalUsersResult[0].total;

      // Get users with active subscriptions
      const activeSubscriptionsQuery = `
        SELECT 
          COUNT(DISTINCT usm.user_id) as total_users_with_plans,
          SUM(usm.amount) as total_revenue,
          COUNT(usm.user_subscription_id) as total_subscriptions
        FROM user_subscription_master usm
        WHERE usm.delete_flag = 0 
        AND usm.end_date > NOW()
      `;

      connection.query(activeSubscriptionsQuery, (activeSubErr, activeSubResult) => {
        if (activeSubErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: activeSubErr.message
          });
        }

        const activeSubData = activeSubResult[0];

        // Get users with plans expiring in 7 days
        const expiringIn7DaysQuery = `
          SELECT 
            COUNT(DISTINCT usm.user_id) as users_expiring_7_days,
            GROUP_CONCAT(DISTINCT usm.user_id) as expiring_user_ids
          FROM user_subscription_master usm
          WHERE usm.delete_flag = 0 
          AND usm.end_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
        `;

        connection.query(expiringIn7DaysQuery, (expiringErr, expiringResult) => {
          if (expiringErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: expiringErr.message
            });
          }

          const expiringData = expiringResult[0];

          // Get detailed user subscription information
          const detailedUsersQuery = `
            SELECT 
              um.user_id,
              um.name as user_name,
              um.mobile as user_mobile,
              um.email as user_email,
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
              END as days_remaining,
              
              -- Calculate next billing date (for active subscriptions)
              CASE 
                WHEN current_sub.end_date IS NULL THEN NULL
                WHEN current_sub.end_date > NOW() THEN current_sub.end_date
                ELSE NULL
              END as next_billing_date,
              
              -- Count total actions (transactions) for this user
              COALESCE(action_counts.total_actions, 0) as total_actions
              
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
            
            -- Get action counts for each user
            LEFT JOIN (
              SELECT 
                user_id,
                COUNT(*) as total_actions
              FROM expense_income_master 
              WHERE delete_flag = 0
              GROUP BY user_id
            ) action_counts ON um.user_id = action_counts.user_id
            
            WHERE um.delete_flag = 0
            AND current_sub.user_subscription_id IS NOT NULL
            ORDER BY um.user_id DESC
          `;

          connection.query(detailedUsersQuery, (detailedErr, detailedResult) => {
            if (detailedErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: detailedErr.message
              });
            }

            // Process detailed user data
            const processedUsers = detailedResult.map(user => ({
              user_id: user.user_id,
              user_name: user.user_name,
              user_mobile: user.user_mobile,
              user_email: user.user_email,
              user_phone_code: user.user_phone_code,
              user_active_status: user.user_active_status,
              user_created_at: moment(user.user_created_at).format('DD/MM/YYYY HH:mm'),

              // Current subscription details
              current_active_plan: user.current_subscription_id ? {
                subscription_id: user.current_subscription_id,
                plan_name: user.current_plan_name,
                plan_value: user.current_plan_amount,
                user_amount: user.current_amount,
                subscription_type: user.current_subscription_type,
                subscription_type_label:
                  user.current_subscription_type == 0 ? "Free or Referral" :
                    user.current_subscription_type == 1 ? "Yearly" :
                      user.current_subscription_type == 2 ? "Monthly" :
                        user.current_subscription_type == 3 ? "Lifetime" :
                          user.current_subscription_type == 4 ? "Other" :
                            "Unknown",
                start_date: moment(user.current_start_date).format('DD/MM/YYYY'),
                end_date: moment(user.current_end_date).format('DD/MM/YYYY'),
                next_billing_date: user.next_billing_date ? moment(user.next_billing_date).format('DD/MM/YYYY') : null,
                days_left: user.days_remaining,
                is_active: user.subscription_status === 'active',
                status: user.subscription_status,
                status_label: user.subscription_status === 'active' ? 'Active' :
                  user.subscription_status === 'expired' ? 'Expired' : 'No Subscription'
              } : null,

              // User activity
              total_actions: user.total_actions,

              // Additional user info
              has_active_subscription: user.subscription_status === 'active',
              subscription_expires_soon: user.days_remaining > 0 && user.days_remaining <= 7
            }));

            // Calculate summary statistics
            const summary = {
              total_active_users: totalActiveUsers,
              total_users_with_plans: processedUsers.length, // Only users with plans are returned
              total_subscriptions: activeSubData.total_subscriptions || 0,
              total_revenue: activeSubData.total_revenue || 0,
              users_expiring_in_7_days: expiringData.users_expiring_7_days || 0,
              total_actions: processedUsers.reduce((sum, user) => sum + user.total_actions, 0),

              // Breakdown by subscription status (all users in response have plans)
              users_with_active_subscriptions: processedUsers.filter(u => u.has_active_subscription).length,
              users_without_subscriptions: 0, // No users without plans in response
              users_with_expired_subscriptions: processedUsers.filter(u => u.current_active_plan && !u.has_active_subscription).length,

              // Breakdown by subscription type
              yearly_subscriptions: processedUsers.filter(u => u.current_active_plan?.subscription_type == 1).length,
              monthly_subscriptions: processedUsers.filter(u => u.current_active_plan?.subscription_type == 2).length,
              lifetime_subscriptions: processedUsers.filter(u => u.current_active_plan?.subscription_type == 3).length,

              // Revenue breakdown
              total_yearly_revenue: processedUsers
                .filter(u => u.current_active_plan?.subscription_type == 1)
                .reduce((sum, u) => sum + (u.current_active_plan?.user_amount || 0), 0),
              total_monthly_revenue: processedUsers
                .filter(u => u.current_active_plan?.subscription_type == 2)
                .reduce((sum, u) => sum + (u.current_active_plan?.user_amount || 0), 0),
              total_lifetime_revenue: processedUsers
                .filter(u => u.current_active_plan?.subscription_type == 3)
                .reduce((sum, u) => sum + (u.current_active_plan?.user_amount || 0), 0)
            };

            // Get users expiring in 7 days details
            const expiringUsersDetails = processedUsers.filter(user => user.subscription_expires_soon);

            return response.status(200).json({
              success: true,
              msg: [
                "Comprehensive admin statistics retrieved successfully",
                "व्यापक एडमिन आंकड़े सफलतापूर्वक प्राप्त",
                "व्यापक प्रशासक आकडेवारी यशस्वीरित्या पुनर्प्राप्त"
              ],
              data: {
                summary: summary,
                users: processedUsers,
                expiring_users_details: expiringUsersDetails,
                last_updated: moment().format('DD/MM/YYYY HH:mm:ss'),
                generated_at: moment().toISOString()
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
 * Get User Statistics by Subscription Plan Controller
 * Returns detailed statistics grouped by subscription plans
 */
const getUserStatsByPlan = async (request, response) => {
  try {
    const planStatsQuery = `
      SELECT 
        sm.subscription_id,
        sm.description as plan_name,
        sm.amount as plan_amount,
        sm.subscription_type,
        sm.validity_days,
        COUNT(usm.user_subscription_id) as total_subscriptions,
        COUNT(DISTINCT usm.user_id) as unique_users,
        SUM(usm.amount) as total_revenue,
        COUNT(CASE WHEN usm.end_date > NOW() THEN 1 END) as active_subscriptions,
        COUNT(CASE WHEN usm.end_date <= NOW() THEN 1 END) as expired_subscriptions,
        AVG(usm.amount) as average_amount,
        MIN(usm.createtime) as first_subscription_date,
        MAX(usm.createtime) as last_subscription_date
      FROM subscription_master sm
      LEFT JOIN user_subscription_master usm ON sm.subscription_id = usm.subscription_id AND usm.delete_flag = 0
      WHERE sm.delete_flag = 0
      GROUP BY sm.subscription_id, sm.description, sm.amount, sm.subscription_type, sm.validity_days
      ORDER BY sm.subscription_id
    `;

    connection.query(planStatsQuery, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const planStatistics = result.map(plan => ({
        subscription_id: plan.subscription_id,
        plan_name: plan.plan_name,
        plan_amount: plan.plan_amount,
        subscription_type: plan.subscription_type,
        subscription_type_label:
          plan.subscription_type == 0 ? "Free or Referral" :
            plan.subscription_type == 1 ? "Yearly" :
              plan.subscription_type == 2 ? "Monthly" :
                plan.subscription_type == 3 ? "Lifetime" :
                  plan.subscription_type == 4 ? "Other" :
                    "Unknown",
        validity_days: plan.validity_days,
        total_subscriptions: plan.total_subscriptions,
        unique_users: plan.unique_users,
        total_revenue: plan.total_revenue || 0,
        active_subscriptions: plan.active_subscriptions,
        expired_subscriptions: plan.expired_subscriptions,
        average_amount: plan.average_amount || 0,
        first_subscription_date: plan.first_subscription_date ? moment(plan.first_subscription_date).format('DD/MM/YYYY') : null,
        last_subscription_date: plan.last_subscription_date ? moment(plan.last_subscription_date).format('DD/MM/YYYY') : null
      }));

      return response.status(200).json({
        success: true,
        msg: [
          "Plan statistics retrieved successfully",
          "प्लान आंकड़े सफलतापूर्वक प्राप्त",
          "प्लॅन आकडेवारी यशस्वीरित्या पुनर्प्राप्त"
        ],
        data: {
          plan_statistics: planStatistics,
          total_plans: planStatistics.length,
          last_updated: moment().format('DD/MM/YYYY HH:mm:ss')
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

export { getComprehensiveAdminStats, getUserStatsByPlan };
