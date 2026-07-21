import connection from "../connection/dbConfig.js";
import moment from "moment-timezone";

// ===== REFERRAL CODE MANAGEMENT =====

// Generate or get user's referral code
export const generateUserReferralCode = async (request, response) => {
  try {
    const userId = request.userId;

    // Check if user already has a referral code
    const checkQuery = `
      SELECT referral_code, total_referrals 
      FROM user_master 
      WHERE user_id = ? AND delete_flag = 0
    `;

    const result = await new Promise((resolve, reject) => {
      connection.query(checkQuery, [userId], (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    if (result.length === 0) {
      return response.status(404).json({
        success: false,
        msg: ["User not found", "उपयोगकर्ता नहीं मिला", "वापरकर्ता सापडला नाही"],
        key: "userNotFound"
      });
    }

    const user = result[0];

    // Fetch referral plan details (subscription_id = 1)
    const referralPlanQuery = `
      SELECT 
        subscription_id,
        description as plan_name,
        text as plan_description,
        amount as plan_price,
        subscription_type,
        validity_days
      FROM subscription_master 
      WHERE subscription_id = 1 AND delete_flag = 0
    `;

    const referralPlanResult = await new Promise((resolve, reject) => {
      connection.query(referralPlanQuery, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    // Prepare referral plan data
    let referralPlan = null;
    if (referralPlanResult.length > 0) {
      const plan = referralPlanResult[0];
      referralPlan = {
        subscription_id: plan.subscription_id,
        plan_name: plan.plan_name,
        plan_description: plan.plan_description,
        plan_price: parseFloat(plan.plan_price) || 0,
        subscription_type: plan.subscription_type,
        subscription_type_label:
          plan.subscription_type == 0 ? "Free or Referral" :
            plan.subscription_type == 1 ? "Yearly" :
              plan.subscription_type == 2 ? "Monthly" :
                plan.subscription_type == 3 ? "Lifetime" :
                  plan.subscription_type == 4 ? "Other" :
                    "Unknown",
        validity_days: plan.validity_days
      };
    }

    if (user.referral_code) {
      // User already has a referral code
      return response.json({
        success: true,
        msg: ["Referral code retrieved successfully", "रेफरल कोड सफलतापूर्वक प्राप्त", "रेफरल कोड यशस्वीरित्या पुनर्प्राप्त"],
        data: {
          referral_code: user.referral_code,
          total_referrals: user.total_referrals,
          referral_plan: referralPlan
        }
      });
    }

    // Generate unique referral code
    const generateUniqueReferralCode = async (userId) => {
      let attempts = 0;
      let referralCode;
      let isUnique = false;

      while (!isUnique && attempts < 10) {
        attempts++;
        // Generate code with user ID, timestamp, and random component
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        referralCode = `REF${String(userId).padStart(6, '0')}${timestamp}${random}`;

        // Check if code already exists
        const checkCodeQuery = `SELECT COUNT(*) as count FROM referral_codes WHERE referral_code = ?`;

        try {
          const result = await new Promise((resolve, reject) => {
            connection.query(checkCodeQuery, [referralCode], (err, result) => {
              if (err) reject(err);
              else resolve(result);
            });
          });

          isUnique = result[0].count === 0;
        } catch (error) {
          console.error('Error checking referral code uniqueness:', error);
          throw error;
        }
      }

      if (!isUnique) {
        throw new Error('Unable to generate unique referral code after 10 attempts');
      }

      return referralCode;
    };

    const referralCode = await generateUniqueReferralCode(userId);

    // Update user with referral code
    const updateQuery = `
      UPDATE user_master 
      SET referral_code = ?, updatetime = NOW()
      WHERE user_id = ? AND delete_flag = 0
    `;

    const updateResult = await new Promise((resolve, reject) => {
      connection.query(updateQuery, [referralCode, userId], (updateErr, updateResult) => {
        if (updateErr) reject(updateErr);
        else resolve(updateResult);
      });
    });

    if (updateResult.affectedRows === 0) {
      return response.status(404).json({
        success: false,
        msg: ["User not found", "उपयोगकर्ता नहीं मिला", "वापरकर्ता सापडला नाही"],
        key: "userNotFound"
      });
    }

    // Insert into referral_codes table
    const insertQuery = `
      INSERT INTO referral_codes (user_id, referral_code, is_active, total_uses, created_at, updated_at)
      VALUES (?, ?, 1, 0, NOW(), NOW())
    `;

    await new Promise((resolve, reject) => {
      connection.query(insertQuery, [userId, referralCode], (insertErr, insertResult) => {
        if (insertErr) reject(insertErr);
        else resolve(insertResult);
      });
    });

    response.json({
      success: true,
      msg: ["Referral code generated successfully", "रेफरल कोड सफलतापूर्वक जेनरेट", "रेफरल कोड यशस्वीरित्या तयार केले"],
      data: {
        referral_code: referralCode,
        total_referrals: 0,
        referral_plan: referralPlan
      }
    });

  } catch (error) {
    console.error("Generate referral code error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get user's referral statistics
export const getUserReferralStats = (request, response) => {
  try {
    const userId = request.userId;

    const query = `
      SELECT 
        um.referral_code,
        um.total_referrals,
        rc.total_uses as code_uses,
        rc.created_at as code_created_at
      FROM user_master um
      LEFT JOIN referral_codes rc ON um.user_id = rc.user_id AND rc.delete_flag = 0
      WHERE um.user_id = ? AND um.delete_flag = 0
    `;

    connection.query(query, [userId], (err, result) => {
      if (err) {
        console.error("Get referral stats error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.length === 0) {
        return response.status(404).json({
          success: false,
          msg: ["User not found", "उपयोगकर्ता नहीं मिला", "वापरकर्ता सापडला नाही"],
          key: "userNotFound"
        });
      }

      const userStats = result[0];

      // Get recent referrals
      const referralsQuery = `
        SELECT 
          rt.tracking_id,
          rt.referred_user_id,
          rt.referral_code,
          rt.status,
          rt.created_at,
          um.name as referred_user_name,
          um.email as referred_user_email
        FROM referral_tracking rt
        LEFT JOIN user_master um ON rt.referred_user_id = um.user_id
        WHERE rt.referrer_user_id = ?
        ORDER BY rt.created_at DESC
        LIMIT 10
      `;

      connection.query(referralsQuery, [userId], (refErr, refResult) => {
        if (refErr) {
          console.error("Get referrals error:", refErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: refErr.message
          });
        }

        const recentReferrals = refResult.map(ref => ({
          ...ref,
          created_at: moment(ref.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
          status_label: ref.status === 'completed' ? 'Completed' :
            ref.status === 'pending' ? 'Pending' :
              ref.status === 'failed' ? 'Failed' : 'Expired'
        }));

        response.json({
          success: true,
          msg: ["Referral statistics retrieved successfully", "रेफरल सांख्यिकी सफलतापूर्वक प्राप्त", "रेफरल आकडेवारी यशस्वीरित्या पुनर्प्राप्त"],
          data: {
            referral_code: userStats.referral_code,
            total_referrals: userStats.total_referrals,
            code_uses: userStats.code_uses || 0,
            code_created_at: userStats.code_created_at ? moment(userStats.code_created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null,
            recent_referrals: recentReferrals
          }
        });
      });
    });

  } catch (error) {
    console.error("Get referral stats error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== FREE TRIAL MANAGEMENT =====

// Check if device can use free trial
export const checkFreeTrialEligibility = (request, response) => {
  try {
    const { device_id } = request.body;

    if (!device_id) {
      return response.status(400).json({
        success: false,
        msg: ["Device ID is required", "डिवाइस ID आवश्यक है", "डिव्हाइस ID आवश्यक आहे"],
        key: "deviceIdRequired"
      });
    }

    const checkQuery = `
      SELECT 
        tracking_id,
        trial_type,
        used_at,
        user_id
      FROM device_trial_tracking 
      WHERE device_id = ? AND trial_type = 'free_trial'
    `;

    connection.query(checkQuery, [device_id], (err, result) => {
      if (err) {
        console.error("Check free trial eligibility error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      const isEligible = result.length === 0;
      const previousTrial = result.length > 0 ? result[0] : null;

      response.json({
        success: true,
        msg: ["Free trial eligibility checked successfully", "फ्री ट्रायल पात्रता सफलतापूर्वक जांची गई", "फ्री ट्रायल पात्रता यशस्वीरित्या तपासली"],
        data: {
          is_eligible: isEligible,
          previous_trial: previousTrial ? {
            used_at: moment(previousTrial.used_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
            user_id: previousTrial.user_id
          } : null
        }
      });
    });

  } catch (error) {
    console.error("Check free trial eligibility error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Activate free trial for user
export const activateFreeTrial = (request, response) => {
  try {
    const userId = request.userId;
    const { device_id } = request.body;

    if (!device_id) {
      return response.status(400).json({
        success: false,
        msg: ["Device ID is required", "डिवाइस ID आवश्यक है", "डिव्हाइस ID आवश्यक आहे"],
        key: "deviceIdRequired"
      });
    }

    // Check if device already used free trial
    const deviceCheckQuery = `
      SELECT tracking_id FROM device_trial_tracking 
      WHERE device_id = ? AND trial_type = 'free_trial'
    `;

    connection.query(deviceCheckQuery, [device_id], (deviceErr, deviceResult) => {
      if (deviceErr) {
        console.error("Check device trial error:", deviceErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: deviceErr.message
        });
      }

      if (deviceResult.length > 0) {
        return response.status(400).json({
          success: false,
          msg: ["Free trial already used on this device", "इस डिवाइस पर फ्री ट्रायल पहले से उपयोग किया गया", "या डिव्हाइसवर फ्री ट्रायल आधीपासून वापरले गेले"],
          key: "freeTrialAlreadyUsed"
        });
      }

      // Check if user already has active subscription
      const subscriptionCheckQuery = `
        SELECT user_subscription_id, end_date 
        FROM user_subscription_master 
        WHERE user_id = ? AND delete_flag = 0 
        ORDER BY end_date DESC 
        LIMIT 1
      `;

      connection.query(subscriptionCheckQuery, [userId], (subErr, subResult) => {
        if (subErr) {
          console.error("Check user subscription error:", subErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: subErr.message
          });
        }

        // If user has active subscription, don't allow free trial
        if (subResult.length > 0 && new Date(subResult[0].end_date) > new Date()) {
          return response.status(400).json({
            success: false,
            msg: ["You already have an active subscription", "आपके पास पहले से एक सक्रिय सदस्यता है", "तुमच्याकडे आधीपासून सक्रिय सदस्यता आहे"],
            key: "activeSubscriptionExists"
          });
        }

        // Start transaction
        connection.beginTransaction((transactionErr) => {
          if (transactionErr) {
            console.error("Begin transaction error:", transactionErr);
            return response.status(500).json({
              success: false,
              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
              error: transactionErr.message
            });
          }

          const now = new Date();

          // Get validity days from free trial plan (subscription_id = 0)
          const getValidityQuery = "SELECT validity_days FROM subscription_master WHERE subscription_id = 0 AND delete_flag = 0";

          connection.query(getValidityQuery, (validityErr, validityResult) => {
            if (validityErr) {
              connection.rollback(() => {
                console.error("Get validity days error:", validityErr);
                return response.status(500).json({
                  success: false,
                  msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                  error: validityErr.message
                });
              });
            }

            const validityDays = validityResult.length > 0 ? validityResult[0].validity_days : 15; // Default to 15 days
            const endDate = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

            // Insert free trial subscription using plan from subscription_master
            const insertSubscriptionQuery = `
              INSERT INTO user_subscription_master 
              (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
              VALUES (0, ?, 0.00, 0, '15 Days Free Trial', 'Free Trial Plan (15 Days)', ?, ?, 0, NOW(), NOW(), NOW())
            `;

            connection.query(insertSubscriptionQuery, [userId, now, endDate], (insertErr, insertResult) => {
              if (insertErr) {
                connection.rollback(() => {
                  console.error("Insert free trial subscription error:", insertErr);
                  return response.status(500).json({
                    success: false,
                    msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                    error: insertErr.message
                  });
                });
              }

              const subscriptionId = insertResult.insertId;

              // Track device trial usage
              const insertDeviceQuery = `
              INSERT INTO device_trial_tracking 
              (device_id, user_id, trial_type, subscription_id, ip_address, user_agent)
              VALUES (?, ?, 'free_trial', ?, ?, ?)
            `;

              const ipAddress = request.ip || request.connection.remoteAddress;
              const userAgent = request.get('User-Agent');

              connection.query(insertDeviceQuery, [device_id, userId, subscriptionId, ipAddress, userAgent], (deviceInsertErr) => {
                if (deviceInsertErr) {
                  connection.rollback(() => {
                    console.error("Insert device tracking error:", deviceInsertErr);
                    return response.status(500).json({
                      success: false,
                      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                      error: deviceInsertErr.message
                    });
                  });
                }

                connection.commit((commitErr) => {
                  if (commitErr) {
                    console.error("Commit transaction error:", commitErr);
                    return response.status(500).json({
                      success: false,
                      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                      error: commitErr.message
                    });
                  }

                  response.json({
                    success: true,
                    msg: ["Free trial activated successfully", "फ्री ट्रायल सफलतापूर्वक सक्रिय", "फ्री ट्रायल यशस्वीरित्या सक्रिय"],
                    data: {
                      subscription_id: subscriptionId,
                      start_date: moment(now).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                      end_date: moment(endDate).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                      duration_days: validityDays
                    }
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error("Activate free trial error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== REFERRAL APPLICATION =====

// Apply referral code
export const applyReferralCode = (request, response) => {
  try {
    const userId = request.userId;
    const { referral_code, device_id } = request.body;

    if (!referral_code || !device_id) {
      return response.status(400).json({
        success: false,
        msg: ["Referral code and device ID are required", "रेफरल कोड और डिवाइस ID आवश्यक हैं", "रेफरल कोड आणि डिव्हाइस ID आवश्यक आहेत"],
        key: "referralCodeAndDeviceIdRequired"
      });
    }

    // Check if user is trying to use their own referral code
    const selfReferralQuery = `
      SELECT referral_code FROM user_master 
      WHERE user_id = ? AND referral_code = ? AND delete_flag = 0
    `;

    connection.query(selfReferralQuery, [userId, referral_code], (selfErr, selfResult) => {
      if (selfErr) {
        console.error("Check self referral error:", selfErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: selfErr.message
        });
      }

      if (selfResult.length > 0) {
        return response.status(400).json({
          success: false,
          msg: ["You cannot use your own referral code", "आप अपना खुद का रेफरल कोड नहीं उपयोग कर सकते", "तुम्ही तुमचा स्वतःचा रेफरल कोड वापरू शकत नाही"],
          key: "cannotUseOwnReferralCode"
        });
      }

      // Check if referral code exists and is valid
      const referralCheckQuery = `
        SELECT 
          rc.referral_id,
          rc.user_id as referrer_user_id,
          rc.referral_code,
          rc.is_active,
          rc.total_uses,
          rc.max_uses,
          rc.expiry_date,
          um.name as referrer_name,
          um.email as referrer_email
        FROM referral_codes rc
        JOIN user_master um ON rc.user_id = um.user_id
        WHERE rc.referral_code = ? AND rc.is_active = 1 AND rc.delete_flag = 0
      `;

      connection.query(referralCheckQuery, [referral_code], (refErr, refResult) => {
        if (refErr) {
          console.error("Check referral code error:", refErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: refErr.message
          });
        }

        if (refResult.length === 0) {
          return response.status(404).json({
            success: false,
            msg: ["Invalid or expired referral code", "अमान्य या समाप्त रेफरल कोड", "अवैध किंवा कालबाह्य रेफरल कोड"],
            key: "invalidReferralCode"
          });
        }

        const referralData = refResult[0];

        // Check if referral code has reached max uses
        if (referralData.max_uses && referralData.total_uses >= referralData.max_uses) {
          return response.status(400).json({
            success: false,
            msg: ["Referral code usage limit reached", "रेफरल कोड उपयोग सीमा पहुंच गई", "रेफरल कोड वापर मर्यादा पोहोचली"],
            key: "referralCodeLimitReached"
          });
        }

        // Check if referral code has expired
        if (referralData.expiry_date && new Date(referralData.expiry_date) < new Date()) {
          return response.status(400).json({
            success: false,
            msg: ["Referral code has expired", "रेफरल कोड समाप्त हो गया है", "रेफरल कोड कालबाह्य झाला आहे"],
            key: "referralCodeExpired"
          });
        }

        // Check if user already used this referral code
        const alreadyUsedQuery = `
          SELECT tracking_id FROM referral_tracking 
          WHERE referred_user_id = ? AND referral_code = ?
        `;

        connection.query(alreadyUsedQuery, [userId, referral_code], (usedErr, usedResult) => {
          if (usedErr) {
            console.error("Check already used referral error:", usedErr);
            return response.status(500).json({
              success: false,
              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
              error: usedErr.message
            });
          }

          if (usedResult.length > 0) {
            return response.status(400).json({
              success: false,
              msg: ["You have already used this referral code", "आपने पहले से इस रेफरल कोड का उपयोग किया है", "तुम्ही आधीपासून हा रेफरल कोड वापरला आहे"],
              key: "referralCodeAlreadyUsed"
            });
          }

          // Check if device already used referral trial
          const deviceReferralQuery = `
            SELECT tracking_id FROM device_trial_tracking 
            WHERE device_id = ? AND trial_type = 'referral_trial'
          `;

          connection.query(deviceReferralQuery, [device_id], (deviceErr, deviceResult) => {
            if (deviceErr) {
              console.error("Check device referral trial error:", deviceErr);
              return response.status(500).json({
                success: false,
                msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                error: deviceErr.message
              });
            }

            if (deviceResult.length > 0) {
              return response.status(400).json({
                success: false,
                msg: ["This device has already used a referral trial", "इस डिवाइस ने पहले से रेफरल ट्रायल का उपयोग किया है", "या डिव्हाइसने आधीपासून रेफरल ट्रायल वापरले आहे"],
                key: "deviceReferralTrialUsed"
              });
            }

            // Check if user already has active subscription
            const subscriptionCheckQuery = `
              SELECT user_subscription_id, end_date 
              FROM user_subscription_master 
              WHERE user_id = ? AND delete_flag = 0 
              ORDER BY end_date DESC 
              LIMIT 1
            `;

            connection.query(subscriptionCheckQuery, [userId], (subErr, subResult) => {
              if (subErr) {
                console.error("Check user subscription error:", subErr);
                return response.status(500).json({
                  success: false,
                  msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                  error: subErr.message
                });
              }

              // Start transaction for referral application
              connection.beginTransaction((transactionErr) => {
                if (transactionErr) {
                  console.error("Begin transaction error:", transactionErr);
                  return response.status(500).json({
                    success: false,
                    msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                    error: transactionErr.message
                  });
                }

                const now = new Date();

                // Get validity days from free trial plan (subscription_id = 0)
                const getValidityQuery = "SELECT validity_days FROM subscription_master WHERE subscription_id = 0 AND delete_flag = 0";

                connection.query(getValidityQuery, (validityErr, validityResult) => {
                  if (validityErr) {
                    connection.rollback(() => {
                      console.error("Get validity days error:", validityErr);
                      return response.status(500).json({
                        success: false,
                        msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                        error: validityErr.message
                      });
                    });
                    return;
                  }

                  const validityDays = validityResult.length > 0 ? validityResult[0].validity_days : 15; // Default to 15 days
                  const endDate = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

                  // Insert referral tracking record
                  const insertTrackingQuery = `
                    INSERT INTO referral_tracking 
                    (referral_id, referrer_user_id, referred_user_id, referral_code, status, reward_status, reward_type, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 'completed', 'pending', 'free_trial', NOW(), NOW())
                  `;

                  connection.query(insertTrackingQuery, [
                    referralData.referral_id,
                    referralData.referrer_user_id,
                    userId,
                    referral_code
                  ], (trackErr, trackResult) => {
                    if (trackErr) {
                      connection.rollback(() => {
                        console.error("Insert referral tracking error:", trackErr);
                        return response.status(500).json({
                          success: false,
                          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                          error: trackErr.message
                        });
                      });
                      return;
                    }

                    const trackingId = trackResult.insertId;

                    // Insert free trial subscription for referred user using plan from subscription_master
                    const insertSubscriptionQuery = `
                      INSERT INTO user_subscription_master 
                      (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
                      VALUES (0, ?, 0.00, 0, '15 Days Free Trial', 'Free Trial Plan (15 Days)', ?, ?, 0, NOW(), NOW(), NOW())
                    `;

                    connection.query(insertSubscriptionQuery, [userId, now, endDate], (subInsertErr, subInsertResult) => {
                      if (subInsertErr) {
                        connection.rollback(() => {
                          console.error("Insert referral subscription error:", subInsertErr);
                          return response.status(500).json({
                            success: false,
                            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                            error: subInsertErr.message
                          });
                        });
                        return;
                      }

                      const subscriptionId = subInsertResult.insertId;

                      // Track device referral trial usage
                      const insertDeviceQuery = `
                        INSERT INTO device_trial_tracking 
                        (device_id, user_id, trial_type, subscription_id, ip_address, user_agent)
                        VALUES (?, ?, 'referral_trial', ?, ?, ?)
                      `;

                      const ipAddress = request.ip || request.connection.remoteAddress;
                      const userAgent = request.get('User-Agent');

                      connection.query(insertDeviceQuery, [device_id, userId, subscriptionId, ipAddress, userAgent], (deviceInsertErr) => {
                        if (deviceInsertErr) {
                          connection.rollback(() => {
                            console.error("Insert device referral tracking error:", deviceInsertErr);
                            return response.status(500).json({
                              success: false,
                              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                              error: deviceInsertErr.message
                            });
                          });
                          return;
                        }

                        // Update referral code usage count
                        const updateReferralQuery = `
                          UPDATE referral_codes 
                          SET total_uses = total_uses + 1, updated_at = NOW()
                          WHERE referral_id = ?
                        `;

                        connection.query(updateReferralQuery, [referralData.referral_id], (updateErr) => {
                          if (updateErr) {
                            connection.rollback(() => {
                              console.error("Update referral code usage error:", updateErr);
                              return response.status(500).json({
                                success: false,
                                msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                error: updateErr.message
                              });
                            });
                            return;
                          }

                          // Update referrer's total referrals count
                          const updateReferrerQuery = `
                            UPDATE user_master 
                            SET total_referrals = total_referrals + 1, updatetime = NOW()
                            WHERE user_id = ?
                          `;

                          connection.query(updateReferrerQuery, [referralData.referrer_user_id], (referrerUpdateErr) => {
                            if (referrerUpdateErr) {
                              connection.rollback(() => {
                                console.error("Update referrer count error:", referrerUpdateErr);
                                return response.status(500).json({
                                  success: false,
                                  msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                  error: referrerUpdateErr.message
                                });
                              });
                              return;
                            }

                            // Check if referrer has active subscription to determine reward activation
                            const checkReferrerSubscriptionQuery = `
                              SELECT user_subscription_id, end_date 
                              FROM user_subscription_master 
                              WHERE user_id = ? AND delete_flag = 0 
                              ORDER BY end_date DESC 
                              LIMIT 1
                            `;

                            connection.query(checkReferrerSubscriptionQuery, [referralData.referrer_user_id], (subCheckErr, subCheckResult) => {
                              if (subCheckErr) {
                                connection.rollback(() => {
                                  console.error("Check referrer subscription error:", subCheckErr);
                                  return response.status(500).json({
                                    success: false,
                                    msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                    error: subCheckErr.message
                                  });
                                });
                                return;
                              }

                              // Determine if referrer has active subscription
                              const hasActiveSubscription = subCheckResult.length > 0 && new Date(subCheckResult[0].end_date) > new Date();
                              const rewardStatus = hasActiveSubscription ? 'pending' : 'active';
                              const rewardSubscriptionId = hasActiveSubscription ? -1 : null; // Will be set when activated

                              // Create reward for referrer using referral plan from subscription_master
                              const insertRewardQuery = `
                                INSERT INTO referral_rewards 
                                (tracking_id, user_id, reward_type, reward_value, subscription_id, status, created_at, updated_at)
                                VALUES (?, ?, 'referral_plan', 0.00, 1, ?, NOW(), NOW())
                              `;

                              connection.query(insertRewardQuery, [trackingId, referralData.referrer_user_id, rewardStatus], (rewardErr, rewardResult) => {
                                if (rewardErr) {
                                  connection.rollback(() => {
                                    console.error("Insert referral reward error:", rewardErr);
                                    return response.status(500).json({
                                      success: false,
                                      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                      error: rewardErr.message
                                    });
                                  });
                                  return;
                                }

                                const rewardId = rewardResult.insertId;

                                // If referrer has no active subscription, activate reward immediately
                                if (!hasActiveSubscription) {
                                  // Get validity days from referral reward plan (subscription_id = 1)
                                  const getRewardValidityQuery = "SELECT validity_days FROM subscription_master WHERE subscription_id = 1 AND delete_flag = 0";

                                  connection.query(getRewardValidityQuery, (rewardValidityErr, rewardValidityResult) => {
                                    if (rewardValidityErr) {
                                      connection.rollback(() => {
                                        console.error("Get reward validity days error:", rewardValidityErr);
                                        return response.status(500).json({
                                          success: false,
                                          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                          error: rewardValidityErr.message
                                        });
                                      });
                                      return;
                                    }

                                    const rewardValidityDays = rewardValidityResult.length > 0 ? rewardValidityResult[0].validity_days : 15; // Default to 15 days
                                    const rewardEndDate = new Date(now.getTime() + (rewardValidityDays * 24 * 60 * 60 * 1000));

                                    // Insert referral reward subscription immediately using plan from subscription_master
                                    const insertRewardSubscriptionQuery = `
                                      INSERT INTO user_subscription_master 
                                      (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
                                      VALUES (1, ?, 0.00, 0, '15 Days Referral Reward', 'Referral Reward Plan (15 Days)', ?, ?, 0, NOW(), NOW(), NOW())
                                    `;

                                    connection.query(insertRewardSubscriptionQuery, [referralData.referrer_user_id, now, rewardEndDate], (rewardSubErr, rewardSubResult) => {
                                      if (rewardSubErr) {
                                        connection.rollback(() => {
                                          console.error("Insert immediate reward subscription error:", rewardSubErr);
                                          return response.status(500).json({
                                            success: false,
                                            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                            error: rewardSubErr.message
                                          });
                                        });
                                        return;
                                      }

                                      // Update reward with subscription ID and activation details
                                      const updateRewardQuery = `
                                        UPDATE referral_rewards 
                                        SET subscription_id = ?, activation_date = NOW(), expiry_date = ?, updated_at = NOW()
                                        WHERE reward_id = ?
                                      `;

                                      connection.query(updateRewardQuery, [rewardSubResult.insertId, rewardEndDate, rewardId], (updateRewardErr) => {
                                        if (updateRewardErr) {
                                          connection.rollback(() => {
                                            console.error("Update immediate reward error:", updateRewardErr);
                                            return response.status(500).json({
                                              success: false,
                                              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                              error: updateRewardErr.message
                                            });
                                          });
                                          return;
                                        }

                                        connection.commit((commitErr) => {
                                          if (commitErr) {
                                            console.error("Commit transaction error:", commitErr);
                                            return response.status(500).json({
                                              success: false,
                                              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                              error: commitErr.message
                                            });
                                          }

                                          response.json({
                                            success: true,
                                            msg: ["Referral code applied successfully", "रेफरल कोड सफलतापूर्वक लागू", "रेफरल कोड यशस्वीरित्या लागू केले"],
                                            data: {
                                              tracking_id: trackingId,
                                              referrer_name: referralData.referrer_name,
                                              subscription_id: subscriptionId,
                                              start_date: moment(now).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                              end_date: moment(endDate).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                              duration_days: validityDays,
                                              reward_created: true,
                                              reward_activated_immediately: true,
                                              referrer_reward: {
                                                subscription_id: rewardSubResult.insertId,
                                                start_date: moment(now).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                                end_date: moment(rewardEndDate).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                                duration_days: rewardValidityDays
                                              }
                                            }
                                          });
                                        });
                                      });
                                    });
                                  });
                                } else {
                                  // Referrer has active subscription, reward will be activated later
                                  connection.commit((commitErr) => {
                                    if (commitErr) {
                                      console.error("Commit transaction error:", commitErr);
                                      return response.status(500).json({
                                        success: false,
                                        msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
                                        error: commitErr.message
                                      });
                                    }

                                    response.json({
                                      success: true,
                                      msg: ["Referral code applied successfully", "रेफरल कोड सफलतापूर्वक लागू", "रेफरल कोड यशस्वीरित्या लागू केले"],
                                      data: {
                                        tracking_id: trackingId,
                                        referrer_name: referralData.referrer_name,
                                        subscription_id: subscriptionId,
                                        start_date: moment(now).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                        end_date: moment(endDate).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
                                        duration_days: validityDays,
                                        reward_created: true,
                                        reward_activated_immediately: false,
                                        reward_will_activate_when: "referrer's subscription expires"
                                      }
                                    });
                                  });
                                }
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (error) {
    console.error("Apply referral code error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== ADMIN FUNCTIONS =====

// Get all referral statistics (Admin)
export const getReferralAnalytics = (request, response) => {
  try {
    const { start_date, end_date, page = 1, limit = 50 } = request.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = "";
    let queryParams = [];

    if (start_date && end_date) {
      whereClause = "WHERE DATE(rt.created_at) BETWEEN ? AND ?";
      queryParams.push(start_date, end_date);
    }

    // Get referral statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_referrals,
        COUNT(CASE WHEN rt.status = 'completed' THEN 1 END) as successful_referrals,
        COUNT(CASE WHEN rt.status = 'failed' THEN 1 END) as failed_referrals,
        COUNT(CASE WHEN rt.status = 'pending' THEN 1 END) as pending_referrals,
        SUM(CASE WHEN rt.status = 'completed' THEN 1 ELSE 0 END) as total_rewards_given
      FROM referral_tracking rt
      ${whereClause}
    `;

    connection.query(statsQuery, queryParams, (statsErr, statsResult) => {
      if (statsErr) {
        console.error("Get referral analytics error:", statsErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: statsErr.message
        });
      }

      const stats = statsResult[0];

      // Get top referrers
      const topReferrersQuery = `
        SELECT 
          um.user_id,
          um.name as referrer_name,
          um.email as referrer_email,
          um.total_referrals,
          rc.total_uses,
          rc.referral_code
        FROM user_master um
        LEFT JOIN referral_codes rc ON um.user_id = rc.user_id AND rc.delete_flag = 0
        WHERE um.total_referrals > 0
        ORDER BY um.total_referrals DESC
        LIMIT 10
      `;

      connection.query(topReferrersQuery, (topErr, topResult) => {
        if (topErr) {
          console.error("Get top referrers error:", topErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: topErr.message
          });
        }

        // Get recent referrals
        const recentReferralsQuery = `
          SELECT 
            rt.tracking_id,
            rt.referral_code,
            rt.status,
            rt.created_at,
            um1.name as referrer_name,
            um1.email as referrer_email,
            um2.name as referred_name,
            um2.email as referred_email
          FROM referral_tracking rt
          LEFT JOIN user_master um1 ON rt.referrer_user_id = um1.user_id
          LEFT JOIN user_master um2 ON rt.referred_user_id = um2.user_id
          ${whereClause}
          ORDER BY rt.created_at DESC
          LIMIT ?
          OFFSET ?
        `;

        connection.query(recentReferralsQuery, [...queryParams, parseInt(limit), offset], (recentErr, recentResult) => {
          if (recentErr) {
            console.error("Get recent referrals error:", recentErr);
            return response.status(500).json({
              success: false,
              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
              error: recentErr.message
            });
          }

          const recentReferrals = recentResult.map(ref => ({
            ...ref,
            created_at: moment(ref.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
            status_label: ref.status === 'completed' ? 'Completed' :
              ref.status === 'pending' ? 'Pending' :
                ref.status === 'failed' ? 'Failed' : 'Expired'
          }));

          response.json({
            success: true,
            msg: ["Referral analytics retrieved successfully", "रेफरल एनालिटिक्स सफलतापूर्वक प्राप्त", "रेफरल विश्लेषण यशस्वीरित्या पुनर्प्राप्त"],
            data: {
              statistics: stats,
              top_referrers: topResult,
              recent_referrals: recentReferrals,
              pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(stats.total_referrals / parseInt(limit)),
                total_referrals: stats.total_referrals,
                limit: parseInt(limit)
              }
            }
          });
        });
      });
    });

  } catch (error) {
    console.error("Get referral analytics error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== REWARD ACTIVATION =====

// Check and activate pending rewards (called by cron job or manually)
export const activatePendingRewards = (request, response) => {
  try {
    // Find users whose subscriptions have expired and have pending referral rewards
    const pendingRewardsQuery = `
      SELECT 
        rr.reward_id,
        rr.user_id,
        rr.tracking_id,
        rr.reward_type,
        um.name as user_name,
        um.email as user_email,
        usm.end_date as subscription_end_date
      FROM referral_rewards rr
      JOIN user_master um ON rr.user_id = um.user_id
      LEFT JOIN user_subscription_master usm ON rr.user_id = usm.user_id AND usm.delete_flag = 0
      WHERE rr.status = 'pending'
      AND rr.reward_type = 'referral_plan'
      AND (usm.end_date IS NULL OR usm.end_date < NOW())
    `;

    connection.query(pendingRewardsQuery, (err, result) => {
      if (err) {
        console.error("Get pending rewards error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.length === 0) {
        return response.json({
          success: true,
          msg: ["No pending rewards to activate", "सक्रिय करने के लिए कोई लंबित पुरस्कार नहीं", "सक्रिय करण्यासाठी कोणतेही लंबित पुरस्कार नाहीत"],
          data: { activated_rewards: 0 }
        });
      }

      let activatedCount = 0;
      let hasError = false;

      result.forEach((reward, index) => {
        const now = new Date();

        // Get validity days from referral reward plan (subscription_id = 1)
        const getValidityQuery = "SELECT validity_days FROM subscription_master WHERE subscription_id = 1 AND delete_flag = 0";

        connection.query(getValidityQuery, (validityErr, validityResult) => {
          if (validityErr) {
            hasError = true;
            console.error("Get validity days error:", validityErr);
            return;
          }

          const validityDays = validityResult.length > 0 ? validityResult[0].validity_days : 15; // Default to 15 days
          const endDate = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

          // Insert referral reward subscription using plan from subscription_master
          const insertRewardQuery = `
          INSERT INTO user_subscription_master 
          (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
          VALUES (1, ?, 0.00, 0, '15 Days Referral Reward', 'Referral Reward Plan (15 Days)', ?, ?, 0, NOW(), NOW(), NOW())
        `;

          connection.query(insertRewardQuery, [reward.user_id, now, endDate], (insertErr, insertResult) => {
            if (insertErr) {
              hasError = true;
              console.error("Insert reward subscription error:", insertErr);
            } else {
              // Update reward status
              const updateRewardQuery = `
              UPDATE referral_rewards 
              SET status = 'active', activation_date = NOW(), expiry_date = ?, subscription_id = ?, updated_at = NOW()
              WHERE reward_id = ?
            `;

              connection.query(updateRewardQuery, [endDate, insertResult.insertId, reward.reward_id], (updateErr) => {
                if (updateErr) {
                  hasError = true;
                  console.error("Update reward status error:", updateErr);
                } else {
                  activatedCount++;
                }
              });
            }

            // If this is the last iteration, send response
            if (index === result.length - 1) {
              if (hasError) {
                return response.status(500).json({
                  success: false,
                  msg: ["Some rewards could not be activated", "कुछ पुरस्कार सक्रिय नहीं हो सके", "काही पुरस्कार सक्रिय होऊ शकले नाहीत"],
                  data: { activated_rewards: activatedCount, total_pending: result.length }
                });
              } else {
                return response.json({
                  success: true,
                  msg: ["Pending rewards activated successfully", "लंबित पुरस्कार सफलतापूर्वक सक्रिय", "लंबित पुरस्कार यशस्वीरित्या सक्रिय"],
                  data: { activated_rewards: activatedCount }
                });
              }
            }
          });
        });
      });
    });

  } catch (error) {
    console.error("Activate pending rewards error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};
