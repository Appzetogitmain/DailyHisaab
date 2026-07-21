import moment from 'moment';
import connection from '../connection/dbConfig.js';

/**
 * Get Weekly Graph Data
 * Provides all months' data with all weeks of each month up to current date
 * Including daily breakdowns and weekly/monthly totals
 */
export const getWeeklyGraphData = async (req, res) => {
  const { user_id, account_id } = req.query;

  if (!user_id || !account_id) {
    return res.status(400).json({
      success: false,
      msg: ["Missing user_id or account_id", "user_id या account_id गुम है", "user_id किंवा account_id गहाळ आहे"],
      error: "Required parameters missing"
    });
  }

  try {
    const currentDate = moment();
    const monthsData = [];

    // Get data for the last 12 months up to current date
    for (let i = 0; i < 12; i++) {
      const monthDate = currentDate.clone().subtract(i, 'months');
      const monthData = await getMonthWithWeeksData(user_id, account_id, monthDate);

      if (monthData) {
        monthsData.push(monthData);
      }
    }

    // Calculate overall totals
    const overallTotals = calculateOverallTotals(monthsData);

    // Prepare response
    const response = {
      success: true,
      msg: ["Weekly graph data retrieved successfully", "साप्ताहिक ग्राफ डेटा सफलतापूर्वक प्राप्त", "साप्ताहिक आलेख डेटा यशस्वीरित्या पुनर्प्राप्त"],
      data: {
        months_data: monthsData,
        overall_totals: overallTotals,
        summary: {
          total_months: monthsData.length,
          date_range: {
            from: monthsData[monthsData.length - 1]?.month_info?.month_name || "N/A",
            to: monthsData[0]?.month_info?.month_name || "N/A"
          }
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Weekly graph data error:", error);
    return res.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

/**
 * Get Weekly Daily Data
 * Fetches daily breakdown for a specific week
 */
const getWeeklyDailyData = async (user_id, account_id, startDate, endDate) => {
  return new Promise((resolve, reject) => {
    const query = `
            SELECT 
                DATE(createtime) as transaction_date,
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as daily_income,
                SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as daily_expense,
                SUM(CASE WHEN type = 3 THEN amount ELSE 0 END) as daily_udhari,
                COUNT(CASE WHEN type = 2 THEN 1 END) as income_transactions,
                COUNT(CASE WHEN type = 1 THEN 1 END) as expense_transactions,
                COUNT(CASE WHEN type = 3 THEN 1 END) as udhari_transactions
            FROM expense_income_master 
            WHERE user_id = ? 
            AND account_id = ? 
            AND delete_flag = 0 
            AND DATE(createtime) BETWEEN ? AND ?
            GROUP BY DATE(createtime)
            ORDER BY transaction_date ASC
        `;

    connection.query(query, [user_id, account_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')], (error, results) => {
      if (error) {
        return reject(error);
      }

      // Create array for all days in the week, filling missing days with zeros
      const dailyData = [];
      const currentDate = startDate.clone();

      while (currentDate.isSameOrBefore(endDate, 'day')) {
        const existingData = results.find(row => moment(row.transaction_date).isSame(currentDate, 'day'));

        if (existingData) {
          const dailyIncome = parseFloat(existingData.daily_income) || 0;
          const dailyExpense = parseFloat(existingData.daily_expense) || 0;
          const dailyUdhari = parseFloat(existingData.daily_udhari) || 0;
          const dailyProfit = dailyIncome - dailyExpense;

          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: currentDate.format("D"),
            income: dailyIncome,
            expense: dailyExpense,
            udhari: dailyUdhari,
            profit: dailyProfit >= 0 ? dailyProfit : 0,
            loss: dailyProfit < 0 ? Math.abs(dailyProfit) : 0,
            is_profit: dailyProfit >= 0,
            is_loss: dailyProfit < 0,
            income_transactions: existingData.income_transactions,
            expense_transactions: existingData.expense_transactions,
            udhari_transactions: existingData.udhari_transactions,
            total_transactions: existingData.income_transactions + existingData.expense_transactions + existingData.udhari_transactions
          });
        } else {
          // No transactions for this day
          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: currentDate.format("D"),
            income: 0,
            expense: 0,
            udhari: 0,
            profit: 0,
            loss: 0,
            is_profit: false,
            is_loss: false,
            income_transactions: 0,
            expense_transactions: 0,
            udhari_transactions: 0,
            total_transactions: 0
          });
        }

        currentDate.add(1, 'day');
      }

      resolve(dailyData);
    });
  });
};

/**
 * Calculate Weekly Totals
 * Calculates totals for income, expense, profit/loss, and udhari
 */
const calculateWeeklyTotals = (dailyData) => {
  const totals = dailyData.reduce((acc, day) => {
    acc.total_income += day.income;
    acc.total_expense += day.expense;
    acc.total_udhari += day.udhari;
    acc.total_profit += day.profit;
    acc.total_loss += day.loss;
    acc.total_transactions += day.total_transactions;
    acc.income_transactions += day.income_transactions;
    acc.expense_transactions += day.expense_transactions;
    acc.udhari_transactions += day.udhari_transactions;
    return acc;
  }, {
    total_income: 0,
    total_expense: 0,
    total_udhari: 0,
    total_profit: 0,
    total_loss: 0,
    total_transactions: 0,
    income_transactions: 0,
    expense_transactions: 0,
    udhari_transactions: 0
  });

  // Calculate net profit/loss
  const netResult = totals.total_income - totals.total_expense;

  return {
    total_income: parseFloat(totals.total_income.toFixed(2)),
    total_expense: parseFloat(totals.total_expense.toFixed(2)),
    total_udhari: parseFloat(totals.total_udhari.toFixed(2)),
    total_profit: netResult >= 0 ? parseFloat(netResult.toFixed(2)) : 0,
    total_loss: netResult < 0 ? parseFloat(Math.abs(netResult).toFixed(2)) : 0,
    net_result: parseFloat(netResult.toFixed(2)),
    is_profit: netResult >= 0,
    is_loss: netResult < 0,
    total_transactions: totals.total_transactions,
    income_transactions: totals.income_transactions,
    expense_transactions: totals.expense_transactions,
    udhari_transactions: totals.udhari_transactions,
    average_daily_income: parseFloat((totals.total_income / 7).toFixed(2)),
    average_daily_expense: parseFloat((totals.total_expense / 7).toFixed(2)),
    average_daily_udhari: parseFloat((totals.total_udhari / 7).toFixed(2))
  };
};

/**
 * Get Month with Weeks Data
 * Fetches complete month data with all weeks and daily breakdowns
 */
const getMonthWithWeeksData = async (user_id, account_id, monthDate) => {
  return new Promise((resolve, reject) => {
    const startDate = monthDate.clone().startOf('month');
    const endDate = monthDate.clone().endOf('month');
    const currentDate = moment();

    // Don't include future months
    if (monthDate.isAfter(currentDate, 'month')) {
      return resolve(null);
    }

    // Adjust end date if it's the current month
    if (monthDate.isSame(currentDate, 'month')) {
      endDate.set(currentDate.toObject());
    }

    const query = `
      SELECT 
        DATE(createtime) as transaction_date,
        SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as daily_income,
        SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as daily_expense,
        SUM(CASE WHEN type = 3 THEN amount ELSE 0 END) as daily_udhari,
        COUNT(CASE WHEN type = 2 THEN 1 END) as income_transactions,
        COUNT(CASE WHEN type = 1 THEN 1 END) as expense_transactions,
        COUNT(CASE WHEN type = 3 THEN 1 END) as udhari_transactions
      FROM expense_income_master 
      WHERE user_id = ? 
      AND account_id = ? 
      AND delete_flag = 0 
      AND DATE(createtime) BETWEEN ? AND ?
      GROUP BY DATE(createtime)
      ORDER BY transaction_date ASC
    `;

    connection.query(query, [user_id, account_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')], (error, results) => {
      if (error) {
        return reject(error);
      }

      // Create array for all days in the month
      const dailyData = [];
      const currentDate = startDate.clone();
      const daysInMonth = endDate.date();

      for (let day = 1; day <= daysInMonth; day++) {
        const existingData = results.find(row => moment(row.transaction_date).date() === day);

        if (existingData) {
          const dailyIncome = parseFloat(existingData.daily_income) || 0;
          const dailyExpense = parseFloat(existingData.daily_expense) || 0;
          const dailyUdhari = parseFloat(existingData.daily_udhari) || 0;
          const dailyProfit = dailyIncome - dailyExpense;

          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: day,
            income: dailyIncome,
            expense: dailyExpense,
            udhari: dailyUdhari,
            profit: dailyProfit >= 0 ? dailyProfit : 0,
            loss: dailyProfit < 0 ? Math.abs(dailyProfit) : 0,
            is_profit: dailyProfit >= 0,
            is_loss: dailyProfit < 0,
            income_transactions: existingData.income_transactions,
            expense_transactions: existingData.expense_transactions,
            udhari_transactions: existingData.udhari_transactions,
            total_transactions: existingData.income_transactions + existingData.expense_transactions + existingData.udhari_transactions
          });
        } else {
          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: day,
            income: 0,
            expense: 0,
            udhari: 0,
            profit: 0,
            loss: 0,
            is_profit: false,
            is_loss: false,
            income_transactions: 0,
            expense_transactions: 0,
            udhari_transactions: 0,
            total_transactions: 0
          });
        }

        currentDate.add(1, 'day');
      }

      // Group days into weeks
      const weeksData = groupDaysIntoWeeks(dailyData, startDate);

      // Calculate monthly totals
      const monthlyTotals = calculateMonthlyTotals(dailyData);

      resolve({
        month_info: {
          month_name: monthDate.format("MMMM YYYY"),
          month_number: monthDate.month() + 1,
          year: monthDate.year(),
          total_days: dailyData.length,
          total_weeks: weeksData.length
        },
        weeks_data: weeksData,
        daily_data: dailyData,
        monthly_totals: monthlyTotals
      });
    });
  });
};

/**
 * Group Days into Weeks
 * Groups daily data into weeks for the month
 */
const groupDaysIntoWeeks = (dailyData, monthStart) => {
  const weeks = [];
  let currentWeek = [];
  let weekStart = monthStart.clone().startOf('week');
  let weekEnd = weekStart.clone().endOf('week');

  // Adjust week start if it's before month start
  if (weekStart.isBefore(monthStart, 'day')) {
    weekStart = monthStart.clone();
  }

  // Adjust week end if it's after month end
  const monthEnd = monthStart.clone().endOf('month');
  if (weekEnd.isAfter(monthEnd, 'day')) {
    weekEnd = monthEnd.clone();
  }

  dailyData.forEach(day => {
    const dayDate = moment(day.date, "DD MMM, YYYY");

    // If day is outside current week, start new week
    if (dayDate.isAfter(weekEnd, 'day') || currentWeek.length === 0) {
      // Save previous week if it has data
      if (currentWeek.length > 0) {
        weeks.push({
          week_info: {
            week_number: weekStart.week(),
            start_date: weekStart.format("DD MMM, YYYY"),
            end_date: weekEnd.format("DD MMM, YYYY"),
            total_days: currentWeek.length
          },
          daily_data: currentWeek,
          weekly_totals: calculateWeeklyTotals(currentWeek)
        });
      }

      // Start new week
      currentWeek = [];
      weekStart = dayDate.clone().startOf('week');
      weekEnd = weekStart.clone().endOf('week');

      // Adjust week start if it's before month start
      if (weekStart.isBefore(monthStart, 'day')) {
        weekStart = monthStart.clone();
      }

      // Adjust week end if it's after month end
      if (weekEnd.isAfter(monthEnd, 'day')) {
        weekEnd = monthEnd.clone();
      }
    }

    currentWeek.push(day);
  });

  // Add the last week if it has data
  if (currentWeek.length > 0) {
    weeks.push({
      week_info: {
        week_number: weekStart.week(),
        start_date: weekStart.format("DD MMM, YYYY"),
        end_date: weekEnd.format("DD MMM, YYYY"),
        total_days: currentWeek.length
      },
      daily_data: currentWeek,
      weekly_totals: calculateWeeklyTotals(currentWeek)
    });
  }

  return weeks;
};

/**
 * Calculate Overall Totals
 * Calculates totals across all months
 */
const calculateOverallTotals = (monthsData) => {
  const totals = monthsData.reduce((acc, month) => {
    const monthTotals = month.monthly_totals;
    acc.total_income += monthTotals.total_income;
    acc.total_expense += monthTotals.total_expense;
    acc.total_udhari += monthTotals.total_udhari;
    acc.total_profit += monthTotals.total_profit;
    acc.total_loss += monthTotals.total_loss;
    acc.total_transactions += monthTotals.total_transactions;
    acc.income_transactions += monthTotals.income_transactions;
    acc.expense_transactions += monthTotals.expense_transactions;
    acc.udhari_transactions += monthTotals.udhari_transactions;
    acc.total_days += month.month_info.total_days;
    acc.total_weeks += month.month_info.total_weeks;
    return acc;
  }, {
    total_income: 0,
    total_expense: 0,
    total_udhari: 0,
    total_profit: 0,
    total_loss: 0,
    total_transactions: 0,
    income_transactions: 0,
    expense_transactions: 0,
    udhari_transactions: 0,
    total_days: 0,
    total_weeks: 0
  });

  const netResult = totals.total_income - totals.total_expense;

  return {
    total_income: parseFloat(totals.total_income.toFixed(2)),
    total_expense: parseFloat(totals.total_expense.toFixed(2)),
    total_udhari: parseFloat(totals.total_udhari.toFixed(2)),
    total_profit: netResult >= 0 ? parseFloat(netResult.toFixed(2)) : 0,
    total_loss: netResult < 0 ? parseFloat(Math.abs(netResult).toFixed(2)) : 0,
    net_result: parseFloat(netResult.toFixed(2)),
    is_profit: netResult >= 0,
    is_loss: netResult < 0,
    total_transactions: totals.total_transactions,
    income_transactions: totals.income_transactions,
    expense_transactions: totals.expense_transactions,
    udhari_transactions: totals.udhari_transactions,
    total_days: totals.total_days,
    total_weeks: totals.total_weeks,
    average_daily_income: totals.total_days > 0 ? parseFloat((totals.total_income / totals.total_days).toFixed(2)) : 0,
    average_daily_expense: totals.total_days > 0 ? parseFloat((totals.total_expense / totals.total_days).toFixed(2)) : 0,
    average_daily_udhari: totals.total_days > 0 ? parseFloat((totals.total_udhari / totals.total_days).toFixed(2)) : 0,
    average_weekly_income: totals.total_weeks > 0 ? parseFloat((totals.total_income / totals.total_weeks).toFixed(2)) : 0,
    average_weekly_expense: totals.total_weeks > 0 ? parseFloat((totals.total_expense / totals.total_weeks).toFixed(2)) : 0,
    average_weekly_udhari: totals.total_weeks > 0 ? parseFloat((totals.total_udhari / totals.total_weeks).toFixed(2)) : 0
  };
};

/**
 * Get Week Date Range
 * Helper function to get start and end dates of a week
 */
const getWeekDateRange = (date) => {
  const start = date.clone().startOf('week');
  const end = date.clone().endOf('week');
  const weekNumber = date.week();

  return {
    start,
    end,
    weekNumber
  };
};

/**
 * Get Single Month Weekly Data
 * Provides detailed data for a specific month with all weeks and daily breakdowns
 */
export const getSingleMonthWeeklyData = async (req, res) => {
  const { user_id, account_id, month, year } = req.query;

  if (!user_id || !account_id || !month || !year) {
    return res.status(400).json({
      success: false,
      msg: ["Missing required parameters", "आवश्यक पैरामीटर गुम हैं", "आवश्यक पॅरामीटर्स गहाळ आहेत"],
      error: "Required parameters missing"
    });
  }

  try {
    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        msg: ["Invalid month. Must be between 1-12", "अमान्य महीना. 1-12 के बीच होना चाहिए", "अवैध महिना. 1-12 दरम्यान असावा"],
        error: "Invalid month parameter"
      });
    }

    if (yearNum < 2020 || yearNum > 2030) {
      return res.status(400).json({
        success: false,
        msg: ["Invalid year. Must be between 2020-2030", "अमान्य वर्ष. 2020-2030 के बीच होना चाहिए", "अवैध वर्ष. 2020-2030 दरम्यान असावा"],
        error: "Invalid year parameter"
      });
    }

    // Create moment object for the specified month
    const targetMonth = moment(`${year}-${month.toString().padStart(2, '0')}`, 'YYYY-MM');
    const currentDate = moment();

    // Don't allow future months
    if (targetMonth.isAfter(currentDate, 'month')) {
      return res.status(400).json({
        success: false,
        msg: ["Cannot fetch data for future months", "भविष्य के महीनों के लिए डेटा नहीं मिल सकता", "भविष्यातील महिन्यांसाठी डेटा मिळू शकत नाही"],
        error: "Future month not allowed"
      });
    }

    // Get month data with weeks
    const monthData = await getMonthWithWeeksData(user_id, account_id, targetMonth);

    if (!monthData) {
      return res.status(404).json({
        success: false,
        msg: ["No data found for the specified month", "निर्दिष्ट महीने के लिए कोई डेटा नहीं मिला", "निर्दिष्ट महिन्यासाठी डेटा सापडले नाही"],
        error: "No data available"
      });
    }

    // Prepare response
    const response = {
      success: true,
      msg: ["Single month weekly data retrieved successfully", "एक महीने का साप्ताहिक डेटा सफलतापूर्वक प्राप्त", "एका महिन्याचा साप्ताहिक डेटा यशस्वीरित्या पुनर्प्राप्त"],
      data: {
        month_info: monthData.month_info,
        weeks_data: monthData.weeks_data,
        daily_data: monthData.daily_data,
        monthly_totals: monthData.monthly_totals,
        summary: {
          total_weeks: monthData.month_info.total_weeks,
          total_days: monthData.month_info.total_days,
          is_current_month: targetMonth.isSame(currentDate, 'month'),
          month_status: targetMonth.isSame(currentDate, 'month') ? 'current' :
            targetMonth.isBefore(currentDate, 'month') ? 'past' : 'future'
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Single month weekly data error:", error);
    return res.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

/**
 * Get Monthly Graph Data (Bonus endpoint)
 * Provides monthly comparison data
 */
export const getMonthlyGraphData = async (req, res) => {
  const { user_id, account_id, month, year } = req.query;

  if (!user_id || !account_id || !month || !year) {
    return res.status(400).json({
      success: false,
      msg: ["Missing required parameters", "आवश्यक पैरामीटर गुम हैं", "आवश्यक पॅरामीटर्स गहाळ आहेत"],
      error: "Required parameters missing"
    });
  }

  try {
    const currentMonth = moment(`${year}-${month}`, 'YYYY-MM');
    const previousMonth = currentMonth.clone().subtract(1, 'month');

    // Get monthly data
    const currentMonthData = await getMonthlyData(user_id, account_id, currentMonth);
    const previousMonthData = await getMonthlyData(user_id, account_id, previousMonth);

    // Calculate monthly totals
    const currentMonthTotals = calculateMonthlyTotals(currentMonthData);
    const previousMonthTotals = calculateMonthlyTotals(previousMonthData);

    const response = {
      success: true,
      msg: ["Monthly graph data retrieved successfully", "मासिक ग्राफ डेटा सफलतापूर्वक प्राप्त", "मासिक आलेख डेटा यशस्वीरित्या पुनर्प्राप्त"],
      data: {
        current_month: {
          month_name: currentMonth.format("MMMM YYYY"),
          month_number: currentMonth.month() + 1,
          year: currentMonth.year(),
          daily_data: currentMonthData,
          totals: currentMonthTotals
        },
        previous_month: {
          month_name: previousMonth.format("MMMM YYYY"),
          month_number: previousMonth.month() + 1,
          year: previousMonth.year(),
          daily_data: previousMonthData,
          totals: previousMonthTotals
        },
        comparison: {
          income_comparison: {
            current: currentMonthTotals.total_income,
            previous: previousMonthTotals.total_income,
            difference: currentMonthTotals.total_income - previousMonthTotals.total_income,
            percentage_change: previousMonthTotals.total_income > 0
              ? ((currentMonthTotals.total_income - previousMonthTotals.total_income) / previousMonthTotals.total_income * 100).toFixed(2)
              : "0.00"
          },
          expense_comparison: {
            current: currentMonthTotals.total_expense,
            previous: previousMonthTotals.total_expense,
            difference: currentMonthTotals.total_expense - previousMonthTotals.total_expense,
            percentage_change: previousMonthTotals.total_expense > 0
              ? ((currentMonthTotals.total_expense - previousMonthTotals.total_expense) / previousMonthTotals.total_expense * 100).toFixed(2)
              : "0.00"
          },
          profit_loss_comparison: {
            current_profit: currentMonthTotals.total_profit,
            previous_profit: previousMonthTotals.total_profit,
            difference: currentMonthTotals.total_profit - previousMonthTotals.total_profit,
            percentage_change: previousMonthTotals.total_profit !== 0
              ? ((currentMonthTotals.total_profit - previousMonthTotals.total_profit) / Math.abs(previousMonthTotals.total_profit) * 100).toFixed(2)
              : "0.00"
          }
        }
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error("Monthly graph data error:", error);
    return res.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

/**
 * Get Monthly Data
 * Fetches daily breakdown for a specific month
 */
const getMonthlyData = async (user_id, account_id, monthDate) => {
  return new Promise((resolve, reject) => {
    const startDate = monthDate.clone().startOf('month');
    const endDate = monthDate.clone().endOf('month');

    const query = `
            SELECT 
                DATE(createtime) as transaction_date,
                SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as daily_income,
                SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as daily_expense,
                SUM(CASE WHEN type = 3 THEN amount ELSE 0 END) as daily_udhari,
                COUNT(CASE WHEN type = 2 THEN 1 END) as income_transactions,
                COUNT(CASE WHEN type = 1 THEN 1 END) as expense_transactions,
                COUNT(CASE WHEN type = 3 THEN 1 END) as udhari_transactions
            FROM expense_income_master 
            WHERE user_id = ? 
            AND account_id = ? 
            AND delete_flag = 0 
            AND DATE(createtime) BETWEEN ? AND ?
            GROUP BY DATE(createtime)
            ORDER BY transaction_date ASC
        `;

    connection.query(query, [user_id, account_id, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')], (error, results) => {
      if (error) {
        return reject(error);
      }

      // Create array for all days in the month
      const dailyData = [];
      const currentDate = startDate.clone();
      const daysInMonth = endDate.date();

      for (let day = 1; day <= daysInMonth; day++) {
        const existingData = results.find(row => moment(row.transaction_date).date() === day);

        if (existingData) {
          const dailyIncome = parseFloat(existingData.daily_income) || 0;
          const dailyExpense = parseFloat(existingData.daily_expense) || 0;
          const dailyUdhari = parseFloat(existingData.daily_udhari) || 0;
          const dailyProfit = dailyIncome - dailyExpense;

          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: day,
            income: dailyIncome,
            expense: dailyExpense,
            udhari: dailyUdhari,
            profit: dailyProfit >= 0 ? dailyProfit : 0,
            loss: dailyProfit < 0 ? Math.abs(dailyProfit) : 0,
            is_profit: dailyProfit >= 0,
            is_loss: dailyProfit < 0,
            income_transactions: existingData.income_transactions,
            expense_transactions: existingData.expense_transactions,
            udhari_transactions: existingData.udhari_transactions,
            total_transactions: existingData.income_transactions + existingData.expense_transactions + existingData.udhari_transactions
          });
        } else {
          dailyData.push({
            date: currentDate.format("DD MMM, YYYY"),
            day_name: currentDate.format("dddd"),
            day_number: day,
            income: 0,
            expense: 0,
            udhari: 0,
            profit: 0,
            loss: 0,
            is_profit: false,
            is_loss: false,
            income_transactions: 0,
            expense_transactions: 0,
            udhari_transactions: 0,
            total_transactions: 0
          });
        }

        currentDate.add(1, 'day');
      }

      resolve(dailyData);
    });
  });
};

/**
 * Calculate Monthly Totals
 * Calculates totals for a month
 */
const calculateMonthlyTotals = (dailyData) => {
  const totals = dailyData.reduce((acc, day) => {
    acc.total_income += day.income;
    acc.total_expense += day.expense;
    acc.total_udhari += day.udhari;
    acc.total_profit += day.profit;
    acc.total_loss += day.loss;
    acc.total_transactions += day.total_transactions;
    acc.income_transactions += day.income_transactions;
    acc.expense_transactions += day.expense_transactions;
    acc.udhari_transactions += day.udhari_transactions;
    return acc;
  }, {
    total_income: 0,
    total_expense: 0,
    total_udhari: 0,
    total_profit: 0,
    total_loss: 0,
    total_transactions: 0,
    income_transactions: 0,
    expense_transactions: 0,
    udhari_transactions: 0
  });

  const netResult = totals.total_income - totals.total_expense;

  return {
    total_income: parseFloat(totals.total_income.toFixed(2)),
    total_expense: parseFloat(totals.total_expense.toFixed(2)),
    total_udhari: parseFloat(totals.total_udhari.toFixed(2)),
    total_profit: netResult >= 0 ? parseFloat(netResult.toFixed(2)) : 0,
    total_loss: netResult < 0 ? parseFloat(Math.abs(netResult).toFixed(2)) : 0,
    net_result: parseFloat(netResult.toFixed(2)),
    is_profit: netResult >= 0,
    is_loss: netResult < 0,
    total_transactions: totals.total_transactions,
    income_transactions: totals.income_transactions,
    expense_transactions: totals.expense_transactions,
    udhari_transactions: totals.udhari_transactions,
    average_daily_income: parseFloat((totals.total_income / dailyData.length).toFixed(2)),
    average_daily_expense: parseFloat((totals.total_expense / dailyData.length).toFixed(2)),
    average_daily_udhari: parseFloat((totals.total_udhari / dailyData.length).toFixed(2))
  };
};
