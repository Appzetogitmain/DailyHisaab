import connection from '../connection/dbConfig.js';
import languageMessage from './languageMessage.js';
import moment from 'moment-timezone';
import Joi from 'joi';

// Validation schemas
const adminPerformanceSchema = Joi.object({
  period_type: Joi.string().valid('daily', 'weekly', 'monthly').default('monthly'),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  user_id: Joi.number().integer().positive().optional(),
  performance_grade: Joi.string().valid('Poor', 'Fair', 'Good', 'Excellent').optional(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
  limit: Joi.number().optional()
});

/**
 * Get overall performance statistics for admin dashboard
 * Calculates metrics dynamically from raw data tables
 */
const getOverallPerformanceStats = async (request, response) => {
  try {
    const { error, value } = adminPerformanceSchema.validate(request.query);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: error.details[0].message
      });
    }

    const { period_type = 'monthly', user_id, performance_grade } = value;

    // Default to current month if not specified
    // Note: Request usually sends start/end dates but we focus on month logic for now 
    // to align with the monthly scoring system.
    const currentMonth = moment().format('YYYY-MM');
    const [year, month] = currentMonth.split('-');

    // 1. Fetch ALL Users (Base Population - matching User Management logic)
    const usersQuery = `
      SELECT user_id, name as user_name, mobile 
      FROM user_master 
      WHERE delete_flag = 0
    `;

    // 2. Fetch Aggregated Basic Financials (Income, Expense) for the month
    const financialsQuery = `
      SELECT 
        user_id,
        SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as total_expense
      FROM expense_income_master
      WHERE YEAR(createtime) = ? AND MONTH(createtime) = ? 
      AND delete_flag = 0 AND type IN (1, 2)
      GROUP BY user_id
    `;

    // 3. Fetch Aggregated Daily Entries (Active Days)
    const activeDaysQuery = `
      SELECT user_id, COUNT(DISTINCT DATE(createtime)) as active_days, COUNT(*) as total_entries
      FROM expense_income_master 
      WHERE YEAR(createtime) = ? AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY user_id
    `;

    // 4. Fetch Aggregated Debt Stats
    const debtQuery = `
      SELECT 
        user_id,
        SUM(CASE WHEN receivable_payable = 1 THEN amount ELSE 0 END) as total_receivable,
        SUM(CASE WHEN receivable_payable = 2 THEN amount ELSE 0 END) as total_payable
      FROM expense_income_master 
      WHERE YEAR(createtime) = ? AND MONTH(createtime) = ? 
      AND type = 3 AND delete_flag = 0
      GROUP BY user_id
    `;

    // 5. Fetch Budget Stats
    const budgetQuery = `
      SELECT 
        user_id, SUM(amount) as total_budget
      FROM budget_master
      WHERE delete_flag = 0
      GROUP BY user_id
    `;

    // Execute queries in parallel
    const [allUsers, financials, activeDays, debtData, budgetData] = await Promise.all([
      new Promise((resolve, reject) => connection.query(usersQuery, (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(financialsQuery, [year, month], (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(activeDaysQuery, [year, month], (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(debtQuery, [year, month], (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(budgetQuery, (err, res) => err ? reject(err) : resolve(res)))
    ]);

    // Map data by user_id
    const userMap = new Map();

    // Initialize all users
    allUsers.forEach(user => {
      userMap.set(user.user_id, {
        user_id: user.user_id,
        user_name: user.user_name,
        mobile: user.mobile,
        income: 0,
        expense: 0,
        active_days: 0,
        entries: 0,
        receivable: 0,
        payable: 0,
        budget: 0,
        scores: {}
      });
    });

    // Merge Financials
    financials.forEach(row => {
      if (userMap.has(row.user_id)) {
        const u = userMap.get(row.user_id);
        u.income = parseFloat(row.total_income) || 0;
        u.expense = parseFloat(row.total_expense) || 0;
      }
    });

    // Merge Active Days
    activeDays.forEach(row => {
      if (userMap.has(row.user_id)) {
        const u = userMap.get(row.user_id);
        u.active_days = parseInt(row.active_days);
        u.entries = parseInt(row.total_entries);
      }
    });

    // Merge Debt
    debtData.forEach(row => {
      if (userMap.has(row.user_id)) {
        const u = userMap.get(row.user_id);
        u.receivable = parseFloat(row.total_receivable);
        u.payable = parseFloat(row.total_payable);
      }
    });

    // Merge Budget
    budgetData.forEach(row => {
      if (userMap.has(row.user_id)) {
        userMap.get(row.user_id).budget = parseFloat(row.total_budget);
      }
    });

    // --- CALCULATE SCORES FOR EACH USER ---
    const users = Array.from(userMap.values());
    const processedUsers = [];
    const dist = { excellent: 0, good: 0, fair: 0, poor: 0 };
    let totalScoreSum = 0;

    // Metrics sums for averages
    const metricSums = {
      profitability: 0,
      cashFlow: 0, // Using simplified or placeholder
      expenseControl: 0, // Using simplified
      debtHealth: 0,
      stockTurnover: 0, // Skipping for bulk or using placeholder
      collections: 0, // Skipping for bulk
      dailyEntry: 0,
      budgetUsage: 0
    };

    const daysInMonth = moment(currentMonth, 'YYYY-MM').daysInMonth();

    for (const user of users) {
      // 1. Profitability (30%)
      let profScore = 0;
      if (user.income > 0) {
        const expRatio = Math.min(100, (user.expense / user.income) * 100);
        const margin = Math.max(0, 100 - expRatio);
        profScore = Math.min(30, (margin / 15) * 30);
      } else if (user.income > 0 && user.expense === 0) {
        profScore = 30;
      }

      // 2. Daily Entry (10%)
      const freq = user.active_days / daysInMonth;
      let dailyScore = 0;
      if (freq >= 0.8) dailyScore = 10;
      else if (freq >= 0.6) dailyScore = 8;
      else if (freq >= 0.4) dailyScore = 6;
      else if (freq >= 0.2) dailyScore = 4;
      else if (freq > 0) dailyScore = 2;

      // 3. Debt Health (15%)
      let debtScore = 15;
      if (user.income > 0) {
        const ratio = user.payable / user.income;
        if (ratio > 0.5) debtScore -= 8;
        else if (ratio > 0.3) debtScore -= 5;
        else if (ratio > 0.1) debtScore -= 2;
      }
      if (user.receivable > user.payable) debtScore += 2;
      debtScore = Math.max(0, Math.min(15, debtScore));

      // 4. Budget Usage (10%)
      let budgetScore = 0;
      if (user.budget > 0) {
        const util = (user.expense / user.budget) * 100;
        if (util <= 90) budgetScore = 10;
        else if (util <= 100) budgetScore = 8;
        else if (util <= 110) budgetScore = 6;
        else if (util <= 120) budgetScore = 4;
        else budgetScore = 2;
      }

      // Simplified placeholder scores for complex metrics requiring deep joins (Stock, Collections, Categorized Expense)
      // To keep bulk query fast, we assume average baseline or simplified logic:
      const expenseControlScore = user.expense > 0 ? 10 : 0; // Placeholder average
      const stockScore = 0;
      const collectionScore = user.receivable > 0 ? 2.5 : 0; // Placeholder
      const cashFlowScore = user.income > user.expense ? 20 : 0; // Simple cash flow check

      const totalUserScore = profScore + dailyScore + debtScore + budgetScore + expenseControlScore + stockScore + collectionScore + cashFlowScore;

      // Assign Grade
      let grade = 'Poor';
      if (totalUserScore >= 80) grade = 'Excellent';
      else if (totalUserScore >= 60) grade = 'Good';
      else if (totalUserScore >= 40) grade = 'Fair';

      if (performance_grade && performance_grade !== grade) continue;

      // Update Distribution & Sums
      dist[grade.toLowerCase()]++;
      totalScoreSum += totalUserScore;
      metricSums.profitability += profScore;
      metricSums.dailyEntry += dailyScore;
      metricSums.debtHealth += debtScore;
      metricSums.budgetUsage += budgetScore;
      metricSums.expenseControl += expenseControlScore;
      metricSums.stockTurnover += stockScore;
      metricSums.collections += collectionScore;
      metricSums.cashFlow += cashFlowScore;

      user.total_score = totalUserScore;
      user.performance_grade = grade;
      processedUsers.push(user);
    }

    const userCount = processedUsers.length;

    // Sort for top performers
    processedUsers.sort((a, b) => b.total_score - a.total_score);
    const topPerformers = processedUsers.slice(0, 10).map(u => ({
      user_id: u.user_id,
      user_name: u.user_name || 'N/A',
      mobile: u.mobile || 'N/A',
      total_score: parseFloat(u.total_score.toFixed(2)),
      performance_grade: u.performance_grade
    }));

    const stats = {
      overview: {
        totalUsers: userCount,
        averageScore: userCount ? parseFloat((totalScoreSum / userCount).toFixed(2)) : 0,
        minScore: userCount ? parseFloat((processedUsers[userCount - 1]?.total_score || 0).toFixed(2)) : 0,
        maxScore: userCount ? parseFloat((processedUsers[0]?.total_score || 0).toFixed(2)) : 0,
        scoreDistribution: dist
      },
      averageMetrics: {
        profitability: userCount ? parseFloat((metricSums.profitability / userCount).toFixed(2)) : 0,
        cashFlow: userCount ? parseFloat((metricSums.cashFlow / userCount).toFixed(2)) : 0,
        expenseControl: userCount ? parseFloat((metricSums.expenseControl / userCount).toFixed(2)) : 0,
        debtHealth: userCount ? parseFloat((metricSums.debtHealth / userCount).toFixed(2)) : 0,
        stockTurnover: userCount ? parseFloat((metricSums.stockTurnover / userCount).toFixed(2)) : 0,
        collections: userCount ? parseFloat((metricSums.collections / userCount).toFixed(2)) : 0,
        dailyEntry: userCount ? parseFloat((metricSums.dailyEntry / userCount).toFixed(2)) : 0,
        budgetUsage: userCount ? parseFloat((metricSums.budgetUsage / userCount).toFixed(2)) : 0
      },
      topPerformingUsers: topPerformers,
      performanceTrends: [], // Trends require history, skipping for on-the-fly calc
      improvementOpportunities: [], // Simplification for now
      riskAlerts: [],
      reportPeriod: {
        type: period_type,
        currentMonth: currentMonth,
        generatedAt: moment().format('YYYY-MM-DD HH:mm:ss')
      }
    };

    return response.status(200).json({
      success: true,
      msg: ['Performance statistics calculated successfully', 'प्रदर्शन आंकड़े सफलतापूर्वक गणना किए गए'],
      data: stats
    });

  } catch (error) {
    console.error('Performance Calc Error:', error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};



/**
 * Get detailed user performance report
 */
const getUserPerformanceReport = async (request, response) => {
  try {
    const { user_id, account_id, month_year } = request.query;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'यूजर आईडी आवश्यक है', 'वापरकर्ता आयडी आवश्यक आहे']
      });
    }

    const targetMonth = month_year || moment().format('YYYY-MM');

    // Get detailed performance data
    const query = `
            SELECT 
                ups.*,
                um.name as user_name,
                um.mobile,
                uam.account_name,
                psd.profitability_metrics,
                psd.cash_flow_metrics,
                psd.expense_control_metrics,
                psd.debt_credit_metrics,
                psd.stock_turnover_metrics,
                psd.collection_metrics,
                psd.daily_entry_metrics,
                psd.budget_usage_metrics,
                psd.improvement_suggestions,
                psd.risk_factors
            FROM user_performance_scores ups
            LEFT JOIN user_master um ON ups.user_id = um.user_id
            LEFT JOIN user_account_master uam ON ups.account_id = uam.user_account_id
            LEFT JOIN performance_score_details psd ON ups.performance_id = psd.detail_id
            WHERE ups.user_id = ? AND ups.month_year = ?
        `;

    const params = [user_id, targetMonth];

    if (account_id) {
      query += ` AND ups.account_id = ?`;
      params.push(account_id);
    }

    connection.query(query, params, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: err.message
        });
      }

      if (result.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['No performance data found for the specified user and period', 'निर्दिष्ट उपयोगकर्ता और अवधि के लिए कोई प्रदर्शन डेटा नहीं मिला', 'निर्दिष्ट वापरकर्ता आणि कालावधीसाठी कोणतेही प्रदर्शन डेटा सापडले नाही']
        });
      }

      const performanceData = result[0];

      // Parse JSON metrics
      const detailedMetrics = {};
      const jsonFields = [
        'profitability_metrics', 'cash_flow_metrics', 'expense_control_metrics',
        'debt_credit_metrics', 'stock_turnover_metrics', 'collection_metrics',
        'daily_entry_metrics', 'budget_usage_metrics', 'risk_factors'
      ];

      jsonFields.forEach(field => {
        if (performanceData[field]) {
          detailedMetrics[field.replace('_metrics', '')] = JSON.parse(performanceData[field]);
        }
      });

      const report = {
        user_info: {
          user_id: performanceData.user_id,
          account_id: performanceData.account_id,
          user_name: performanceData.user_name || 'N/A',
          mobile: performanceData.mobile || 'N/A',
          account_name: performanceData.account_name || 'N/A'
        },
        performance_summary: {
          month_year: performanceData.month_year,
          total_score: parseFloat(performanceData.total_score),
          performance_grade: performanceData.performance_grade,
          calculation_date: performanceData.calculation_date,
          last_updated: performanceData.last_updated
        },
        score_breakdown: {
          profitability: {
            score: parseFloat(performanceData.profitability_score),
            weight: '30%'
          },
          cash_flow: {
            score: parseFloat(performanceData.cash_flow_consistency_score),
            weight: '20%'
          },
          expense_control: {
            score: parseFloat(performanceData.expense_control_score),
            weight: '20%'
          },
          debt_health: {
            score: parseFloat(performanceData.debt_credit_health_score),
            weight: '15%'
          },
          stock_turnover: {
            score: parseFloat(performanceData.stock_turnover_score),
            weight: '10%'
          },
          collections: {
            score: parseFloat(performanceData.timely_collections_score),
            weight: '5%'
          },
          daily_entry: {
            score: parseFloat(performanceData.daily_entry_score),
            weight: '10 points'
          },
          budget_usage: {
            score: parseFloat(performanceData.budget_usage_score),
            weight: '10 points'
          }
        },
        detailed_metrics: detailedMetrics,
        improvement_suggestions: performanceData.improvement_suggestions,
        risk_factors: detailedMetrics.risk_factors || {}
      };

      return response.status(200).json({
        success: true,
        msg: ['User performance report retrieved successfully', 'उपयोगकर्ता प्रदर्शन रिपोर्ट सफलतापूर्वक प्राप्त की गई', 'वापरकर्ता प्रदर्शन अहवाल यशस्वीरित्या पुनर्प्राप्त केले'],
        data: report
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
 * Get performance comparison between users
 */
const getPerformanceComparison = async (request, response) => {
  try {
    const { user_ids, month_year } = request.query;

    if (!user_ids) {
      return response.status(200).json({
        success: false,
        msg: ['User IDs are required', 'यूजर आईडी आवश्यक हैं', 'वापरकर्ता आयडी आवश्यक आहेत']
      });
    }

    const userIds = Array.isArray(user_ids) ? user_ids : user_ids.split(',');
    const targetMonth = month_year || moment().format('YYYY-MM');

    if (userIds.length < 2 || userIds.length > 10) {
      return response.status(200).json({
        success: false,
        msg: ['Please provide 2-10 user IDs for comparison', 'तुलना के लिए 2-10 यूजर आईडी प्रदान करें', 'तुलनेसाठी 2-10 वापरकर्ता आयडी प्रदान करा']
      });
    }

    const placeholders = userIds.map(() => '?').join(',');
    const query = `
            SELECT 
                ups.user_id,
                ups.account_id,
                ups.total_score,
                ups.performance_grade,
                ups.profitability_score,
                ups.cash_flow_consistency_score,
                ups.expense_control_score,
                ups.debt_credit_health_score,
                ups.stock_turnover_score,
                ups.timely_collections_score,
                ups.daily_entry_score,
                ups.budget_usage_score,
                um.name as user_name,
                um.mobile,
                uam.account_name
            FROM user_performance_scores ups
            LEFT JOIN user_master um ON ups.user_id = um.user_id
            LEFT JOIN user_account_master uam ON ups.account_id = uam.user_account_id
            WHERE ups.user_id IN (${placeholders}) AND ups.month_year = ? AND ups.is_active = 1
            ORDER BY ups.total_score DESC
        `;

    connection.query(query, [...userIds, targetMonth], (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: err.message
        });
      }

      if (result.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['No performance data found for the specified users and period', 'निर्दिष्ट उपयोगकर्ताओं और अवधि के लिए कोई प्रदर्शन डेटा नहीं मिला', 'निर्दिष्ट वापरकर्ते आणि कालावधीसाठी कोणतेही प्रदर्शन डेटा सापडले नाही']
        });
      }

      // Calculate comparison metrics
      const scores = result.map(row => parseFloat(row.total_score));
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);

      const comparison = {
        month_year: targetMonth,
        total_users: result.length,
        average_score: Math.round(avgScore * 100) / 100,
        highest_score: Math.round(maxScore * 100) / 100,
        lowest_score: Math.round(minScore * 100) / 100,
        score_range: Math.round((maxScore - minScore) * 100) / 100,
        user_comparison: result.map((row, index) => ({
          rank: index + 1,
          user_id: row.user_id,
          account_id: row.account_id,
          user_name: row.user_name || 'N/A',
          mobile: row.mobile || 'N/A',
          account_name: row.account_name || 'N/A',
          total_score: parseFloat(row.total_score),
          performance_grade: row.performance_grade,
          score_vs_average: Math.round((parseFloat(row.total_score) - avgScore) * 100) / 100,
          breakdown: {
            profitability: parseFloat(row.profitability_score),
            cash_flow: parseFloat(row.cash_flow_consistency_score),
            expense_control: parseFloat(row.expense_control_score),
            debt_health: parseFloat(row.debt_credit_health_score),
            stock_turnover: parseFloat(row.stock_turnover_score),
            collections: parseFloat(row.timely_collections_score),
            daily_entry: parseFloat(row.daily_entry_score),
            budget_usage: parseFloat(row.budget_usage_score)
          }
        })),
        insights: {
          best_performing_metric: getBestPerformingMetric(result),
          worst_performing_metric: getWorstPerformingMetric(result),
          improvement_opportunities: getComparisonInsights(result)
        }
      };

      return response.status(200).json({
        success: true,
        msg: ['Performance comparison retrieved successfully', 'प्रदर्शन तुलना सफलतापूर्वक प्राप्त की गई', 'प्रदर्शन तुलना यशस्वीरित्या पुनर्प्राप्त केली'],
        data: comparison
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
 * Helper function to get best performing metric
 */
const getBestPerformingMetric = (users) => {
  const metrics = [
    'profitability_score', 'cash_flow_consistency_score', 'expense_control_score',
    'debt_credit_health_score', 'stock_turnover_score', 'timely_collections_score',
    'daily_entry_score', 'budget_usage_score'
  ];

  const avgScores = {};
  metrics.forEach(metric => {
    const avg = users.reduce((sum, user) => sum + parseFloat(user[metric]), 0) / users.length;
    avgScores[metric] = avg;
  });

  const bestMetric = Object.keys(avgScores).reduce((a, b) => avgScores[a] > avgScores[b] ? a : b);
  return {
    metric: bestMetric.replace('_score', ''),
    average_score: Math.round(avgScores[bestMetric] * 100) / 100
  };
};

/**
 * Helper function to get worst performing metric
 */
const getWorstPerformingMetric = (users) => {
  const metrics = [
    'profitability_score', 'cash_flow_consistency_score', 'expense_control_score',
    'debt_credit_health_score', 'stock_turnover_score', 'timely_collections_score',
    'daily_entry_score', 'budget_usage_score'
  ];

  const avgScores = {};
  metrics.forEach(metric => {
    const avg = users.reduce((sum, user) => sum + parseFloat(user[metric]), 0) / users.length;
    avgScores[metric] = avg;
  });

  const worstMetric = Object.keys(avgScores).reduce((a, b) => avgScores[a] < avgScores[b] ? a : b);
  return {
    metric: worstMetric.replace('_score', ''),
    average_score: Math.round(avgScores[worstMetric] * 100) / 100
  };
};

/**
 * Helper function to get comparison insights
 */
const getComparisonInsights = (users) => {
  const insights = [];

  // Check for users with poor daily entry scores
  const poorDailyEntry = users.filter(user => parseFloat(user.daily_entry_score) < 5);
  if (poorDailyEntry.length > 0) {
    insights.push({
      type: 'daily_entry',
      description: `${poorDailyEntry.length} user(s) have low daily entry frequency`,
      users_affected: poorDailyEntry.map(u => u.user_id),
      priority: 'medium'
    });
  }

  // Check for users with debt issues
  const debtIssues = users.filter(user => parseFloat(user.debt_credit_health_score) < 5);
  if (debtIssues.length > 0) {
    insights.push({
      type: 'debt_health',
      description: `${debtIssues.length} user(s) have debt and credit issues`,
      users_affected: debtIssues.map(u => u.user_id),
      priority: 'high'
    });
  }

  // Check for users with poor expense control
  const poorExpenseControl = users.filter(user => parseFloat(user.expense_control_score) < 10);
  if (poorExpenseControl.length > 0) {
    insights.push({
      type: 'expense_control',
      description: `${poorExpenseControl.length} user(s) have poor expense control`,
      users_affected: poorExpenseControl.map(u => u.user_id),
      priority: 'medium'
    });
  }

  return insights;
};

/**
 * Feature Usage Analytics
 * Tracks usage of key features (Income, Expense, Udhari, Budget)
 */
const getFeatureUsageAnalytics = async (request, response) => {
  try {
    const today = moment();
    const startOfCurrentMonth = today.clone().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const startOfLastMonth = today.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const endOfLastMonth = today.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD HH:mm:ss');
    const startOf6MonthsAgo = today.clone().subtract(5, 'months').startOf('month').format('YYYY-MM-DD HH:mm:ss');

    // 1. Total Active Users (Matches User Management 'Active' logic: Logged in last 30 days)
    const thresholdDate = moment().subtract(30, 'days').format('YYYY-MM-DD HH:mm:ss');
    const activeUsersQuery = `SELECT COUNT(*) as total FROM user_master WHERE last_login_date_time >= '${thresholdDate}' AND delete_flag = 0`;

    // 2. Feature Usage Counts - Current Month
    const currentUsageQuery = `
      SELECT 'Income' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 2 AND createtime >= ? AND delete_flag = 0
      UNION ALL
      SELECT 'Expense' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 1 AND createtime >= ? AND delete_flag = 0
      UNION ALL
      SELECT 'Udhari' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 3 AND createtime >= ? AND delete_flag = 0
      UNION ALL
      SELECT 'Budget' as feature, COUNT(DISTINCT user_id) as users FROM budget_master WHERE createtime >= ? AND delete_flag = 0
    `;

    // 3. Feature Usage Counts - Last Month
    const lastUsageQuery = `
      SELECT 'Income' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 2 AND createtime BETWEEN ? AND ? AND delete_flag = 0
      UNION ALL
      SELECT 'Expense' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 1 AND createtime BETWEEN ? AND ? AND delete_flag = 0
      UNION ALL
      SELECT 'Udhari' as feature, COUNT(DISTINCT user_id) as users FROM expense_income_master WHERE type = 3 AND createtime BETWEEN ? AND ? AND delete_flag = 0
      UNION ALL
      SELECT 'Budget' as feature, COUNT(DISTINCT user_id) as users FROM budget_master WHERE createtime BETWEEN ? AND ? AND delete_flag = 0
    `;

    // 4. Trends (Last 6 Months)
    const trendQuery = `
      SELECT 
        DATE_FORMAT(createtime, '%Y-%m') as month,
        COUNT(DISTINCT user_id) as active_users
      FROM (
         SELECT user_id, createtime FROM expense_income_master WHERE createtime >= ? AND delete_flag = 0
         UNION ALL
         SELECT user_id, createtime FROM budget_master WHERE createtime >= ? AND delete_flag = 0
      ) as combined
      GROUP BY DATE_FORMAT(createtime, '%Y-%m')
      ORDER BY month ASC
    `;

    const [activeUsersRes, currentUsageRes, prevUsageRes, trendRes] = await Promise.all([
      new Promise((resolve, reject) => connection.query(activeUsersQuery, (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(currentUsageQuery, [startOfCurrentMonth, startOfCurrentMonth, startOfCurrentMonth, startOfCurrentMonth], (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(lastUsageQuery, [startOfLastMonth, endOfLastMonth, startOfLastMonth, endOfLastMonth, startOfLastMonth, endOfLastMonth, startOfLastMonth, endOfLastMonth], (err, res) => err ? reject(err) : resolve(res))),
      new Promise((resolve, reject) => connection.query(trendQuery, [startOf6MonthsAgo, startOf6MonthsAgo], (err, res) => err ? reject(err) : resolve(res)))
    ]);

    // Process Growth Trends
    const features = ['Income', 'Expense', 'Udhari', 'Budget'];
    const growthTrends = features.map(feat => {
      const curr = currentUsageRes.find(r => r.feature === feat)?.users || 0;
      const prev = prevUsageRes.find(r => r.feature === feat)?.users || 0;
      let growth = 0;
      if (prev === 0) {
        growth = curr > 0 ? 100 : 0;
      } else {
        growth = ((curr - prev) / prev) * 100;
      }

      return {
        feature: feat,
        current: curr,
        previous: prev,
        growth: parseFloat(growth.toFixed(2)),
        status: growth >= 0 ? 'Growing' : 'Declining'
      };
    });

    // Add Placeholders for Report/Export
    growthTrends.push({ feature: 'Report', current: 0, previous: 0, growth: 0, status: 'Stable' });
    growthTrends.push({ feature: 'Export', current: 0, previous: 0, growth: 0, status: 'Stable' });

    // Metrics
    const sortedByUsage = [...growthTrends].sort((a, b) => b.current - a.current);
    const mostUsed = sortedByUsage[0];

    const sortedByGrowth = [...growthTrends].sort((a, b) => b.growth - a.growth);
    const fastestGrowing = sortedByGrowth[0];

    const totalActive = activeUsersRes[0]?.total || 0;

    // Engagement Score Calculation
    const uniqueUserSum = growthTrends.reduce((sum, item) => sum + item.current, 0);
    const featureCount = features.length;
    let engagementScore = 0;
    if (totalActive > 0) {
      const avgFeaturesPerUser = uniqueUserSum / totalActive;
      engagementScore = (avgFeaturesPerUser / featureCount) * 10;
      engagementScore = Math.min(10, engagementScore);
    }

    // Fix Trend Data format for Chart
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const d = today.clone().subtract(i, 'months');
      const mKey = d.format('YYYY-MM');
      const found = trendRes.find(r => r.month === mKey);
      last6Months.push({
        month: mKey,
        active_users: found ? found.active_users : 0
      });
    }

    return response.status(200).json({
      success: true,
      data: {
        totalActiveUsers: totalActive,
        mostUsedFeature: mostUsed.feature,
        mostUsedCount: mostUsed.current,
        fastestGrowingFeature: fastestGrowing.feature,
        fastestGrowingPct: fastestGrowing.growth,
        engagementScore: parseFloat(engagementScore.toFixed(1)),
        featureUsageComparison: growthTrends,
        featureGrowthTrends: growthTrends,
        featureUsageTrends: last6Months
      }
    });

  } catch (error) {
    console.error('Feature Analytics Error:', error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

export {
  getOverallPerformanceStats,
  getUserPerformanceReport,
  getPerformanceComparison,
  getFeatureUsageAnalytics
};
