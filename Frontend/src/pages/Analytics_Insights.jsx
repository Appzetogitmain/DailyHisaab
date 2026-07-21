// File: src/pages/Analytics_Insights.jsx
import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { Filter, Save, PlusCircle, Target, TrendingUp, Users, RefreshCw, AlertCircle, Clock, Activity } from "lucide-react";
import apiService from "../services/api";

// const featureUsageData = [
//   { feature: "Voice Entry", usage: 320 },
//   { feature: "Exports", usage: 210 },
//   { feature: "Reports", usage: 150 },
//   { feature: "Consultings", usage: 95 },
// ];

const dailyVsMonthly = [
  { period: "Day 1", daily: 120, monthly: 450 },
  { period: "Day 2", daily: 90, monthly: 470 },
  { period: "Day 3", daily: 140, monthly: 490 },
  { period: "Day 4", daily: 110, monthly: 460 },
];

const regionData = [
  { region: "Karnatak", users: 400 },
  { region: "Delhi", users: 300 },
  { region: "Odisha", users: 200 },
  { region: "West Bengal", users: 150 },
  { region: "Other", users: 100 },
];

// Local fallback data removed - using real API data



const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#9A60B4"];

export default function AnalyticsInsights() {
  const [customReports, setCustomReports] = useState([]);
  const [newReport, setNewReport] = useState("");

  // Performance tracking state
  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format

  // Feature usage analytics state
  const [featureUsageData, setFeatureUsageData] = useState(null);
  const [featureUsageLoading, setFeatureUsageLoading] = useState(true);
  const [featureUsageError, setFeatureUsageError] = useState(null);
  const [featureTrendsData, setFeatureTrendsData] = useState(null);
  const [featureTrendsLoading, setFeatureTrendsLoading] = useState(false);

  // Language Analytics State
  const [languageData, setLanguageData] = useState([]);
  const [languageLoading, setLanguageLoading] = useState(true);

  // State Distribution State
  const [stateData, setStateData] = useState([]);
  const [stateLoading, setStateLoading] = useState(true);

  // Conversion Funnel State
  const [funnelData, setFunnelData] = useState([]);
  const [funnelLoading, setFunnelLoading] = useState(true);
  
  // Retention Analytics State
  const [retentionData, setRetentionData] = useState({
    d1: 52,
    d7: 31,
    d30: 18,
    churnRate: 42,
    avgSession: "8m 12s"
  });
 
  // User Acquisition State
  const [acquisitionData, setAcquisitionData] = useState([]);
  const [acquisitionLoading, setAcquisitionLoading] = useState(true);

  // Fetch conversion funnel data
  const fetchFunnelData = async () => {
    try {
      setFunnelLoading(true);
      const response = await apiService.getConversionFunnelData();
      if (response.success) {
        setFunnelData(response.data);
        if (response.retention) {
          setRetentionData(response.retention);
        }
      } else {
        console.error('Failed to fetch funnel data');
      }
    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setFunnelLoading(false);
    }
  };

  // Fetch performance bar graph data
  const fetchPerformanceData = async () => {
    try {
      setPerformanceLoading(true);
      setPerformanceError(null);
      const response = await apiService.getOverallPerformanceStats({
        month_year: selectedMonth
      });
      if (response.success) {
        setPerformanceData(response.data);
      } else {
        setPerformanceError('Failed to fetch performance data');
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
      setPerformanceError('Error loading performance data');
    } finally {
      setPerformanceLoading(false);
    }
  };

  // Fetch feature usage analytics data
  const fetchFeatureUsageData = async () => {
    try {
      setFeatureUsageLoading(true);
      setFeatureUsageError(null);
      const response = await apiService.getFeatureUsageAnalytics({
        month_year: selectedMonth
      });
      if (response.success) {
        setFeatureUsageData(response.data);
      } else {
        setFeatureUsageError('Failed to fetch feature usage data');
      }
    } catch (error) {
      console.error('Error fetching feature usage data:', error);
      setFeatureUsageError('Error loading feature usage data');
    } finally {
      setFeatureUsageLoading(false);
    }
  };

  // Fetch feature usage trends data
  const fetchFeatureTrendsData = async () => {
    try {
      setFeatureTrendsLoading(true);
      const response = await apiService.getFeatureUsageTrends({
        months: 6
      });
      if (response.success) {
        setFeatureTrendsData(response.data);
      }
    } catch (error) {
      console.error('Error fetching feature trends data:', error);
    } finally {
      setFeatureTrendsLoading(false);
    }
  };

  // Fetch language analytics data
  const fetchLanguageData = async () => {
    try {
      setLanguageLoading(true);
      const response = await apiService.getLanguageAnalytics();
      if (response.success) {
        setLanguageData(response.data);
      }
    } catch (error) {
      console.error('Error fetching language data:', error);
    } finally {
      setLanguageLoading(false);
    }
  };

  // Fetch state distribution data
  const fetchStateData = async () => {
    try {
      setStateLoading(true);
      const response = await apiService.getUserDistributionByState();
      if (response.success) {
        // Map response data to Recharts format: name and value
        // Expecting response.data to be array of { name: 'StateName', value: count, percentage: '...' }
        const formattedData = response.data.map(item => ({
          name: item.name || 'Unknown',
          value: item.value || 0
        }));
        setStateData(formattedData);
      }
    } catch (error) {
      console.error('Error fetching state data:', error);
    } finally {
      setStateLoading(false);
    }
  };

  // Fetch user acquisition statistics
  const fetchAcquisitionData = async () => {
    try {
      setAcquisitionLoading(true);
      const response = await apiService.getUserAcquisitionStats();
      if (response.success) {
        setAcquisitionData(response.data);
      }
    } catch (error) {
      console.error('Error fetching acquisition data:', error);
    } finally {
      setAcquisitionLoading(false);
    }
  };

  // Load performance data on component mount and when month changes
  useEffect(() => {
    fetchPerformanceData();
    fetchFeatureUsageData();
    fetchFeatureTrendsData();
    fetchLanguageData();
    fetchStateData();
    fetchFunnelData();
    fetchAcquisitionData();
  }, [selectedMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // eslint-disable-next-line no-unused-vars
  const handleSaveReport = () => {
    if (newReport.trim()) {
      setCustomReports([...customReports, newReport]);
      setNewReport("");
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Analytics & Insights</h1>

      {/* Performance Tracking - 8 Key Parameters */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
              Performance Tracking
            </h2>
            <p className="text-sm sm:text-base text-gray-600">User performance analysis across key financial health metrics</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700">Month:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-xs sm:text-sm"
              />
            </div>
            <button
              onClick={fetchPerformanceData}
              disabled={performanceLoading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              <RefreshCw className={`w-4 h-4 ${performanceLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Ref</span>
            </button>
          </div>
        </div>

        {performanceLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-lg text-gray-600">Loading performance data...</span>
            </div>
          </div>
        ) : performanceError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Performance Data</h3>
              <p className="text-gray-600 mb-4">{performanceError}</p>
              <button
                onClick={fetchPerformanceData}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : performanceData ? (
          <>
            {/* Performance Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-indigo-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Total Users</p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-600">
                  {performanceData.overview?.totalUsers?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-indigo-500">Analyzed users</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Average Score</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">
                  {performanceData.overview?.averageScore?.toFixed(1) || '0'}/100
                </p>
                <p className="text-xs text-green-500">Overall performance</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Excellent Users</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {performanceData.overview?.scoreDistribution?.excellent || '0'}
                </p>
                <p className="text-xs text-blue-500">80-100 points</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Good Users</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">
                  {performanceData.overview?.scoreDistribution?.good || '0'}
                </p>
                <p className="text-xs text-yellow-500">60-79 points</p>
              </div>
            </div>


            {/* PERFORMANCE CHART SECTION */}
            {performanceData.averageMetrics && (
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-semibold mb-4 text-gray-800">Average Performance Metrics</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Profitability', score: performanceData.averageMetrics.profitability, fill: '#4F46E5' },
                        { name: 'Cash Flow', score: performanceData.averageMetrics.cashFlow, fill: '#06B6D4' },
                        { name: 'Exp. Control', score: performanceData.averageMetrics.expenseControl, fill: '#10B981' },
                        { name: 'Debt Health', score: performanceData.averageMetrics.debtHealth, fill: '#F59E0B' },
                        { name: 'Stock Turn.', score: performanceData.averageMetrics.stockTurnover, fill: '#8B5CF6' },
                        { name: 'Collections', score: performanceData.averageMetrics.collections, fill: '#EC4899' },
                        { name: 'Daily Entry', score: performanceData.averageMetrics.dailyEntry, fill: '#6366F1' },
                        { name: 'Budget Usage', score: performanceData.averageMetrics.budgetUsage, fill: '#14B8A6' },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 11 }}
                        domain={[0, 'auto']} // Let it auto-scale or fix to [0, 100] if scores are normalized
                      />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        cursor={{ fill: '#F3F4F6' }}
                      />
                      <Bar
                        dataKey="score"
                        radius={[4, 4, 0, 0]}
                        barSize={30}
                      >
                        {
                          [
                            { name: 'Profitability', score: performanceData.averageMetrics.profitability, fill: '#4F46E5' },
                            { name: 'Cash Flow', score: performanceData.averageMetrics.cashFlow, fill: '#06B6D4' },
                            { name: 'Exp. Control', score: performanceData.averageMetrics.expenseControl, fill: '#10B981' },
                            { name: 'Debt Health', score: performanceData.averageMetrics.debtHealth, fill: '#F59E0B' },
                            { name: 'Stock Turn.', score: performanceData.averageMetrics.stockTurnover, fill: '#8B5CF6' },
                            { name: 'Collections', score: performanceData.averageMetrics.collections, fill: '#EC4899' },
                            { name: 'Daily Entry', score: performanceData.averageMetrics.dailyEntry, fill: '#6366F1' },
                            { name: 'Budget Usage', score: performanceData.averageMetrics.budgetUsage, fill: '#14B8A6' },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}



            {/* Performance Distribution */}
            {performanceData.performance_distribution && (
              <div className="mb-4 sm:mb-6">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">Performance Distribution</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-green-50 rounded-lg p-3 sm:p-4 text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                      {performanceData.performance_distribution.excellent || 0}
                    </div>
                    <div className="text-xs sm:text-sm text-green-700 font-medium">Excellent</div>
                    <div className="text-xs text-green-600">80-100 points</div>
                    <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((performanceData.performance_distribution.excellent || 0) / (performanceData.total_users || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3 sm:p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {performanceData.performance_distribution.good || 0}
                    </div>
                    <div className="text-sm text-yellow-700 font-medium">Good</div>
                    <div className="text-xs text-yellow-600">60-79 points</div>
                    <div className="w-full bg-yellow-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((performanceData.performance_distribution.good || 0) / (performanceData.total_users || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-orange-600 mb-1">
                      {performanceData.performance_distribution.fair || 0}
                    </div>
                    <div className="text-sm text-orange-700 font-medium">Fair</div>
                    <div className="text-xs text-orange-600">40-59 points</div>
                    <div className="w-full bg-orange-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((performanceData.performance_distribution.fair || 0) / (performanceData.total_users || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600 mb-1">
                      {performanceData.performance_distribution.poor || 0}
                    </div>
                    <div className="text-sm text-red-700 font-medium">Poor</div>
                    <div className="text-xs text-red-600">0-39 points</div>
                    <div className="w-full bg-red-200 rounded-full h-2 mt-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${((performanceData.performance_distribution.poor || 0) / (performanceData.total_users || 1)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Top Performers */}
            {performanceData.topPerformingUsers && performanceData.topPerformingUsers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Top Performers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {performanceData.topPerformingUsers && performanceData.topPerformingUsers.length > 0 ? (
                    performanceData.topPerformingUsers.map((performer, index) => (
                      <div key={performer.user_id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`
                              flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                              ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                index === 1 ? 'bg-gray-100 text-gray-700' :
                                  index === 2 ? 'bg-orange-100 text-orange-700' :
                                    'bg-indigo-100 text-indigo-700'}
                            `}>
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 truncate max-w-[120px]" title={performer.user_name}>
                              {performer.user_name || 'N/A'}
                            </span>
                          </div>
                          <span className={`
                            px-2 py-0.5 rounded-full text-xs font-medium
                            ${performer.grade === 'Excellent' ? 'bg-green-100 text-green-800' :
                              performer.grade === 'Good' ? 'bg-blue-100 text-blue-800' :
                                performer.grade === 'Fair' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'}
                          `}>
                            {performer.performance_grade}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="text-gray-600">Score:</span>
                          <span className="font-bold text-gray-900">{performer.total_score}</span>
                        </div>

                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Mobile:</span>
                          <span className="text-gray-900">{performer.mobile}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      No top performers found for this period.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Insights */}
            {performanceData.insights && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Key Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {performanceData.insights.best_performing_parameter && (
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-green-800">Best Performing Parameter</span>
                      </div>
                      <p className="text-green-700 font-semibold capitalize">
                        {performanceData.insights.best_performing_parameter.parameter?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-green-600">
                        Average Score: {performanceData.insights.best_performing_parameter.average_score}
                      </p>
                    </div>
                  )}

                  {performanceData.insights.worst_performing_parameter && (
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-red-800">Needs Improvement</span>
                      </div>
                      <p className="text-red-700 font-semibold capitalize">
                        {performanceData.insights.worst_performing_parameter.parameter?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm text-red-600">
                        Average Score: {performanceData.insights.worst_performing_parameter.average_score}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Performance Data</h3>
              <p className="text-gray-600">No performance data available for the selected month.</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature Usage Analytics */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              Feature Usage Analytics
            </h2>
            <p className="text-sm sm:text-base text-gray-600">Track usage of key features across all users for trend analysis</p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                fetchFeatureUsageData();
                fetchFeatureTrendsData();
              }}
              disabled={featureUsageLoading || featureTrendsLoading}
              className="flex items-center gap-2 bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              <RefreshCw className={`w-4 h-4 ${featureUsageLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Ref</span>
            </button>
          </div>
        </div>

        {featureUsageLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-lg text-gray-600">Loading feature usage data...</span>
            </div>
          </div>
        ) : featureUsageError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Feature Usage Data</h3>
              <p className="text-gray-600 mb-4">{featureUsageError}</p>
              <button
                onClick={fetchFeatureUsageData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : featureUsageData ? (
          <>
            {/* Feature Usage Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-blue-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Total Active Users</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">
                  {featureUsageData.totalActiveUsers?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-blue-500">Across all features</p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Most Used Feature</p>
                <p className="text-base sm:text-lg font-bold text-green-600">
                  {featureUsageData.mostUsedFeature || 'N/A'}
                </p>
                <p className="text-xs text-green-500">
                  {featureUsageData.mostUsedCount || 0} users
                </p>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Fastest Growing</p>
                <p className="text-base sm:text-lg font-bold text-purple-600">
                  {featureUsageData.fastestGrowingFeature || 'N/A'}
                </p>
                <p className="text-xs text-purple-500">
                  {featureUsageData.fastestGrowingPct || 0}% growth
                </p>
              </div>
              <div className="bg-orange-50 rounded-xl p-3 sm:p-4 text-center">
                <p className="text-xs sm:text-sm text-gray-600">Engagement Score</p>
                <p className="text-xl sm:text-2xl font-bold text-orange-600">
                  {featureUsageData.engagementScore?.toFixed(1) || '0'}/10
                </p>
                <p className="text-xs text-orange-500">Overall engagement</p>
              </div>
            </div>

            {/* Feature Usage Comparison Chart */}
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-800">Feature Usage Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={featureUsageData.featureUsageComparison || []} margin={{ top: 15, right: 15, left: 15, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="feature"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                    fontSize={10}
                  />
                  <YAxis
                    label={{ value: 'Active Users', angle: -90, position: 'insideLeft' }}
                    fontSize={10}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                            <p className="font-semibold text-gray-800 mb-2">{label}</p>
                            <div className="space-y-1 text-sm">
                              <p><span className="font-medium">Current Users:</span> {data.current || 0}</p>
                              <p><span className="font-medium">Previous Users:</span> {data.previous || 0}</p>
                              <p><span className="font-medium">Growth:</span> {data.growth}%</p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="current"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    name="Active Users"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Feature Usage Trends (Last 6 Months) */}
            {featureUsageData.featureUsageTrends && featureUsageData.featureUsageTrends.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Feature Usage Trends (Last 6 Months)</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={featureUsageData.featureUsageTrends} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis
                      label={{ value: 'Active Users', angle: -90, position: 'insideLeft' }}
                      fontSize={12}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="active_users"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      name="Total Active Users"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Growth Trends Cards */}
            {featureUsageData.featureGrowthTrends && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">Feature Growth Trends</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {featureUsageData.featureGrowthTrends.map((trend, index) => (
                    <div key={index} className={`rounded-lg p-4 ${trend.status === 'Growing' ? 'bg-green-50' :
                      trend.status === 'Declining' ? 'bg-red-50' : 'bg-gray-50'
                      }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{trend.feature}</span>
                        <span className={`text-sm font-bold ${trend.status === 'Growing' ? 'text-green-600' :
                          trend.status === 'Declining' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                          {trend.growth > 0 ? '+' : ''}{trend.growth}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Current: {trend.current} users</p>
                        <p>Previous: {trend.previous} users</p>
                      </div>
                      <div className={`text-xs font-medium mt-2 ${trend.status === 'Growing' ? 'text-green-700' :
                        trend.status === 'Declining' ? 'text-red-700' : 'text-gray-700'
                        }`}>
                        {trend.status === 'Growing' ? '📈 Growing' :
                          trend.status === 'Declining' ? '📉 Declining' : '📊 Stable'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Feature Usage Data</h3>
              <p className="text-gray-600">No feature usage data available for the selected month.</p>
            </div>
          </div>
        )}
      </div>

      {/* Feature Usage */}
      {/* <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Feature Usage Statistics</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={featureUsageData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="feature" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="usage" fill="#0088FE" />
          </BarChart>
        </ResponsiveContainer>
      </div> */}

      {/* Daily vs Monthly Usage */}
      <div className="bg-white shadow rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3">Daily vs Monthly Usage</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyVsMonthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="daily" stroke="#00C49F" />
            <Line type="monotone" dataKey="monthly" stroke="#FF8042" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* User Language Distribution */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-3">User Language Distribution</h2>
          <div className="h-64">
            {languageLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : languageData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                  >
                    {languageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} Users`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No language data available
              </div>
            )}
          </div>
        </div>

        {/* User State Distribution */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold mb-3">User State Distribution</h2>
          <div className="h-64">
            {stateLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : stateData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stateData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#82ca9d"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {stateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} Users`, name]}
                  />
                  <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No state data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Acquisition Channels */}
      <div className="bg-white shadow rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg font-semibold mb-3">Top Acquisition Channels</h2>
        <div className="h-[250px]">
          {acquisitionLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : acquisitionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={acquisitionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="users" fill="#9A60B4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No acquisition data available
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Conversion Funnel
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Section */}
          <div className="lg:col-span-2 bg-gray-50 rounded-xl p-3 sm:p-4">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={funnelData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="stage" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 12, fontWeight: 500 }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: 'rgba(229, 231, 235, 0.4)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {funnelData.map((entry, index) => {
                    const colors = {
                      "Installs": "#6366F1",
                      "Sign Up": "#3B82F6",
                      "Active Users": "#10B981",
                      "Inactive Users": "#6B7280",
                      "Free Users": "#F59E0B",
                      "Paid Users": "#8B5CF6"
                    };
                    return <Cell key={`cell-${index}`} fill={colors[entry.stage] || "#9CA3AF"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cards Section */}
          <div className="flex flex-col justify-between gap-3 max-h-[320px] overflow-y-auto pr-1">
            {funnelData.map((item, index) => {
              const installsCount = funnelData.find(f => f.stage === "Installs")?.count || 1;
              const conversionRate = installsCount > 0 ? ((item.count / installsCount) * 100).toFixed(1) : "0.0";
              
              const stageDetails = {
                "Installs": { desc: "App downloaded", color: "indigo", bg: "bg-indigo-50 text-indigo-700 border-indigo-100" },
                "Sign Up": { desc: "Account created", color: "blue", bg: "bg-blue-50 text-blue-700 border-blue-100" },
                "Active Users": { desc: "Used app in last 7 days", color: "emerald", bg: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                "Inactive Users": { desc: "Installed but not opening app", color: "gray", bg: "bg-gray-100 text-gray-700 border-gray-200" },
                "Free Users": { desc: "Active but not subscribed", color: "amber", bg: "bg-amber-50 text-amber-700 border-amber-100" },
                "Paid Users": { desc: "Subscription active", color: "purple", bg: "bg-purple-50 text-purple-700 border-purple-100" }
              };

              const details = stageDetails[item.stage] || { desc: "User stage", color: "gray", bg: "bg-gray-50 text-gray-700 border-gray-100" };

              return (
                <div key={item.stage} className={`border rounded-xl p-3 flex justify-between items-center transition-all hover:translate-x-1 ${details.bg}`}>
                  <div>
                    <h3 className="text-sm font-bold truncate">{item.stage}</h3>
                    <p className="text-xs opacity-75">{details.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-extrabold">{item.count.toLocaleString()}</p>
                    <p className="text-[10px] font-medium opacity-75">{conversionRate}% conv.</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Retention Analytics */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Retention Overview</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Retention Curve / Progress bars */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">User Retention Curve</h3>
            
            {/* D1 Retention */}
            <div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-700 mb-1">
                <span>D1 Retention (Day 1)</span>
                <span className="text-indigo-600 font-bold">{retentionData.d1}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div 
                  className="bg-indigo-500 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${retentionData.d1}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Users who returned 1 day after install</p>
            </div>

            {/* D7 Retention */}
            <div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-700 mb-1">
                <span>D7 Retention (Week 1)</span>
                <span className="text-blue-600 font-bold">{retentionData.d7}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div 
                  className="bg-blue-500 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${retentionData.d7}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Users who returned 7 days after install</p>
            </div>

            {/* D30 Retention */}
            <div>
              <div className="flex justify-between items-center text-sm font-medium text-gray-700 mb-1">
                <span>D30 Retention (Month 1)</span>
                <span className="text-purple-600 font-bold">{retentionData.d30}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div 
                  className="bg-purple-500 h-3 rounded-full transition-all duration-500" 
                  style={{ width: `${retentionData.d30}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Users who returned 30 days after install</p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex flex-col justify-between gap-4">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Key Retention Metrics</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
              {/* Churn Rate Card */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <div>
                  <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider px-2 py-0.5 bg-amber-100 rounded-md">
                    Churn Risk
                  </span>
                  <p className="text-3xl sm:text-4xl font-extrabold text-orange-600 mt-4">{retentionData.churnRate}%</p>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-bold text-gray-800">Churn Rate</h4>
                  <p className="text-xs text-gray-500">Users who stopped using the app after 30 days</p>
                </div>
              </div>

              {/* Avg Session Duration Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider px-2 py-0.5 bg-emerald-100 rounded-md">
                    Engagement
                  </span>
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-3xl sm:text-4xl font-extrabold text-emerald-600 mt-4">{retentionData.avgSession}</p>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-bold text-gray-800">Avg Session Duration</h4>
                  <p className="text-xs text-gray-500">Average time spent per app session</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Reports */}
      {/* <div className="bg-white shadow rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">📌 Custom Reports</h2>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter report name"
            value={newReport}
            onChange={(e) => setNewReport(e.target.value)}
            className="p-2 border rounded w-full"
          />
          <button
            onClick={handleSaveReport}
            className="bg-green-500 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-600"
          >
            <Save size={16} /> Save
          </button>
        </div>
        {customReports.length > 0 && (
          <ul className="list-disc list-inside text-gray-700">
            {customReports.map((report, idx) => (
              <li key={idx}>{report}</li>
            ))}
          </ul>
        )}
      </div> */}
    </div>
  );
}
