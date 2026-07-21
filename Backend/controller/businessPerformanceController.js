import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';


/**
 * Get Business Performance Score
 * Calculates 6 key metrics and overall score with recommendations
 */
const getBusinessPerformanceScore = async (request, response) => {
  try {
    const { user_id, account_id, month_year } = request.query;

    if (!user_id || !account_id || !month_year) {
      return response.status(200).json({
        success: false,
        msg: ['user_id, account_id, and month_year are required', 'user_id, account_id और month_year आवश्यक हैं', 'user_id, account_id आणि month_year आवश्यक आहेत'],
        key: 'missing_params'
      });
    }

    // Validate month_year format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month_year)) {
      return response.status(200).json({
        success: false,
        msg: ['month_year must be in YYYY-MM format', 'month_year YYYY-MM format में होना चाहिए', 'month_year YYYY-MM स्वरूपात असावे'],
        key: 'invalid_format'
      });
    }

    const [year, month] = month_year.split('-');

    // Calculate total days in the month efficiently
    const daysInMonth = moment(`${year}-${month}-01`, "YYYY-MM-DD").daysInMonth();

    // Fetch all necessary data in parallel (Consolidated Queries)
    const [financialData, inventoryData] = await Promise.all([
      fetchAggregatedFinancialData(user_id, account_id, year, month),
      fetchInventoryData(user_id, account_id, year, month)
    ]);

    // Calculate metrics using the fetched data
    const dailyEntriesScore = calculateDailyEntriesScore(financialData, daysInMonth);
    const profitabilityScore = calculateProfitabilityScore(financialData);
    const expenseRatioScore = calculateExpenseRatioScore(financialData);
    const receivablesScore = calculateReceivablesScore(financialData);
    const cashFlowScore = calculateCashFlowScore(financialData, daysInMonth);
    const inventoryScore = calculateInventoryScore(inventoryData);

    // Check for new/inactive user (Zero Data)
    // If no entries and no inventory movement, set score to 0
    const isNoData = dailyEntriesScore.details.total_entries === 0 &&
      inventoryScore.details.opening_stock === 0 &&
      inventoryScore.details.total_purchases === 0;

    // Calculate overall score (average of all 6)
    const overallScore = isNoData ? 0 : Math.round(
      (dailyEntriesScore.score +
        profitabilityScore.score +
        expenseRatioScore.score +
        receivablesScore.score +
        cashFlowScore.score +
        inventoryScore.score) / 6
    );

    // Get overall recommendations based on individual metric scores (prioritizing low scores)
    const overallRecommendations = getOverallRecommendationsFromMetrics({
      dailyEntries: { score: dailyEntriesScore.score, details: dailyEntriesScore.details },
      profitability: { score: profitabilityScore.score, details: profitabilityScore.details },
      expenseRatio: { score: expenseRatioScore.score, details: expenseRatioScore.details },
      receivables: { score: receivablesScore.score, details: receivablesScore.details },
      cashFlow: { score: cashFlowScore.score, details: cashFlowScore.details },
      inventory: { score: inventoryScore.score, details: inventoryScore.details }
    });

    return response.status(200).json({
      success: true,
      msg: ['Business performance score calculated successfully', 'व्यापार प्रदर्शन स्कोर सफलतापूर्वक गणना की गई', 'व्यवसाय कामगिरी स्कोर यशस्वीरित्या मोजले'],
      data: {
        month_year: month_year,
        overall_score: overallScore,
        metrics: {
          daily_entries: dailyEntriesScore,
          profitability: profitabilityScore,
          expense_ratio: expenseRatioScore,
          receivables: receivablesScore,
          cash_flow: cashFlowScore,
          inventory: inventoryScore
        },
        overall_recommendations: {
          whyLow: overallRecommendations.whyLow,
          howToImprove: overallRecommendations.howToImprove
        }
      }
    });

  } catch (error) {
    console.error('Error calculating business performance:', error);
    return response.status(200).json({
      success: false,
      msg: ['Error calculating performance score', 'प्रदर्शन स्कोर गणना में त्रुटि', 'कामगिरी स्कोर मोजण्यात त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Fetch Aggregated Financial Data
 * optimized single query for all financial metrics
 */
const fetchAggregatedFinancialData = (user_id, account_id, year, month) => {
  return new Promise((resolve, reject) => {
    // Calculate last day of month for receivables overdue check
    const lastDayOfMonth = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');

    const query = `
      SELECT 
        -- Daily Entries
        COUNT(DISTINCT DATE(createtime)) as active_days,
        COUNT(*) as total_entries,

        -- Profitability & Expense Ratio & Cash Flow
        SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as total_expense,
        
        -- Cash Flow Specific (Immediate Income)
        SUM(CASE WHEN type = 2 AND DATE(createtime) = DATE(updatetime) THEN amount ELSE 0 END) as immediate_income,

        -- Receivables / Collections
        SUM(CASE WHEN type = 3 AND receivable_payable = 1 THEN amount ELSE 0 END) as total_receivables,
        SUM(CASE WHEN type = 3 AND receivable_payable = 1 AND due_date IS NOT NULL AND due_date <= ? THEN amount ELSE 0 END) as overdue_receivables,
        COUNT(CASE WHEN type = 3 AND receivable_payable = 1 THEN 1 END) as total_receivable_count,
        COUNT(CASE WHEN type = 3 AND receivable_payable = 1 AND due_date IS NOT NULL AND due_date <= ? THEN 1 END) as overdue_count

      FROM expense_income_master 
      WHERE user_id = ? AND account_id = ? 
      AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
      AND delete_flag = 0
    `;

    connection.query(query, [lastDayOfMonth, lastDayOfMonth, user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || {});
    });
  });
};

/**
 * Fetch Inventory Data
 */
const fetchInventoryData = (user_id, account_id, year, month) => {
  return new Promise((resolve, reject) => {
    const monthYear = `${year}-${month}`;
    const stockQuery = `
      SELECT 
        opening_stock,
        closing_stock,
        (SELECT SUM(purchase_amount) FROM purchase_stock 
         WHERE user_id = ? AND account_id = ? 
         AND YEAR(purchase_date) = ? AND MONTH(purchase_date) = ?) as total_purchases
      FROM monthly_stock_ledger 
      WHERE user_id = ? AND account_id = ? AND month_year = ?
    `;

    connection.query(stockQuery, [user_id, account_id, year, month, user_id, account_id, monthYear], (err, result) => {
      if (err) return reject(err);
      resolve(result[0] || null);
    });
  });
};

/**
 * Calculate Daily Entries Score (Synchronous)
 */
const calculateDailyEntriesScore = (data, totalDays) => {
  const activeDays = parseInt(data.active_days) || 0;
  const totalEntries = parseInt(data.total_entries) || 0;

  const entryFrequency = totalDays > 0 ? activeDays / totalDays : 0;
  const avgEntriesPerDay = totalDays > 0 ? totalEntries / totalDays : 0;

  let score = 0;
  if (entryFrequency >= 0.9) score = 100;
  else if (entryFrequency >= 0.8) score = 90;
  else if (entryFrequency >= 0.7) score = 80;
  else if (entryFrequency >= 0.6) score = 70;
  else if (entryFrequency >= 0.5) score = 60;
  else if (entryFrequency >= 0.4) score = 50;
  else if (entryFrequency >= 0.3) score = 40;
  else if (entryFrequency >= 0.2) score = 30;
  else if (entryFrequency >= 0.1) score = 20;
  else if (entryFrequency > 0) score = 10;
  else score = 0;

  return {
    score: Math.round(score),
    details: {
      active_days: activeDays,
      total_entries: totalEntries,
      total_days: totalDays,
      entry_frequency: Math.round(entryFrequency * 100) / 100,
      avg_entries_per_day: Math.round(avgEntriesPerDay * 100) / 100
    }
  };
};

/**
 * Calculate Profitability Score (Synchronous)
 */
const calculateProfitabilityScore = (data) => {
  const totalIncome = parseFloat(data.total_income) || 0;
  const totalExpense = parseFloat(data.total_expense) || 0;
  const profit = totalIncome - totalExpense;

  if (totalIncome === 0 && totalExpense === 0) {
    return {
      score: 50,
      details: {
        total_income: 0,
        total_expense: 0,
        profit: 0,
        gross_margin_percentage: 0,
        message: 'No transactions recorded'
      }
    };
  }

  let grossMargin = 0;
  let lossMargin = 0;

  if (totalIncome > 0) {
    const expenseRatio = Math.min(100, (totalExpense / totalIncome) * 100);
    grossMargin = Math.max(0, 100 - expenseRatio);
    if (totalExpense > totalIncome) {
      lossMargin = Math.min(100, ((totalExpense - totalIncome) / totalExpense) * 100);
    }
  } else if (totalExpense > 0) {
    grossMargin = 0;
    lossMargin = 100;
  } else { // Income > 0, Expense = 0
    grossMargin = 100;
    lossMargin = 0;
  }

  let score = 0;
  if (grossMargin >= 50) score = 100;
  else if (grossMargin >= 40) score = 90;
  else if (grossMargin >= 30) score = 80;
  else if (grossMargin >= 20) score = 70;
  else if (grossMargin >= 15) score = 60;
  else if (grossMargin >= 10) score = 50;
  else if (grossMargin >= 5) score = 40;
  else if (grossMargin > 0) score = 30;
  else if (lossMargin > 50) score = 0;
  else if (lossMargin > 20) score = 10;
  else if (lossMargin > 0) score = 20;
  else score = 30;

  return {
    score: Math.round(score),
    details: {
      total_income: totalIncome,
      total_expense: totalExpense,
      profit: profit,
      gross_margin_percentage: Math.round(grossMargin * 100) / 100,
      loss_margin_percentage: Math.round(lossMargin * 100) / 100
    }
  };
};

/**
 * Calculate Expense Ratio Score (Synchronous)
 */
const calculateExpenseRatioScore = (data) => {
  const totalIncome = parseFloat(data.total_income) || 0;
  const totalExpense = parseFloat(data.total_expense) || 0;

  if (totalIncome === 0 && totalExpense === 0) {
    return {
      score: 50,
      details: {
        total_income: 0,
        total_expense: 0,
        expense_ratio_percentage: 0,
        message: 'No transactions recorded'
      }
    };
  }

  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : (totalExpense > 0 ? 100 : 0);

  let score = 0;
  if (expenseRatio <= 30) score = 100;
  else if (expenseRatio <= 40) score = 90;
  else if (expenseRatio <= 50) score = 80;
  else if (expenseRatio <= 60) score = 70;
  else if (expenseRatio <= 70) score = 60;
  else if (expenseRatio <= 80) score = 50;
  else if (expenseRatio <= 90) score = 40;
  else if (expenseRatio <= 100) score = 30;
  else if (expenseRatio <= 120) score = 20;
  else score = 0;

  return {
    score: Math.round(score),
    details: {
      total_income: totalIncome,
      total_expense: totalExpense,
      expense_ratio_percentage: Math.round(expenseRatio * 100) / 100
    }
  };
};

/**
 * Calculate Receivables Score (Synchronous)
 */
const calculateReceivablesScore = (data) => {
  const totalReceivables = parseFloat(data.total_receivables) || 0;
  const overdueReceivables = parseFloat(data.overdue_receivables) || 0;
  const overduePercentage = totalReceivables > 0 ? (overdueReceivables / totalReceivables) * 100 : 0;

  let score = 0;
  if (totalReceivables === 0) {
    return {
      score: 100,
      details: {
        total_receivables: 0,
        overdue_receivables: 0,
        overdue_percentage: 0,
        total_receivable_count: 0,
        overdue_count: 0,
        message: 'No receivables recorded'
      }
    };
  } else if (overduePercentage === 0) score = 100;
  else if (overduePercentage <= 5) score = 90;
  else if (overduePercentage <= 10) score = 80;
  else if (overduePercentage <= 15) score = 70;
  else if (overduePercentage <= 20) score = 60;
  else if (overduePercentage <= 30) score = 50;
  else if (overduePercentage <= 40) score = 40;
  else if (overduePercentage <= 50) score = 30;
  else if (overduePercentage <= 70) score = 20;
  else score = 10;

  return {
    score: Math.round(score),
    details: {
      total_receivables: totalReceivables,
      overdue_receivables: overdueReceivables,
      overdue_percentage: Math.round(overduePercentage * 100) / 100,
      total_receivable_count: parseInt(data.total_receivable_count) || 0,
      overdue_count: parseInt(data.overdue_count) || 0
    }
  };
};

/**
 * Calculate Cash Flow Score (Synchronous)
 */
const calculateCashFlowScore = (data, totalDays) => {
  const totalIncome = parseFloat(data.total_income) || 0;
  const totalExpense = parseFloat(data.total_expense) || 0;

  if (totalIncome === 0 && totalExpense === 0) {
    return {
      score: 50,
      details: {
        total_income: 0,
        total_expense: 0,
        net_cash_flow: 0,
        cash_flow_ratio: 0,
        active_days: parseInt(data.active_days) || 0,
        message: 'No transactions recorded'
      }
    };
  }

  const netCashFlow = totalIncome - totalExpense;
  const cashFlowRatio = totalExpense > 0 ? (totalIncome / totalExpense) : (totalIncome > 0 ? 2 : 0);
  const activeDays = parseInt(data.active_days) || 0;

  let score = 0;
  if (netCashFlow > 0 && cashFlowRatio >= 1.5) score = 100;
  else if (netCashFlow > 0 && cashFlowRatio >= 1.2) score = 90;
  else if (netCashFlow > 0 && cashFlowRatio >= 1.1) score = 80;
  else if (netCashFlow > 0 && cashFlowRatio >= 1.05) score = 70;
  else if (netCashFlow > 0) score = 60;
  else if (netCashFlow >= -totalExpense * 0.1) score = 50;
  else if (netCashFlow >= -totalExpense * 0.2) score = 40;
  else if (netCashFlow >= -totalExpense * 0.3) score = 30;
  else if (netCashFlow >= -totalExpense * 0.5) score = 20;
  else score = 10;

  return {
    score: Math.round(score),
    details: {
      total_income: totalIncome,
      total_expense: totalExpense,
      net_cash_flow: netCashFlow,
      cash_flow_ratio: Math.round(cashFlowRatio * 100) / 100,
      active_days: activeDays
    }
  };
};

/**
 * Calculate Inventory Score (Synchronous)
 */
const calculateInventoryScore = (data) => {
  if (!data) {
    return {
      score: 50,
      details: {
        opening_stock: 0,
        closing_stock: 0,
        total_purchases: 0,
        stock_sold: 0,
        turnover_ratio: 0,
        message: 'No stock data available'
      }
    };
  }

  const openingStock = parseFloat(data.opening_stock) || 0;
  const closingStock = parseFloat(data.closing_stock) || 0;
  const totalPurchases = parseFloat(data.total_purchases) || 0;
  const stockSold = openingStock + totalPurchases - closingStock;
  const averageStock = (openingStock + closingStock) / 2;
  const turnoverRatio = averageStock > 0 ? (stockSold / averageStock) : (stockSold > 0 ? 10 : 0);

  let score = 0;
  if (openingStock === 0 && totalPurchases === 0) {
    score = 50;
  } else if (turnoverRatio >= 4) score = 100;
  else if (turnoverRatio >= 3) score = 90;
  else if (turnoverRatio >= 2) score = 80;
  else if (turnoverRatio >= 1.5) score = 70;
  else if (turnoverRatio >= 1) score = 60;
  else if (turnoverRatio >= 0.5) score = 50;
  else if (turnoverRatio >= 0.3) score = 40;
  else if (turnoverRatio >= 0.1) score = 30;
  else if (turnoverRatio > 0) score = 20;
  else score = 10;

  return {
    score: Math.round(score),
    details: {
      opening_stock: openingStock,
      closing_stock: closingStock,
      total_purchases: totalPurchases,
      stock_sold: stockSold,
      average_stock: averageStock,
      turnover_ratio: Math.round(turnoverRatio * 100) / 100
    }
  };
};

/**
 * Get Overall Recommendations from Individual Metrics
 * Prioritizes low-scoring metrics and combines their recommendations
 * Returns 3-5 points for whyLow and howToImprove
 * Each metric contributes exactly 1 point to both whyLow and howToImprove
 */
const getOverallRecommendationsFromMetrics = (metrics) => {
  // Define metric names mapping
  const metricNames = {
    dailyEntries: 'Daily Entries',
    profitability: 'Profitability',
    expenseRatio: 'Expense Ratio',
    receivables: 'Collections',
    cashFlow: 'Cash Flow',
    inventory: 'Stock Turnover'
  };

  // Create array of metrics with their scores and sort by score (low to high)
  const metricsArray = [
    { key: 'daily_entries', name: metricNames.dailyEntries, score: metrics.dailyEntries.score, details: metrics.dailyEntries.details },
    { key: 'profitability', name: metricNames.profitability, score: metrics.profitability.score, details: metrics.profitability.details },
    { key: 'expense_ratio', name: metricNames.expenseRatio, score: metrics.expenseRatio.score, details: metrics.expenseRatio.details },
    { key: 'receivables', name: metricNames.receivables, score: metrics.receivables.score, details: metrics.receivables.details },
    { key: 'cash_flow', name: metricNames.cashFlow, score: metrics.cashFlow.score, details: metrics.cashFlow.details },
    { key: 'inventory', name: metricNames.inventory, score: metrics.inventory.score, details: metrics.inventory.details }
  ];

  // Sort by score (lowest first) and filter out high scores (>= 80)
  // Only metrics with score < 80 are included - score 80 and above are excluded
  const lowScoringMetrics = metricsArray
    .filter(m => m.score < 80)
    .sort((a, b) => a.score - b.score);

  // If all metrics are good (>= 80), use overall recommendations
  if (lowScoringMetrics.length === 0) {
    const overallRecs = getRecommendationForScore(80, 'overall', null);
    return {
      whyLow: overallRecs.whyLow.slice(0, 5),
      howToImprove: overallRecs.howToImprove.slice(0, 5)
    };
  }

  // Collect recommendations from low-scoring metrics (prioritizing lowest scores)
  const whyLowPoints = [];
  const howToImprovePoints = [];

  // Get recommendations for each low-scoring metric
  // Only process metrics with score < 80 (double-check for safety)
  for (const metric of lowScoringMetrics) {
    // Extra safety check: skip any metric with score >= 80
    if (metric.score >= 80) {
      continue;
    }

    const recs = getRecommendationForScore(metric.score, metric.key, metric.details);

    // Add 1 point from each metric (first point from recommendations)

    // Add whyLow point
    if (whyLowPoints.length < 5 && recs.whyLow && recs.whyLow.length > 0) {
      whyLowPoints.push(recs.whyLow[0]);
    }

    // Add howToImprove point
    if (howToImprovePoints.length < 5 && recs.howToImprove && recs.howToImprove.length > 0) {
      howToImprovePoints.push(recs.howToImprove[0]);
    }

    // Stop if we have enough points
    if (whyLowPoints.length >= 5 && howToImprovePoints.length >= 5) {
      break;
    }
  }

  // Ensure we have at least 3 points, max 5
  const finalWhyLow = whyLowPoints.slice(0, 5);
  const finalHowToImprove = howToImprovePoints.slice(0, 5);

  // If we have less than 3 points, add from overall recommendations
  if (finalWhyLow.length < 3) {
    const overallRecs = getRecommendationForScore(
      lowScoringMetrics[0].score,
      'overall',
      null
    );
    const needed = 3 - finalWhyLow.length;
    finalWhyLow.push(...overallRecs.whyLow.slice(0, needed));
  }

  if (finalHowToImprove.length < 3) {
    const overallRecs = getRecommendationForScore(
      lowScoringMetrics[0].score,
      'overall',
      null
    );
    const needed = 3 - finalHowToImprove.length;
    finalHowToImprove.push(...overallRecs.howToImprove.slice(0, needed));
  }

  return {
    whyLow: finalWhyLow.slice(0, 5),
    howToImprove: finalHowToImprove.slice(0, 5)
  };
};

/**
 * Get recommendation text for a specific score and metric type
 */
const getRecommendationForScore = (score, metricType, details = null) => {
  // Check for zero data case (score 50 with message indicating no data)
  if (score === 50 && details && details.message && (details.message.includes('No transactions') || details.message.includes('No stock data'))) {
    return getZeroDataRecommendations(metricType);
  }

  // Check for zero receivables case (score 100 but no receivables)
  if (score === 100 && details && details.message && details.message.includes('No receivables')) {
    return getZeroDataRecommendations('receivables');
  }

  // Calculate interval key: 
  // 0-10 -> 0, 11-20 -> 10, 21-30 -> 20, ..., 91-100 -> 90
  let key;
  if (score <= 10) {
    key = 0;
  } else if (score <= 20) {
    key = 10;
  } else if (score <= 30) {
    key = 20;
  } else if (score <= 40) {
    key = 30;
  } else if (score <= 50) {
    key = 40;
  } else if (score <= 60) {
    key = 50;
  } else if (score <= 70) {
    key = 60;
  } else if (score <= 80) {
    key = 70;
  } else if (score <= 90) {
    key = 80;
  } else {
    key = 90; // 91-100
  }

  const recommendations = {
    daily_entries: getDailyEntriesRecommendations(),
    profitability: getProfitabilityRecommendations(),
    expense_ratio: getExpenseRatioRecommendations(),
    receivables: getReceivablesRecommendations(),
    cash_flow: getCashFlowRecommendations(),
    inventory: getInventoryRecommendations(),
    overall: getOverallRecommendations()
  };

  const metricRecs = recommendations[metricType] || recommendations['overall'];
  return metricRecs[key] || metricRecs[90];
};

/**
 * Get recommendations for zero data cases
 */
const getZeroDataRecommendations = (metricType) => {
  const zeroDataRecs = {
    profitability: {
      whyLow: [
        'No income or expense transactions recorded this month',
        'No profitability data available',
        'Business activity not tracked',
        'No financial transactions entered',
        'Start recording transactions to calculate profitability'
      ],
      howToImprove: [
        'Start recording income transactions',
        'Enter all expense transactions',
        'Track all business financial activities',
        'Record transactions daily for accurate profitability',
        'Begin logging business transactions to see profitability metrics'
      ]
    },
    expense_ratio: {
      whyLow: [
        'No income or expense transactions recorded',
        'Expense ratio cannot be calculated without data',
        'No financial activity tracked',
        'Missing transaction data',
        'Start tracking expenses and income'
      ],
      howToImprove: [
        'Record all income transactions',
        'Enter all expense transactions',
        'Track financial activities regularly',
        'Maintain daily expense and income records',
        'Begin logging transactions to calculate expense ratio'
      ]
    },
    cash_flow: {
      whyLow: [
        'No cash flow data available',
        'No income or expense transactions recorded',
        'Cash flow cannot be calculated without transactions',
        'Missing financial activity data',
        'No transactions to analyze cash flow'
      ],
      howToImprove: [
        'Start recording income transactions',
        'Enter all expense transactions',
        'Track cash inflows and outflows',
        'Maintain regular transaction entries',
        'Begin logging transactions to track cash flow'
      ]
    },
    inventory: {
      whyLow: [
        'No stock data available',
        'Inventory management not set up',
        'No stock transactions recorded',
        'Missing inventory data',
        'Stock tracking not initiated'
      ],
      howToImprove: [
        'Set up opening stock for the month',
        'Record stock purchases',
        'Track inventory movements',
        'Enter stock transactions regularly',
        'Begin managing inventory through the app'
      ]
    },
    daily_entries: {
      whyLow: [
        'No daily entries recorded this month',
        'Daily transaction tracking is completely missing',
        'No data discipline in maintaining records',
        'Transactions are not being entered regularly',
        'Business activity is not being documented'
      ],
      howToImprove: [
        'Start entering transactions daily, even small ones',
        'Set a daily reminder to update your records',
        'Use the app every day to log income and expenses',
        'Make it a habit to record transactions immediately',
        'Track every rupee that comes in or goes out'
      ]
    },
    receivables: {
      whyLow: [
        'No receivables recorded this month',
        'Udhari/credit transactions not tracked',
        'No outstanding receivables data',
        'Credit management not initiated',
        'Receivables tracking not set up'
      ],
      howToImprove: [
        'Start recording credit transactions',
        'Track amounts given on credit',
        'Monitor receivables regularly',
        'Set due dates for credit transactions',
        'Begin managing receivables through the app'
      ]
    },
    overall: {
      whyLow: [
        'No business data recorded this month',
        'Limited transaction tracking',
        'Business activity not documented',
        'Missing financial data',
        'Start tracking to see overall performance'
      ],
      howToImprove: [
        'Begin recording all business transactions',
        'Track income and expenses daily',
        'Set up inventory management if applicable',
        'Monitor receivables and payables',
        'Maintain consistent data entry for better insights'
      ]
    }
  };

  return zeroDataRecs[metricType] || zeroDataRecs['overall'];
};

/**
 * Daily Entries Completeness Recommendations
 */
const getDailyEntriesRecommendations = () => {
  return {
    0: {
      whyLow: [
        'No daily entries recorded this month',
        'Daily transaction tracking is completely missing',
        'No data discipline in maintaining records',
        'Transactions are not being entered regularly',
        'Business activity is not being documented'
      ],
      howToImprove: [
        'Start entering transactions daily, even small ones',
        'Set a daily reminder to update your records',
        'Use the app every day to log income and expenses',
        'Make it a habit to record transactions immediately',
        'Track every rupee that comes in or goes out'
      ]
    },
    10: {
      whyLow: [
        'Very few entries recorded (less than 10% of days)',
        'Daily transaction tracking is minimal',
        'Most business activities are not documented',
        'Irregular entry pattern',
        'Poor data discipline'
      ],
      howToImprove: [
        'Increase entry frequency to at least 3-4 days per week',
        'Record transactions as they happen, not later',
        'Set specific times daily to update records',
        'Track all cash and digital transactions',
        'Review and enter pending transactions weekly'
      ]
    },
    20: {
      whyLow: [
        'Low entry frequency (10-20% of days)',
        'Missing entries on most days',
        'Inconsistent transaction recording',
        'Many business activities go undocumented',
        'Poor tracking discipline'
      ],
      howToImprove: [
        'Aim to enter transactions on at least 5 days per week',
        'Record both income and expenses daily',
        'Use quick entry feature for faster logging',
        'Set multiple reminders throughout the day',
        'Make entry a part of your daily routine'
      ]
    },
    30: {
      whyLow: [
        'Entry frequency needs improvement (20-30% of days)',
        'Missing entries on majority of days',
        'Inconsistent daily tracking',
        'Many transactions not recorded on time',
        'Data discipline needs strengthening'
      ],
      howToImprove: [
        'Target recording transactions on 6-7 days per week',
        'Enter transactions at end of each business day',
        'Keep a small notebook for quick notes, enter later',
        'Use app notifications to remind yourself',
        'Focus on consistency over perfection'
      ]
    },
    40: {
      whyLow: [
        'Moderate entry frequency (30-40% of days)',
        'Some days missing transaction entries',
        'Irregular tracking pattern',
        'Inconsistent data discipline',
        'Room for improvement in daily entries'
      ],
      howToImprove: [
        'Increase to daily entries on 7-8 days per week',
        'Record transactions at fixed times daily',
        'Don\'t skip weekends if business is active',
        'Review and fill any missed entries weekly',
        'Maintain entry streak for better discipline'
      ]
    },
    50: {
      whyLow: [
        'Fair entry frequency (40-50% of days)',
        'Some inconsistency in daily tracking',
        'Missing entries on some business days',
        'Data discipline is average',
        'Could improve entry regularity'
      ],
      howToImprove: [
        'Aim for entries on 80-90% of days',
        'Make entry a non-negotiable daily task',
        'Set aside 5 minutes daily for transaction entry',
        'Track all transactions, big or small',
        'Review missed entries and backfill them'
      ]
    },
    60: {
      whyLow: [
        'Good entry frequency (50-60% of days)',
        'Minor gaps in daily tracking',
        'Some days without entries',
        'Data discipline is improving',
        'Close to consistent tracking'
      ],
      howToImprove: [
        'Target entries on 90%+ of days',
        'Maintain current good habits',
        'Fill in any remaining gaps',
        'Keep up the daily entry momentum',
        'Aim for zero missed days'
      ]
    },
    70: {
      whyLow: [
        'Good entry frequency (60-70% of days)',
        'Most days have entries recorded',
        'Minor inconsistencies remain',
        'Data discipline is good',
        'Small improvements needed for excellence'
      ],
      howToImprove: [
        'Aim for 95%+ daily entry consistency',
        'Maintain the good tracking habits',
        'Fill remaining small gaps',
        'Keep daily entry routine consistent',
        'Strive for near-perfect tracking'
      ]
    },
    80: {
      whyLow: [
        'Very good entry frequency (70-80% of days)',
        'Excellent daily tracking discipline',
        'Most transactions are recorded',
        'Strong data management',
        'Near-perfect entry consistency'
      ],
      howToImprove: [
        'Maintain this excellent entry frequency',
        'Continue daily entry habit',
        'Keep records updated in real-time',
        'Maintain consistency across all days',
        'You\'re doing great, keep it up!'
      ]
    },
    90: {
      whyLow: [
        'Excellent entry frequency (80-90% of days)',
        'Outstanding daily tracking discipline',
        'Nearly all transactions recorded',
        'Excellent data management',
        'Very consistent entry pattern'
      ],
      howToImprove: [
        'Maintain this excellent consistency',
        'Continue the great daily entry habit',
        'Keep up the excellent work',
        'You\'re maintaining excellent discipline',
        'Perfect example of good data management'
      ]
    },
    100: {
      whyLow: [
        'Perfect entry frequency (90%+ of days)',
        'Outstanding daily tracking discipline',
        'All transactions recorded regularly',
        'Perfect data management',
        'Excellent consistency'
      ],
      howToImprove: [
        'Continue maintaining this perfect consistency',
        'Keep up the excellent daily entry habit',
        'You\'re setting a great example',
        'Maintain this level of discipline',
        'Perfect tracking - keep it up!'
      ]
    }
  };
};

/**
 * Profitability Recommendations
 */
const getProfitabilityRecommendations = () => {
  return {
    0: {
      whyLow: [
        'Very high losses this month',
        'Expenses exceed income significantly',
        'Business is running at a major loss',
        'Profit margin is deeply negative',
        'Urgent attention needed to profitability'
      ],
      howToImprove: [
        'Review and cut unnecessary expenses immediately',
        'Increase prices if possible to improve margins',
        'Focus on high-margin products/services',
        'Reduce operational costs wherever possible',
        'Consider consulting for cost optimization strategies'
      ]
    },
    10: {
      whyLow: [
        'High losses this month',
        'Expenses are much higher than income',
        'Profit margin is very negative',
        'Business struggling with profitability',
        'Significant financial losses'
      ],
      howToImprove: [
        'Identify and eliminate unnecessary expenses',
        'Negotiate better rates with suppliers',
        'Increase revenue through better pricing',
        'Focus on profitable products/services only',
        'Create a cost reduction plan'
      ]
    },
    20: {
      whyLow: [
        'Moderate losses this month',
        'Expenses exceeding income',
        'Negative profit margin',
        'Business needs profitability improvement',
        'Cost structure needs optimization'
      ],
      howToImprove: [
        'Reduce variable costs where possible',
        'Increase income through new sales channels',
        'Review pricing strategy for better margins',
        'Cut down on non-essential expenses',
        'Focus on cost control and revenue growth'
      ]
    },
    30: {
      whyLow: [
        'Small losses this month',
        'Profit margin is very low or negative',
        'Income barely covers expenses',
        'Profitability needs improvement',
        'Margins are too tight'
      ],
      howToImprove: [
        'Aim for at least 5% profit margin',
        'Increase prices gradually where possible',
        'Reduce costs without affecting quality',
        'Focus on high-margin offerings',
        'Improve operational efficiency'
      ]
    },
    40: {
      whyLow: [
        'Low profit margin (0-5%)',
        'Very tight profitability',
        'Income slightly above expenses',
        'Profit margins need improvement',
        'Business is barely profitable'
      ],
      howToImprove: [
        'Target profit margin of 10-15%',
        'Review pricing to improve margins',
        'Optimize cost structure',
        'Increase revenue through better sales',
        'Focus on value-added services'
      ]
    },
    50: {
      whyLow: [
        'Moderate profit margin (5-10%)',
        'Profitability is acceptable but low',
        'Room for margin improvement',
        'Could increase profitability further',
        'Margins are moderate'
      ],
      howToImprove: [
        'Aim for 15-20% profit margin',
        'Review pricing strategy',
        'Optimize product mix for better margins',
        'Reduce unnecessary costs',
        'Focus on high-margin products'
      ]
    },
    60: {
      whyLow: [
        'Good profit margin (10-15%)',
        'Profitability is decent',
        'Margins are reasonable',
        'Some improvement possible',
        'Business is profitable'
      ],
      howToImprove: [
        'Target 20-25% profit margin',
        'Continue optimizing costs',
        'Focus on premium offerings',
        'Improve operational efficiency',
        'Maintain and grow profitability'
      ]
    },
    70: {
      whyLow: [
        'Very good profit margin (15-20%)',
        'Strong profitability',
        'Healthy margins',
        'Good financial performance',
        'Business is doing well'
      ],
      howToImprove: [
        'Maintain current profit margins',
        'Continue cost optimization',
        'Explore opportunities for margin expansion',
        'Maintain pricing discipline',
        'Keep up the good financial management'
      ]
    },
    80: {
      whyLow: [
        'Excellent profit margin (20-30%)',
        'Outstanding profitability',
        'Very healthy margins',
        'Excellent financial performance',
        'Strong business profitability'
      ],
      howToImprove: [
        'Maintain excellent profit margins',
        'Continue the great financial management',
        'Keep optimizing operations',
        'Maintain pricing discipline',
        'You\'re doing excellent work!'
      ]
    },
    90: {
      whyLow: [
        'Outstanding profit margin (30-40%)',
        'Exceptional profitability',
        'Excellent margins',
        'Outstanding financial performance',
        'Very strong profitability'
      ],
      howToImprove: [
        'Maintain outstanding margins',
        'Continue excellent financial practices',
        'Keep up the great work',
        'Maintain this level of profitability',
        'Perfect example of good business management'
      ]
    },
    100: {
      whyLow: [
        'Exceptional profit margin (40%+)',
        'Perfect profitability',
        'Outstanding margins',
        'Exceptional financial performance',
        'Excellent profitability management'
      ],
      howToImprove: [
        'Continue maintaining exceptional margins',
        'Keep up the outstanding financial management',
        'You\'re setting a perfect example',
        'Maintain this level of excellence',
        'Perfect profitability - excellent work!'
      ]
    }
  };
};

/**
 * Expense Ratio Recommendations
 */
const getExpenseRatioRecommendations = () => {
  return {
    0: {
      whyLow: [
        'Expenses are extremely high relative to income',
        'Expense ratio exceeds 120% of income',
        'Spending is out of control',
        'Very high expense to income ratio',
        'Urgent expense management needed'
      ],
      howToImprove: [
        'Immediately cut non-essential expenses',
        'Review all expenses and eliminate unnecessary ones',
        'Negotiate better rates with vendors',
        'Reduce operational costs drastically',
        'Create strict budget and stick to it'
      ]
    },
    10: {
      whyLow: [
        'Expenses are very high (100-120% of income)',
        'Expense ratio is dangerously high',
        'Spending exceeds or equals income',
        'Poor expense control',
        'High expense to income ratio'
      ],
      howToImprove: [
        'Cut down expenses by at least 20%',
        'Review and eliminate unnecessary spending',
        'Focus on essential expenses only',
        'Negotiate better deals with suppliers',
        'Implement strict cost control measures'
      ]
    },
    20: {
      whyLow: [
        'Expenses are high (90-100% of income)',
        'Expense ratio is very high',
        'Spending is close to income level',
        'Tight expense control needed',
        'High expense ratio'
      ],
      howToImprove: [
        'Reduce expenses to 80% of income',
        'Identify and cut unnecessary costs',
        'Review recurring expenses for savings',
        'Optimize operational costs',
        'Improve expense management'
      ]
    },
    30: {
      whyLow: [
        'Expenses are moderate-high (80-90% of income)',
        'Expense ratio needs improvement',
        'Spending is high relative to income',
        'Expense control can be better',
        'Moderate expense ratio'
      ],
      howToImprove: [
        'Aim to reduce expenses to 70% of income',
        'Review and optimize all expense categories',
        'Cut down on non-essential spending',
        'Negotiate better rates',
        'Improve expense tracking and control'
      ]
    },
    40: {
      whyLow: [
        'Expenses are moderate (70-80% of income)',
        'Expense ratio is acceptable but high',
        'Room for expense optimization',
        'Could reduce expenses further',
        'Moderate expense control'
      ],
      howToImprove: [
        'Target expenses at 60% of income',
        'Review expense categories for savings',
        'Optimize operational costs',
        'Focus on cost efficiency',
        'Improve expense management practices'
      ]
    },
    50: {
      whyLow: [
        'Expenses are reasonable (60-70% of income)',
        'Expense ratio is decent',
        'Good expense control',
        'Some optimization possible',
        'Reasonable expense ratio'
      ],
      howToImprove: [
        'Aim for expenses at 50% of income',
        'Continue optimizing costs',
        'Maintain good expense discipline',
        'Review opportunities for savings',
        'Keep improving expense efficiency'
      ]
    },
    60: {
      whyLow: [
        'Expenses are good (50-60% of income)',
        'Expense ratio is healthy',
        'Good expense management',
        'Well-controlled spending',
        'Healthy expense ratio'
      ],
      howToImprove: [
        'Target expenses at 40% of income',
        'Continue maintaining good expense control',
        'Keep optimizing where possible',
        'Maintain expense discipline',
        'Excellent expense management'
      ]
    },
    70: {
      whyLow: [
        'Expenses are very good (40-50% of income)',
        'Excellent expense ratio',
        'Strong expense control',
        'Well-managed spending',
        'Very healthy expense ratio'
      ],
      howToImprove: [
        'Maintain expenses at current level',
        'Continue excellent expense management',
        'Keep up the good cost control',
        'Maintain expense discipline',
        'You\'re managing expenses excellently'
      ]
    },
    80: {
      whyLow: [
        'Expenses are excellent (30-40% of income)',
        'Outstanding expense ratio',
        'Excellent expense control',
        'Very well-managed spending',
        'Outstanding expense management'
      ],
      howToImprove: [
        'Maintain excellent expense ratio',
        'Continue outstanding expense management',
        'Keep up the great cost control',
        'Maintain this level of efficiency',
        'Perfect expense management'
      ]
    },
    90: {
      whyLow: [
        'Expenses are outstanding (20-30% of income)',
        'Perfect expense ratio',
        'Exceptional expense control',
        'Perfectly managed spending',
        'Exceptional expense efficiency'
      ],
      howToImprove: [
        'Maintain outstanding expense ratio',
        'Continue exceptional expense management',
        'Keep up the perfect cost control',
        'Maintain this level of excellence',
        'Perfect example of expense management'
      ]
    },
    100: {
      whyLow: [
        'Expenses are perfect (less than 20% of income)',
        'Ideal expense ratio',
        'Perfect expense control',
        'Excellent spending management',
        'Perfect expense efficiency'
      ],
      howToImprove: [
        'Continue maintaining perfect expense ratio',
        'Keep up the exceptional expense management',
        'You\'re setting a perfect example',
        'Maintain this level of excellence',
        'Perfect expense control - excellent work!'
      ]
    }
  };
};

/**
 * Receivables/Collections Recommendations
 */
const getReceivablesRecommendations = () => {
  return {
    0: {
      whyLow: [
        'Very high overdue receivables (70%+)',
        'Most receivables are past due',
        'Poor collection management',
        'High risk of bad debts',
        'Urgent collection action needed'
      ],
      howToImprove: [
        'Immediately follow up on all overdue amounts',
        'Set strict payment terms for new customers',
        'Offer early payment discounts',
        'Use reminder features to collect dues',
        'Consider payment plans for large amounts'
      ]
    },
    10: {
      whyLow: [
        'High overdue receivables (50-70%)',
        'Many receivables are past due',
        'Collection management needs improvement',
        'Significant collection delays',
        'High overdue percentage'
      ],
      howToImprove: [
        'Follow up on overdue amounts daily',
        'Set clear payment deadlines',
        'Send payment reminders regularly',
        'Consider stricter credit terms',
        'Focus on collecting old dues first'
      ]
    },
    20: {
      whyLow: [
        'Moderate-high overdue receivables (40-50%)',
        'Many receivables overdue',
        'Collection process needs improvement',
        'Delayed payments are common',
        'High overdue ratio'
      ],
      howToImprove: [
        'Improve collection follow-up process',
        'Set and enforce payment deadlines',
        'Use app reminders for collections',
        'Offer incentives for early payment',
        'Review credit terms for new customers'
      ]
    },
    30: {
      whyLow: [
        'Moderate overdue receivables (30-40%)',
        'Some receivables are overdue',
        'Collection management needs attention',
        'Payment delays are occurring',
        'Moderate overdue percentage'
      ],
      howToImprove: [
        'Follow up on overdue amounts weekly',
        'Set clear due dates for all receivables',
        'Send payment reminders before due date',
        'Improve collection tracking',
        'Focus on timely collections'
      ]
    },
    40: {
      whyLow: [
        'Some overdue receivables (20-30%)',
        'Collection management is improving',
        'Some payment delays',
        'Room for collection improvement',
        'Moderate collection efficiency'
      ],
      howToImprove: [
        'Aim to reduce overdue to less than 15%',
        'Set automatic reminders for due dates',
        'Follow up on approaching deadlines',
        'Improve collection follow-up',
        'Maintain better collection discipline'
      ]
    },
    50: {
      whyLow: [
        'Moderate collection efficiency (15-20% overdue)',
        'Some receivables need attention',
        'Collection management is decent',
        'Minor payment delays',
        'Acceptable overdue ratio'
      ],
      howToImprove: [
        'Target overdue receivables below 10%',
        'Improve collection follow-up process',
        'Set reminders for all due dates',
        'Focus on timely collections',
        'Maintain better collection tracking'
      ]
    },
    60: {
      whyLow: [
        'Good collection efficiency (10-15% overdue)',
        'Most receivables are collected on time',
        'Good collection management',
        'Minor overdue amounts',
        'Healthy collection ratio'
      ],
      howToImprove: [
        'Aim for overdue below 5%',
        'Continue good collection practices',
        'Maintain timely follow-ups',
        'Keep improving collection process',
        'Maintain collection discipline'
      ]
    },
    70: {
      whyLow: [
        'Very good collection efficiency (5-10% overdue)',
        'Excellent collection management',
        'Most payments collected timely',
        'Strong collection process',
        'Very healthy collection ratio'
      ],
      howToImprove: [
        'Target overdue below 5%',
        'Continue excellent collection practices',
        'Maintain timely follow-ups',
        'Keep up the good collection discipline',
        'Excellent collection management'
      ]
    },
    80: {
      whyLow: [
        'Excellent collection efficiency (2-5% overdue)',
        'Outstanding collection management',
        'Nearly all payments collected on time',
        'Excellent collection process',
        'Outstanding collection ratio'
      ],
      howToImprove: [
        'Maintain excellent collection efficiency',
        'Continue outstanding collection practices',
        'Keep up the great collection discipline',
        'Maintain this level of efficiency',
        'Perfect collection management'
      ]
    },
    90: {
      whyLow: [
        'Outstanding collection efficiency (0-2% overdue)',
        'Perfect collection management',
        'All payments collected timely',
        'Exceptional collection process',
        'Near-perfect collection ratio'
      ],
      howToImprove: [
        'Maintain outstanding collection efficiency',
        'Continue perfect collection practices',
        'Keep up the excellent collection discipline',
        'Maintain this level of excellence',
        'Perfect example of collection management'
      ]
    },
    100: {
      whyLow: [
        'Perfect collection efficiency (0% overdue)',
        'Ideal collection management',
        'All receivables collected on time',
        'Perfect collection process',
        'Ideal collection ratio'
      ],
      howToImprove: [
        'Continue maintaining perfect collection efficiency',
        'Keep up the exceptional collection practices',
        'You\'re setting a perfect example',
        'Maintain this level of excellence',
        'Perfect collection management - excellent work!'
      ]
    }
  };
};

/**
 * Cash Flow Recommendations
 */
const getCashFlowRecommendations = () => {
  return {
    0: {
      whyLow: [
        'Very negative cash flow',
        'Cash outflow much higher than inflow',
        'Severe cash flow problems',
        'Business facing cash crunch',
        'Urgent cash flow improvement needed'
      ],
      howToImprove: [
        'Immediately reduce expenses',
        'Accelerate collection of receivables',
        'Delay non-essential payments',
        'Increase income sources',
        'Create emergency cash flow plan'
      ]
    },
    10: {
      whyLow: [
        'Highly negative cash flow',
        'Cash outflow significantly exceeds inflow',
        'Serious cash flow issues',
        'Business struggling with cash',
        'High negative cash flow'
      ],
      howToImprove: [
        'Cut down expenses drastically',
        'Focus on collecting receivables faster',
        'Improve payment terms',
        'Increase revenue generation',
        'Manage cash flow more carefully'
      ]
    },
    20: {
      whyLow: [
        'Negative cash flow',
        'Cash outflow exceeds inflow',
        'Cash flow problems',
        'Business needs cash flow improvement',
        'Negative cash position'
      ],
      howToImprove: [
        'Reduce expenses to improve cash flow',
        'Speed up collection of payments',
        'Optimize payment cycles',
        'Increase income sources',
        'Better cash flow management needed'
      ]
    },
    30: {
      whyLow: [
        'Moderate negative cash flow',
        'Tight cash flow situation',
        'Cash flow needs improvement',
        'Income slightly below expenses',
        'Cash flow is constrained'
      ],
      howToImprove: [
        'Aim for positive cash flow',
        'Improve collection efficiency',
        'Reduce unnecessary expenses',
        'Increase revenue streams',
        'Better cash flow planning needed'
      ]
    },
    40: {
      whyLow: [
        'Small negative cash flow',
        'Tight cash flow',
        'Cash flow slightly negative',
        'Income close to expenses',
        'Cash flow needs improvement'
      ],
      howToImprove: [
        'Target positive cash flow',
        'Improve income to expense ratio',
        'Better cash flow management',
        'Optimize payment and collection cycles',
        'Focus on cash flow improvement'
      ]
    },
    50: {
      whyLow: [
        'Neutral cash flow',
        'Cash flow is balanced',
        'Income equals expenses',
        'Cash flow is stable but tight',
        'Room for cash flow improvement'
      ],
      howToImprove: [
        'Aim for positive cash flow',
        'Increase income to exceed expenses',
        'Improve cash flow margin',
        'Better cash flow planning',
        'Target 10-20% positive cash flow'
      ]
    },
    60: {
      whyLow: [
        'Positive cash flow',
        'Income exceeds expenses',
        'Good cash flow position',
        'Healthy cash flow',
        'Decent cash flow margin'
      ],
      howToImprove: [
        'Maintain positive cash flow',
        'Aim for higher cash flow margin',
        'Continue good cash management',
        'Improve cash flow ratio further',
        'Maintain healthy cash position'
      ]
    },
    70: {
      whyLow: [
        'Very good cash flow',
        'Strong positive cash flow',
        'Excellent cash flow position',
        'Healthy cash flow margin',
        'Good cash flow management'
      ],
      howToImprove: [
        'Maintain strong cash flow',
        'Continue excellent cash management',
        'Keep up the good cash flow practices',
        'Maintain positive cash flow margin',
        'Excellent cash flow management'
      ]
    },
    80: {
      whyLow: [
        'Excellent cash flow',
        'Outstanding positive cash flow',
        'Very healthy cash position',
        'Strong cash flow margin',
        'Excellent cash flow management'
      ],
      howToImprove: [
        'Maintain excellent cash flow',
        'Continue outstanding cash management',
        'Keep up the great cash flow practices',
        'Maintain this level of cash efficiency',
        'Perfect cash flow management'
      ]
    },
    90: {
      whyLow: [
        'Outstanding cash flow',
        'Exceptional positive cash flow',
        'Perfect cash position',
        'Excellent cash flow margin',
        'Exceptional cash flow management'
      ],
      howToImprove: [
        'Maintain outstanding cash flow',
        'Continue exceptional cash management',
        'Keep up the perfect cash flow practices',
        'Maintain this level of excellence',
        'Perfect example of cash flow management'
      ]
    },
    100: {
      whyLow: [
        'Perfect cash flow',
        'Ideal positive cash flow',
        'Excellent cash position',
        'Perfect cash flow margin',
        'Perfect cash flow management'
      ],
      howToImprove: [
        'Continue maintaining perfect cash flow',
        'Keep up the exceptional cash management',
        'You\'re setting a perfect example',
        'Maintain this level of excellence',
        'Perfect cash flow - excellent work!'
      ]
    }
  };
};

/**
 * Inventory Turnover Recommendations
 */
const getInventoryRecommendations = () => {
  return {
    0: {
      whyLow: [
        'No stock movement or very low turnover',
        'Stock is not being sold',
        'Inventory is stagnant',
        'Very poor stock turnover',
        'Inventory management needs urgent attention'
      ],
      howToImprove: [
        'Focus on selling existing stock',
        'Reduce stock holding levels',
        'Improve sales efforts',
        'Clear slow-moving inventory',
        'Optimize inventory levels'
      ]
    },
    10: {
      whyLow: [
        'Very low stock turnover (less than 0.1)',
        'Stock movement is minimal',
        'Inventory is mostly stagnant',
        'Poor inventory efficiency',
        'Very low turnover ratio'
      ],
      howToImprove: [
        'Increase sales to improve turnover',
        'Reduce stock purchase until current stock sells',
        'Focus on selling existing inventory',
        'Clear old stock through promotions',
        'Improve inventory management'
      ]
    },
    20: {
      whyLow: [
        'Low stock turnover (0.1-0.3)',
        'Stock movement is slow',
        'Inventory turnover needs improvement',
        'Stock is moving slowly',
        'Low turnover efficiency'
      ],
      howToImprove: [
        'Aim for turnover ratio of 0.5 or higher',
        'Improve sales velocity',
        'Reduce stock holding period',
        'Focus on fast-moving items',
        'Better inventory management needed'
      ]
    },
    30: {
      whyLow: [
        'Moderate-low stock turnover (0.3-0.5)',
        'Stock movement is moderate',
        'Inventory turnover can be better',
        'Room for turnover improvement',
        'Moderate turnover efficiency'
      ],
      howToImprove: [
        'Target turnover ratio of 1.0 or higher',
        'Increase sales frequency',
        'Optimize stock levels',
        'Focus on popular items',
        'Improve inventory rotation'
      ]
    },
    40: {
      whyLow: [
        'Moderate stock turnover (0.5-1.0)',
        'Stock movement is acceptable',
        'Inventory turnover is decent',
        'Some improvement possible',
        'Moderate turnover ratio'
      ],
      howToImprove: [
        'Aim for turnover ratio of 1.5 or higher',
        'Improve sales efforts',
        'Optimize inventory mix',
        'Focus on high-turnover items',
        'Better inventory planning'
      ]
    },
    50: {
      whyLow: [
        'Fair stock turnover (1.0-1.5)',
        'Stock movement is reasonable',
        'Inventory turnover is acceptable',
        'Good turnover efficiency',
        'Fair turnover ratio'
      ],
      howToImprove: [
        'Target turnover ratio of 2.0 or higher',
        'Continue improving sales',
        'Optimize stock levels',
        'Maintain good inventory rotation',
        'Improve turnover efficiency'
      ]
    },
    60: {
      whyLow: [
        'Good stock turnover (1.5-2.0)',
        'Stock movement is good',
        'Inventory turnover is healthy',
        'Good turnover efficiency',
        'Healthy turnover ratio'
      ],
      howToImprove: [
        'Aim for turnover ratio of 2.5 or higher',
        'Continue good inventory management',
        'Maintain sales momentum',
        'Optimize inventory levels',
        'Excellent inventory management'
      ]
    },
    70: {
      whyLow: [
        'Very good stock turnover (2.0-2.5)',
        'Stock movement is excellent',
        'Inventory turnover is strong',
        'Very good turnover efficiency',
        'Strong turnover ratio'
      ],
      howToImprove: [
        'Target turnover ratio of 3.0 or higher',
        'Continue excellent inventory management',
        'Maintain strong sales',
        'Keep up good inventory rotation',
        'Excellent inventory efficiency'
      ]
    },
    80: {
      whyLow: [
        'Excellent stock turnover (2.5-3.0)',
        'Stock movement is outstanding',
        'Inventory turnover is excellent',
        'Excellent turnover efficiency',
        'Outstanding turnover ratio'
      ],
      howToImprove: [
        'Maintain excellent turnover ratio',
        'Continue outstanding inventory management',
        'Keep up the great inventory rotation',
        'Maintain this level of efficiency',
        'Perfect inventory management'
      ]
    },
    90: {
      whyLow: [
        'Outstanding stock turnover (3.0-4.0)',
        'Stock movement is perfect',
        'Inventory turnover is exceptional',
        'Perfect turnover efficiency',
        'Exceptional turnover ratio'
      ],
      howToImprove: [
        'Maintain outstanding turnover ratio',
        'Continue exceptional inventory management',
        'Keep up the perfect inventory rotation',
        'Maintain this level of excellence',
        'Perfect example of inventory management'
      ]
    },
    100: {
      whyLow: [
        'Perfect stock turnover (4.0+)',
        'Ideal stock movement',
        'Perfect inventory turnover',
        'Ideal turnover efficiency',
        'Perfect inventory management'
      ],
      howToImprove: [
        'Continue maintaining perfect turnover',
        'Keep up the exceptional inventory management',
        'You\'re setting a perfect example',
        'Maintain this level of excellence',
        'Perfect inventory turnover - excellent work!'
      ]
    }
  };
};

/**
 * Overall Recommendations
 */
const getOverallRecommendations = () => {
  return {
    0: {
      whyLow: [
        'Overall performance is very poor',
        'Multiple areas need urgent attention',
        'Business performance is critically low',
        'Immediate improvements needed across all metrics',
        'Comprehensive business improvement required'
      ],
      howToImprove: [
        'Focus on daily entry discipline first',
        'Improve profitability by reducing expenses',
        'Better cash flow management needed',
        'Work on collection efficiency',
        'Comprehensive business improvement plan required'
      ]
    },
    10: {
      whyLow: [
        'Overall performance is poor',
        'Most areas need significant improvement',
        'Business performance is low',
        'Multiple improvements needed',
        'Substantial business improvement required'
      ],
      howToImprove: [
        'Start with daily entry consistency',
        'Focus on profitability improvement',
        'Better expense management needed',
        'Improve collection processes',
        'Create comprehensive improvement plan'
      ]
    },
    20: {
      whyLow: [
        'Overall performance needs major improvement',
        'Several areas require attention',
        'Business performance is below average',
        'Multiple improvements needed',
        'Significant business improvement required'
      ],
      howToImprove: [
        'Improve daily entry frequency',
        'Focus on increasing profitability',
        'Better expense control needed',
        'Work on collection efficiency',
        'Prioritize high-impact improvements'
      ]
    },
    30: {
      whyLow: [
        'Overall performance is below average',
        'Several areas need improvement',
        'Business performance needs attention',
        'Multiple areas require work',
        'Moderate business improvement needed'
      ],
      howToImprove: [
        'Increase daily entry consistency',
        'Focus on profitability enhancement',
        'Improve expense management',
        'Better collection processes',
        'Work on all key metrics systematically'
      ]
    },
    40: {
      whyLow: [
        'Overall performance is average',
        'Some areas need improvement',
        'Business performance is moderate',
        'Room for improvement in several areas',
        'Steady improvement needed'
      ],
      howToImprove: [
        'Maintain daily entry discipline',
        'Continue improving profitability',
        'Better expense optimization',
        'Improve collection efficiency',
        'Focus on consistent improvement'
      ]
    },
    50: {
      whyLow: [
        'Overall performance is fair',
        'Business performance is decent',
        'Some areas performing well',
        'Gradual improvement possible',
        'Good foundation with room for growth'
      ],
      howToImprove: [
        'Maintain consistent daily entries',
        'Continue profitability improvement',
        'Optimize expense management',
        'Enhance collection processes',
        'Focus on systematic improvements'
      ]
    },
    60: {
      whyLow: [
        'Overall performance is good',
        'Business performance is healthy',
        'Most areas performing well',
        'Minor improvements possible',
        'Good business management'
      ],
      howToImprove: [
        'Maintain excellent daily entry habits',
        'Continue strong profitability',
        'Keep expense management optimized',
        'Maintain good collection efficiency',
        'Focus on maintaining excellence'
      ]
    },
    70: {
      whyLow: [
        'Overall performance is very good',
        'Business performance is strong',
        'Most areas performing excellently',
        'Minor enhancements possible',
        'Excellent business management'
      ],
      howToImprove: [
        'Maintain perfect daily entry consistency',
        'Continue excellent profitability',
        'Maintain optimal expense management',
        'Keep up excellent collection efficiency',
        'Maintain high performance standards'
      ]
    },
    80: {
      whyLow: [
        'Overall performance is excellent',
        'Business performance is outstanding',
        'All areas performing very well',
        'Maintaining excellence',
        'Outstanding business management'
      ],
      howToImprove: [
        'Continue maintaining perfect daily entries',
        'Maintain excellent profitability',
        'Keep expense management optimal',
        'Continue excellent collection efficiency',
        'Maintain outstanding performance levels'
      ]
    },
    90: {
      whyLow: [
        'Overall performance is outstanding',
        'Business performance is exceptional',
        'All areas performing excellently',
        'Near-perfect business management',
        'Exceptional overall performance'
      ],
      howToImprove: [
        'Maintain perfect daily entry consistency',
        'Continue exceptional profitability',
        'Maintain perfect expense management',
        'Keep up perfect collection efficiency',
        'Continue exceptional performance'
      ]
    },
    100: {
      whyLow: [
        'Overall performance is perfect',
        'Business performance is ideal',
        'All areas performing perfectly',
        'Perfect business management',
        'Ideal overall performance'
      ],
      howToImprove: [
        'Continue maintaining perfect consistency',
        'Keep up exceptional profitability',
        'Maintain perfect expense management',
        'Continue perfect collection efficiency',
        'Perfect business management - excellent work!'
      ]
    }
  };
};

export {
  getBusinessPerformanceScore
};

