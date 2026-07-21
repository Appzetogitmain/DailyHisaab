import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';

/**
 * Get Dashboard Data Controller
 * Returns comprehensive dashboard analytics and statistics
 */
const getDashboardData = async (request, response) => {
  try {
    const currentDate = new Date();
    const today = moment(currentDate).format('YYYY-MM-DD');
    const yesterday = moment(currentDate).subtract(1, 'day').format('YYYY-MM-DD');
    const last30Days = moment(currentDate).subtract(30, 'days').format('YYYY-MM-DD');

    // Helper function to execute queries with promises
    const query = (sql, params) => {
      return new Promise((resolve, reject) => {
        connection.query(sql, params, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };

    // 1. Overview Stats
    const totalUsersQuery = "SELECT COUNT(*) as total FROM user_master WHERE delete_flag = 0";
    const dailyActiveQuery = "SELECT COUNT(*) as daily FROM user_master WHERE delete_flag = 0 AND updatetime >= ?";
    const monthlyActiveQuery = "SELECT COUNT(*) as monthly FROM user_master WHERE delete_flag = 0 AND updatetime >= ?";

    // Installs: Based on user_master creation date (All users, free or paid)
    const dailyInstallsQuery = "SELECT COUNT(*) as daily_installs FROM user_master WHERE delete_flag = 0 AND DATE(createtime) = ?";

    // Revenue: Only from Valid Razorpay Orders
    const revenueQuery = `
      SELECT 
        SUM(CASE WHEN DATE(createtime) = ? THEN amount ELSE 0 END) as daily_revenue,
        SUM(CASE WHEN DATE(createtime) >= ? THEN amount ELSE 0 END) as monthly_revenue,
        SUM(amount) as total_revenue,
        COUNT(CASE WHEN DATE(createtime) = ? THEN 1 END) as daily_new_paid_subscribers
      FROM user_subscription_master 
      WHERE delete_flag = 0 AND amount > 0 AND razorpay_order_id IS NOT NULL AND razorpay_order_id != ''
    `;

    const pendingTicketsQuery = "SELECT COUNT(*) as pending_count FROM support_tickets_master WHERE delete_flag = 0 AND status = 0";

    // execute parallel
    const [
      totalUsersRes,
      dailyActiveRes,
      monthlyActiveRes,
      dailyInstallsRes,
      revenueRes,
      pendingTicketsRes
    ] = await Promise.all([
      query(totalUsersQuery),
      query(dailyActiveQuery, [yesterday]),
      query(monthlyActiveQuery, [last30Days]),
      query(dailyInstallsQuery, [today]),
      query(revenueQuery, [today, last30Days, today]),
      query(pendingTicketsQuery)
    ]);

    const overview_stats = {
      total_active_users: totalUsersRes[0].total,
      daily_active_users: dailyActiveRes[0].daily,
      monthly_active_users: monthlyActiveRes[0].monthly,
      app_daily_installs: dailyInstallsRes[0].daily_installs,
      daily_revenue: revenueRes[0].daily_revenue || 0,
      monthly_revenue: revenueRes[0].monthly_revenue || 0,
      total_revenue: revenueRes[0].total_revenue || 0,
      pending_tickets: pendingTicketsRes[0].pending_count,
      new_subscribers_today: revenueRes[0].daily_new_paid_subscribers || 0
    };

    // 2. Analytics Overview (Trends) - Fetching raw data then merging in JS
    // Installs: All users from user_master
    const installsTrendQuery = `
      SELECT DATE(createtime) as date, COUNT(*) as count 
      FROM user_master 
      WHERE delete_flag = 0 AND createtime >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY DATE(createtime)
    `;

    // Revenue: Paid users from user_subscription_master
    const revenueTrendQuery = `
      SELECT DATE(createtime) as date, SUM(amount) as amount 
      FROM user_subscription_master 
      WHERE delete_flag = 0 AND amount > 0 AND razorpay_order_id IS NOT NULL AND razorpay_order_id != '' AND createtime >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY DATE(createtime)
    `;

    // Uninstalls: Deleted users from user_master
    // Assuming delete_flag = 1 means uninstalled/deleted account
    const uninstallsTrendQuery = `
      SELECT DATE(updatetime) as date, COUNT(*) as count 
      FROM user_master 
      WHERE delete_flag = 1 AND updatetime >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY DATE(updatetime)
    `;

    const [installsTrend, revenueTrend, uninstallsTrend] = await Promise.all([
      query(installsTrendQuery),
      query(revenueTrendQuery),
      query(uninstallsTrendQuery)
    ]);

    // Helper to merge trend data
    const processTrendData = (days, formatStr) => {
      const data = [];
      for (let i = 0; i < days; i++) {
        const d = moment().subtract(i, 'days');
        const dateKey = d.format('YYYY-MM-DD');

        const installDay = installsTrend.find(r => moment(r.date).format('YYYY-MM-DD') === dateKey);
        const revenueDay = revenueTrend.find(r => moment(r.date).format('YYYY-MM-DD') === dateKey);
        const uninstallDay = uninstallsTrend.find(r => moment(r.date).format('YYYY-MM-DD') === dateKey);

        data.push({
          time: d.format(formatStr),
          installs: installDay ? installDay.count : 0,
          revenue: revenueDay ? revenueDay.amount : 0,
          uninstalls: uninstallDay ? uninstallDay.count : 0
        });
      }
      return data.reverse();
    };

    // Helper for grouped trends (Weekly/Monthly)
    const processGroupedTrend = (count, unit, formatStr) => {
      const data = [];
      for (let i = 0; i < count; i++) {
        const start = moment().subtract(i, unit).startOf(unit);
        const end = moment().subtract(i, unit).endOf(unit);

        // Filter and Sum
        const sumMetric = (dataSet, key) => dataSet
          .filter(item => moment(item.date).isBetween(start, end, 'day', '[]'))
          .reduce((sum, item) => sum + (item[key] || 0), 0);

        data.push({
          time: unit === 'week' ? `Week ${count - i}` : start.format(formatStr),
          installs: sumMetric(installsTrend, 'count'),
          revenue: sumMetric(revenueTrend, 'amount'),
          uninstalls: sumMetric(uninstallsTrend, 'count')
        });
      }
      return data.reverse();
    };

    const analytics_overview = {
      daily: processTrendData(7, 'DD/MM'),
      weekly: processGroupedTrend(4, 'week', ''),
      monthly: processGroupedTrend(6, 'month', 'MMM YYYY'),
      custom: processTrendData(365, 'YYYY-MM-DD')
    };


    // 3. Plan Distribution (Current Active Plans)
    // We need to fetch all active users and their CURRENT valid active subscription
    // If no active subscription, they count as "Free/No Plan"

    // Get all plans first
    const plans = await query("SELECT subscription_id, description, subscription_type, text FROM subscription_master WHERE delete_flag = 0");

    // Get all users active subscription status
    // Rank subscriptions by ID desc to get latest active one
    // Note: We scan all active users to classify them
    const userActivePlansQuery = `
      SELECT 
        u.user_id,
        (
          SELECT subscription_id 
          FROM user_subscription_master 
          WHERE user_id = u.user_id AND end_date > NOW() AND delete_flag = 0
          ORDER BY user_subscription_id DESC 
          LIMIT 1
        ) as active_subscription_id
      FROM user_master u
      WHERE u.delete_flag = 0
    `;

    const userPlans = await query(userActivePlansQuery);

    // Initialize counts
    const planCounts = {};
    plans.forEach(p => {
      planCounts[p.subscription_id] = {
        ...p,
        count: 0
      };
    });
    // Add Free/None bucket (id 0)
    planCounts[0] = {
      subscription_id: 0,
      description: 'Free / No Plan',
      subscription_type: 0,
      text: 'Free',
      count: 0
    };

    // Count users per plan
    userPlans.forEach(u => {
      const subId = u.active_subscription_id || 0;
      if (planCounts[subId]) {
        planCounts[subId].count++;
      } else {
        // Fallback for unknown plan ids, though unlikely if foreign keys exist, map to free/other
        planCounts[0].count++;
      }
    });

    // Format Plan Data for Frontend
    const planDetails = Object.values(planCounts).map(p => ({
      subscription_id: p.subscription_id,
      plan_name: p.description,
      subscription_type: p.subscription_type,
      total_users: p.count, // Represents active users on this plan
      active_users: p.count, // Same as total for this snapshot
      expired_users: 0, // Not calculating expired for this specific "Active Plan" view
      total_revenue: 0, // Not calculating complex per-user revenue here
      subscription_type_label:
        p.subscription_type == 0 ? "Free" :
          p.subscription_type == 1 ? "Yearly" :
            p.subscription_type == 2 ? "Monthly" :
              p.subscription_type == 3 ? "Lifetime" :
                p.subscription_type == 4 ? "Other" : "Free"
    }));

    // Sort: Paid plans first (type != 0), then Free, by count desc
    planDetails.sort((a, b) => {
      // Custom sort: Put Paid active users on top
      if (a.subscription_type !== 0 && b.subscription_type === 0) return -1;
      if (a.subscription_type === 0 && b.subscription_type !== 0) return 1;
      return b.total_users - a.total_users;
    });

    // Pie Chart Data
    // We only include plans that have users > 0 to keep chart clean? Or all? 
    // Usually all is fine, but let's filter only > 0 for better viz if needed, keeping all for now to match UI cards
    const totalSubscribedUsers = planDetails.reduce((sum, p) => sum + p.total_users, 0); // This should equal total active users roughly

    const pieChartData = {
      labels: planDetails.map(p => p.plan_name),
      datasets: [{
        data: planDetails.map(p => p.total_users),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    const plans_validity_wise_users = {
      detailed_data: planDetails,
      pie_chart_data: pieChartData,
      summary: {
        total_users: totalSubscribedUsers
      }
    };


    // 4. Recent Subscribers (Paid Only - Razorpay Verified)
    const recentSubscribersQuery = `
      SELECT 
        us.user_subscription_id as id,
        u.name,
        u.email,
        u.mobile,
        s.description as plan,
        us.amount as revenue,
        us.createtime as joined_timestamp,
        us.end_date
      FROM user_subscription_master us
      JOIN user_master u ON us.user_id = u.user_id
      JOIN subscription_master s ON us.subscription_id = s.subscription_id
      WHERE us.delete_flag = 0 AND us.amount > 0 AND us.razorpay_order_id IS NOT NULL AND us.razorpay_order_id != ''
      ORDER BY us.createtime DESC
      LIMIT 10
    `;
    const recentSubscribers = await query(recentSubscribersQuery);

    // Process recent subscribers
    // Handle potential null/undefined values safely
    const processedRecentSubscribers = recentSubscribers.map(sub => ({
      id: sub.id,
      name: sub.name || 'N/A',
      email: sub.email || 'N/A',
      mobile_number: sub.mobile || 'N/A',
      plan: sub.plan || 'Unknown Plan',
      joined_at: sub.joined_timestamp ? moment(sub.joined_timestamp).format('DD/MM/YYYY HH:mm') : 'N/A',
      joined_timestamp: sub.joined_timestamp ? moment(sub.joined_timestamp).toISOString() : null,
      end_date: sub.end_date ? moment(sub.end_date).format('DD/MM/YYYY') : 'N/A',
      revenue: sub.revenue || 0,
      currency: "INR"
    }));

    // 5. Support Tickets
    const supportTickets = await query(`
      SELECT 
        st.support_ticket_id, 
        st.priority, 
        st.status, 
        st.description as subject, 
        u.email as user_email, 
        u.mobile as user_mobile, 
        st.createtime
      FROM support_tickets_master st 
      JOIN user_master u ON st.user_id = u.user_id
      WHERE st.delete_flag = 0 
      ORDER BY st.createtime DESC 
      LIMIT 10
    `);

    const processedSupportTickets = supportTickets.map(ticket => ({
      id: ticket.support_ticket_id,
      subject: ticket.subject || 'No Subject',
      priority: ticket.priority,
      status: ticket.status,
      user_email: ticket.user_email || 'N/A',
      user_mobile: ticket.user_mobile || 'N/A',
      created_at: ticket.createtime ? moment(ticket.createtime).format('DD/MM/YYYY HH:mm') : 'N/A',
      created_timestamp: ticket.createtime ? moment(ticket.createtime).toISOString() : null
    }));

    return response.status(200).json({
      success: true,
      msg: ["Dashboard data retrieved successfully", "डैशबोर्ड डेटा सफलतापूर्वक प्राप्त", "डॅशबोर्ड डेटा यशस्वीरित्या पुनर्प्राप्त"],
      data: {
        overview_stats,
        analytics_overview,
        plans_validity_wise_users,
        recent_subscribers: processedRecentSubscribers,
        support_tickets: processedSupportTickets
      },
      last_updated: moment().toISOString()
    });

  } catch (error) {
    console.error("Dashboard Data Error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

export { getDashboardData };
