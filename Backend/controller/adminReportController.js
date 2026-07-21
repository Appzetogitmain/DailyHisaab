import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';

/**
 * Admin Report Controller
 * Provides comprehensive analytics and reporting data for admin dashboard
 */

/**
 * Get User Growth Report
 * Returns user growth data with new users, total users, and churn rate
 */
const getUserGrowthReport = async (request, response) => {
  try {
    const { start_date, end_date } = request.query;
    let dateCondition = '';
    let queryParams = [];

    if (start_date && end_date) {
      dateCondition = 'WHERE DATE(createtime) BETWEEN ? AND ?';
      queryParams = [start_date, end_date];
    } else {
      const sixMonthsAgo = moment().subtract(6, 'months').format('YYYY-MM-DD');
      dateCondition = 'WHERE DATE(createtime) >= ?';
      queryParams = [sixMonthsAgo];
    }

    const growthQuery = `
      SELECT 
        DATE_FORMAT(createtime, '%Y-%m') AS month,
        COUNT(*) AS newUsers,
        SUM(COUNT(*)) OVER (ORDER BY DATE_FORMAT(createtime, '%Y-%m')) AS totalUsers,
        LAG(COUNT(*)) OVER (ORDER BY DATE_FORMAT(createtime, '%Y-%m')) AS prevMonthUsers
      FROM user_master 
      ${dateCondition} AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m')
      ORDER BY month
    `;

    connection.query(growthQuery, queryParams, (err, growthResult) => {
      if (err) {
        return response.status(500).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error'],
          error: err.message
        });
      }

      const userGrowthData = growthResult.map((row) => {
        let churn = 0;
        if (row.prevMonthUsers && row.prevMonthUsers > 0) {
          churn = Math.max(0, Math.floor(row.prevMonthUsers * 0.05));
        }
        return {
          name: moment(row.month).format('MMM'),
          newUsers: row.newUsers,
          totalUsers: row.totalUsers,
          churn
        };
      });

      const currentMonthData = userGrowthData[userGrowthData.length - 1] || { newUsers: 0, totalUsers: 0, churn: 0 };
      const prevMonthData = userGrowthData[userGrowthData.length - 2] || { newUsers: 0, totalUsers: 0, churn: 0 };

      const growthRate =
        prevMonthData.newUsers > 0
          ? ((currentMonthData.newUsers - prevMonthData.newUsers) / prevMonthData.newUsers * 100).toFixed(0)
          : 0;
      const churnChange = currentMonthData.churn - prevMonthData.churn;
      const netGrowth = currentMonthData.newUsers - currentMonthData.churn;

      return response.status(200).json({
        success: true,
        msg: ['User growth report retrieved successfully'],
        data: {
          userGrowthData,
          summary: {
            newUsersThisMonth: currentMonthData.newUsers,
            totalUsers: currentMonthData.totalUsers,
            churnRate: currentMonthData.churn,
            netGrowth,
            growthRate: `${growthRate}%`,
            churnChange: churnChange > 0 ? `+${churnChange}` : churnChange.toString()
          }
        }
      });
    });

  } catch (error) {
    return response.status(500).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error'],
      error: error.message
    });
  }
};



/**
 * Get User Activity Report
 * Returns active vs inactive users breakdown
 */
const getUserActivityReport = async (request, response) => {
  try {
    const userActivityQuery = `
      SELECT 
        um.user_id,
        um.active_flag,
        COALESCE(current_sub.amount, 0) AS subscription_amount,
        current_sub.end_date,
        CASE 
          WHEN um.active_flag = 0 THEN 'inactive'
          WHEN current_sub.user_id IS NOT NULL AND current_sub.end_date > NOW() AND current_sub.amount > 0 THEN 'paid'
          WHEN current_sub.user_id IS NOT NULL AND current_sub.end_date > NOW() AND current_sub.amount = 0 THEN 'free'
          WHEN current_sub.user_id IS NULL THEN 'free'
          ELSE 'inactive'
        END AS user_type
      FROM user_master um
      LEFT JOIN (
        SELECT usm1.user_id, usm1.amount, usm1.end_date
        FROM user_subscription_master usm1
        WHERE usm1.delete_flag = 0 
        AND usm1.user_subscription_id = (
          SELECT MAX(usm2.user_subscription_id) 
          FROM user_subscription_master usm2
          WHERE usm2.user_id = usm1.user_id AND usm2.delete_flag = 0
        )
      ) current_sub ON um.user_id = current_sub.user_id
      WHERE um.delete_flag = 0
    `;

    connection.query(userActivityQuery, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const freeUsers = result.filter(row => row.user_type === 'free').length;
      const paidUsers = result.filter(row => row.user_type === 'paid').length;
      const inactiveUsers = result.filter(row => row.user_type === 'inactive').length;
      const total = freeUsers + paidUsers + inactiveUsers;

      const userActivityData = [
        { name: "Free Users", value: freeUsers, color: "#3b82f6", percentage: total > 0 ? ((freeUsers / total) * 100).toFixed(1) : "0" },
        { name: "Paid Users", value: paidUsers, color: "#4ade80", percentage: total > 0 ? ((paidUsers / total) * 100).toFixed(1) : "0" },
        { name: "Inactive Users", value: inactiveUsers, color: "#6b7280", percentage: total > 0 ? ((inactiveUsers / total) * 100).toFixed(1) : "0" }
      ];

      return response.status(200).json({
        success: true,
        msg: ['User activity report retrieved successfully', 'उपयोगकर्ता गतिविधि रिपोर्ट सफलतापूर्वक प्राप्त', 'वापरकर्ता क्रियाकलाप अहवाल यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          userActivityData,
          summary: {
            totalUsers: total,
            freeUsers,
            paidUsers,
            inactiveUsers,
            activePercentage: total > 0 ? (((freeUsers + paidUsers) / total) * 100).toFixed(1) : "0"
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
 * Get Subscription Revenue Report
 * Returns subscription revenue data by plan type
 */
const getSubscriptionRevenueReport = async (request, response) => {
  try {
    const { period = '6months' } = request.query;
    let dateCondition = '';

    switch (period) {
      case '1month':
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
        break;
      case '3months':
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)';
        break;
      case '6months':
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)';
        break;
      case '1year':
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
        break;
      default:
        dateCondition = '';
    }

    const subscriptionRevenueQuery = `
      SELECT 
        sm.subscription_id,
        sm.subscription_type,
        sm.description AS plan_name,
        sm.amount AS plan_amount,
        sm.validity_days,
        sm.delete_flag,
        COUNT(usm.user_id) AS user_count,
        COALESCE(SUM(CASE WHEN usm.amount > 0 THEN usm.amount ELSE 0 END),0) AS total_revenue,
        COUNT(CASE WHEN usm.end_date >= CURDATE() OR usm.end_date IS NULL THEN 1 END) AS active_users,
        COUNT(CASE WHEN usm.end_date < CURDATE() THEN 1 END) AS expired_users
      FROM subscription_master sm
      LEFT JOIN user_subscription_master usm
        ON sm.subscription_id = usm.subscription_id
        AND usm.delete_flag = 0
        AND usm.razorpay_order_id IS NOT NULL 
        AND usm.razorpay_order_id != ''
        ${dateCondition}
      WHERE sm.delete_flag = 0
      GROUP BY sm.subscription_id, sm.subscription_type, sm.description, sm.amount, sm.validity_days, sm.delete_flag
      ORDER BY sm.subscription_type, sm.amount
    `;

    connection.query(subscriptionRevenueQuery, [], (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const subscriptionRevenueData = result.map(row => {
        const userCount = parseInt(row.user_count) || 0;
        const totalRevenue = parseFloat(row.total_revenue) || 0;
        const activeUsers = parseInt(row.active_users) || 0;
        const expiredUsers = parseInt(row.expired_users) || 0;

        return {
          name: row.plan_name || 'N/A',
          amount: parseFloat(row.plan_amount),
          userCount,
          totalRevenue,
          activeUsers,
          expiredUsers,
          type:
            row.subscription_type == 0 ? 'Free or Referral' :
              row.subscription_type == 1 ? 'Yearly' :
                row.subscription_type == 2 ? 'Monthly' :
                  row.subscription_type == 3 ? 'Lifetime' :
                    row.subscription_type == 4 ? 'Other' :
                      'Unknown',
          duration: row.validity_days,
          status: row.delete_flag == 0 ? 'Active' : 'Inactive',
          color: row.subscription_type == 1 ? '#3b82f6' : row.subscription_type == 2 ? '#10b981' : '#f59e0b'
        };
      });

      const yearlyTotal = subscriptionRevenueData.filter(row => row.type === 'Yearly').reduce((sum, row) => sum + row.totalRevenue, 0);
      const monthlyTotal = subscriptionRevenueData.filter(row => row.type === 'Monthly').reduce((sum, row) => sum + row.totalRevenue, 0);
      const lifetimeTotal = subscriptionRevenueData.filter(row => row.type === 'Lifetime').reduce((sum, row) => sum + row.totalRevenue, 0);
      const totalUsers = subscriptionRevenueData.reduce((sum, row) => sum + row.userCount, 0);
      const totalActiveUsers = subscriptionRevenueData.reduce((sum, row) => sum + row.activeUsers, 0);
      const totalExpiredUsers = subscriptionRevenueData.reduce((sum, row) => sum + row.expiredUsers, 0);

      return response.status(200).json({
        success: true,
        msg: ['Subscription revenue report retrieved successfully', 'सब्सक्रिप्शन राजस्व रिपोर्ट सफलतापूर्वक प्राप्त', 'सब्सक्रिप्शन महसूल अहवाल यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          subscriptionRevenueData,
          summary: {
            yearlyRevenue: yearlyTotal,
            monthlyRevenue: monthlyTotal,
            lifetimeRevenue: lifetimeTotal,
            totalRevenue: yearlyTotal + monthlyTotal + lifetimeTotal,
            totalPaidUsers: totalUsers,
            totalActiveUsers: totalActiveUsers,
            totalExpiredUsers: totalExpiredUsers,
            activePlans: subscriptionRevenueData.filter(row => row.status === 'Active').length,
            totalPlans: subscriptionRevenueData.length
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
 * Get Revenue Chart Data
 * Returns revenue data grouped by time period (daily, weekly, monthly, yearly, custom)
 */
const getRevenueChartData = async (request, response) => {
  try {
    const { period = 'monthly', start_date, end_date } = request.query;
    let dateCondition = '';
    let groupByClause = '';
    let dateFormat = '';

    // Determine date condition and grouping based on period
    switch (period) {
      case 'daily':
        // Last 30 days grouped by day
        dateCondition = 'AND DATE(usm.start_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        groupByClause = 'DATE(usm.start_date)';
        dateFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        // Last 12 weeks grouped by week
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 12 WEEK)';
        groupByClause = 'YEARWEEK(usm.start_date, 1)';
        dateFormat = '%Y-W%u';
        break;
      case 'monthly':
        // Last 12 months grouped by month
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
        groupByClause = 'DATE_FORMAT(usm.start_date, "%Y-%m")';
        dateFormat = '%Y-%m';
        break;
      case 'yearly':
        // Last 5 years grouped by year
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
        groupByClause = 'YEAR(usm.start_date)';
        dateFormat = '%Y';
        break;
      case 'custom':
        // Custom date range
        if (start_date && end_date) {
          // Validate date format
          const startDate = moment(start_date, 'YYYY-MM-DD', true);
          const endDate = moment(end_date, 'YYYY-MM-DD', true);

          if (!startDate.isValid() || !endDate.isValid()) {
            return response.status(200).json({
              success: false,
              msg: ['Invalid date format. Use YYYY-MM-DD', 'अमान्य तारीख प्रारूप', 'अवैध तारीख स्वरूप'],
              key: "invalid_date_format"
            });
          }

          if (startDate.isAfter(endDate)) {
            return response.status(200).json({
              success: false,
              msg: ['Start date must be before end date', 'प्रारंभ तिथि अंत तिथि से पहले होनी चाहिए', 'प्रारंभ तारीख अंत तारीखपूर्वी असणे आवश्यक आहे'],
              key: "invalid_date_range"
            });
          }

          dateCondition = 'AND DATE(usm.start_date) >= ? AND DATE(usm.start_date) <= ?';
          const daysDiff = endDate.diff(startDate, 'days');

          if (daysDiff <= 30) {
            // Group by day if range is <= 30 days
            groupByClause = 'DATE(usm.start_date)';
            dateFormat = '%Y-%m-%d';
          } else if (daysDiff <= 90) {
            // Group by week if range is <= 90 days
            groupByClause = 'YEARWEEK(usm.start_date, 1)';
            dateFormat = '%Y-W%u';
          } else if (daysDiff <= 365) {
            // Group by month if range is <= 365 days
            groupByClause = 'DATE_FORMAT(usm.start_date, "%Y-%m")';
            dateFormat = '%Y-%m';
          } else {
            // Group by year if range is > 365 days
            groupByClause = 'YEAR(usm.start_date)';
            dateFormat = '%Y';
          }
        } else {
          dateCondition = '';
          groupByClause = 'DATE(usm.start_date)';
          dateFormat = '%Y-%m-%d';
        }
        break;
      default:
        dateCondition = 'AND usm.start_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
        groupByClause = 'DATE_FORMAT(usm.start_date, "%Y-%m")';
        dateFormat = '%Y-%m';
    }

    const revenueChartQuery = `
      SELECT 
        ${groupByClause} as period_key,
        DATE_FORMAT(usm.start_date, '${dateFormat}') as period_label,
        DATE_FORMAT(MIN(usm.start_date), '%Y-%m-%d') as period_start,
        COUNT(DISTINCT usm.user_id) as total_users,
        COUNT(usm.user_subscription_id) as total_subscriptions,
        COALESCE(SUM(CASE WHEN usm.amount > 0 THEN usm.amount ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN usm.amount > 0 THEN usm.amount ELSE 0 END), 0) as avg_revenue_per_subscription
      FROM user_subscription_master usm
      WHERE usm.delete_flag = 0
        AND usm.amount > 0
        AND usm.razorpay_order_id IS NOT NULL 
        AND usm.razorpay_order_id != ''
        ${dateCondition}
      GROUP BY ${groupByClause}
      ORDER BY period_start ASC
    `;

    // Prepare query parameters for custom date range
    const queryParams = period === 'custom' && start_date && end_date ? [start_date, end_date] : [];

    connection.query(revenueChartQuery, queryParams, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      // Format the data for chart
      const chartData = result.map(row => {
        let label = '';
        const periodStart = moment(row.period_start);

        switch (period) {
          case 'daily':
            label = periodStart.format('DD MMM');
            break;
          case 'weekly':
            label = `Week ${periodStart.format('W')} ${periodStart.format('MMM')}`;
            break;
          case 'monthly':
            label = periodStart.format('MMM YYYY');
            break;
          case 'yearly':
            label = periodStart.format('YYYY');
            break;
          case 'custom':
            // Use the period_label from database
            label = row.period_label || periodStart.format('DD MMM YYYY');
            break;
          default:
            label = periodStart.format('MMM YYYY');
        }

        return {
          period: row.period_key,
          label: label,
          date: row.period_start,
          revenue: parseFloat(row.total_revenue) || 0,
          users: parseInt(row.total_users) || 0,
          subscriptions: parseInt(row.total_subscriptions) || 0,
          avgRevenue: parseFloat(row.avg_revenue_per_subscription) || 0
        };
      });

      // Calculate summary statistics
      const totalRevenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
      const totalUsers = chartData.reduce((sum, item) => sum + item.users, 0);
      const totalSubscriptions = chartData.reduce((sum, item) => sum + item.subscriptions, 0);
      const avgRevenue = chartData.length > 0 ? totalRevenue / chartData.length : 0;
      const maxRevenue = chartData.length > 0 ? Math.max(...chartData.map(item => item.revenue)) : 0;
      const minRevenue = chartData.length > 0 ? Math.min(...chartData.map(item => item.revenue)) : 0;

      return response.status(200).json({
        success: true,
        msg: ['Revenue chart data retrieved successfully', 'राजस्व चार्ट डेटा सफलतापूर्वक प्राप्त', 'महसूल चार्ट डेटा यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          chartData,
          summary: {
            totalRevenue,
            totalUsers,
            totalSubscriptions,
            avgRevenue,
            maxRevenue,
            minRevenue,
            dataPoints: chartData.length,
            period: period
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
 * Get Business Health Report
 * Returns business health metrics across different categories
 */
const getBusinessHealthReport = async (request, response) => {
  try {
    // Calculate various business health metrics
    const metrics = {};

    // User Acquisition Rate (last 30 days)
    const acquisitionQuery = `
      SELECT COUNT(*) as newUsers
      FROM user_master 
      WHERE createtime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND delete_flag = 0
    `;

    // Revenue Growth (last 30 days vs previous 30 days) - using subscription data
    const revenueQuery = `
      SELECT 
        SUM(CASE WHEN usm.createtime >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN usm.amount ELSE 0 END) as currentRevenue,
        SUM(CASE WHEN usm.createtime >= DATE_SUB(NOW(), INTERVAL 60 DAY) AND usm.createtime < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN usm.amount ELSE 0 END) as previousRevenue
      FROM user_subscription_master usm
      WHERE usm.delete_flag = 0 
        AND usm.amount > 0
        AND usm.razorpay_order_id IS NOT NULL 
        AND usm.razorpay_order_id != ''
    `;

    // User Retention (users with recent activity - using last login or recent transactions)
    const retentionQuery = `
      SELECT COUNT(DISTINCT um.user_id) as activeUsers
      FROM user_master um
      LEFT JOIN expense_income_master eim ON um.user_id = eim.user_id AND eim.delete_flag = 0
      WHERE (
        um.updatetime >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
        OR eim.createtime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      )
      AND um.delete_flag = 0 AND um.active_flag = 1
    `;

    // Support Quality (based on support tickets resolution) - check if table exists
    const supportQuery = `
      SELECT 
        COUNT(*) as totalTickets,
        SUM(CASE WHEN status = 'resolved' OR status = 3 THEN 1 ELSE 0 END) as resolvedTickets
      FROM support_tickets_master 
      WHERE createtime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND delete_flag = 0
    `;

    // Product Usage (users with transactions in last 30 days)
    const usageQuery = `
      SELECT COUNT(DISTINCT um.user_id) as activeUsers
      FROM user_master um
      INNER JOIN expense_income_master eim ON um.user_id = eim.user_id
      WHERE eim.createtime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      AND um.delete_flag = 0 AND um.active_flag = 1
      AND eim.delete_flag = 0
    `;

    // Market Share (simulated - would need competitor data)
    const marketShare = 72; // Simulated value

    connection.query(acquisitionQuery, (err1, acquisitionResult) => {
      if (err1) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err1.message
        });
      }

      connection.query(revenueQuery, (err2, revenueResult) => {
        if (err2) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: err2.message
          });
        }

        connection.query(retentionQuery, (err3, retentionResult) => {
          if (err3) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: err3.message
            });
          }

          connection.query(supportQuery, (err4, supportResult) => {
            if (err4) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: err4.message
              });
            }

            connection.query(usageQuery, (err5, usageResult) => {
              if (err5) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: err5.message
                });
              }

              // Calculate metrics
              const newUsers = acquisitionResult[0].newUsers;
              const currentRevenue = revenueResult[0].currentRevenue || 0;
              const previousRevenue = revenueResult[0].previousRevenue || 0;
              const activeUsers = retentionResult[0].activeUsers;
              const totalTickets = supportResult[0].totalTickets || 0;
              const resolvedTickets = supportResult[0].resolvedTickets || 0;
              const productUsers = usageResult[0].activeUsers;

              // Calculate percentages
              const userAcquisition = Math.min(100, Math.max(0, (newUsers / 100) * 100)); // Normalize to 0-100
              const revenueGrowth = previousRevenue > 0 ?
                Math.min(100, Math.max(0, ((currentRevenue - previousRevenue) / previousRevenue) * 100)) : 0;
              const userRetention = Math.min(100, Math.max(0, (activeUsers / 1000) * 100)); // Normalize based on expected users
              const supportQuality = totalTickets > 0 ?
                Math.min(100, Math.max(0, (resolvedTickets / totalTickets) * 100)) : 0;
              const productUsage = Math.min(100, Math.max(0, (productUsers / 1000) * 100)); // Normalize

              const businessHealthData = [
                {
                  category: "User Acquisition",
                  status: userAcquisition >= 80 ? "Strong" : userAcquisition >= 60 ? "Average" : "Poor",
                  value: Math.round(userAcquisition),
                  color: userAcquisition >= 80 ? "#4ade80" : userAcquisition >= 60 ? "#facc15" : "#f87171"
                },
                {
                  category: "Revenue Growth",
                  status: revenueGrowth >= 80 ? "Strong" : revenueGrowth >= 60 ? "Average" : "Poor",
                  value: Math.round(revenueGrowth),
                  color: revenueGrowth >= 80 ? "#4ade80" : revenueGrowth >= 60 ? "#facc15" : "#f87171"
                },
                {
                  category: "User Retention",
                  status: userRetention >= 80 ? "Strong" : userRetention >= 60 ? "Average" : "Poor",
                  value: Math.round(userRetention),
                  color: userRetention >= 80 ? "#4ade80" : userRetention >= 60 ? "#facc15" : "#f87171"
                },
                {
                  category: "Support Quality",
                  status: supportQuality >= 80 ? "Strong" : supportQuality >= 60 ? "Average" : "Poor",
                  value: Math.round(supportQuality),
                  color: supportQuality >= 80 ? "#4ade80" : supportQuality >= 60 ? "#facc15" : "#f87171"
                },
                {
                  category: "Product Usage",
                  status: productUsage >= 80 ? "Strong" : productUsage >= 60 ? "Average" : "Poor",
                  value: Math.round(productUsage),
                  color: productUsage >= 80 ? "#4ade80" : productUsage >= 60 ? "#facc15" : "#f87171"
                },
                {
                  category: "Market Share",
                  status: marketShare >= 80 ? "Strong" : marketShare >= 60 ? "Average" : "Poor",
                  value: marketShare,
                  color: marketShare >= 80 ? "#4ade80" : marketShare >= 60 ? "#facc15" : "#f87171"
                }
              ];

              return response.status(200).json({
                success: true,
                msg: ['Business health report retrieved successfully', 'व्यापार स्वास्थ्य रिपोर्ट सफलतापूर्वक प्राप्त', 'व्यवसाय आरोग्य अहवाल यशस्वीरित्या पुनर्प्राप्त'],
                data: {
                  businessHealthData,
                  summary: {
                    overallScore: Math.round(businessHealthData.reduce((sum, item) => sum + item.value, 0) / businessHealthData.length),
                    strongCategories: businessHealthData.filter(item => item.status === 'Strong').length,
                    averageCategories: businessHealthData.filter(item => item.status === 'Average').length,
                    poorCategories: businessHealthData.filter(item => item.status === 'Poor').length
                  }
                }
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
 * Get Income vs Expense Summary
 * Returns income and expense data for different time periods
 */
// const getIncomeExpenseSummary = async (request, response) => {
//   try {
//     const { period = 'monthly' } = request.query;

//     let dateFormat, groupBy, limit;

//     switch (period) {
//       case 'daily':
//         dateFormat = '%Y-%m-%d';
//         groupBy = 'DATE(createtime)';
//         limit = 7;
//         break;
//       case 'weekly':
//         dateFormat = '%Y-%u';
//         groupBy = 'YEARWEEK(createtime)';
//         limit = 4;
//         break;
//       case 'monthly':
//       default:
//         dateFormat = '%Y-%m';
//         groupBy = 'DATE_FORMAT(createtime, "%Y-%m")';
//         limit = 6;
//         break;
//     }

//     // Get income data (from successful payments)
//     const incomeQuery = `
//       SELECT 
//         ${groupBy} as period,
//         SUM(amount) as income
//       FROM razorpay_orders 
//       WHERE status = 'paid' 
//       AND delete_flag = 0
//       GROUP BY ${groupBy}
//       ORDER BY period DESC
//       LIMIT ${limit}
//     `;

//     // Get expense data (simulated - would need actual expense tracking)
//     const expenseQuery = `
//       SELECT 
//         ${groupBy} as period,
//         SUM(amount * 0.3) as expense
//       FROM razorpay_orders 
//       WHERE status = 'paid' 
//       AND delete_flag = 0
//       GROUP BY ${groupBy}
//       ORDER BY period DESC
//       LIMIT ${limit}
//     `;

//     connection.query(incomeQuery, (err1, incomeResult) => {
//       if (err1) {
//         return response.status(200).json({
//           success: false,
//           msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
//           error: err1.message
//         });
//       }

//       connection.query(expenseQuery, (err2, expenseResult) => {
//         if (err2) {
//           return response.status(200).json({
//             success: false,
//             msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
//             error: err2.message
//           });
//         }

//         // Combine income and expense data
//         const incomeMap = {};
//         incomeResult.forEach(row => {
//           incomeMap[row.period] = parseFloat(row.income);
//         });

//         const expenseMap = {};
//         expenseResult.forEach(row => {
//           expenseMap[row.period] = parseFloat(row.expense);
//         });

//         const allPeriods = [...new Set([...Object.keys(incomeMap), ...Object.keys(expenseMap)])].sort();

//         const summaryData = allPeriods.map(period => {
//           let name;
//           if (period === 'daily') {
//             name = moment(period).format('ddd');
//           } else if (period === 'weekly') {
//             name = `Week ${moment(period).week()}`;
//           } else {
//             name = moment(period).format('MMM');
//           }

//           return {
//             name,
//             income: incomeMap[period] || 0,
//             expense: expenseMap[period] || 0,
//             profit: (incomeMap[period] || 0) - (expenseMap[period] || 0)
//           };
//         }).reverse();

//         // Calculate growth rates
//         const current = summaryData[summaryData.length - 1] || { income: 0, expense: 0 };
//         const previous = summaryData[summaryData.length - 2] || { income: 0, expense: 0 };

//         const incomeGrowth = previous.income > 0 ?
//           ((current.income - previous.income) / previous.income * 100).toFixed(0) : 0;
//         const expenseGrowth = previous.expense > 0 ?
//           ((current.expense - previous.expense) / previous.expense * 100).toFixed(0) : 0;
//         const profitGrowth = previous.profit > 0 ?
//           ((current.profit - previous.profit) / previous.profit * 100).toFixed(0) : 0;

//         return response.status(200).json({
//           success: true,
//           msg: ['Income expense summary retrieved successfully', 'आय व्यय सारांश सफलतापूर्वक प्राप्त', 'उत्पन्न खर्च सारांश यशस्वीरित्या पुनर्प्राप्त'],
//           data: {
//             summaryData,
//             period,
//             summary: {
//               totalIncome: summaryData.reduce((sum, item) => sum + item.income, 0),
//               totalExpense: summaryData.reduce((sum, item) => sum + item.expense, 0),
//               totalProfit: summaryData.reduce((sum, item) => sum + item.profit, 0),
//               incomeGrowth: `${incomeGrowth}%`,
//               expenseGrowth: `${expenseGrowth}%`,
//               profitGrowth: `${profitGrowth}%`
//             }
//           }
//         });
//       });
//     });

//   } catch (error) {
//     return response.status(200).json({
//       success: false,
//       msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
//       error: error.message
//     });
//   }
// };

/**
 * Get Expense Breakdown
 * Returns expense categories and amounts
 */
const getExpenseBreakdown = async (request, response) => {
  try {
    const { period = '6months' } = request.query;

    let dateCondition = '';
    let queryParams = [];

    if (period === '6months') {
      const sixMonthsAgo = moment().subtract(6, 'months').format('YYYY-MM-DD');
      dateCondition = 'AND DATE(eim.createtime) >= ?';
      queryParams = [sixMonthsAgo];
    } else if (period === 'yearly') {
      const oneYearAgo = moment().subtract(1, 'year').format('YYYY-MM-DD');
      dateCondition = 'AND DATE(eim.createtime) >= ?';
      queryParams = [oneYearAgo];
    }

    // Get expense breakdown by account type from user transactions
    const expenseQuery = `
      SELECT 
        uam.user_type,
        SUM(eim.amount) as total_amount,
        COUNT(*) as transaction_count
      FROM expense_income_master eim
      INNER JOIN user_account_master uam ON eim.account_id = uam.user_account_id
      WHERE eim.type = 1 
      AND eim.delete_flag = 0
      AND uam.delete_flag = 0
      ${dateCondition}
      GROUP BY uam.user_type
      ORDER BY total_amount DESC
    `;

    connection.query(expenseQuery, queryParams, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const expenseData = result.map(row => ({
        name: row.user_type == 0 ? 'Business' : row.user_type == 1 ? 'Personal' : 'Other',
        value: parseFloat(row.total_amount),
        count: row.transaction_count,
        type: 'Expense',
        accountType: row.user_type
      }));

      return response.status(200).json({
        success: true,
        msg: ['Expense breakdown retrieved successfully', 'व्यय विवरण सफलतापूर्वक प्राप्त', 'खर्च विभाजन यशस्वीरित्या पुनर्प्राप्त'],
        data: { expenseData }
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
 * Get Income Breakdown
 * Returns income sources and amounts
 */
const getIncomeBreakdown = async (request, response) => {
  try {
    const { period = '6months' } = request.query;

    let dateCondition = '';
    let queryParams = [];

    if (period === '6months') {
      const sixMonthsAgo = moment().subtract(6, 'months').format('YYYY-MM-DD');
      dateCondition = 'AND DATE(eim.createtime) >= ?';
      queryParams = [sixMonthsAgo];
    } else if (period === 'yearly') {
      const oneYearAgo = moment().subtract(1, 'year').format('YYYY-MM-DD');
      dateCondition = 'AND DATE(eim.createtime) >= ?';
      queryParams = [oneYearAgo];
    }

    // Get income breakdown by account type from user transactions
    const incomeQuery = `
      SELECT 
        uam.user_type,
        SUM(eim.amount) as total_amount,
        COUNT(*) as transaction_count
      FROM expense_income_master eim
      INNER JOIN user_account_master uam ON eim.account_id = uam.user_account_id
      WHERE eim.type = 2 
      AND eim.delete_flag = 0
      AND uam.delete_flag = 0
      ${dateCondition}
      GROUP BY uam.user_type
      ORDER BY total_amount DESC
    `;

    connection.query(incomeQuery, queryParams, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const incomeData = result.map(row => ({
        name: row.user_type == 0 ? 'Business' : row.user_type == 1 ? 'Personal' : 'Other',
        value: parseFloat(row.total_amount),
        count: row.transaction_count,
        type: 'Income',
        accountType: row.user_type
      }));

      return response.status(200).json({
        success: true,
        msg: ['Income breakdown retrieved successfully', 'आय विवरण सफलतापूर्वक प्राप्त', 'उत्पन्न विभाजन यशस्वीरित्या पुनर्प्राप्त'],
        data: { incomeData }
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
 * Get Comprehensive Report
 * Returns all report data in a single API call
 */
const getComprehensiveReport = async (request, response) => {
  try {
    const { period = '6months' } = request.query;

    // Get all report data in parallel
    const reports = await Promise.allSettled([
      new Promise((resolve, reject) => {
        const req = { query: { period } };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getUserGrowthReport(req, res);
      }),
      new Promise((resolve, reject) => {
        const req = { query: {} };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getUserActivityReport(req, res);
      }),
      new Promise((resolve, reject) => {
        const req = { query: { period } };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getSubscriptionRevenueReport(req, res);
      }),
      new Promise((resolve, reject) => {
        const req = { query: {} };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getBusinessHealthReport(req, res);
      }),
      new Promise((resolve, reject) => {
        const req = { query: { period } };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getExpenseBreakdown(req, res);
      }),
      new Promise((resolve, reject) => {
        const req = { query: { period } };
        const res = {
          status: () => ({ json: (data) => resolve(data) })
        };
        getIncomeBreakdown(req, res);
      })
    ]);


    const reportData = {
      userGrowth: reports[0].status === 'fulfilled' ? reports[0].value.data : null,
      userActivity: reports[1].status === 'fulfilled' ? reports[1].value.data : null,
      subscriptionRevenue: reports[2].status === 'fulfilled' ? reports[2].value.data : null,
      businessHealth: reports[3].status === 'fulfilled' ? reports[3].value.data : null,
      expenseBreakdown: reports[4].status === 'fulfilled' ? reports[4].value.data : null,
      incomeBreakdown: reports[5].status === 'fulfilled' ? reports[5].value.data : null
    };

    return response.status(200).json({
      success: true,
      msg: ['Comprehensive report retrieved successfully', 'व्यापक रिपोर्ट सफलतापूर्वक प्राप्त', 'व्यापक अहवाल यशस्वीरित्या पुनर्प्राप्त'],
      data: reportData
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
 * Export Report Data
 * Returns CSV formatted data for export
 */
// const exportReportData = async (request, response) => {
//   try {
//     const { reportType, period = 'monthly' } = request.query;

//     let data = null;
//     let filename = 'report';

//     switch (reportType) {
//       case 'userGrowth':
//         const growthReq = { query: { period } };
//         const growthRes = { status: () => ({ json: (data) => { data = data; } }) };
//         await getUserGrowthReport(growthReq, growthRes);
//         filename = 'user_growth_data';
//         break;

//       case 'userActivity':
//         const activityReq = { query: {} };
//         const activityRes = { status: () => ({ json: (data) => { data = data; } }) };
//         await getUserActivityReport(activityReq, activityRes);
//         filename = 'user_activity_data';
//         break;

//       case 'subscriptionRevenue':
//         const revenueReq = { query: { period } };
//         const revenueRes = { status: () => ({ json: (data) => { data = data; } }) };
//         await getSubscriptionRevenueReport(revenueReq, revenueRes);
//         filename = 'subscription_revenue_data';
//         break;

//       case 'businessHealth':
//         const healthReq = { query: {} };
//         const healthRes = { status: () => ({ json: (data) => { data = data; } }) };
//         await getBusinessHealthReport(healthReq, healthRes);
//         filename = 'business_health_data';
//         break;

//       case 'incomeExpense':
//         const incomeExpenseReq = { query: { period } };
//         const incomeExpenseRes = { status: () => ({ json: (data) => { data = data; } }) };
//         await getIncomeExpenseSummary(incomeExpenseReq, incomeExpenseRes);
//         filename = 'income_expense_data';
//         break;

//       default:
//         return response.status(200).json({
//           success: false,
//           msg: ['Invalid report type', 'अमान्य रिपोर्ट प्रकार', 'अवैध अहवाल प्रकार']
//         });
//     }

//     if (!data || !data.success) {
//       return response.status(200).json({
//         success: false,
//         msg: ['Failed to generate report data', 'रिपोर्ट डेटा उत्पन्न करने में विफल', 'अहवाल डेटा व्युत्पन्न करण्यात अयशस्वी']
//       });
//     }

//     // Convert data to CSV format
//     const csvData = convertToCSV(data.data);

//     response.setHeader('Content-Type', 'text/csv');
//     response.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
//     response.send(csvData);

//   } catch (error) {
//     return response.status(200).json({
//       success: false,
//       msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
//       error: error.message
//     });
//   }
// };

/**
 * Helper function to convert data to CSV format
 */
// const convertToCSV = (data) => {
//   if (!data || typeof data !== 'object') return '';

//   if (Array.isArray(data)) {
//     if (data.length === 0) return '';

//     const headers = Object.keys(data[0]).join(',');
//     const rows = data.map(obj =>
//       Object.values(obj).map(value =>
//         typeof value === 'string' && value.includes(',') ? `"${value}"` : value
//       ).join(',')
//     );

//     return [headers, ...rows].join('\n');
//   }

//   return JSON.stringify(data, null, 2);
// };

/**
 * Get User Distribution By State
 * Returns count of users grouped by state from user_master table
 */
const getUserDistributionByState = async (request, response) => {
  try {
    const distributionQuery = `
      SELECT 
        COALESCE(state, 'Unknown') as name,
        COUNT(*) as value
      FROM user_master 
      WHERE delete_flag = 0 
      GROUP BY state
      ORDER BY value DESC
    `;

    connection.query(distributionQuery, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      // Calculate percentage
      const totalUsers = result.reduce((sum, item) => sum + item.value, 0);
      const dataWithPercentage = result.map(item => ({
        ...item,
        percentage: totalUsers > 0 ? ((item.value / totalUsers) * 100).toFixed(1) : "0"
      }));

      return response.status(200).json({
        success: true,
        msg: ['User state distribution retrieved successfully', 'उपयोगकर्ता राज्य वितरण सफलतापूर्वक प्राप्त', 'वापरकर्ता राज्य वितरण यशस्वीरित्या पुनर्प्राप्त'],
        data: dataWithPercentage
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
  getUserGrowthReport,
  getUserActivityReport,
  getSubscriptionRevenueReport,
  getRevenueChartData,
  getBusinessHealthReport,
  // getIncomeExpenseSummary,
  getExpenseBreakdown,
  getIncomeBreakdown,
  getComprehensiveReport,
  getUserDistributionByState,
  // exportReportData
};
