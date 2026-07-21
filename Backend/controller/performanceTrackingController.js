import connection from '../connection/dbConfig.js';
import languageMessage from './languageMessage.js';
import moment from 'moment-timezone';
import Joi from 'joi';

// Validation schemas
const calculatePerformanceSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  account_id: Joi.number().integer().positive().required(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional()
});

const getPerformanceSchema = Joi.object({
  user_id: Joi.number().integer().positive().required(),
  account_id: Joi.number().integer().positive().optional(),
  month_year: Joi.string().pattern(/^\d{4}-\d{2}$/).optional()
});

// Helper function to get current month in YYYY-MM format
const getCurrentMonth = () => moment().format('YYYY-MM');

// Helper function to get previous month
const getPreviousMonth = (monthYear) => {
  return moment(monthYear + '-01').subtract(1, 'month').format('YYYY-MM');
};

// Helper function to get last 6 months
const getLast6Months = (monthYear) => {
  const months = [];
  const current = moment(monthYear + '-01');
  for (let i = 5; i >= 0; i--) {
    months.push(current.clone().subtract(i, 'month').format('YYYY-MM'));
  }
  return months;
};

/**
 * Calculate Profitability Score (30% weight)
 * Formula: (Net Profit / Total Income) * 100
 */
const calculateProfitabilityScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    const query = `
            SELECT 
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as total_expense,
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as net_profit
            FROM expense_income_master 
            WHERE user_id = ? AND account_id = ? 
            AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
            AND delete_flag = 0 AND type IN (1, 2)
        `;

    connection.query(query, [user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);

      const data = result[0];
      const totalIncome = parseFloat(data.total_income) || 0;
      const totalExpense = parseFloat(data.total_expense) || 0;
      const netProfit = parseFloat(data.net_profit) || 0;

      let score = 0;
      let profitMargin = 0;
      let lossMargin = 0;

      // Calculate profit margin in 0-100% range based on income and expense ratio
      if (totalIncome > 0) {
        // Calculate expense ratio: (expenses / income) * 100, capped at 100%
        const expenseRatio = Math.min(100, (totalExpense / totalIncome) * 100);
        // Profit margin = 100 - expense ratio (0-100% range)
        // When expenses = 0, profit margin = 100%
        // When expenses >= income, profit margin = 0%
        profitMargin = Math.max(0, 100 - expenseRatio);

        // Calculate loss margin: 0% when expenses <= income, otherwise ((expenses - income) / expenses) * 100, capped at 100%
        if (totalExpense > totalIncome) {
          lossMargin = Math.min(100, ((totalExpense - totalIncome) / totalExpense) * 100);
        }

        // Scale profit margin to 0-30 points
        score = Math.min(30, Math.max(0, (profitMargin / 15) * 30)); // 15% margin = 30 points
      } else if (totalExpense > 0 && totalIncome === 0) {
        // When there's no income but there are expenses, profit margin = 0%, loss margin = 100%
        profitMargin = 0;
        lossMargin = 100;
        score = 0;
      } else if (totalIncome > 0 && totalExpense === 0) {
        // When there's income but no expenses, profit margin = 100%, loss margin = 0%
        profitMargin = 100;
        lossMargin = 0;
        score = 30; // Max score for 100% margin
      }

      resolve({
        score: Math.round(score * 100) / 100,
        totalIncome,
        totalExpense,
        netProfit,
        profitMargin: Math.round(profitMargin * 100) / 100,
        lossMargin: Math.round(lossMargin * 100) / 100
      });
    });
  });
};

/**
 * Calculate Cash Flow Consistency Score (20% weight)
 * Positive monthly cash flow = higher score
 */
const calculateCashFlowConsistencyScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const last6Months = getLast6Months(month_year);
    const placeholders = last6Months.map(() => '?').join(',');

    const query = `
            SELECT 
                DATE_FORMAT(createtime, '%Y-%m') as month_year,
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as monthly_income,
                SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as monthly_expense,
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as monthly_cash_flow
            FROM expense_income_master 
            WHERE user_id = ? AND account_id = ? 
            AND DATE_FORMAT(createtime, '%Y-%m') IN (${placeholders})
            AND delete_flag = 0 AND type IN (1, 2)
            GROUP BY DATE_FORMAT(createtime, '%Y-%m')
            ORDER BY month_year
        `;

    connection.query(query, [user_id, account_id, ...last6Months], (err, result) => {
      if (err) return reject(err);

      let positiveMonths = 0;
      let totalMonths = 0;
      const monthlyFlows = [];

      result.forEach(row => {
        const cashFlow = parseFloat(row.monthly_cash_flow) || 0;
        monthlyFlows.push({
          month: row.month_year,
          income: parseFloat(row.monthly_income) || 0,
          expense: parseFloat(row.monthly_expense) || 0,
          cashFlow
        });

        if (cashFlow > 0) positiveMonths++;
        totalMonths++;
      });

      const consistencyPercentage = totalMonths > 0 ? (positiveMonths / totalMonths) * 100 : 0;
      const score = (consistencyPercentage / 100) * 20; // Scale to 20 points

      resolve({
        score: Math.round(score * 100) / 100,
        positiveMonths,
        totalMonths,
        consistencyPercentage: Math.round(consistencyPercentage * 100) / 100,
        monthlyFlows
      });
    });
  });
};

/**
 * Calculate Expense Control Score (20% weight)
 * Formula: Essential Expenses / Total Expenses
 */
const calculateExpenseControlScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    // First, get all expense categories to determine which are essential
    // Note: If is_essential column doesn't exist, we'll treat all expenses as non-essential
    const categoryQuery = `
            SELECT c.category_id, c.category_name, 
                   SUM(e.amount) as total_amount
            FROM expense_income_master e
            LEFT JOIN category_master c ON e.category_id = c.category_id
            WHERE e.user_id = ? AND e.account_id = ? 
            AND YEAR(e.createtime) = ? AND MONTH(e.createtime) = ? 
            AND e.type = 1 AND e.delete_flag = 0
            GROUP BY c.category_id, c.category_name
        `;

    connection.query(categoryQuery, [user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);

      let essentialExpenses = 0;
      let totalExpenses = 0;
      const expenseBreakdown = [];

      result.forEach(row => {
        const amount = parseFloat(row.total_amount) || 0;
        totalExpenses += amount;

        // Since is_essential column doesn't exist, we'll use a simple heuristic:
        // Consider basic categories as essential (you can customize this logic)
        const essentialCategories = ['food', 'rent', 'utilities', 'transport', 'medical', 'education', 'groceries', 'electricity', 'water', 'gas', 'basic', 'necessary'];
        const categoryName = (row.category_name || '').toLowerCase();
        const isEssential = essentialCategories.some(essential => categoryName.includes(essential)) ? 1 : 0;

        expenseBreakdown.push({
          category_id: row.category_id,
          category_name: row.category_name,
          amount,
          is_essential: isEssential
        });

        // If category is marked as essential, add to essential expenses
        if (isEssential === 1) {
          essentialExpenses += amount;
        }
      });

      let score = 0;
      let essentialPercentage = 0;

      if (totalExpenses > 0) {
        essentialPercentage = (essentialExpenses / totalExpenses) * 100;
        // Higher essential expenses percentage = better score
        // 80%+ essential = full points, 40% essential = 0 points
        score = Math.min(20, Math.max(0, ((essentialPercentage - 40) / 40) * 20));
      }

      resolve({
        score: Math.round(score * 100) / 100,
        essentialExpenses,
        totalExpenses,
        essentialPercentage: Math.round(essentialPercentage * 100) / 100,
        expenseBreakdown
      });
    });
  });
};

/**
 * Calculate Debt & Credit Health Score (15% weight)
 * Loan repayment on time, no overdue → full marks
 */
const calculateDebtCreditHealthScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    const query = `
            SELECT 
                SUM(CASE WHEN type = 3 AND receivable_payable = 1 THEN amount ELSE 0 END) as total_receivable,
                SUM(CASE WHEN type = 3 AND receivable_payable = 2 THEN amount ELSE 0 END) as total_payable,
                COUNT(CASE WHEN type = 3 AND receivable_payable = 1 THEN 1 END) as receivable_count,
                COUNT(CASE WHEN type = 3 AND receivable_payable = 2 THEN 1 END) as payable_count
            FROM expense_income_master 
            WHERE user_id = ? AND account_id = ? 
            AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
            AND delete_flag = 0 AND type = 3
        `;

    connection.query(query, [user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);

      const data = result[0];
      const totalReceivable = parseFloat(data.total_receivable) || 0;
      const totalPayable = parseFloat(data.total_payable) || 0;
      const receivableCount = parseInt(data.receivable_count) || 0;
      const payableCount = parseInt(data.payable_count) || 0;

      let score = 15; // Start with full points

      // Deduct points for high debt ratios
      const totalIncomeQuery = `
                SELECT SUM(amount) as total_income
                FROM expense_income_master 
                WHERE user_id = ? AND account_id = ? 
                AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
                AND type = 2 AND delete_flag = 0
            `;

      connection.query(totalIncomeQuery, [user_id, account_id, year, month], (incomeErr, incomeResult) => {
        if (incomeErr) return reject(incomeErr);

        const totalIncome = parseFloat(incomeResult[0].total_income) || 1;
        const debtToIncomeRatio = totalPayable / totalIncome;

        // Deduct points based on debt-to-income ratio
        if (debtToIncomeRatio > 0.5) score -= 8; // High debt
        else if (debtToIncomeRatio > 0.3) score -= 5; // Medium debt
        else if (debtToIncomeRatio > 0.1) score -= 2; // Low debt

        // Bonus points for good receivables
        if (totalReceivable > totalPayable) score += 2;

        score = Math.max(0, Math.min(15, score));

        resolve({
          score: Math.round(score * 100) / 100,
          totalReceivable,
          totalPayable,
          receivableCount,
          payableCount,
          debtToIncomeRatio: Math.round(debtToIncomeRatio * 100) / 100
        });
      });
    });
  });
};

/**
 * Calculate Stock Turnover Score (10% weight)
 * (Sold Stock / Purchased Stock) - Higher turnover = better score
 */
const calculateStockTurnoverScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    // Get stock purchases from purchase_stock table
    const purchaseQuery = `
            SELECT SUM(purchase_amount) as total_purchases
            FROM purchase_stock 
            WHERE user_id = ? AND account_id = ? 
            AND YEAR(purchase_date) = ? AND MONTH(purchase_date) = ?
        `;

    connection.query(purchaseQuery, [user_id, account_id, year, month], (purchaseErr, purchaseResult) => {
      if (purchaseErr) return reject(purchaseErr);

      const totalPurchases = parseFloat(purchaseResult[0].total_purchases) || 0;

      // Get stock sales (income from stock-related categories or general income)
      const salesQuery = `
                SELECT SUM(e.amount) as total_sales
                FROM expense_income_master e
                LEFT JOIN category_master c ON e.category_id = c.category_id
                WHERE e.user_id = ? AND e.account_id = ? 
                AND YEAR(e.createtime) = ? AND MONTH(e.createtime) = ? 
                AND e.type = 2 AND e.delete_flag = 0
                AND (c.category_name LIKE '%stock%' OR c.category_name LIKE '%sale%' OR c.category_name LIKE '%revenue%')
            `;

      connection.query(salesQuery, [user_id, account_id, year, month], (salesErr, salesResult) => {
        if (salesErr) return reject(salesErr);

        const totalSales = parseFloat(salesResult[0].total_sales) || 0;

        let turnoverRatio = 0;
        let score = 0;

        if (totalPurchases > 0) {
          turnoverRatio = totalSales / totalPurchases;
          // Higher turnover ratio = better score (max 10 points)
          score = Math.min(10, turnoverRatio * 5); // 2x turnover = 10 points
        } else if (totalSales > 0) {
          // If no purchases but has sales, give partial credit
          score = 5;
        }

        resolve({
          score: Math.round(score * 100) / 100,
          totalPurchases,
          totalSales,
          turnoverRatio: Math.round(turnoverRatio * 100) / 100
        });
      });
    });
  });
};

/**
 * Calculate Timely Collections Score (5% weight)
 * If customers clear dues within credit period → good
 */
const calculateTimelyCollectionsScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    const query = `
            SELECT 
                e.expense_income_id,
                e.amount,
                e.due_date,
                e.createtime,
                e.receivable_payable,
                c.customer_name
            FROM expense_income_master e
            LEFT JOIN udhari_customer_master c ON e.customer_id = c.udhari_customer_id AND c.delete_flag = 0
            WHERE e.user_id = ? AND e.account_id = ? 
            AND YEAR(e.createtime) = ? AND MONTH(e.createtime) = ? 
            AND e.type = 3 AND e.delete_flag = 0
            AND e.receivable_payable = 1
        `;

    connection.query(query, [user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);

      let timelyCollections = 0;
      let totalCollections = 0;
      const collectionDetails = [];

      result.forEach(row => {
        totalCollections++;

        if (row.due_date) {
          const dueDate = moment(row.due_date);
          const createdAt = moment(row.createtime);
          const creditPeriod = dueDate.diff(createdAt, 'days');

          // Assume 30 days is the standard credit period
          const standardCreditPeriod = 30;

          collectionDetails.push({
            customer_name: row.customer_name,
            amount: parseFloat(row.amount),
            credit_period: creditPeriod,
            is_timely: creditPeriod <= standardCreditPeriod
          });

          if (creditPeriod <= standardCreditPeriod) {
            timelyCollections++;
          }
        } else {
          // No due date set, assume timely
          timelyCollections++;
          collectionDetails.push({
            customer_name: row.customer_name,
            amount: parseFloat(row.amount),
            credit_period: null,
            is_timely: true
          });
        }
      });

      const timelyPercentage = totalCollections > 0 ? (timelyCollections / totalCollections) * 100 : 100;
      const score = (timelyPercentage / 100) * 5; // Scale to 5 points

      resolve({
        score: Math.round(score * 100) / 100,
        timelyCollections,
        totalCollections,
        timelyPercentage: Math.round(timelyPercentage * 100) / 100,
        collectionDetails
      });
    });
  });
};

/**
 * Calculate Daily Entry Score (10 points)
 * Based on frequency of daily entries
 */
const calculateDailyEntryScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    const query = `
            SELECT 
                COUNT(DISTINCT DATE(createtime)) as active_days,
                COUNT(*) as total_entries
            FROM expense_income_master 
            WHERE user_id = ? AND account_id = ? 
            AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
            AND delete_flag = 0
        `;

    connection.query(query, [user_id, account_id, year, month], (err, result) => {
      if (err) return reject(err);

      const data = result[0];
      const activeDays = parseInt(data.active_days) || 0;
      const totalEntries = parseInt(data.total_entries) || 0;

      // Calculate total days in the month using moment for accuracy
      const totalDays = moment(month_year, 'YYYY-MM').daysInMonth();

      const entryFrequency = activeDays / totalDays;
      const avgEntriesPerDay = totalDays > 0 ? totalEntries / totalDays : 0;

      // Score based on entry frequency (0-10 points)
      let score = 0;
      if (entryFrequency >= 0.8) score = 10; // 80%+ days active
      else if (entryFrequency >= 0.6) score = 8; // 60-80% days active
      else if (entryFrequency >= 0.4) score = 6; // 40-60% days active
      else if (entryFrequency >= 0.2) score = 4; // 20-40% days active
      else if (entryFrequency > 0) score = 2; // Some entries
      else score = 0; // No entries

      resolve({
        score: Math.round(score * 100) / 100,
        activeDays,
        totalEntries,
        totalDays,
        entryFrequency: Math.round(entryFrequency * 100) / 100,
        avgEntriesPerDay: Math.round(avgEntriesPerDay * 100) / 100
      });
    });
  });
};

/**
 * Calculate Budget Usage Score (10 points)
 * Based on budget utilization and adherence
 */
const calculateBudgetUsageScore = async (user_id, account_id, month_year) => {
  return new Promise((resolve, reject) => {
    const [year, month] = month_year.split('-');

    // Get user's budgets for the month
    const budgetQuery = `
            SELECT budget_id, amount, duration, budget_type, category_id
            FROM budget_master 
            WHERE user_id = ? AND account_id = ? 
            AND delete_flag = 0
        `;

    connection.query(budgetQuery, [user_id, account_id], async (budgetErr, budgetResult) => {
      if (budgetErr) return reject(budgetErr);

      if (budgetResult.length === 0) {
        return resolve({
          score: 0,
          budgetCount: 0,
          totalBudgetAmount: 0,
          totalActualExpense: 0,
          budgetUtilization: 0,
          budgetDetails: []
        });
      }

      try {
        let totalBudgetAmount = 0;
        let totalActualExpense = 0;

        // Process each budget using Promise.all to handle nested async queries
        const budgetDetails = await Promise.all(budgetResult.map(budget => {
          return new Promise((budResolve, budReject) => {
            const budgetAmount = parseFloat(budget.amount);
            totalBudgetAmount += budgetAmount;

            let actualExpenseQuery = `
                        SELECT SUM(amount) as actual_expense
                        FROM expense_income_master 
                        WHERE user_id = ? AND account_id = ? 
                        AND YEAR(createtime) = ? AND MONTH(createtime) = ? 
                        AND type = 1 AND delete_flag = 0
                    `;

            const queryParams = [user_id, account_id, year, month];

            if (budget.budget_type === 2 && budget.category_id) {
              actualExpenseQuery += ` AND category_id = ?`;
              queryParams.push(budget.category_id);
            }

            connection.query(actualExpenseQuery, queryParams, (expenseErr, expenseResult) => {
              if (expenseErr) return budReject(expenseErr);

              const actualExpense = parseFloat(expenseResult[0].actual_expense) || 0;
              totalActualExpense += actualExpense;

              const utilization = budgetAmount > 0 ? (actualExpense / budgetAmount) * 100 : 0;

              budResolve({
                budget_id: budget.budget_id,
                budget_amount: budgetAmount,
                actual_expense: actualExpense,
                utilization: Math.round(utilization * 100) / 100,
                is_within_budget: actualExpense <= budgetAmount
              });
            });
          });
        }));

        // Calculate overall score
        const budgetUtilization = totalBudgetAmount > 0 ? (totalActualExpense / totalBudgetAmount) * 100 : 0;

        let score = 0;
        if (budgetUtilization <= 90) score = 10; // Within 90% of budget
        else if (budgetUtilization <= 100) score = 8; // Within budget
        else if (budgetUtilization <= 110) score = 6; // Slightly over budget
        else if (budgetUtilization <= 120) score = 4; // Over budget
        else score = 2; // Significantly over budget

        resolve({
          score: Math.round(score * 100) / 100,
          budgetCount: budgetResult.length,
          totalBudgetAmount,
          totalActualExpense,
          budgetUtilization: Math.round(budgetUtilization * 100) / 100,
          budgetDetails
        });
      } catch (err) {
        reject(err);
      }
    });
  });
};

/**
 * Calculate overall performance grade
 */
const calculatePerformanceGrade = (totalScore) => {
  if (totalScore >= 80) return 'Excellent';
  if (totalScore >= 60) return 'Good';
  if (totalScore >= 40) return 'Fair';
  return 'Poor';
};

/**
 * Main function to calculate comprehensive performance score
 */
const calculateUserPerformanceScore = async (user_id, account_id, month_year = null) => {
  try {
    const targetMonth = month_year || getCurrentMonth();

    // Calculate all individual scores
    const [
      profitability,
      cashFlow,
      expenseControl,
      debtHealth,
      stockTurnover,
      timelyCollections,
      dailyEntry,
      budgetUsage
    ] = await Promise.all([
      calculateProfitabilityScore(user_id, account_id, targetMonth),
      calculateCashFlowConsistencyScore(user_id, account_id, targetMonth),
      calculateExpenseControlScore(user_id, account_id, targetMonth),
      calculateDebtCreditHealthScore(user_id, account_id, targetMonth),
      calculateStockTurnoverScore(user_id, account_id, targetMonth),
      calculateTimelyCollectionsScore(user_id, account_id, targetMonth),
      calculateDailyEntryScore(user_id, account_id, targetMonth),
      calculateBudgetUsageScore(user_id, account_id, targetMonth)
    ]);

    // Check for new/inactive user (Zero Data)
    const isNoData = dailyEntry.totalEntries === 0 &&
      stockTurnover.totalPurchases === 0 &&
      stockTurnover.totalSales === 0;

    // Calculate total score (average of 8 categories, each out of 100)
    // If no data, score is 0. Otherwise sum of component scores.
    const totalScore = isNoData ? 0 : Math.round((profitability.score + cashFlow.score + expenseControl.score +
      debtHealth.score + stockTurnover.score + timelyCollections.score +
      dailyEntry.score + budgetUsage.score) * 100) / 100;

    const performanceGrade = calculatePerformanceGrade(totalScore);

    // Store the performance score in database
    await storePerformanceScore(user_id, account_id, targetMonth, {
      totalScore,
      performanceGrade,
      profitability,
      cashFlow,
      expenseControl,
      debtHealth,
      stockTurnover,
      timelyCollections,
      dailyEntry,
      budgetUsage
    });

    return {
      month_year: targetMonth,
      totalScore,
      performanceGrade,
      breakdown: {
        profitability,
        cashFlow,
        expenseControl,
        debtHealth,
        stockTurnover,
        timelyCollections,
        dailyEntry,
        budgetUsage
      }
    };

  } catch (error) {
    console.error('Error calculating performance score:', error);
    throw error;
  }
};

/**
 * Store performance score in database
 */
const storePerformanceScore = async (user_id, account_id, month_year, performanceData) => {
  return new Promise((resolve, reject) => {
    const {
      totalScore,
      performanceGrade,
      profitability,
      cashFlow,
      expenseControl,
      debtHealth,
      stockTurnover,
      timelyCollections,
      dailyEntry,
      budgetUsage
    } = performanceData;

    // Insert or update performance score
    const insertQuery = `
            INSERT INTO user_performance_scores (
                user_id, account_id, month_year, total_score, performance_grade,
                profitability_score, cash_flow_consistency_score, expense_control_score,
                debt_credit_health_score, stock_turnover_score, timely_collections_score,
                daily_entry_score, budget_usage_score
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                total_score = VALUES(total_score),
                performance_grade = VALUES(performance_grade),
                profitability_score = VALUES(profitability_score),
                cash_flow_consistency_score = VALUES(cash_flow_consistency_score),
                expense_control_score = VALUES(expense_control_score),
                debt_credit_health_score = VALUES(debt_credit_health_score),
                stock_turnover_score = VALUES(stock_turnover_score),
                timely_collections_score = VALUES(timely_collections_score),
                daily_entry_score = VALUES(daily_entry_score),
                budget_usage_score = VALUES(budget_usage_score),
                last_updated = CURRENT_TIMESTAMP
        `;

    const values = [
      user_id, account_id, month_year, totalScore, performanceGrade,
      profitability.score, cashFlow.score, expenseControl.score,
      debtHealth.score, stockTurnover.score, timelyCollections.score,
      dailyEntry.score, budgetUsage.score
    ];

    connection.query(insertQuery, values, (err, result) => {
      if (err) return reject(err);

      // Store detailed metrics
      const performanceId = result.insertId || result.affectedRows;
      storePerformanceDetails(performanceId, {
        profitability,
        cashFlow,
        expenseControl,
        debtHealth,
        stockTurnover,
        timelyCollections,
        dailyEntry,
        budgetUsage
      }).then(() => resolve(result)).catch(reject);
    });
  });
};

/**
 * Store detailed performance metrics
 */
const storePerformanceDetails = async (performanceId, metrics) => {
  return new Promise((resolve, reject) => {
    const detailsQuery = `
            INSERT INTO performance_score_details (
                performance_id, profitability_metrics, cash_flow_metrics,
                expense_control_metrics, debt_credit_metrics, stock_turnover_metrics,
                collection_metrics, daily_entry_metrics, budget_usage_metrics
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                profitability_metrics = VALUES(profitability_metrics),
                cash_flow_metrics = VALUES(cash_flow_metrics),
                expense_control_metrics = VALUES(expense_control_metrics),
                debt_credit_metrics = VALUES(debt_credit_metrics),
                stock_turnover_metrics = VALUES(stock_turnover_metrics),
                collection_metrics = VALUES(collection_metrics),
                daily_entry_metrics = VALUES(daily_entry_metrics),
                budget_usage_metrics = VALUES(budget_usage_metrics),
                updatetime = CURRENT_TIMESTAMP
        `;

    const values = [
      performanceId,
      JSON.stringify(metrics.profitability),
      JSON.stringify(metrics.cashFlow),
      JSON.stringify(metrics.expenseControl),
      JSON.stringify(metrics.debtHealth),
      JSON.stringify(metrics.stockTurnover),
      JSON.stringify(metrics.timelyCollections),
      JSON.stringify(metrics.dailyEntry),
      JSON.stringify(metrics.budgetUsage)
    ];

    connection.query(detailsQuery, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
};

/**
 * API Endpoint: Calculate Performance Score for User
 */
const calculatePerformanceScore = async (request, response) => {
  try {
    const { error, value } = calculatePerformanceSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: error.details[0].message
      });
    }

    const { user_id, account_id, month_year } = value;

    // Check if user exists and is active
    const userCheckQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], async (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated,
          active_status: 0
        });
      }

      try {
        const performanceData = await calculateUserPerformanceScore(user_id, account_id, month_year);

        return response.status(200).json({
          success: true,
          msg: ['Performance score calculated successfully', 'प्रदर्शन स्कोर सफलतापूर्वक गणना की गई', 'प्रदर्शन स्कोअर यशस्वीरित्या गणना केले'],
          data: performanceData
        });

      } catch (calcError) {
        console.error('Performance calculation error:', calcError);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: calcError.message
        });
      }
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
 * API Endpoint: Get User Performance Score
 */
const getUserPerformanceScore = async (request, response) => {
  try {
    const { error, value } = getPerformanceSchema.validate(request.query);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: error.details[0].message
      });
    }

    const { user_id, account_id, month_year } = value;
    const targetMonth = month_year || getCurrentMonth();

    // Get performance score from database
    let query = `
            SELECT ups.*, psd.profitability_metrics, psd.cash_flow_metrics,
                   psd.expense_control_metrics, psd.debt_credit_metrics,
                   psd.stock_turnover_metrics, psd.collection_metrics,
                   psd.daily_entry_metrics, psd.budget_usage_metrics
            FROM user_performance_scores ups
            LEFT JOIN performance_score_details psd ON ups.performance_id = psd.performance_id
            WHERE ups.user_id = ? AND ups.month_year = ?
        `;

    const params = [user_id, targetMonth];

    if (account_id) {
      query += ` AND ups.account_id = ?`;
      params.push(account_id);
    }

    query += ` ORDER BY ups.last_updated DESC LIMIT 1`;

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
          msg: ['No performance data found for the specified period', 'निर्दिष्ट अवधि के लिए कोई प्रदर्शन डेटा नहीं मिला', 'निर्दिष्ट कालावधीसाठी कोणतेही प्रदर्शन डेटा सापडले नाही']
        });
      }

      const performanceData = result[0];

      // Parse JSON metrics
      const detailedMetrics = {};
      if (performanceData.profitability_metrics) {
        detailedMetrics.profitability = JSON.parse(performanceData.profitability_metrics);
      }
      if (performanceData.cash_flow_metrics) {
        detailedMetrics.cashFlow = JSON.parse(performanceData.cash_flow_metrics);
      }
      if (performanceData.expense_control_metrics) {
        detailedMetrics.expenseControl = JSON.parse(performanceData.expense_control_metrics);
      }
      if (performanceData.debt_credit_metrics) {
        detailedMetrics.debtHealth = JSON.parse(performanceData.debt_credit_metrics);
      }
      if (performanceData.stock_turnover_metrics) {
        detailedMetrics.stockTurnover = JSON.parse(performanceData.stock_turnover_metrics);
      }
      if (performanceData.collection_metrics) {
        detailedMetrics.timelyCollections = JSON.parse(performanceData.collection_metrics);
      }
      if (performanceData.daily_entry_metrics) {
        detailedMetrics.dailyEntry = JSON.parse(performanceData.daily_entry_metrics);
      }
      if (performanceData.budget_usage_metrics) {
        detailedMetrics.budgetUsage = JSON.parse(performanceData.budget_usage_metrics);
      }

      return response.status(200).json({
        success: true,
        msg: ['Performance data retrieved successfully', 'प्रदर्शन डेटा सफलतापूर्वक प्राप्त किया गया', 'प्रदर्शन डेटा यशस्वीरित्या पुनर्प्राप्त केले'],
        data: {
          month_year: performanceData.month_year,
          totalScore: parseFloat(performanceData.total_score),
          performanceGrade: performanceData.performance_grade,
          breakdown: {
            profitability: { score: parseFloat(performanceData.profitability_score) },
            cashFlow: { score: parseFloat(performanceData.cash_flow_consistency_score) },
            expenseControl: { score: parseFloat(performanceData.expense_control_score) },
            debtHealth: { score: parseFloat(performanceData.debt_credit_health_score) },
            stockTurnover: { score: parseFloat(performanceData.stock_turnover_score) },
            timelyCollections: { score: parseFloat(performanceData.timely_collections_score) },
            dailyEntry: { score: parseFloat(performanceData.daily_entry_score) },
            budgetUsage: { score: parseFloat(performanceData.budget_usage_score) }
          },
          detailedMetrics,
          lastUpdated: performanceData.last_updated
        }
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
 * API Endpoint: Get User Performance History
 */
const getUserPerformanceHistory = async (request, response) => {
  try {
    const { user_id, account_id, months = 12 } = request.query;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'यूजर आईडी आवश्यक है', 'वापरकर्ता आयडी आवश्यक आहे']
      });
    }

    // Get performance history for last N months
    let query = `
            SELECT month_year, total_score, performance_grade,
                   profitability_score, cash_flow_consistency_score,
                   expense_control_score, debt_credit_health_score,
                   stock_turnover_score, timely_collections_score,
                   daily_entry_score, budget_usage_score,
                   calculation_date, last_updated
            FROM user_performance_scores
            WHERE user_id = ?
        `;

    const params = [user_id];

    if (account_id) {
      query += ` AND account_id = ?`;
      params.push(account_id);
    }

    query += ` ORDER BY month_year DESC LIMIT ?`;
    params.push(parseInt(months));

    connection.query(query, params, (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: err.message
        });
      }

      return response.status(200).json({
        success: true,
        msg: ['Performance history retrieved successfully', 'प्रदर्शन इतिहास सफलतापूर्वक प्राप्त किया गया', 'प्रदर्शन इतिहास यशस्वीरित्या पुनर्प्राप्त केले'],
        data: {
          performanceHistory: result.map(row => ({
            month_year: row.month_year,
            totalScore: parseFloat(row.total_score),
            performanceGrade: row.performance_grade,
            breakdown: {
              profitability: parseFloat(row.profitability_score),
              cashFlow: parseFloat(row.cash_flow_consistency_score),
              expenseControl: parseFloat(row.expense_control_score),
              debtHealth: parseFloat(row.debt_credit_health_score),
              stockTurnover: parseFloat(row.stock_turnover_score),
              timelyCollections: parseFloat(row.timely_collections_score),
              dailyEntry: parseFloat(row.daily_entry_score),
              budgetUsage: parseFloat(row.budget_usage_score)
            },
            calculationDate: row.calculation_date,
            lastUpdated: row.last_updated
          })),
          totalMonths: result.length
        }
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
 * Feature Usage Analytics Controller
 * Tracks usage of key features across all users for admin analytics
 */

// Feature Usage Tracking Functions

/**
 * Track Income Feature Usage
 * Analyzes income entries across all users
 */
const trackIncomeUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_entries,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        COUNT(DISTINCT account_id) as accounts_used,
        DATE_FORMAT(createtime, '%Y-%m-%d') as entry_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM expense_income_master 
      WHERE type = 2 
      AND YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY entry_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      // Handle case where no data is returned
      if (!result || result.length === 0) {
        return resolve({
          feature: 'Income',
          month_year: targetMonth,
          stats: {
            unique_users: 0,
            total_entries: 0,
            total_amount: 0,
            accounts_used: 0,
            active_days: 0,
            avg_amount: 0,
            daily_breakdown: []
          }
        });
      }

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, parseInt(row.unique_users) || 0),
        total_entries: acc.total_entries + (parseInt(row.total_entries) || 0),
        total_amount: acc.total_amount + parseFloat(row.total_amount || 0),
        accounts_used: Math.max(acc.accounts_used, parseInt(row.accounts_used) || 0),
        active_days: Math.max(acc.active_days, parseInt(row.active_days) || 0)
      }), { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, active_days: 0 });

      resolve({
        feature: 'Income',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_amount: totalStats.total_entries > 0 ? totalStats.total_amount / totalStats.total_entries : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Expense Feature Usage
 * Analyzes expense entries across all users
 */
const trackExpenseUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_entries,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        COUNT(DISTINCT account_id) as accounts_used,
        COUNT(DISTINCT category_id) as categories_used,
        DATE_FORMAT(createtime, '%Y-%m-%d') as entry_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM expense_income_master 
      WHERE type = 1 
      AND YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY entry_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      // Handle case where no data is returned
      if (!result || result.length === 0) {
        return resolve({
          feature: 'Expense',
          month_year: targetMonth,
          stats: {
            unique_users: 0,
            total_entries: 0,
            total_amount: 0,
            accounts_used: 0,
            categories_used: 0,
            active_days: 0,
            avg_amount: 0,
            daily_breakdown: []
          }
        });
      }

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, parseInt(row.unique_users) || 0),
        total_entries: acc.total_entries + (parseInt(row.total_entries) || 0),
        total_amount: acc.total_amount + parseFloat(row.total_amount || 0),
        accounts_used: Math.max(acc.accounts_used, parseInt(row.accounts_used) || 0),
        categories_used: Math.max(acc.categories_used, parseInt(row.categories_used) || 0),
        active_days: Math.max(acc.active_days, parseInt(row.active_days) || 0)
      }), { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, categories_used: 0, active_days: 0 });

      resolve({
        feature: 'Expense',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_amount: totalStats.total_entries > 0 ? totalStats.total_amount / totalStats.total_entries : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Udhari (Credit/Debt) Feature Usage
 * Analyzes credit/debt entries across all users
 */
const trackUdhariUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_entries,
        SUM(amount) as total_amount,
        AVG(amount) as avg_amount,
        COUNT(DISTINCT account_id) as accounts_used,
        COUNT(DISTINCT customer_id) as customers_involved,
        SUM(CASE WHEN receivable_payable = 1 THEN amount ELSE 0 END) as total_receivable,
        SUM(CASE WHEN receivable_payable = 2 THEN amount ELSE 0 END) as total_payable,
        DATE_FORMAT(createtime, '%Y-%m-%d') as entry_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM expense_income_master 
      WHERE type = 3 
      AND YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY entry_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        total_entries: acc.total_entries + row.total_entries,
        total_amount: acc.total_amount + parseFloat(row.total_amount || 0),
        accounts_used: Math.max(acc.accounts_used, row.accounts_used),
        customers_involved: Math.max(acc.customers_involved, row.customers_involved),
        total_receivable: acc.total_receivable + parseFloat(row.total_receivable || 0),
        total_payable: acc.total_payable + parseFloat(row.total_payable || 0),
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, customers_involved: 0, total_receivable: 0, total_payable: 0, active_days: 0 });

      resolve({
        feature: 'Udhari',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_amount: totalStats.total_entries > 0 ? totalStats.total_amount / totalStats.total_entries : 0,
          net_position: totalStats.total_receivable - totalStats.total_payable,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Budget Feature Usage
 * Analyzes budget creation and management across all users
 */
const trackBudgetUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_budgets,
        SUM(amount) as total_budget_amount,
        AVG(amount) as avg_budget_amount,
        COUNT(DISTINCT account_id) as accounts_used,
        COUNT(DISTINCT category_id) as categories_budgeted,
        SUM(CASE WHEN budget_type = 1 THEN 1 ELSE 0 END) as general_budgets,
        SUM(CASE WHEN budget_type = 2 THEN 1 ELSE 0 END) as category_budgets,
        DATE_FORMAT(createtime, '%Y-%m-%d') as creation_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM budget_master 
      WHERE YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY creation_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        total_budgets: acc.total_budgets + row.total_budgets,
        total_budget_amount: acc.total_budget_amount + parseFloat(row.total_budget_amount || 0),
        accounts_used: Math.max(acc.accounts_used, row.accounts_used),
        categories_budgeted: Math.max(acc.categories_budgeted, row.categories_budgeted),
        general_budgets: acc.general_budgets + row.general_budgets,
        category_budgets: acc.category_budgets + row.category_budgets,
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, total_budgets: 0, total_budget_amount: 0, accounts_used: 0, categories_budgeted: 0, general_budgets: 0, category_budgets: 0, active_days: 0 });

      resolve({
        feature: 'Budget',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_budget_amount: totalStats.total_budgets > 0 ? totalStats.total_budget_amount / totalStats.total_budgets : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Report Feature Usage
 * Analyzes report generation and data export patterns
 */
const trackReportUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    // Since there's no dedicated reports table, we'll track based on data access patterns
    // This includes users who have significant transaction activity (indicating report usage)
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT account_id) as accounts_accessed,
        COUNT(*) as total_transactions_viewed,
        AVG(transaction_count) as avg_transactions_per_user,
        DATE_FORMAT(createtime, '%Y-%m-%d') as access_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM (
        SELECT 
          user_id, 
          account_id, 
          createtime,
          COUNT(*) as transaction_count
        FROM expense_income_master 
        WHERE YEAR(createtime) = ? 
        AND MONTH(createtime) = ? 
        AND delete_flag = 0
        GROUP BY user_id, account_id, DATE(createtime)
        HAVING transaction_count >= 3
      ) as report_activity
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY access_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        accounts_accessed: Math.max(acc.accounts_accessed, row.accounts_accessed),
        total_transactions_viewed: acc.total_transactions_viewed + row.total_transactions_viewed,
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, accounts_accessed: 0, total_transactions_viewed: 0, active_days: 0 });

      resolve({
        feature: 'Report',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_transactions_per_user: totalStats.unique_users > 0 ? totalStats.total_transactions_viewed / totalStats.unique_users : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Export Feature Usage
 * Analyzes data export patterns (based on high transaction volumes)
 */
const trackExportUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    // Track users with high transaction volumes (likely exporting data)
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT account_id) as accounts_exported,
        SUM(transaction_count) as total_transactions_exported,
        AVG(transaction_count) as avg_transactions_per_export,
        DATE_FORMAT(createtime, '%Y-%m-%d') as export_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM (
        SELECT 
          user_id, 
          account_id, 
          createtime,
          COUNT(*) as transaction_count
        FROM expense_income_master 
        WHERE YEAR(createtime) = ? 
        AND MONTH(createtime) = ? 
        AND delete_flag = 0
        GROUP BY user_id, account_id, DATE(createtime)
        HAVING transaction_count >= 10
      ) as export_activity
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY export_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) return reject(err);

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        accounts_exported: Math.max(acc.accounts_exported, row.accounts_exported),
        total_transactions_exported: acc.total_transactions_exported + row.total_transactions_exported,
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, accounts_exported: 0, total_transactions_exported: 0, active_days: 0 });

      resolve({
        feature: 'Export',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_transactions_per_export: totalStats.unique_users > 0 ? totalStats.total_transactions_exported / totalStats.unique_users : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Refer & Earn Feature Usage
 * Analyzes referral program usage across all users
 */
const trackReferEarnUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    // Check if referral_master table exists, otherwise use subscription data
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_referrals,
        COUNT(DISTINCT referred_user_id) as successful_referrals,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_referrals,
        DATE_FORMAT(createtime, '%Y-%m-%d') as referral_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM referral_master 
      WHERE YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY referral_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) {
        // If referral_master doesn't exist, return empty data
        return resolve({
          feature: 'Refer & Earn',
          month_year: targetMonth,
          stats: {
            unique_users: 0,
            total_referrals: 0,
            successful_referrals: 0,
            active_referrals: 0,
            active_days: 0,
            daily_breakdown: []
          }
        });
      }

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        total_referrals: acc.total_referrals + row.total_referrals,
        successful_referrals: Math.max(acc.successful_referrals, row.successful_referrals),
        active_referrals: acc.active_referrals + row.active_referrals,
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, total_referrals: 0, successful_referrals: 0, active_referrals: 0, active_days: 0 });

      resolve({
        feature: 'Refer & Earn',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          conversion_rate: totalStats.total_referrals > 0 ? (totalStats.successful_referrals / totalStats.total_referrals) * 100 : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Regular Payment Feature Usage
 * Analyzes recurring payment patterns across all users
 */
const trackRegularPaymentUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    // Track users with regular transaction patterns (same amounts, regular intervals)
    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT account_id) as accounts_with_regular_payments,
        COUNT(*) as total_regular_transactions,
        SUM(amount) as total_regular_amount,
        AVG(amount) as avg_regular_amount,
        COUNT(DISTINCT category_id) as categories_with_regular_payments,
        DATE_FORMAT(createtime, '%Y-%m-%d') as payment_date,
        COUNT(DISTINCT DATE(createtime)) as active_days
      FROM expense_income_master 
      WHERE YEAR(createtime) = ? 
      AND MONTH(createtime) = ? 
      AND delete_flag = 0
      AND amount > 0
      AND (
        -- Regular payment patterns (same amount, same category, multiple times)
        (user_id, account_id, category_id, amount) IN (
          SELECT user_id, account_id, category_id, amount
          FROM expense_income_master 
          WHERE YEAR(createtime) = ? 
          AND MONTH(createtime) = ? 
          AND delete_flag = 0
          GROUP BY user_id, account_id, category_id, amount
          HAVING COUNT(*) >= 3
        )
      )
      GROUP BY DATE_FORMAT(createtime, '%Y-%m-%d')
      ORDER BY payment_date
    `;

    connection.query(query, [year, month, year, month], (err, result) => {
      if (err) return reject(err);

      const totalStats = result.reduce((acc, row) => ({
        unique_users: Math.max(acc.unique_users, row.unique_users),
        accounts_with_regular_payments: Math.max(acc.accounts_with_regular_payments, row.accounts_with_regular_payments),
        total_regular_transactions: acc.total_regular_transactions + row.total_regular_transactions,
        total_regular_amount: acc.total_regular_amount + parseFloat(row.total_regular_amount || 0),
        categories_with_regular_payments: Math.max(acc.categories_with_regular_payments, row.categories_with_regular_payments),
        active_days: Math.max(acc.active_days, row.active_days)
      }), { unique_users: 0, accounts_with_regular_payments: 0, total_regular_transactions: 0, total_regular_amount: 0, categories_with_regular_payments: 0, active_days: 0 });

      resolve({
        feature: 'Regular Payment',
        month_year: targetMonth,
        stats: {
          ...totalStats,
          avg_regular_amount: totalStats.total_regular_transactions > 0 ? totalStats.total_regular_amount / totalStats.total_regular_transactions : 0,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Business Health Usage
 * Analyzes how many users are using performance functionality
 */
const trackBusinessHealthUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_performance_calculations,
        AVG(total_score) as avg_performance_score,
        COUNT(DISTINCT account_id) as accounts_used,
        DATE_FORMAT(last_updated, '%Y-%m-%d') as entry_date,
        COUNT(DISTINCT DATE(last_updated)) as active_days,
        SUM(CASE WHEN total_score >= 80 THEN 1 ELSE 0 END) as high_performance_users,
        SUM(CASE WHEN total_score >= 60 AND total_score < 80 THEN 1 ELSE 0 END) as medium_performance_users,
        SUM(CASE WHEN total_score < 60 THEN 1 ELSE 0 END) as low_performance_users
      FROM user_performance_scores 
      WHERE YEAR(last_updated) = ? 
      AND MONTH(last_updated) = ? 
      AND is_active = 1
      GROUP BY DATE_FORMAT(last_updated, '%Y-%m-%d')
      ORDER BY entry_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const totalUsers = result.length > 0 ? result[0].unique_users : 0;
      const totalCalculations = result.reduce((sum, row) => sum + row.total_performance_calculations, 0);
      const avgPerformanceScore = result.reduce((sum, row) => sum + (row.avg_performance_score || 0), 0) / (result.length || 1);
      const accountsUsed = result.length > 0 ? result[0].accounts_used : 0;
      const activeDays = result.length;
      const highPerformanceUsers = result.reduce((sum, row) => sum + (row.high_performance_users || 0), 0);
      const mediumPerformanceUsers = result.reduce((sum, row) => sum + (row.medium_performance_users || 0), 0);
      const lowPerformanceUsers = result.reduce((sum, row) => sum + (row.low_performance_users || 0), 0);

      resolve({
        feature: 'Business Health',
        month_year: targetMonth,
        stats: {
          unique_users: totalUsers,
          total_performance_calculations: totalCalculations,
          avg_performance_score: Math.round(avgPerformanceScore * 100) / 100,
          accounts_used: accountsUsed,
          active_days: activeDays,
          high_performance_users: highPerformanceUsers,
          medium_performance_users: mediumPerformanceUsers,
          low_performance_users: lowPerformanceUsers,
          performance_distribution: {
            high: highPerformanceUsers,
            medium: mediumPerformanceUsers,
            low: lowPerformanceUsers
          },
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Track Stock Entry Usage
 * Analyzes how many users are using stock functionality
 */
const trackStockEntryUsage = async (month_year = null) => {
  return new Promise((resolve, reject) => {
    const targetMonth = month_year || getCurrentMonth();
    const [year, month] = targetMonth.split('-');

    const query = `
      SELECT 
        COUNT(DISTINCT ps.user_id) as unique_users,
        COUNT(*) as total_stock_entries,
        SUM(ps.purchase_amount) as total_purchase_amount,
        AVG(ps.purchase_amount) as avg_purchase_amount,
        COUNT(DISTINCT ps.account_id) as accounts_used,
        DATE_FORMAT(ps.purchase_date, '%Y-%m-%d') as entry_date,
        COUNT(DISTINCT DATE(ps.purchase_date)) as active_days
      FROM purchase_stock ps
      WHERE YEAR(ps.purchase_date) = ? 
      AND MONTH(ps.purchase_date) = ?
      GROUP BY DATE_FORMAT(ps.purchase_date, '%Y-%m-%d')
      ORDER BY entry_date
    `;

    connection.query(query, [year, month], (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      const totalUsers = result.length > 0 ? result[0].unique_users : 0;
      const totalEntries = result.reduce((sum, row) => sum + row.total_stock_entries, 0);
      const totalAmount = result.reduce((sum, row) => sum + (row.total_purchase_amount || 0), 0);
      const avgAmount = totalEntries > 0 ? totalAmount / totalEntries : 0;
      const accountsUsed = result.length > 0 ? result[0].accounts_used : 0;
      const activeDays = result.length;

      resolve({
        feature: 'Stock Entry',
        month_year: targetMonth,
        stats: {
          unique_users: totalUsers,
          total_stock_entries: totalEntries,
          total_purchase_amount: totalAmount,
          avg_purchase_amount: Math.round(avgAmount * 100) / 100,
          accounts_used: accountsUsed,
          active_days: activeDays,
          daily_breakdown: result
        }
      });
    });
  });
};

/**
 * Get Comprehensive Feature Usage Analytics
 * Combines all feature usage data for admin dashboard
 */
const getFeatureUsageAnalytics = async (month_year = null) => {
  try {
    const targetMonth = month_year || getCurrentMonth();

    // Get all feature usage data in parallel with error handling
    const [
      incomeUsage,
      expenseUsage,
      udhariUsage,
      budgetUsage,
      reportUsage,
      exportUsage,
      referEarnUsage,
      regularPaymentUsage,
      businessHealthUsage,
      stockEntryUsage
    ] = await Promise.all([
      trackIncomeUsage(targetMonth).catch(err => {
        console.error('Error tracking income usage:', err);
        return { feature: 'Income', month_year: targetMonth, stats: { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, active_days: 0, avg_amount: 0, daily_breakdown: [] } };
      }),
      trackExpenseUsage(targetMonth).catch(err => {
        console.error('Error tracking expense usage:', err);
        return { feature: 'Expense', month_year: targetMonth, stats: { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, categories_used: 0, active_days: 0, avg_amount: 0, daily_breakdown: [] } };
      }),
      trackUdhariUsage(targetMonth).catch(err => {
        console.error('Error tracking udhari usage:', err);
        return { feature: 'Udhari', month_year: targetMonth, stats: { unique_users: 0, total_entries: 0, total_amount: 0, accounts_used: 0, customers_involved: 0, total_receivable: 0, total_payable: 0, active_days: 0, avg_amount: 0, net_position: 0, daily_breakdown: [] } };
      }),
      trackBudgetUsage(targetMonth).catch(err => {
        console.error('Error tracking budget usage:', err);
        return { feature: 'Budget', month_year: targetMonth, stats: { unique_users: 0, total_budgets: 0, total_budget_amount: 0, accounts_used: 0, categories_budgeted: 0, general_budgets: 0, category_budgets: 0, active_days: 0, avg_budget_amount: 0, daily_breakdown: [] } };
      }),
      trackReportUsage(targetMonth).catch(err => {
        console.error('Error tracking report usage:', err);
        return { feature: 'Report', month_year: targetMonth, stats: { unique_users: 0, accounts_accessed: 0, total_transactions_viewed: 0, active_days: 0, avg_transactions_per_user: 0, daily_breakdown: [] } };
      }),
      trackExportUsage(targetMonth).catch(err => {
        console.error('Error tracking export usage:', err);
        return { feature: 'Export', month_year: targetMonth, stats: { unique_users: 0, accounts_exported: 0, total_transactions_exported: 0, active_days: 0, avg_transactions_per_export: 0, daily_breakdown: [] } };
      }),
      trackReferEarnUsage(targetMonth).catch(err => {
        console.error('Error tracking refer earn usage:', err);
        return { feature: 'Refer & Earn', month_year: targetMonth, stats: { unique_users: 0, total_referrals: 0, successful_referrals: 0, active_referrals: 0, active_days: 0, conversion_rate: 0, daily_breakdown: [] } };
      }),
      trackRegularPaymentUsage(targetMonth).catch(err => {
        console.error('Error tracking regular payment usage:', err);
        return { feature: 'Regular Payment', month_year: targetMonth, stats: { unique_users: 0, accounts_with_regular_payments: 0, total_regular_transactions: 0, total_regular_amount: 0, categories_with_regular_payments: 0, active_days: 0, avg_regular_amount: 0, daily_breakdown: [] } };
      }),
      trackBusinessHealthUsage(targetMonth).catch(err => {
        console.error('Error tracking business health usage:', err);
        return { feature: 'Business Health', month_year: targetMonth, stats: { unique_users: 0, total_performance_calculations: 0, avg_performance_score: 0, accounts_used: 0, active_days: 0, high_performance_users: 0, medium_performance_users: 0, low_performance_users: 0, performance_distribution: { high: 0, medium: 0, low: 0 }, daily_breakdown: [] } };
      }),
      trackStockEntryUsage(targetMonth).catch(err => {
        console.error('Error tracking stock entry usage:', err);
        return { feature: 'Stock Entry', month_year: targetMonth, stats: { unique_users: 0, total_stock_entries: 0, total_purchase_amount: 0, avg_purchase_amount: 0, accounts_used: 0, active_days: 0, daily_breakdown: [] } };
      })
    ]);

    // Calculate overall engagement metrics
    // For now, we'll use the sum of unique users from each feature
    // In a more sophisticated implementation, we'd query for actual unique users across all features
    const totalActiveUsers = (
      (incomeUsage.stats.unique_users || 0) +
      (expenseUsage.stats.unique_users || 0) +
      (udhariUsage.stats.unique_users || 0) +
      (budgetUsage.stats.unique_users || 0) +
      (reportUsage.stats.unique_users || 0) +
      (exportUsage.stats.unique_users || 0) +
      (referEarnUsage.stats.unique_users || 0) +
      (regularPaymentUsage.stats.unique_users || 0) +
      (businessHealthUsage.stats.unique_users || 0) +
      (stockEntryUsage.stats.unique_users || 0)
    );

    const featureUsageData = [
      incomeUsage,
      expenseUsage,
      udhariUsage,
      budgetUsage,
      reportUsage,
      exportUsage,
      referEarnUsage,
      regularPaymentUsage,
      businessHealthUsage,
      stockEntryUsage
    ];

    // Calculate trend data (comparing with previous month)
    const previousMonth = getPreviousMonth(targetMonth);
    const previousMonthData = await Promise.all([
      trackIncomeUsage(previousMonth),
      trackExpenseUsage(previousMonth),
      trackUdhariUsage(previousMonth),
      trackBudgetUsage(previousMonth),
      trackReportUsage(previousMonth),
      trackExportUsage(previousMonth),
      trackReferEarnUsage(previousMonth),
      trackRegularPaymentUsage(previousMonth),
      trackBusinessHealthUsage(previousMonth),
      trackStockEntryUsage(previousMonth)
    ]);

    const trendAnalysis = featureUsageData.map((current, index) => {
      const previous = previousMonthData[index];
      const currentUsers = current.stats.unique_users;
      const previousUsers = previous.stats.unique_users;

      const growthRate = previousUsers > 0 ? ((currentUsers - previousUsers) / previousUsers) * 100 : 0;

      return {
        feature: current.feature,
        current_users: currentUsers,
        previous_users: previousUsers,
        growth_rate: Math.round(growthRate * 100) / 100,
        trend: growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable'
      };
    });

    return {
      month_year: targetMonth,
      total_active_users: totalActiveUsers,
      feature_usage: featureUsageData,
      trend_analysis: trendAnalysis,
      insights: {
        most_used_feature: featureUsageData.reduce((max, feature) =>
          feature.stats.unique_users > max.stats.unique_users ? feature : max
        ),
        fastest_growing_feature: trendAnalysis.reduce((max, trend) =>
          trend.growth_rate > max.growth_rate ? trend : max
        ),
        engagement_score: Math.round((totalActiveUsers / featureUsageData.length) * 100) / 100
      }
    };

  } catch (error) {
    console.error('Error getting feature usage analytics:', error);
    throw error;
  }
};

/**
 * API Endpoint: Get Feature Usage Analytics for Admin Dashboard
 */
const getFeatureUsageAnalyticsAPI = async (request, response) => {
  try {
    const { month_year } = request.query;
    const targetMonth = month_year || getCurrentMonth();

    const analyticsData = await getFeatureUsageAnalytics(targetMonth);

    return response.status(200).json({
      success: true,
      msg: ['Feature usage analytics retrieved successfully', 'फीचर उपयोग एनालिटिक्स सफलतापूर्वक प्राप्त', 'फीचर वापर विश्लेषण यशस्वीरित्या पुनर्प्राप्त'],
      data: analyticsData
    });

  } catch (error) {
    console.error('Error in getFeatureUsageAnalyticsAPI:', error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

/**
 * API Endpoint: Get Feature Usage Trends (Last 6 Months)
 */
const getFeatureUsageTrendsAPI = async (request, response) => {
  try {
    const { months = 6 } = request.query;
    const currentMonth = getCurrentMonth();

    const trendsData = [];

    for (let i = 0; i < parseInt(months); i++) {
      const monthYear = moment(currentMonth + '-01').subtract(i, 'month').format('YYYY-MM');
      const analyticsData = await getFeatureUsageAnalytics(monthYear);

      trendsData.push({
        month_year: monthYear,
        total_active_users: analyticsData.total_active_users,
        feature_summary: analyticsData.feature_usage.map(feature => ({
          feature: feature.feature,
          unique_users: feature.stats.unique_users,
          total_entries: feature.stats.total_entries ||
            feature.stats.total_budgets ||
            feature.stats.total_referrals ||
            feature.stats.total_regular_transactions ||
            feature.stats.total_performance_calculations ||
            feature.stats.total_stock_entries || 0
        }))
      });
    }

    return response.status(200).json({
      success: true,
      msg: ['Feature usage trends retrieved successfully', 'फीचर उपयोग ट्रेंड्स सफलतापूर्वक प्राप्त', 'फीचर वापर ट्रेंड्स यशस्वीरित्या पुनर्प्राप्त'],
      data: {
        trends: trendsData.reverse(), // Show oldest to newest
        total_months: trendsData.length
      }
    });

  } catch (error) {
    console.error('Error in getFeatureUsageTrendsAPI:', error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

/**
 * Generate dynamic performance feedback text based on score
 */
const generatePerformanceFeedback = (performanceData) => {
  const totalScore = parseFloat(performanceData.total_score);
  const performanceGrade = performanceData.performance_grade;

  // Debug: Log the performance data to see what we're working with
  console.log('🔍 Performance Data Debug:', {
    totalScore,
    performanceGrade,
    profitability_score: performanceData.profitability_score,
    cash_flow_consistency_score: performanceData.cash_flow_consistency_score,
    expense_control_score: performanceData.expense_control_score,
    debt_credit_health_score: performanceData.debt_credit_health_score,
    stock_turnover_score: performanceData.stock_turnover_score,
    timely_collections_score: performanceData.timely_collections_score,
    daily_entry_score: performanceData.daily_entry_score,
    budget_usage_score: performanceData.budget_usage_score
  });

  // Get individual scores
  const scores = {
    profitability: parseFloat(performanceData.profitability_score) || 0,
    cashFlow: parseFloat(performanceData.cash_flow_consistency_score) || 0,
    expenseControl: parseFloat(performanceData.expense_control_score) || 0,
    debtHealth: parseFloat(performanceData.debt_credit_health_score) || 0,
    stockTurnover: parseFloat(performanceData.stock_turnover_score) || 0,
    timelyCollections: parseFloat(performanceData.timely_collections_score) || 0,
    dailyEntry: parseFloat(performanceData.daily_entry_score) || 0,
    budgetUsage: parseFloat(performanceData.budget_usage_score) || 0
  };

  console.log('🔍 Parsed Scores:', scores);

  // Parse all metrics first to use in feedback generation
  const metrics = {
    profitability: null,
    cashFlow: null,
    expenseControl: null,
    debtHealth: null,
    stockTurnover: null,
    timelyCollections: null,
    dailyEntry: null,
    budgetUsage: null
  };

  try {
    if (performanceData.profitability_metrics) {
      metrics.profitability = JSON.parse(performanceData.profitability_metrics);
    }
    if (performanceData.cash_flow_metrics) {
      metrics.cashFlow = JSON.parse(performanceData.cash_flow_metrics);
    }
    if (performanceData.expense_control_metrics) {
      metrics.expenseControl = JSON.parse(performanceData.expense_control_metrics);
    }
    if (performanceData.debt_credit_metrics) {
      metrics.debtHealth = JSON.parse(performanceData.debt_credit_metrics);
    }
    if (performanceData.stock_turnover_metrics) {
      metrics.stockTurnover = JSON.parse(performanceData.stock_turnover_metrics);
    }
    if (performanceData.collection_metrics) {
      metrics.timelyCollections = JSON.parse(performanceData.collection_metrics);
    }
    if (performanceData.daily_entry_metrics) {
      metrics.dailyEntry = JSON.parse(performanceData.daily_entry_metrics);
    }
    if (performanceData.budget_usage_metrics) {
      metrics.budgetUsage = JSON.parse(performanceData.budget_usage_metrics);
    }
  } catch (e) {
    console.log('Error parsing metrics:', e);
  }

  // Generate feedback for all 8 categories based on actual data
  const categoryFeedback = [];

  // 1. Profitability
  let profitWhyLow = "Profitability needs attention";
  let profitHowToImprove = "Focus on increasing income and reducing costs";
  if (metrics.profitability) {
    const profitMargin = metrics.profitability.profitMargin || 0;
    const netProfit = metrics.profitability.netProfit || 0;
    const totalIncome = metrics.profitability.totalIncome || 0;
    const totalExpense = metrics.profitability.totalExpense || 0;

    if (profitMargin < 10) {
      profitWhyLow = `Low profit margin of ${Math.round(profitMargin)}% (Income: ₹${Math.round(totalIncome)}, Expense: ₹${Math.round(totalExpense)})`;
      profitHowToImprove = `Increase profit margin to at least 15% by reducing expenses or increasing income`;
    } else if (profitMargin < 20) {
      profitWhyLow = `Profit margin is ${Math.round(profitMargin)}% with net profit of ₹${Math.round(netProfit)}`;
      profitHowToImprove = `Aim to increase profit margin to 20% or above`;
    } else {
      profitWhyLow = `Good profit margin of ${Math.round(profitMargin)}%`;
      profitHowToImprove = `Maintain current profitability level and look for further improvement opportunities`;
    }
  } else if (scores.profitability < 70) {
    profitWhyLow = "Low profitability score";
    profitHowToImprove = "Focus on high-margin products and reduce costs";
  } else {
    profitWhyLow = `Profitability is good (${Math.round(scores.profitability)}%)`;
    profitHowToImprove = "Maintain current profitability levels";
  }
  categoryFeedback.push({ category: 'Profitability', score: scores.profitability, whyLow: profitWhyLow, howToImprove: profitHowToImprove });

  // 2. Cash Flow
  let cashFlowWhyLow = "Cash flow consistency needs improvement";
  let cashFlowHowToImprove = "Maintain consistent daily entries";
  if (metrics.cashFlow) {
    const consistency = metrics.cashFlow.consistency || 0;
    const positiveDays = metrics.cashFlow.positiveDays || 0;
    const totalDays = metrics.cashFlow.totalDays || 31;
    const negativeDays = totalDays - positiveDays;

    if (consistency < 70 || negativeDays > 10) {
      cashFlowWhyLow = `${negativeDays} days with negative cash flow out of ${totalDays} days`;
      cashFlowHowToImprove = `Maintain positive cash flow for at least ${Math.ceil(totalDays * 0.8)} days per month`;
    } else if (consistency < 85) {
      cashFlowWhyLow = `Cash flow consistency is ${Math.round(consistency)}% (${positiveDays}/${totalDays} positive days)`;
      cashFlowHowToImprove = `Improve cash flow consistency to 85% or above`;
    } else {
      cashFlowWhyLow = `Excellent cash flow consistency of ${Math.round(consistency)}%`;
      cashFlowHowToImprove = "Keep maintaining positive cash flow patterns";
    }
  } else if (scores.cashFlow < 70) {
    cashFlowWhyLow = "Irregular cash flow patterns";
    cashFlowHowToImprove = "Maintain consistent daily entries and balance income/expenses";
  } else {
    cashFlowWhyLow = `Cash flow is consistent (${Math.round(scores.cashFlow)}%)`;
    cashFlowHowToImprove = "Continue maintaining regular cash flow";
  }
  categoryFeedback.push({ category: 'CashFlow', score: scores.cashFlow, whyLow: cashFlowWhyLow, howToImprove: cashFlowHowToImprove });

  // 3. Expense Control
  let expenseWhyLow = "Expense control needs improvement";
  let expenseHowToImprove = "Reduce non-essential expenses";
  if (metrics.expenseControl) {
    const averageDailyExpense = metrics.expenseControl.averageDailyExpense || 0;
    const maxDailyExpense = metrics.expenseControl.maxDailyExpense || 0;
    const variancePercentage = metrics.expenseControl.variancePercentage || 0;
    const totalExpenses = metrics.expenseControl.totalExpenses || 0;

    if (variancePercentage > 50 || maxDailyExpense > averageDailyExpense * 2) {
      expenseWhyLow = `High expense variance: Average ₹${Math.round(averageDailyExpense)}/day, Max ₹${Math.round(maxDailyExpense)}/day`;
      expenseHowToImprove = `Control daily expenses and reduce variance to below 30%`;
    } else if (totalExpenses > 0) {
      expenseWhyLow = `Monthly expenses: ₹${Math.round(totalExpenses)}, Average: ₹${Math.round(averageDailyExpense)}/day`;
      expenseHowToImprove = `Monitor and control expenses to maintain consistent spending`;
    } else {
      expenseWhyLow = `Expense control is good`;
      expenseHowToImprove = "Continue monitoring expenses regularly";
    }
  } else if (scores.expenseControl < 70) {
    expenseWhyLow = "High expense ratio this month";
    expenseHowToImprove = "Reduce non-essential expenses and monitor spending";
  } else {
    expenseWhyLow = `Expense control is good (${Math.round(scores.expenseControl)}%)`;
    expenseHowToImprove = "Maintain current expense control levels";
  }
  categoryFeedback.push({ category: 'ExpenseControl', score: scores.expenseControl, whyLow: expenseWhyLow, howToImprove: expenseHowToImprove });

  // 4. Debt Health
  let debtWhyLow = "Debt health needs attention";
  let debtHowToImprove = "Reduce outstanding debts";
  if (metrics.debtHealth) {
    const debtRatio = metrics.debtHealth.debtRatio || 0;
    const totalDebt = metrics.debtHealth.totalDebt || 0;
    const totalCredit = metrics.debtHealth.totalCredit || 0;
    const debtToCreditRatio = metrics.debtHealth.debtToCreditRatio || 0;

    if (debtRatio > 40 || debtToCreditRatio > 0.7) {
      debtWhyLow = `High debt ratio: ${Math.round(debtRatio)}% (Debt: ₹${Math.round(totalDebt)}, Credit: ₹${Math.round(totalCredit)})`;
      debtHowToImprove = `Reduce debt ratio below 30% by paying off debts`;
    } else if (debtRatio > 30) {
      debtWhyLow = `Debt ratio is ${Math.round(debtRatio)}% with ₹${Math.round(totalDebt)} total debt`;
      debtHowToImprove = `Aim to reduce debt ratio to below 30%`;
    } else if (totalDebt > 0) {
      debtWhyLow = `Debt ratio: ${Math.round(debtRatio)}% (Debt: ₹${Math.round(totalDebt)}, Credit: ₹${Math.round(totalCredit)})`;
      debtHowToImprove = `Maintain low debt ratio and clear outstanding debts`;
    } else {
      debtWhyLow = "No outstanding debts";
      debtHowToImprove = "Continue maintaining debt-free status";
    }
  } else if (scores.debtHealth < 70) {
    debtWhyLow = "High debt-to-income ratio";
    debtHowToImprove = "Reduce outstanding debts and improve credit management";
  } else {
    debtWhyLow = `Debt health is good (${Math.round(scores.debtHealth)}%)`;
    debtHowToImprove = "Continue managing debts effectively";
  }
  categoryFeedback.push({ category: 'DebtHealth', score: scores.debtHealth, whyLow: debtWhyLow, howToImprove: debtHowToImprove });

  // 5. Stock Turnover
  let stockWhyLow = "Stock turnover needs improvement";
  let stockHowToImprove = "Optimize stock levels";
  if (metrics.stockTurnover) {
    const turnoverRatio = metrics.stockTurnover.turnoverRatio || 0;
    const totalStockValue = metrics.stockTurnover.totalStockValue || 0;
    const totalSales = metrics.stockTurnover.totalSales || 0;

    if (turnoverRatio < 60) {
      stockWhyLow = `Low stock turnover: ${Math.round(turnoverRatio)}% (Stock: ₹${Math.round(totalStockValue)}, Sales: ₹${Math.round(totalSales)})`;
      stockHowToImprove = `Improve stock turnover to at least 80% by optimizing inventory levels`;
    } else if (turnoverRatio < 80) {
      stockWhyLow = `Stock turnover is ${Math.round(turnoverRatio)}% with ₹${Math.round(totalStockValue)} stock value`;
      stockHowToImprove = `Increase stock turnover to 80% or above for better efficiency`;
    } else if (totalStockValue > 0) {
      stockWhyLow = `Stock turnover: ${Math.round(turnoverRatio)}% (Stock: ₹${Math.round(totalStockValue)})`;
      stockHowToImprove = `Maintain efficient stock turnover rates`;
    } else {
      stockWhyLow = "Stock management is efficient";
      stockHowToImprove = "Continue optimizing stock levels";
    }
  } else if (scores.stockTurnover < 70) {
    stockWhyLow = "Slow inventory turnover";
    stockHowToImprove = "Optimize stock levels and improve sales velocity";
  } else {
    stockWhyLow = `Stock turnover is good (${Math.round(scores.stockTurnover)}%)`;
    stockHowToImprove = "Maintain efficient stock management";
  }
  categoryFeedback.push({ category: 'StockTurnover', score: scores.stockTurnover, whyLow: stockWhyLow, howToImprove: stockHowToImprove });

  // 6. Timely Collections
  let collectionWhyLow = "Collection rate needs improvement";
  let collectionHowToImprove = 'Start using "reminder" feature for udhar';
  if (metrics.timelyCollections) {
    const collectionRate = metrics.timelyCollections.collectionRate || 0;
    const totalReceivables = metrics.timelyCollections.totalReceivables || 0;
    const collectedAmount = metrics.timelyCollections.collectedAmount || 0;
    const pendingAmount = totalReceivables - collectedAmount;

    if (collectionRate < 60) {
      collectionWhyLow = `Low collection rate: ${Math.round(collectionRate)}% (₹${Math.round(pendingAmount)} pending from ₹${Math.round(totalReceivables)} total)`;
      collectionHowToImprove = `Improve collection rate to at least 80% by following up on pending amounts`;
    } else if (collectionRate < 80) {
      collectionWhyLow = `Collection rate is ${Math.round(collectionRate)}% with ₹${Math.round(pendingAmount)} pending`;
      collectionHowToImprove = `Increase collection rate to 80% or above using reminder features`;
    } else if (pendingAmount > 0) {
      collectionWhyLow = `Collection rate: ${Math.round(collectionRate)}% (₹${Math.round(pendingAmount)} still pending)`;
      collectionHowToImprove = `Clear pending collections of ₹${Math.round(pendingAmount)} to improve cash flow`;
    } else {
      collectionWhyLow = "All receivables collected";
      collectionHowToImprove = "Continue timely collection practices";
    }
  } else if (scores.timelyCollections < 70) {
    collectionWhyLow = "Pending collections from customers";
    collectionHowToImprove = 'Follow up on pending collections using "reminder" feature';
  } else {
    collectionWhyLow = `Collection rate is good (${Math.round(scores.timelyCollections)}%)`;
    collectionHowToImprove = "Maintain timely collection practices";
  }
  categoryFeedback.push({ category: 'TimelyCollections', score: scores.timelyCollections, whyLow: collectionWhyLow, howToImprove: collectionHowToImprove });

  // 7. Daily Entry
  let dailyEntryWhyLow = "Daily entry consistency needs improvement";
  let dailyEntryHowToImprove = "Add entries daily for consistent tracking";
  if (metrics.dailyEntry) {
    const entriesMade = metrics.dailyEntry.entriesMade || 0;
    const totalDays = metrics.dailyEntry.totalDays || 31;
    const daysMissed = totalDays - entriesMade;
    const consistencyPercentage = metrics.dailyEntry.consistencyPercentage || 0;

    if (consistencyPercentage < 70 || daysMissed > 10) {
      dailyEntryWhyLow = `Missed ${daysMissed} days of entries (${entriesMade}/${totalDays} days entered)`;
      dailyEntryHowToImprove = `Add entries for next ${Math.min(7, daysMissed)} days to improve consistency`;
    } else if (consistencyPercentage < 85) {
      dailyEntryWhyLow = `Entry consistency: ${Math.round(consistencyPercentage)}% (${entriesMade}/${totalDays} days)`;
      dailyEntryHowToImprove = `Aim for 90%+ consistency by adding entries daily`;
    } else {
      dailyEntryWhyLow = `Good entry consistency: ${Math.round(consistencyPercentage)}% (${entriesMade}/${totalDays} days)`;
      dailyEntryHowToImprove = "Continue maintaining daily entry habit";
    }
  } else if (scores.dailyEntry < 70) {
    dailyEntryWhyLow = "Missed daily entries this month";
    dailyEntryHowToImprove = "Add entries daily for consistent tracking";
  } else {
    dailyEntryWhyLow = `Daily entry consistency is good (${Math.round(scores.dailyEntry)}%)`;
    dailyEntryHowToImprove = "Keep maintaining regular daily entries";
  }
  categoryFeedback.push({ category: 'DailyEntry', score: scores.dailyEntry, whyLow: dailyEntryWhyLow, howToImprove: dailyEntryHowToImprove });

  // 8. Budget Usage
  let budgetWhyLow = "Budget usage needs attention";
  let budgetHowToImprove = "Set and stick to monthly budgets";
  if (metrics.budgetUsage) {
    const usagePercentage = metrics.budgetUsage.usagePercentage || 0;
    const budgetAmount = metrics.budgetUsage.budgetAmount || 0;
    const actualSpent = metrics.budgetUsage.actualSpent || 0;
    const remainingAmount = budgetAmount - actualSpent;

    if (usagePercentage > 100) {
      const excessAmount = actualSpent - budgetAmount;
      budgetWhyLow = `Exceeded budget by ₹${Math.round(excessAmount)} (${Math.round(usagePercentage)}% used, Budget: ₹${Math.round(budgetAmount)})`;
      budgetHowToImprove = `Reduce spending by ₹${Math.round(excessAmount)} to stay within budget`;
    } else if (usagePercentage > 90) {
      budgetWhyLow = `Budget usage at ${Math.round(usagePercentage)}% (Spent: ₹${Math.round(actualSpent)}/${Math.round(budgetAmount)})`;
      budgetHowToImprove = `Monitor spending closely, only ₹${Math.round(remainingAmount)} remaining`;
    } else if (usagePercentage > 70) {
      budgetWhyLow = `Budget usage: ${Math.round(usagePercentage)}% (₹${Math.round(remainingAmount)} remaining)`;
      budgetHowToImprove = `Continue monitoring to avoid exceeding budget`;
    } else {
      budgetWhyLow = `Budget usage: ${Math.round(usagePercentage)}% (₹${Math.round(remainingAmount)} remaining)`;
      budgetHowToImprove = "Good budget control, maintain current spending levels";
    }
  } else if (scores.budgetUsage < 70) {
    budgetWhyLow = "Budget usage issues detected";
    budgetHowToImprove = "Set realistic budgets and monitor spending regularly";
  } else {
    budgetWhyLow = `Budget usage is good (${Math.round(scores.budgetUsage)}%)`;
    budgetHowToImprove = "Continue monitoring budget adherence";
  }
  categoryFeedback.push({ category: 'BudgetUsage', score: scores.budgetUsage, whyLow: budgetWhyLow, howToImprove: budgetHowToImprove });

  // Filter only low scoring categories (score < 70) and sort by score (lowest first)
  const lowScoringCategories = categoryFeedback
    .filter(item => item.score < 70)
    .sort((a, b) => a.score - b.score);

  // Extract whyLow and howToImprove messages (only for low scoring categories)
  const whyLowMessages = lowScoringCategories.map(item => item.whyLow);
  const improvementMessages = lowScoringCategories.map(item => item.howToImprove);

  // If no low scoring categories, provide general feedback
  if (whyLowMessages.length === 0) {
    if (totalScore >= 90) {
      whyLowMessages.push("Excellent performance across all categories!");
      improvementMessages.push("Continue maintaining this level of performance");
    } else if (totalScore >= 80) {
      whyLowMessages.push("Good performance, minor improvements can enhance overall score");
      improvementMessages.push("Focus on maintaining consistency across all categories");
    } else {
      whyLowMessages.push("Performance is improving, continue working on consistency");
      improvementMessages.push("Maintain regular entries and monitor all categories");
    }
  }

  // Generate performance rating text
  let performanceRating = "";
  if (totalScore >= 90) {
    performanceRating = "Excellent";
  } else if (totalScore >= 80) {
    performanceRating = "Good";
  } else if (totalScore >= 70) {
    performanceRating = "Fair";
  } else if (totalScore >= 60) {
    performanceRating = "Needs Improvement";
  } else {
    performanceRating = "Poor";
  }

  return {
    score: Math.round(totalScore),
    maxScore: 100,
    performanceRating,
    whyLow: whyLowMessages, // All 8 categories
    howToImprove: improvementMessages, // All 8 categories
    scoreBreakdown: {
      profitability: Math.round(scores.profitability),
      cashFlow: Math.round(scores.cashFlow),
      expenseControl: Math.round(scores.expenseControl),
      debtHealth: Math.round(scores.debtHealth),
      stockTurnover: Math.round(scores.stockTurnover),
      timelyCollections: Math.round(scores.timelyCollections),
      dailyEntry: Math.round(scores.dailyEntry),
      budgetUsage: Math.round(scores.budgetUsage)
    }
  };
};

/**
 * Get Overall Performance Stats for User (with dynamic feedback)
 */
const getOverallPerformanceStats = async (request, response) => {
  try {
    const { user_id, account_id, month_year } = request.query;
    const targetMonth = month_year || getCurrentMonth();

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'यूजर आईडी आवश्यक है', 'वापरकर्ता आयडी आवश्यक आहे']
      });
    }

    // Get performance score from database
    let query = `
      SELECT ups.*, psd.profitability_metrics, psd.cash_flow_metrics,
             psd.expense_control_metrics, psd.debt_credit_metrics,
             psd.stock_turnover_metrics, psd.collection_metrics,
             psd.daily_entry_metrics, psd.budget_usage_metrics
      FROM user_performance_scores ups
      LEFT JOIN performance_score_details psd ON ups.performance_id = psd.performance_id
      WHERE ups.user_id = ? AND ups.month_year = ?
    `;

    const params = [user_id, targetMonth];

    if (account_id) {
      query += ` AND ups.account_id = ?`;
      params.push(account_id);
    }

    query += ` ORDER BY ups.last_updated DESC LIMIT 1`;

    connection.query(query, params, async (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: err.message
        });
      }

      if (result.length === 0) {
        // Try to calculate performance score on-the-fly if data doesn't exist
        try {
          const calculatedScore = await calculateUserPerformanceScore(user_id, account_id || null, targetMonth);

          // Regenerate feedback with calculated data
          const performanceData = {
            total_score: calculatedScore.totalScore,
            performance_grade: calculatedScore.performanceGrade,
            profitability_score: calculatedScore.breakdown.profitability.score,
            cash_flow_consistency_score: calculatedScore.breakdown.cashFlow.score,
            expense_control_score: calculatedScore.breakdown.expenseControl.score,
            debt_credit_health_score: calculatedScore.breakdown.debtHealth.score,
            stock_turnover_score: calculatedScore.breakdown.stockTurnover.score,
            timely_collections_score: calculatedScore.breakdown.timelyCollections.score,
            daily_entry_score: calculatedScore.breakdown.dailyEntry.score,
            budget_usage_score: calculatedScore.breakdown.budgetUsage.score,
            profitability_metrics: JSON.stringify(calculatedScore.breakdown.profitability.metrics || {}),
            cash_flow_metrics: JSON.stringify(calculatedScore.breakdown.cashFlow.metrics || {}),
            expense_control_metrics: JSON.stringify(calculatedScore.breakdown.expenseControl.metrics || {}),
            debt_credit_metrics: JSON.stringify(calculatedScore.breakdown.debtHealth.metrics || {}),
            stock_turnover_metrics: JSON.stringify(calculatedScore.breakdown.stockTurnover.metrics || {}),
            collection_metrics: JSON.stringify(calculatedScore.breakdown.timelyCollections.metrics || {}),
            daily_entry_metrics: JSON.stringify(calculatedScore.breakdown.dailyEntry.metrics || {}),
            budget_usage_metrics: JSON.stringify(calculatedScore.breakdown.budgetUsage.metrics || {}),
            month_year: targetMonth,
            last_updated: new Date().toISOString().slice(0, 19).replace('T', ' ')
          };

          const feedback = generatePerformanceFeedback(performanceData);

          // Parse JSON metrics for detailed breakdown
          const detailedMetrics = {};
          if (performanceData.profitability_metrics) {
            detailedMetrics.profitability = JSON.parse(performanceData.profitability_metrics);
          }
          if (performanceData.cash_flow_metrics) {
            detailedMetrics.cashFlow = JSON.parse(performanceData.cash_flow_metrics);
          }
          if (performanceData.expense_control_metrics) {
            detailedMetrics.expenseControl = JSON.parse(performanceData.expense_control_metrics);
          }
          if (performanceData.debt_credit_metrics) {
            detailedMetrics.debtHealth = JSON.parse(performanceData.debt_credit_metrics);
          }
          if (performanceData.stock_turnover_metrics) {
            detailedMetrics.stockTurnover = JSON.parse(performanceData.stock_turnover_metrics);
          }
          if (performanceData.collection_metrics) {
            detailedMetrics.timelyCollections = JSON.parse(performanceData.collection_metrics);
          }
          if (performanceData.daily_entry_metrics) {
            detailedMetrics.dailyEntry = JSON.parse(performanceData.daily_entry_metrics);
          }
          if (performanceData.budget_usage_metrics) {
            detailedMetrics.budgetUsage = JSON.parse(performanceData.budget_usage_metrics);
          }

          return response.status(200).json({
            success: true,
            msg: ['Performance stats retrieved successfully', 'प्रदर्शन आंकड़े सफलतापूर्वक प्राप्त', 'प्रदर्शन आकडेवारी यशस्वीरित्या पुनर्प्राप्त'],
            data: {
              month_year: performanceData.month_year,
              score: feedback.score,
              maxScore: feedback.maxScore,
              performanceRating: feedback.performanceRating,
              feedback: {
                whyLow: feedback.whyLow,
                howToImprove: feedback.howToImprove
              },
              breakdown: {
                profitability: { score: parseFloat(performanceData.profitability_score) },
                cashFlow: { score: parseFloat(performanceData.cash_flow_consistency_score) },
                expenseControl: { score: parseFloat(performanceData.expense_control_score) },
                debtHealth: { score: parseFloat(performanceData.debt_credit_health_score) },
                stockTurnover: { score: parseFloat(performanceData.stock_turnover_score) },
                timelyCollections: { score: parseFloat(performanceData.timely_collections_score) },
                dailyEntry: { score: parseFloat(performanceData.daily_entry_score) },
                budgetUsage: { score: parseFloat(performanceData.budget_usage_score) }
              },
              scoreBreakdown: feedback.scoreBreakdown,
              detailedMetrics,
              lastUpdated: performanceData.last_updated
            }
          });
        } catch (calcError) {
          console.error('Error calculating performance score on-the-fly:', calcError);
          return response.status(200).json({
            success: false,
            msg: ['No performance data found for the specified period. Please calculate performance score first.', 'निर्दिष्ट अवधि के लिए कोई प्रदर्शन डेटा नहीं मिला। कृपया पहले प्रदर्शन स्कोर की गणना करें।', 'निर्दिष्ट कालावधीसाठी कोणतेही प्रदर्शन डेटा सापडले नाही. कृपया प्रथम प्रदर्शन स्कोरची गणना करा.'],
            error: calcError.message
          });
        }
      }

      const performanceData = result[0];

      // Generate dynamic feedback
      const feedback = generatePerformanceFeedback(performanceData);

      // Parse JSON metrics for detailed breakdown
      const detailedMetrics = {};
      if (performanceData.profitability_metrics) {
        detailedMetrics.profitability = JSON.parse(performanceData.profitability_metrics);
      }
      if (performanceData.cash_flow_metrics) {
        detailedMetrics.cashFlow = JSON.parse(performanceData.cash_flow_metrics);
      }
      if (performanceData.expense_control_metrics) {
        detailedMetrics.expenseControl = JSON.parse(performanceData.expense_control_metrics);
      }
      if (performanceData.debt_credit_metrics) {
        detailedMetrics.debtHealth = JSON.parse(performanceData.debt_credit_metrics);
      }
      if (performanceData.stock_turnover_metrics) {
        detailedMetrics.stockTurnover = JSON.parse(performanceData.stock_turnover_metrics);
      }
      if (performanceData.collection_metrics) {
        detailedMetrics.timelyCollections = JSON.parse(performanceData.collection_metrics);
      }
      if (performanceData.daily_entry_metrics) {
        detailedMetrics.dailyEntry = JSON.parse(performanceData.daily_entry_metrics);
      }
      if (performanceData.budget_usage_metrics) {
        detailedMetrics.budgetUsage = JSON.parse(performanceData.budget_usage_metrics);
      }

      return response.status(200).json({
        success: true,
        msg: ['Performance stats retrieved successfully', 'प्रदर्शन आंकड़े सफलतापूर्वक प्राप्त', 'प्रदर्शन आकडेवारी यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          month_year: performanceData.month_year,
          // Main score display (like the image)
          score: feedback.score,
          maxScore: feedback.maxScore,
          performanceRating: feedback.performanceRating,

          // Dynamic feedback text
          feedback: {
            whyLow: feedback.whyLow,
            howToImprove: feedback.howToImprove
          },

          // Detailed breakdown
          breakdown: {
            profitability: { score: parseFloat(performanceData.profitability_score) },
            cashFlow: { score: parseFloat(performanceData.cash_flow_consistency_score) },
            expenseControl: { score: parseFloat(performanceData.expense_control_score) },
            debtHealth: { score: parseFloat(performanceData.debt_credit_health_score) },
            stockTurnover: { score: parseFloat(performanceData.stock_turnover_score) },
            timelyCollections: { score: parseFloat(performanceData.timely_collections_score) },
            dailyEntry: { score: parseFloat(performanceData.daily_entry_score) },
            budgetUsage: { score: parseFloat(performanceData.budget_usage_score) }
          },

          // Score breakdown for UI
          scoreBreakdown: feedback.scoreBreakdown,

          // Detailed metrics
          detailedMetrics,
          lastUpdated: performanceData.last_updated
        }
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

export {
  calculatePerformanceScore,
  getUserPerformanceScore,
  getUserPerformanceHistory,
  getOverallPerformanceStats,
  calculateUserPerformanceScore,
  generatePerformanceFeedback,
  getFeatureUsageAnalyticsAPI,
  getFeatureUsageTrendsAPI,
  getFeatureUsageAnalytics,
  trackBusinessHealthUsage,
  trackStockEntryUsage
};
