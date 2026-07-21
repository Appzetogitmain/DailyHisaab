import express from 'express';
import { getAllContentUrl, getContent } from '../controller/getController.js';
import verifyToken, { verifyAdminToken } from './authentication.js';
import { authenticateUser, contactUs, deleteAccount, editProfile, getUserProfile, loginWithMobile, otpVerify, resendOtp, signUpWithMobile } from '../controller/userController.js';
import upload from '../controller/multer.js';
import { addCategory, setAppLock, updateAppLock, getUserCategory, editCategory, deleteCategory, getAllCategory, getFaq, addCustomers, getTeamMembers, deleteTeamMember, editTeamMember, addTeamMember, removeAppLock, createSupportTicket, getSupportTickets, getUserAccount, createUserAccount, getSubscriptionData, getUserSubscription, deleteUserAccount, addBudget, updateBudget, deleteBudget, notificationOnOff, purchaseSubscription, addExpenseIncomeUdhari, getCustomer, getMonthlyTransactions, getHomePageApi, getBudget, getUdhari, getGrocery, getReceivablePayableUdhari, editCustomer, deleteCustomer, getDailyProfitLoss, getUserImage, getRazorpayConfig, updateUdhari, markUdhariAsPaid, updateExpenseIncome, deleteExpenseIncome, getUserReminders, exportData, exportBudget } from '../controller/allController.js';
import { createAppRating, getAppRatingFeedback, getAppRatingStats, createFeedback, getUserFeedback, getAllFeedback, updateFeedbackResponse, deleteFeedback, getFeedbackStats } from '../controller/feedbackController.js';
import { getContactUsData, createContactConfig, updateContactConfig, deleteContactConfig, getAllContactConfigs, createAppDownloadLink, updateAppDownloadLink, deleteAppDownloadLink, getAllAppDownloadLinks } from '../controller/contactUsController.js';
import { addOpeningStock, getStockLedger, addPurchaseStock } from '../controller/stockController.js';
import { addOrUpdateOpeningStock, addPurchaseStockMonthly, updatePurchaseStock, adminCloseStockMonth, getMonthlyStockLedger, getSingleStockMonth, getAllStockMonths, addOrUpdateClosingStock, closeStockMonth, exportMonthlyStock } from '../controller/monthlyStockController.js';
import { getFeatureUsageAnalyticsAPI, getFeatureUsageTrendsAPI } from '../controller/performanceTrackingController.js';
import { adminRegister, adminLogin, getAllUsersWithAccounts, getInactiveUsers, createSubscriptionPlan, updateSubscriptionPlan, deleteSubscriptionPlan, getAllSubscriptionPlans, getAllPaymentHistory, getAllUsersSubscriptionHistory, getAllSupportTickets, createAdminCategory, updateAdminCategory, deleteAdminCategory, getAllAdminCategories, permanentlyDeleteUser } from '../controller/adminController.js';
import { getDetailedUserInfo, manageUserStatus, unsuspendUser, forceLogoutUsers } from '../controller/userManagementController.js';
import { getDashboardData } from '../controller/dashboardController.js';
import { getComprehensiveAdminStats, getUserStatsByPlan } from '../controller/adminStatsController.js';
import { getAvailablePlans, manualUpgradeUser, bulkManualUpgradeUsers, getManualUpgradeHistory, getManualUpgradeStats, searchUserByMobile, searchUsersByMobileAutocomplete } from '../controller/manualUpgradeController.js';
import { updateSupportTicketStatus, deleteSupportTicket, getSupportTicketDetails, getSupportTicketStats } from '../controller/supportTicketController.js';
import { createRazorpayOrder, verifyRazorpayPayment, getPaymentHistory, handleRazorpayWebhook } from '../controller/paymentController.js';
import { createRecurringPayment, getAllRecurringPayments, executeRecurringPayments, updateRecurringPayment, deleteRecurringPayment, exportRecurringPayments } from '../controller/recurringPaymentController.js';
import { getWeeklyGraphData, getSingleMonthWeeklyData, getMonthlyGraphData } from '../controller/weeklyGraphController.js';
import { createNotificationCampaign, sendNotificationCampaign, getAllNotificationCampaigns, getNotificationSystemStats, updateUserDeviceToken, getNotificationPerformanceStats, updateNotificationCampaign, deleteNotificationCampaign, getUserNotificationDetails, updateNotificationStatus, sendTestNotification } from '../controller/notificationController.js';
import { createBanner, getAllBanners, updateBanner, deleteBanner, createTutorial, getAllTutorials, updateTutorial, deleteTutorial, trackTutorialView, getTutorialAnalytics } from '../controller/contentController.js';
import { getAllPolicyCategories, getPolicyPointsByCategory, createPolicyPoint, updatePolicyPoint, deletePolicyPoint, reorderPolicyPoints, createPolicyVersion, getPolicyVersionHistory, getPublicPolicyContent, acceptPolicyVersion, getUserPolicyAcceptance } from '../controller/termsConditionsController.js';
import { getFaqCategories, getFaqsByCategory, getFaqById, searchFaqs, getAllFaqCategories, getAllFaqs, createFaqCategory, createFaqItem, updateFaqItem, deleteFaqItem, getFaqAnalytics, updateFaqCategory, deleteFaqCategory } from '../controller/faqController.js';
import { generateUserReferralCode, getUserReferralStats, checkFreeTrialEligibility, activateFreeTrial, applyReferralCode, getReferralAnalytics, activatePendingRewards } from '../controller/referralController.js';
import { getUserGrowthReport, getUserActivityReport, getSubscriptionRevenueReport, getBusinessHealthReport, getExpenseBreakdown, getIncomeBreakdown, getComprehensiveReport, getRevenueChartData, getUserDistributionByState } from '../controller/adminReportController.js';
import { managerLogin, verifyManagerToken, verifyManagerTokenWithContext, checkManagerPermission } from '../router/managerAuthentication.js';
import { managerLoginWithOTP, managerVerifyOTP, managerResendOTP, addManager, getManagers, updateManager, removeManager, getManagerActivityLog, getManagerProfile, updateManagerProfile } from '../controller/managerController.js';
import { managerLoginOTPSchema, managerVerifyOTPSchema, managerResendOTPSchema } from '../validations/signUpWithMobile.js';
import { calculatePerformanceScore, getUserPerformanceScore, getUserPerformanceHistory, getOverallPerformanceStats as getUserOverallPerformanceStats } from '../controller/performanceTrackingController.js';
import { getOverallPerformanceStats, getUserPerformanceReport, getPerformanceComparison, getFeatureUsageAnalytics } from '../controller/adminPerformanceController.js';
import { getPerformanceBarGraphData, getPerformanceTrends, getUserPerformanceComparison, getConversionFunnelData } from '../controller/performanceVisualizationController.js';
import { getBusinessPerformanceScore } from '../controller/businessPerformanceController.js';
import { getLanguages, addLanguage, toggleLanguageStatus, updateUserLanguage, getLanguageAnalytics, editLanguage, deleteLanguage } from '../controller/languageController.js';
import { getUserAcquisitionStats, getUserAcquisitionDetails } from '../controller/adminAcquisitionController.js';

var router = express.Router();

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    // Multer error
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(200).json({
        success: false,
        msg: ['File too large', 'फ़ाइल बहुत बड़ी है', 'फाइल खूप मोठी आहे'],
        key: 'icon'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(200).json({
        success: false,
        msg: ['Unexpected file field', 'अपेक्षित नहीं फ़ाइल फ़ील्ड', 'अनपेक्षित फाइल फील्ड'],
        key: 'icon'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(200).json({
        success: false,
        msg: ['Too many files', 'बहुत सारी फ़ाइलें', 'खूप फाइल्स'],
        key: 'icon'
      });
    }

    // Cloudinary or other upload errors
    if (err.message && err.message.includes('Cloudinary')) {
      return res.status(200).json({
        success: false,
        msg: ['Image upload failed', 'छवि अपलोड विफल', 'प्रतिमा अपलोड अयशस्वी'],
        error: err.message,
        key: 'icon'
      });
    }

    // Generic error
    return res.status(200).json({
      success: false,
      msg: ['File upload error', 'फ़ाइल अपलोड त्रुटि', 'फाइल अपलोड त्रुटी'],
      error: err.message || 'Unknown upload error',
      key: 'icon'
    });
  }
  next();
};
router.get("/get_content", getContent);
router.get("/get_all_content_url", getAllContentUrl);
router.post("/login_with_mobile", upload.none(), loginWithMobile);
router.post("/sign_up_with_mobile", upload.none(), signUpWithMobile);
router.post("/authenticate_user", upload.none(), authenticateUser);
router.post("/resend_otp", upload.none(), resendOtp);
router.post("/otp_verify", upload.none(), otpVerify);
router.post("/support", upload.none(), contactUs);
router.post("/delete_account", verifyToken, upload.none(), deleteAccount);
router.post("/edit_profile", verifyToken, upload.single("image"), editProfile);
router.get("/get_user_profile", verifyToken, getUserProfile);
router.post("/set_app_lock", verifyToken, upload.none(), setAppLock);
router.post("/update_app_lock", verifyToken, upload.none(), updateAppLock);
router.post("/remove_app_lock", verifyToken, upload.none(), removeAppLock);
router.post("/add_category", verifyToken, upload.single("icon"), handleMulterError, addCategory);
router.get("/get_user_category", verifyToken, upload.none(), getUserCategory);
router.post("/edit_category", verifyToken, upload.single("icon"), handleMulterError, editCategory);
router.post("/delete_category", verifyToken, upload.none(), deleteCategory);
router.get("/get_all_category", verifyToken, getAllCategory);

router.get("/get_faq", verifyToken, getFaq);

router.post("/add_customers", upload.none(), addCustomers);
router.post("/edit_customer", verifyToken, upload.none(), editCustomer);
router.post("/delete_customer", verifyToken, upload.none(), deleteCustomer);
router.get("/get_customer", verifyToken, getCustomer);
router.get("/get_team_members", verifyToken, getTeamMembers);
router.post("/delete_team_member", verifyToken, upload.none(), deleteTeamMember);
router.post("/edit_team_member", verifyToken, upload.none(), editTeamMember);
router.post("/add_team_member", verifyToken, upload.none(), addTeamMember);
router.post("/create_support_ticket", verifyToken, upload.single("screenshot"), createSupportTicket);
router.get("/get_support_ticket", verifyToken, getSupportTickets);

// App Rating and Feedback Management Routes
router.post("/rate_app", verifyToken, upload.none(), createAppRating);
router.get("/admin/get_app_rating_feedback", verifyAdminToken, getAppRatingFeedback);
router.get("/admin/get_app_rating_stats", verifyAdminToken, getAppRatingStats);

// Feedback Management Routes
router.post("/create_feedback", verifyToken, upload.none(), createFeedback);
router.get("/get_user_feedback", verifyToken, getUserFeedback);
router.post("/create_user_account", upload.none(), createUserAccount);
router.get("/get_user_account", verifyToken, getUserAccount);
router.post("/delete_user_account", upload.none(), verifyToken, deleteUserAccount);
router.get("/get_subscription", verifyToken, getSubscriptionData);
router.get("/get_user_subscription", verifyToken, getUserSubscription);
router.post("/purchase_subscription", verifyToken, upload.none(), purchaseSubscription);
router.post("/add_budget", verifyToken, upload.none(), addBudget);
router.put("/update_budget", verifyToken, upload.none(), updateBudget);
router.delete("/delete_budget", verifyToken, upload.none(), deleteBudget);
router.post("/notification_on_off", verifyToken, upload.none(), notificationOnOff);
router.post("/add_expense_income_udhari", upload.single("image"), verifyToken, addExpenseIncomeUdhari);
router.put("/update_expense_income", verifyToken, upload.single("image"), updateExpenseIncome);
router.delete("/delete_expense_income", verifyToken, upload.none(), deleteExpenseIncome);
router.get("/get_transactions", verifyToken, getMonthlyTransactions);
router.get("/get_home_page", verifyToken, getHomePageApi);
router.get("/get_budget", verifyToken, getBudget);

// Reminder System
router.get("/get_user_reminders", verifyToken, getUserReminders);

// Export Data
router.get("/export_data", verifyToken, exportData);
router.get("/export_budget", verifyToken, exportBudget);

router.get("/get_udhari", verifyToken, getUdhari);
router.get("/get_grocery", verifyToken, getGrocery);
router.get("/get_receivable_payable", verifyToken, getReceivablePayableUdhari);
router.get("/get_daily_profit_loss", verifyToken, getDailyProfitLoss);
router.get("/get_user_image", verifyToken, getUserImage);
// Old stock system (keeping for backward compatibility)
// router.post("/add_opening_stock", verifyToken, upload.none(), addOpeningStock);
// router.post("/add_purchase_stock", verifyToken, upload.none(), addPurchaseStock);
// router.get("/get_stock_ledger", verifyToken, getStockLedger);

// New monthly stock system
router.post("/add_or_update_opening_stock", verifyToken, upload.none(), addOrUpdateOpeningStock);
router.post("/add_purchase_stock_monthly", verifyToken, upload.none(), addPurchaseStockMonthly);
router.put("/update_purchase_stock", verifyToken, upload.none(), updatePurchaseStock);
router.post("/add_or_update_closing_stock", verifyToken, upload.none(), addOrUpdateClosingStock);
router.post("/close_stock_month", verifyToken, upload.none(), closeStockMonth);
router.get("/get_monthly_stock_ledger", verifyToken, getMonthlyStockLedger);
router.get("/get_single_stock_month", verifyToken, getSingleStockMonth);
router.get("/get_all_stock_months", verifyToken, getAllStockMonths);
router.get("/export_monthly_stock", verifyToken, exportMonthlyStock);

// Admin only - Manual stock month closure (emergency use)
router.post("/admin/close_stock_month", verifyAdminToken, upload.none(), adminCloseStockMonth);

// Admin routes
router.post("/admin_register", upload.none(), adminRegister);
router.post("/admin_login", adminLogin);
router.get("/admin/get_all_users_with_accounts", verifyAdminToken, getAllUsersWithAccounts);
router.get("/admin/get_inactive_users", verifyAdminToken, getInactiveUsers);
router.get("/admin/get_detailed_user_info", verifyAdminToken, getDetailedUserInfo);
router.get("/admin/get_user_details", verifyAdminToken, getDetailedUserInfo);
router.delete("/admin/permanently_delete_user", verifyAdminToken, upload.none(), permanentlyDeleteUser);
router.post("/admin/manage_user_status", verifyAdminToken, upload.none(), manageUserStatus);
router.put("/admin/unsuspend_user", verifyAdminToken, upload.none(), unsuspendUser);
router.post("/admin/force_logout", verifyAdminToken, upload.none(), forceLogoutUsers);
router.get("/admin/dashboard", verifyAdminToken, getDashboardData);

// Admin Statistics Routes
router.get("/admin/comprehensive_stats", verifyAdminToken, getComprehensiveAdminStats);
router.get("/admin/user_stats_by_plan", verifyAdminToken, getUserStatsByPlan);
router.get("/admin/user_acquisition_stats", verifyAdminToken, getUserAcquisitionStats);
router.get("/admin/user_acquisition_details", verifyAdminToken, getUserAcquisitionDetails);

// Feature Usage Analytics Routes
router.get("/admin/feature_usage_analytics", verifyAdminToken, getFeatureUsageAnalyticsAPI);
router.get("/admin/feature_usage_trends", verifyAdminToken, getFeatureUsageTrendsAPI);

// Admin Manual Upgrade Routes
router.get("/admin/get_available_plans", verifyAdminToken, getAvailablePlans);
router.get("/admin/search_user_by_mobile", verifyAdminToken, searchUserByMobile);
router.get("/admin/search_users_autocomplete", verifyAdminToken, searchUsersByMobileAutocomplete);
router.post("/admin/manual_upgrade_user", verifyAdminToken, manualUpgradeUser);
router.post("/admin/bulk_manual_upgrade_users", verifyAdminToken, bulkManualUpgradeUsers);
router.get("/admin/get_manual_upgrade_history", verifyAdminToken, getManualUpgradeHistory);
router.get("/admin/get_manual_upgrade_stats", verifyAdminToken, getManualUpgradeStats);

// Admin Subscription Plan Management
router.post("/admin/create_subscription_plan", verifyAdminToken, upload.none(), createSubscriptionPlan);
router.put("/admin/update_subscription_plan", verifyAdminToken, upload.none(), updateSubscriptionPlan);
router.delete("/admin/delete_subscription_plan", verifyAdminToken, upload.none(), deleteSubscriptionPlan);
router.get("/admin/get_all_subscription_plans", verifyAdminToken, getAllSubscriptionPlans);

// Admin Payment History Management
router.get("/admin/get_all_payment_history", verifyAdminToken, getAllPaymentHistory);

// Admin User Subscription History Management
router.get("/admin/get_all_users_subscription_history", verifyAdminToken, getAllUsersSubscriptionHistory);

// Admin Support Ticket Management
router.get("/admin/get_all_support_tickets", verifyAdminToken, getAllSupportTickets);
router.put("/admin/update_support_ticket_status", verifyAdminToken, upload.none(), updateSupportTicketStatus);
router.delete("/admin/delete_support_ticket", verifyAdminToken, upload.none(), deleteSupportTicket);
router.get("/admin/get_support_ticket_details", verifyAdminToken, getSupportTicketDetails);
router.get("/admin/get_support_ticket_stats", verifyAdminToken, getSupportTicketStats);

// Admin Category Management
router.post("/admin/create_category", verifyAdminToken, upload.single("icon"), handleMulterError, createAdminCategory);
router.put("/admin/update_category", verifyAdminToken, upload.single("icon"), handleMulterError, updateAdminCategory);
router.delete("/admin/delete_category", verifyAdminToken, upload.none(), deleteAdminCategory);
router.get("/admin/get_all_categories", verifyAdminToken, getAllAdminCategories);

// Admin Feedback Management
router.get("/admin/get_all_feedback", verifyAdminToken, getAllFeedback);
router.put("/admin/update_feedback_response", verifyAdminToken, upload.none(), updateFeedbackResponse);
router.delete("/admin/delete_feedback", verifyAdminToken, upload.none(), deleteFeedback);
router.get("/admin/get_feedback_stats", verifyAdminToken, getFeedbackStats);

// Contact Us Management (Public)
router.get("/get_contact_us_data", getContactUsData);

// Admin Contact Us Management
router.post("/admin/create_contact_config", verifyAdminToken, upload.none(), createContactConfig);
router.put("/admin/update_contact_config", verifyAdminToken, upload.none(), updateContactConfig);
router.delete("/admin/delete_contact_config", verifyAdminToken, upload.none(), deleteContactConfig);
router.get("/admin/get_all_contact_configs", verifyAdminToken, getAllContactConfigs);

// Admin App Download Links Management
router.post("/admin/create_app_download_link", verifyAdminToken, upload.none(), createAppDownloadLink);
router.put("/admin/update_app_download_link", verifyAdminToken, upload.none(), updateAppDownloadLink);
router.delete("/admin/delete_app_download_link", verifyAdminToken, upload.none(), deleteAppDownloadLink);
router.get("/admin/get_all_app_download_links", verifyAdminToken, getAllAppDownloadLinks);


// Payment Routes
router.get("/get_razorpay_config", getRazorpayConfig);
router.post("/create_razorpay_order", verifyToken, upload.none(), createRazorpayOrder);
router.post("/verify_razorpay_payment", verifyToken, upload.none(), verifyRazorpayPayment);
router.get("/get_payment_history", verifyToken, getPaymentHistory);
router.post("/razorpay_webhook", handleRazorpayWebhook);

// Udhari (Debt) Management Routes
router.put("/update_udhari", verifyToken, upload.none(), updateUdhari);
router.post("/mark_udhari_as_paid", verifyToken, upload.none(), markUdhariAsPaid);

// Recurring Payment Management Routes
router.post("/create_recurring_payment", verifyToken, upload.none(), createRecurringPayment);
router.get("/get_recurring_payments", verifyToken, getAllRecurringPayments);
router.post("/execute_recurring_payments", upload.none(), executeRecurringPayments); // No auth required for system automation
router.put("/update_recurring_payment", verifyToken, upload.none(), updateRecurringPayment);
router.delete("/delete_recurring_payment", verifyToken, upload.none(), deleteRecurringPayment);
router.get("/export_recurring_payments", verifyToken, exportRecurringPayments);

// Graph Data Routes
router.get("/get_weekly_graph_data", verifyToken, getWeeklyGraphData);
router.get("/get_single_month_weekly_data", verifyToken, getSingleMonthWeeklyData);
router.get("/get_monthly_graph_data", verifyToken, getMonthlyGraphData);

// Notification Management Routes
// Admin Notification Routes
router.post("/admin/create_notification_campaign", upload.none(), verifyAdminToken, createNotificationCampaign);
router.put("/admin/update_notification_campaign", verifyAdminToken, upload.none(), updateNotificationCampaign);
router.delete("/admin/delete_notification_campaign", verifyAdminToken, upload.none(), deleteNotificationCampaign);
router.post("/admin/send_notification_campaign", verifyAdminToken, upload.none(), sendNotificationCampaign);
router.get("/admin/get_all_notification_campaigns", verifyAdminToken, getAllNotificationCampaigns);
router.get("/admin/get_notification_performance_stats", verifyAdminToken, getNotificationPerformanceStats);
router.get("/admin/get_notification_system_stats", verifyAdminToken, getNotificationSystemStats);
router.get("/admin/get_user_notification_details", verifyAdminToken, getUserNotificationDetails);
router.post("/admin/notification_on_off", verifyAdminToken, upload.none(), notificationOnOff);

// User Notification Routes
router.post("/update_device_token", verifyToken, upload.none(), updateUserDeviceToken);
router.post("/update_notification_status", verifyToken, upload.none(), updateNotificationStatus);

// Test Notification Route (Simple test API)
router.post("/send-notification", upload.none(), sendTestNotification);


// Content Management Routes
// Banner Management Routes
router.post("/admin/create_banner", verifyAdminToken, upload.none(), createBanner);
router.get("/admin/get_all_banners", verifyAdminToken, getAllBanners);
router.put("/admin/update_banner/:banner_id", verifyAdminToken, upload.none(), updateBanner);
router.delete("/admin/delete_banner/:banner_id", verifyAdminToken, upload.none(), deleteBanner);

// Tutorial Management Routes
router.post("/admin/create_tutorial", verifyAdminToken, upload.none(), createTutorial);
router.get("/admin/get_all_tutorials", verifyAdminToken, getAllTutorials);
router.put("/admin/update_tutorial/:tutorial_id", verifyAdminToken, upload.none(), updateTutorial);
router.delete("/admin/delete_tutorial/:tutorial_id", verifyAdminToken, upload.none(), deleteTutorial);
router.get("/admin/get_tutorial_analytics/:tutorial_id", verifyAdminToken, getTutorialAnalytics);

// User Tutorial Routes (for tracking views)
router.post("/track_tutorial_view/:tutorial_id", verifyToken, upload.none(), trackTutorialView);

// Terms & Conditions Management Routes
// Admin Policy Management Routes
router.get("/admin/get_all_policy_categories", verifyAdminToken, getAllPolicyCategories);
router.get("/admin/get_policy_points/:category_id", verifyAdminToken, getPolicyPointsByCategory);
router.post("/admin/create_policy_point", verifyAdminToken, upload.none(), createPolicyPoint);
router.put("/admin/update_policy_point/:point_id", verifyAdminToken, upload.none(), updatePolicyPoint);
router.delete("/admin/delete_policy_point/:point_id", verifyAdminToken, upload.none(), deletePolicyPoint);
router.put("/admin/reorder_policy_points/:category_id", verifyAdminToken, upload.none(), reorderPolicyPoints);

// Admin Policy Version Management Routes
router.post("/admin/create_policy_version", verifyAdminToken, upload.none(), createPolicyVersion);
router.get("/admin/get_policy_version_history/:category_id", verifyAdminToken, getPolicyVersionHistory);

// User Policy Routes (Public Access)
router.get("/get_policy_content/:category_name", getPublicPolicyContent);
router.get("/get_all_policy_categories", getAllPolicyCategories);
router.get("/get_policy_points/:category_id", getPolicyPointsByCategory);
router.post("/accept_policy_version/:version_id", verifyToken, upload.none(), acceptPolicyVersion);
router.get("/get_user_policy_acceptance", verifyToken, getUserPolicyAcceptance);

// Convenient alias routes for common policy types (Public Access)
router.get("/terms-and-conditions", (req, res) => {
  req.params.category_name = 'terms';
  getPublicPolicyContent(req, res);
});
router.get("/privacy-policy", (req, res) => {
  req.params.category_name = 'privacy';
  getPublicPolicyContent(req, res);
});
router.get("/about-us", (req, res) => {
  req.params.category_name = 'about';
  getPublicPolicyContent(req, res);
});

// FAQ System Routes
// User FAQ Routes (Public Access)
router.get("/get_faq_categories", getFaqCategories);
router.get("/get_faqs_by_category/:category_name", getFaqsByCategory);
router.get("/get_faq_by_id/:faq_id", getFaqById);
router.get("/search_faqs", searchFaqs);

// Admin FAQ Management Routes
router.get("/admin/get_all_faq_categories", verifyAdminToken, getAllFaqCategories);
router.get("/admin/get_all_faqs", verifyAdminToken, getAllFaqs);
router.post("/admin/create_faq_category", verifyAdminToken, upload.none(), createFaqCategory);
router.put("/admin/update_faq_category/:category_id", verifyAdminToken, upload.none(), updateFaqCategory);
router.delete("/admin/delete_faq_category/:category_id", verifyAdminToken, upload.none(), deleteFaqCategory);
router.post("/admin/create_faq_item", verifyAdminToken, upload.none(), createFaqItem);
router.put("/admin/update_faq_item/:faq_id", verifyAdminToken, upload.none(), updateFaqItem);
router.delete("/admin/delete_faq_item/:faq_id", verifyAdminToken, upload.none(), deleteFaqItem);
router.get("/admin/get_faq_analytics", verifyAdminToken, getFaqAnalytics);

// Refer & Earn System Routes
// User Referral Routes
router.get("/get_referral_code", verifyToken, generateUserReferralCode);
router.get("/get_referral_stats", verifyToken, getUserReferralStats);
router.post("/check_free_trial_eligibility", upload.none(), checkFreeTrialEligibility);
router.post("/activate_free_trial", verifyToken, upload.none(), activateFreeTrial);
router.post("/apply_referral_code", verifyToken, upload.none(), applyReferralCode);

// Admin Referral Routes
router.get("/admin/get_referral_analytics", verifyAdminToken, getReferralAnalytics);
router.post("/admin/activate_pending_rewards", verifyAdminToken, upload.none(), activatePendingRewards);

// Admin Report Routes
router.get("/admin/get_user_growth_report", verifyAdminToken, getUserGrowthReport);
router.get("/admin/get_user_activity_report", verifyAdminToken, getUserActivityReport);
router.get("/admin/get_subscription_revenue_report", verifyAdminToken, getSubscriptionRevenueReport);
router.get("/admin/get_revenue_chart_data", verifyAdminToken, getRevenueChartData);
router.get("/admin/get_business_health_report", verifyAdminToken, getBusinessHealthReport);
router.get("/admin/get_user_distribution_by_state", verifyAdminToken, getUserDistributionByState);
// router.get("/admin/get_income_expense_summary", verifyAdminToken, getIncomeExpenseSummary);
router.get("/admin/get_expense_breakdown", verifyAdminToken, getExpenseBreakdown);
router.get("/admin/get_income_breakdown", verifyAdminToken, getIncomeBreakdown);
router.get("/admin/get_comprehensive_report", verifyAdminToken, getComprehensiveReport);
// router.get("/admin/export_report_data", verifyAdminToken, exportReportData);

// Manager System Routes
// Manager Authentication Routes
router.post("/manager_login", upload.none(), managerLogin); // Old direct login method
router.post("/manager_login_otp", upload.none(), managerLoginWithOTP); // New OTP login (Step 1)
router.post("/manager_verify_otp", upload.none(), managerVerifyOTP); // OTP verification (Step 2)
router.post("/manager_resend_otp", upload.none(), managerResendOTP); // Resend OTP

// Business Owner Manager Management Routes
router.post("/add_manager", verifyToken, upload.none(), addManager);
router.get("/get_managers", verifyToken, getManagers);
router.put("/update_manager", verifyToken, upload.none(), updateManager);
router.delete("/remove_manager", verifyToken, upload.none(), removeManager);
router.get("/get_manager_activity_log", verifyToken, getManagerActivityLog);

// Manager Dashboard Routes (requires manager authentication) (TODO: Implement these functions)
// router.get("/manager/dashboard", verifyManagerToken, getManagerDashboard);

// Manager Business Operations Routes (requires manager authentication with context)
// Income/Expense Management
router.post("/manager/add_expense_income_udhari", upload.single("image"), verifyManagerTokenWithContext, addExpenseIncomeUdhari);
router.put("/manager/update_expense_income", verifyManagerTokenWithContext, upload.single("image"), updateExpenseIncome);
router.delete("/manager/delete_expense_income", verifyManagerTokenWithContext, upload.none(), deleteExpenseIncome);
router.get("/manager/get_transactions", verifyManagerTokenWithContext, getMonthlyTransactions);
router.get("/manager/get_home_page", verifyManagerTokenWithContext, getHomePageApi);
router.get("/manager/get_daily_profit_loss", verifyManagerTokenWithContext, getDailyProfitLoss);

// Budget Management
router.post("/manager/add_budget", verifyManagerTokenWithContext, upload.none(), addBudget);
router.put("/manager/update_budget", verifyManagerTokenWithContext, upload.none(), updateBudget);
router.delete("/manager/delete_budget", verifyManagerTokenWithContext, upload.none(), deleteBudget);
router.get("/manager/get_budget", verifyManagerTokenWithContext, getBudget);

// Reminder System
router.get("/manager/get_user_reminders", verifyManagerTokenWithContext, getUserReminders);

// Export Data
router.get("/manager/export_data", verifyManagerTokenWithContext, exportData);
router.get("/manager/export_budget", verifyManagerTokenWithContext, exportBudget);

// Customer Management
router.post("/manager/add_customers", verifyManagerTokenWithContext, upload.none(), addCustomers);
router.get("/manager/get_customer", verifyManagerTokenWithContext, getCustomer);
router.post("/manager/edit_customer", verifyManagerTokenWithContext, upload.none(), editCustomer);
router.post("/manager/delete_customer", verifyManagerTokenWithContext, upload.none(), deleteCustomer);

// Udhari (Debt) Management
router.get("/manager/get_udhari", verifyManagerTokenWithContext, getUdhari);
router.get("/manager/get_receivable_payable", verifyManagerTokenWithContext, getReceivablePayableUdhari);
router.put("/manager/update_udhari", verifyManagerTokenWithContext, upload.none(), updateUdhari);
router.post("/manager/mark_udhari_as_paid", verifyManagerTokenWithContext, upload.none(), markUdhariAsPaid);

// Stock Management (Old System)
// router.post("/manager/add_opening_stock", verifyManagerTokenWithContext, upload.none(), addOpeningStock);
// router.post("/manager/add_purchase_stock", verifyManagerTokenWithContext, upload.none(), addPurchaseStock);
// router.get("/manager/get_stock_ledger", verifyManagerTokenWithContext, getStockLedger);

// Stock Management (New Monthly System)
router.post("/manager/add_or_update_opening_stock", verifyManagerTokenWithContext, upload.none(), addOrUpdateOpeningStock);
router.post("/manager/add_purchase_stock_monthly", verifyManagerTokenWithContext, upload.none(), addPurchaseStockMonthly);
router.put("/manager/update_purchase_stock", verifyManagerTokenWithContext, upload.none(), updatePurchaseStock);
router.post("/manager/add_or_update_closing_stock", verifyManagerTokenWithContext, upload.none(), addOrUpdateClosingStock);
router.post("/manager/close_stock_month", verifyManagerTokenWithContext, upload.none(), closeStockMonth);
router.get("/manager/get_monthly_stock_ledger", verifyManagerTokenWithContext, getMonthlyStockLedger);
router.get("/manager/get_single_stock_month", verifyManagerTokenWithContext, getSingleStockMonth);
router.get("/manager/get_all_stock_months", verifyManagerTokenWithContext, getAllStockMonths);
router.get("/manager/export_monthly_stock", verifyManagerTokenWithContext, exportMonthlyStock);

// Category Management
router.post("/manager/add_category", verifyManagerTokenWithContext, upload.single("icon"), handleMulterError, addCategory);
router.get("/manager/get_user_category", verifyManagerTokenWithContext, getUserCategory);
router.post("/manager/edit_category", verifyManagerTokenWithContext, upload.single("icon"), handleMulterError, editCategory);
router.post("/manager/delete_category", verifyManagerTokenWithContext, upload.none(), deleteCategory);
router.get("/manager/get_all_category", verifyManagerTokenWithContext, getAllCategory);

// Team Member Management
router.get("/manager/get_team_members", verifyManagerTokenWithContext, getTeamMembers);
router.post("/manager/delete_team_member", verifyManagerTokenWithContext, upload.none(), deleteTeamMember);
router.post("/manager/edit_team_member", verifyManagerTokenWithContext, upload.none(), editTeamMember);
router.post("/manager/add_team_member", verifyManagerTokenWithContext, upload.none(), addTeamMember);

// Reports and Analytics
router.get("/manager/get_weekly_graph_data", verifyManagerTokenWithContext, getWeeklyGraphData);
router.get("/manager/get_single_month_weekly_data", verifyManagerTokenWithContext, getSingleMonthWeeklyData);
router.get("/manager/get_monthly_graph_data", verifyManagerTokenWithContext, getMonthlyGraphData);

// Grocery Management
router.get("/manager/get_grocery", verifyManagerTokenWithContext, getGrocery);

// Support Tickets
router.post("/manager/create_support_ticket", verifyManagerTokenWithContext, upload.single("screenshot"), createSupportTicket);
router.get("/manager/get_support_ticket", verifyManagerTokenWithContext, getSupportTickets);

// User Profile (Owner's Profile - for business operations)
router.get("/manager/get_user_profile", verifyManagerTokenWithContext, getUserProfile);
router.post("/manager/edit_profile", verifyManagerTokenWithContext, upload.single("image"), editProfile);
router.get("/manager/get_user_image", verifyManagerTokenWithContext, getUserImage);

// Manager Profile (Manager's Own Profile)
router.get("/manager/get_manager_profile", verifyManagerToken, getManagerProfile);
router.post("/manager/update_manager_profile", verifyManagerToken, upload.single("image"), updateManagerProfile);

// Additional Manager Business Operations
// User Account Management
router.post("/manager/create_user_account", upload.none(), verifyManagerTokenWithContext, createUserAccount);
router.get("/manager/get_user_account", verifyManagerTokenWithContext, getUserAccount);
router.post("/manager/delete_user_account", upload.none(), verifyManagerTokenWithContext, deleteUserAccount);

// Subscription Management
router.get("/manager/get_subscription", verifyManagerTokenWithContext, getSubscriptionData);
router.get("/manager/get_user_subscription", verifyManagerTokenWithContext, getUserSubscription);
router.post("/manager/purchase_subscription", verifyManagerTokenWithContext, upload.none(), purchaseSubscription);

// App Lock Management
router.post("/manager/set_app_lock", verifyManagerTokenWithContext, upload.none(), setAppLock);
router.post("/manager/update_app_lock", verifyManagerTokenWithContext, upload.none(), updateAppLock);
router.post("/manager/remove_app_lock", verifyManagerTokenWithContext, upload.none(), removeAppLock);

// Notification Management
router.post("/manager/notification_on_off", verifyManagerTokenWithContext, upload.none(), notificationOnOff);

// Payment Integration
router.get("/manager/get_razorpay_config", verifyManagerTokenWithContext, getRazorpayConfig);
router.post("/manager/create_razorpay_order", verifyManagerTokenWithContext, upload.none(), createRazorpayOrder);
router.post("/manager/verify_razorpay_payment", verifyManagerTokenWithContext, upload.none(), verifyRazorpayPayment);
router.get("/manager/get_payment_history", verifyManagerTokenWithContext, getPaymentHistory);

// Recurring Payment Management
router.post("/manager/create_recurring_payment", verifyManagerTokenWithContext, upload.none(), createRecurringPayment);
router.get("/manager/get_recurring_payments", verifyManagerTokenWithContext, getAllRecurringPayments);
router.put("/manager/update_recurring_payment", verifyManagerTokenWithContext, upload.none(), updateRecurringPayment);
router.delete("/manager/delete_recurring_payment", verifyManagerTokenWithContext, upload.none(), deleteRecurringPayment);
router.get("/manager/export_recurring_payments", verifyManagerTokenWithContext, exportRecurringPayments);

// FAQ Management
router.get("/manager/get_faq", verifyManagerTokenWithContext, getFaq);

// Performance Tracking
router.post("/manager/calculate_performance_score", verifyManagerTokenWithContext, upload.none(), calculatePerformanceScore);
router.get("/manager/get_user_performance_score", verifyManagerTokenWithContext, getUserPerformanceScore);
router.get("/manager/get_user_performance_history", verifyManagerTokenWithContext, getUserPerformanceHistory);
router.get("/manager/get_overall_performance_stats", verifyManagerTokenWithContext, getUserOverallPerformanceStats);


// Business Performance Score (New System - Separate from existing performance)
router.get("/manager/get_business_performance_score", verifyManagerTokenWithContext, getBusinessPerformanceScore);

// Additional Manager Routes - App Rating and Feedback
router.post("/manager/rate_app", verifyManagerTokenWithContext, upload.none(), createAppRating);
router.post("/manager/create_feedback", verifyManagerTokenWithContext, upload.none(), createFeedback);
router.get("/manager/get_user_feedback", verifyManagerTokenWithContext, getUserFeedback);

// Manager Contact and Support
router.post("/manager/support", verifyManagerTokenWithContext, upload.none(), contactUs);

// Performance Tracking Routes
// User Performance Routes
router.post("/calculate_performance_score", verifyToken, upload.none(), calculatePerformanceScore);
router.get("/get_user_performance_score", verifyToken, getUserPerformanceScore);
router.get("/get_user_performance_history", verifyToken, getUserPerformanceHistory);
router.get("/get_overall_performance_stats", verifyToken, getUserOverallPerformanceStats);

// New Business Performance Score API (Separate from existing performance system)
router.get("/get_business_performance_score", verifyToken, getBusinessPerformanceScore);

// Admin Performance Routes
router.get("/admin/get_overall_performance_stats", verifyAdminToken, getOverallPerformanceStats);
router.get("/admin/get_user_performance_report", verifyAdminToken, getUserPerformanceReport);
router.get("/admin/get_performance_comparison", verifyAdminToken, getPerformanceComparison);
router.get("/admin/get_feature_usage_analytics", verifyAdminToken, getFeatureUsageAnalytics);

// Performance Visualization Routes (for Bar Graphs and Charts)
router.get("/admin/get_performance_bar_graph_data", verifyAdminToken, getPerformanceBarGraphData);
router.get("/admin/get_performance_trends", verifyAdminToken, getPerformanceTrends);
router.get("/admin/get_user_performance_comparison", verifyAdminToken, getUserPerformanceComparison);
router.get("/admin/get_conversion_funnel_data", verifyAdminToken, getConversionFunnelData);

// Example admin-protected route (you can add more admin routes here)
router.get("/admin_dashboard", verifyAdminToken, (req, res) => {
  res.json({
    success: true,
    msg: ["Welcome to admin dashboard", "एडमिन डैशबोर्ड में आपका स्वागत है", "प्रशासक डॅशबोर्डमध्ये आपले स्वागत आहे"],
    adminInfo: req.adminInfo
  });
});

// Language Module Routes
router.get("/get_languages", getLanguages);
router.post("/admin/add_language", verifyAdminToken, upload.none(), addLanguage);
router.post("/admin/edit_language", verifyAdminToken, upload.none(), editLanguage);
router.post("/admin/delete_language", verifyAdminToken, upload.none(), deleteLanguage);
router.post("/admin/toggle_language_status", verifyAdminToken, upload.none(), toggleLanguageStatus);
router.post("/update_user_language", verifyToken, upload.none(), updateUserLanguage);
router.get("/admin/get_language_analytics", verifyAdminToken, getLanguageAnalytics);

export default router;



