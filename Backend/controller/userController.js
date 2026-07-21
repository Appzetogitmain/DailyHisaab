import connection from '../connection/dbConfig.js';
import { DeviceTokenStore_1_Signal, fetchUserData, generateRandomOTP } from './function.js';
import jwt from "jsonwebtoken";
import moment from "moment-timezone";
import languageMessage from './languageMessage.js';
import { contactUsSchema, publicContactUsSchema, createProfileSchema, deleteAccountSchema, otpVerifySchema, resendOtpSchema, signUpWithMobileSchema, loginWithMobileSchema } from '../validations/signUpWithMobile.js';
import smsIndiaHubService from '../services/smsIndiaHubService.js';
const SECRET_KEY = process.env.SECRET_KEY || 'DaliyHisab'

/**
 * Login with Mobile (for existing users only)
 * Sends OTP to existing users for login
 */
const loginWithMobile = async (request, response) => {
    try {
        const { error, value } = loginWithMobileSchema.validate(request.body);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed'],
                errors: error.details.map(detail => detail.message)
            });
        }

        const { mobile, phone_code, player_id, device_type, user_type, name, email } = value;

        // Generate current timestamp for this request
        let createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        var otp = await generateRandomOTP(6, mobile);
        const payload = { subject: mobile };
        const token = jwt.sign(payload, SECRET_KEY);

        // Check if user exists with same user_type (login scenario - existing users only)
        var sqlSelect = "SELECT user_id, mobile, otp_verify, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0 AND user_type = ? ";
        connection.query(sqlSelect, [phone_code, mobile, user_type], async (error, userSelectResult) => {
            if (error) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
            }

            // User must exist for login
            if (userSelectResult.length === 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['Account Doesn\'t Exists. Please Sign Up To Use App', 'खाता मौजूद नहीं है। कृपया ऐप का उपयोग करने के लिए साइन अप करें।', 'खाते अस्तित्वात नाही. कृपया अॅप वापरण्यासाठी साइन अप करा.'],
                    key: 'user_not_found'
                });
            }

            var user_id = userSelectResult[0].user_id;
            var active_flag = userSelectResult[0].active_flag;

            // Check if user account is suspended
            if (active_flag === 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['Your account has been suspended. Please contact support.', 'आपका खाता निलंबित कर दिया गया है। कृपया सहायता से संपर्क करें।', 'तुमचे खाते निलंबित केले गेले आहे. कृपया समर्थनाशी संपर्क साधा.'],
                    key: 'account_suspended'
                });
            }

            // Update OTP and optional name/email for existing user
            let updateFields = ["user_type = ?", "mobile = ?", "phone_code = ?", "otp = ?", "updatetime = NOW()", "last_login_date_time = ?"];
            let updateValues = [user_type, mobile, phone_code, otp, createtime];

            if (name !== undefined && name !== null && name !== '') {
                updateFields.push("name = ?");
                updateValues.push(name);
            }

            if (email !== undefined && email !== null && email !== '') {
                updateFields.push("email = ?");
                updateValues.push(email);
            }

            updateValues.push(user_id); // Add user_id at the end for WHERE clause

            var updateUserSQL = `UPDATE user_master SET ${updateFields.join(', ')} WHERE user_id = ? AND delete_flag = 0`;
            connection.query(updateUserSQL, updateValues, async (error, updateUserResult) => {
                if (error) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                }
                if (updateUserResult.affectedRows > 0) {
                    await DeviceTokenStore_1_Signal(user_id, device_type, player_id, function (result) { });

                    // Send OTP via SMS India Hub
                    const formattedMobile = smsIndiaHubService.formatMobileNumber(phone_code, mobile);
                    const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                    if (!smsResult.success) {
                        console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                        // Continue with response even if SMS fails - OTP is still stored in DB
                    }

                    fetchUserData(user_id, async (error, userDataArray) => {
                        if (error) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                        }

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.otpSendSuccessfully,
                            userDataArray,
                            token: token
                        });
                    });
                } else {
                    return response.status(200).json({ success: false, msg: languageMessage.errorUpdatingUserData });
                }
            });
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

/**
 * Sign Up with Mobile (for new users only)
 * Creates a new user account and sends OTP
 */
const signUpWithMobile = async (request, response) => {
    try {
        const { error, value } = signUpWithMobileSchema.validate(request.body);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed'],
                errors: error.details.map(detail => detail.message)
            });
        }

        const { mobile, phone_code, player_id, device_type, user_type, name, email, state, source, medium, campaign } = value;

        // Default acquisition values
        const finalSource = source || 'organic';
        const finalMedium = medium || 'playstore';
        const finalCampaign = campaign || 'none';

        // Generate current timestamp for this request
        let createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        var otp = await generateRandomOTP(6, mobile);
        const payload = { subject: mobile };
        const token = jwt.sign(payload, SECRET_KEY);

        // Check if user already exists with same user_type
        var sqlSelect = "SELECT user_id, mobile, user_type, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0 AND user_type = ? ";
        connection.query(sqlSelect, [phone_code, mobile, user_type], async (error, userSelectResult) => {
            if (error) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
            }

            // If user exists with same user_type, reject signup (user should use login API)
            if (userSelectResult.length > 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['User already exists. Please use login API.', 'उपयोगकर्ता पहले से मौजूद है। कृपया लॉगिन API का उपयोग करें।', 'वापरकर्ता आधीपासून अस्तित्वात आहे. कृपया लॉगिन API वापरा.'],
                    key: 'user_already_exists'
                });
            }

            // Check if mobile number is already registered with different user_type
            const checkMobileQuery = "SELECT user_id, mobile, user_type, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0";
            connection.query(checkMobileQuery, [phone_code, mobile], async (checkErr, checkResult) => {
                if (checkErr) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkErr.message });
                }

                // If mobile number exists with different user_type, reject
                if (checkResult.length > 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['This mobile number is already registered. Please use login API.', 'यह मोबाइल नंबर पहले से पंजीकृत है। कृपया लॉगिन API का उपयोग करें।', 'हा मोबाइल नंबर आधीपासून नोंदणीकृत आहे. कृपया लॉगिन API वापरा.'],
                        key: 'mobile_already_exists'
                    });
                }

                // Mobile number is not registered, create new user
                // Include name and email if provided (optional fields)
                let insertFields = ["mobile", "phone_code", "otp", "otp_verify", "user_type", "login_type", "createtime", "updatetime", "source", "medium", "campaign"];
                let insertValues = [mobile, phone_code, otp, 0, user_type, 0, createtime, createtime, finalSource, finalMedium, finalCampaign];

                if (name !== undefined && name !== null && name !== '') {
                    insertFields.push("name");
                    insertValues.push(name);
                }

                if (email !== undefined && email !== null && email !== '') {
                    insertFields.push("email");
                    insertValues.push(email);
                }

                if (state !== undefined && state !== null && state !== '') {
                    insertFields.push("state");
                    insertValues.push(state);
                }

                insertFields.push("signup_step");
                insertValues.push(1);

                const insertUser = `INSERT INTO user_master (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
                const values = insertValues;
                connection.query(insertUser, values, async (insertErr, data) => {
                    if (insertErr) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: insertErr.message });
                    }
                    const user_id = data.insertId;
                    await DeviceTokenStore_1_Signal(user_id, device_type, player_id, function () { });

                    // Safety cleanup: Remove any subscription_id = 1 (referral reward) that might have been incorrectly assigned
                    const preCleanupQuery = `
                        DELETE FROM user_subscription_master 
                        WHERE user_id = ? AND subscription_id = 1 AND delete_flag = 0
                    `;
                    connection.query(preCleanupQuery, [user_id], (preCleanupErr, preCleanupResult) => {
                        if (preCleanupErr) {
                            console.error(`Error in pre-cleanup for user ${user_id}:`, preCleanupErr);
                        } else if (preCleanupResult.affectedRows > 0) {
                            console.warn(`⚠ Pre-cleanup: Removed ${preCleanupResult.affectedRows} incorrectly assigned referral reward subscription(s) for user ${user_id}`);
                        }
                    });

                    // Automatically assign ONLY free trial subscription (subscription_id = 0) for new users
                    connection.beginTransaction((transactionErr) => {
                        if (transactionErr) {
                            console.error('Error starting transaction for subscription assignment:', transactionErr);
                        } else {
                            const checkExistingSubscriptionQuery = `
                                SELECT user_subscription_id, subscription_id 
                                FROM user_subscription_master 
                                WHERE user_id = ? AND delete_flag = 0
                            `;
                            connection.query(checkExistingSubscriptionQuery, [user_id], (checkErr, checkResult) => {
                                if (checkErr) {
                                    connection.rollback(() => {
                                        console.error('Error checking existing subscription:', checkErr);
                                    });
                                } else if (checkResult.length > 0) {
                                    connection.rollback(() => {
                                        console.log(`User ${user_id} already has ${checkResult.length} subscription(s), skipping free trial assignment`);
                                    });
                                } else {
                                    const getValidityQuery = `
                                        SELECT subscription_id, validity_days, text, description 
                                        FROM subscription_master 
                                        WHERE subscription_id = 0 AND delete_flag = 0 
                                        LIMIT 1
                                    `;
                                    connection.query(getValidityQuery, (validityErr, validityResult) => {
                                        if (validityErr) {
                                            connection.rollback(() => {
                                                console.error('Error fetching free trial validity:', validityErr);
                                            });
                                        } else if (validityResult.length === 0) {
                                            connection.rollback(() => {
                                                console.error('Free trial plan (subscription_id = 0) not found in subscription_master');
                                            });
                                        } else {
                                            const plan = validityResult[0];
                                            if (plan.subscription_id !== 0) {
                                                connection.rollback(() => {
                                                    console.error(`ERROR: Expected subscription_id = 0, but got ${plan.subscription_id}. Aborting subscription assignment.`);
                                                });
                                                return;
                                            }

                                            const validityDays = plan.validity_days || 15;
                                            const subscriptionText = plan.text || '15 Days Free Trial';
                                            const subscriptionDescription = plan.description || 'Free Trial Plan (15 Days)';

                                            const now = new Date();
                                            const endDate = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

                                            const insertSubscriptionQuery = `
                                                INSERT INTO user_subscription_master 
                                                (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
                                                VALUES (0, ?, 0.00, 0, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())
                                            `;

                                            connection.query(insertSubscriptionQuery, [user_id, subscriptionText, subscriptionDescription, now, endDate], (subInsertErr, subInsertResult) => {
                                                if (subInsertErr) {
                                                    connection.rollback(() => {
                                                        console.error('Error assigning free trial subscription:', subInsertErr);
                                                    });
                                                } else {
                                                    const verifyQuery = `
                                                        SELECT subscription_id 
                                                        FROM user_subscription_master 
                                                        WHERE user_subscription_id = ? AND subscription_id = 0
                                                    `;
                                                    connection.query(verifyQuery, [subInsertResult.insertId], (verifyErr, verifyResult) => {
                                                        if (verifyErr || verifyResult.length === 0) {
                                                            connection.rollback(() => {
                                                                console.error(`CRITICAL ERROR: Subscription assigned but verification failed for user ${user_id}`);
                                                            });
                                                        } else {
                                                            connection.commit((commitErr) => {
                                                                if (commitErr) {
                                                                    console.error('Error committing subscription transaction:', commitErr);
                                                                } else {
                                                                    console.log(`✓ Free trial subscription (subscription_id = 0) successfully assigned to new user ${user_id}`);

                                                                    const cleanupQuery = `
                                                                        DELETE FROM user_subscription_master 
                                                                        WHERE user_id = ? AND subscription_id = 1 AND delete_flag = 0
                                                                    `;
                                                                    connection.query(cleanupQuery, [user_id], (cleanupErr, cleanupResult) => {
                                                                        if (cleanupErr) {
                                                                            console.error(`Error cleaning up referral reward subscription for user ${user_id}:`, cleanupErr);
                                                                        } else if (cleanupResult.affectedRows > 0) {
                                                                            console.warn(`⚠ Removed ${cleanupResult.affectedRows} incorrectly assigned referral reward subscription(s) for user ${user_id}`);
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });

                    // Send OTP via SMS India Hub
                    const formattedMobile = smsIndiaHubService.formatMobileNumber(phone_code, mobile);
                    const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                    if (!smsResult.success) {
                        console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                    }

                    fetchUserData(user_id, async (fetchErr, userDataArray) => {
                        if (fetchErr) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: fetchErr.message });
                        }

                        const updateLoginTime = "UPDATE user_master SET last_login_date_time = ? WHERE user_id = ? AND delete_flag = 0";
                        connection.query(updateLoginTime, [createtime, user_id], async (updateErr2) => {
                            if (updateErr2) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, err: updateErr2.message });
                            }

                            return response.status(200).json({ success: true, msg: languageMessage.otpSendSuccessfully, userDataArray, token });
                        });
                    });
                });
            });
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};


const resendOtp = (request, response) => {

    try {

        // Check if request body exists
        if (!request.body) {
            return response.status(200).json({
                success: false,
                msg: ['Request body is required', 'अनुरोध बॉडी आवश्यक है', 'विनंती बॉडी आवश्यक आहे'],
                errors: ['Please provide mobile and phone_code in request body']
            });
        }

        const { error, value } = resendOtpSchema.validate(request.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            return response.status(200).json({
                success: false,
                msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        // Safety check: ensure value exists and has required fields
        if (!value || !value.mobile || !value.phone_code) {
            return response.status(200).json({
                success: false,
                msg: ['Invalid request data', 'अमान्य अनुरोध डेटा', 'अवैध विनंती डेटा'],
                errors: ['Mobile number and phone code are required']
            });
        }

        const { mobile, phone_code, user_type } = value;

        // Build query based on whether user_type is provided
        let query1;
        let values1;

        if (user_type !== undefined && user_type !== null) {
            // If user_type is provided, query with user_type (for login scenario)
            query1 = "SELECT user_id, mobile, phone_code, active_flag, user_type FROM user_master WHERE delete_flag=0 AND mobile = ? AND phone_code = ? AND user_type = ?";
            values1 = [mobile, phone_code, user_type];
        } else {
            // If user_type is not provided, query without it (for registration scenario)
            query1 = "SELECT user_id, mobile, phone_code, active_flag, user_type FROM user_master WHERE delete_flag=0 AND mobile = ? AND phone_code = ?";
            values1 = [mobile, phone_code];
        }

        connection.query(query1, values1, async (queryError, queryResult) => {

            if (queryError) {
                console.error('Error fetching user for resend OTP:', queryError);
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: queryError.message
                });
            }

            // If user not found, check if mobile exists with different user_type
            if (queryResult.length <= 0) {
                // Check if mobile number exists with any user_type
                const checkMobileQuery = "SELECT user_id, mobile, user_type, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0";

                connection.query(checkMobileQuery, [phone_code, mobile], async (checkErr, checkResult) => {
                    if (checkErr) {
                        console.error('Error checking mobile number:', checkErr);
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                            error: checkErr.message
                        });
                    }

                    // If mobile exists with different user_type and user_type was specified, reject
                    if (checkResult.length > 0 && user_type !== undefined && user_type !== null) {
                        const existingUserType = checkResult[0].user_type;
                        if (existingUserType !== user_type) {
                            return response.status(200).json({
                                success: false,
                                msg: ['This mobile number is already registered with a different account type. Please use the correct account type or a different number.', 'यह मोबाइल नंबर पहले से एक अलग खाता प्रकार के साथ पंजीकृत है। कृपया सही खाता प्रकार का उपयोग करें या एक अलग नंबर।', 'हा मोबाइल नंबर आधीपासून वेगळ्या खाता प्रकारासह नोंदणीकृत आहे. कृपया योग्य खाता प्रकार वापरा किंवा वेगळा नंबर वापरा.'],
                                key: 'mobile_already_exists_different_type'
                            });
                        }
                    }

                    // Mobile number is not registered, create new user
                    console.log(`User not found for mobile ${mobile}. Creating new user...`);

                    // Default user_type to 1 (User) if not provided
                    const defaultUserType = user_type !== undefined && user_type !== null ? user_type : 1;

                    // Generate OTP
                    var otp = await generateRandomOTP(6, mobile);
                    console.log(`Generated OTP for new user (mobile: ${mobile}, user_type: ${defaultUserType}): ${otp}`);

                    // Generate current timestamp for this request
                    let createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

                    // Create new user record
                    let insertFields = ["mobile", "phone_code", "otp", "otp_verify", "user_type", "login_type", "createtime", "updatetime", "signup_step"];
                    let insertValues = [mobile, phone_code, otp, 0, defaultUserType, 0, createtime, createtime, 1];

                    const insertUser = `INSERT INTO user_master (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;

                    connection.query(insertUser, insertValues, async (insertErr, insertResult) => {
                        if (insertErr) {
                            console.error('Error creating new user for resend OTP:', insertErr);
                            return response.status(200).json({
                                success: false,
                                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                error: insertErr.message
                            });
                        }

                        const new_user_id = insertResult.insertId;
                        console.log(`New user created with user_id: ${new_user_id}`);

                        // Send OTP via SMS India Hub
                        const phoneCodeStr = phone_code ? String(phone_code).replace(/[^0-9]/g, '') : '91';
                        const formattedMobile = smsIndiaHubService.formatMobileNumber(phoneCodeStr, mobile);

                        console.log(`Attempting to send OTP to new user: ${formattedMobile}`);

                        try {
                            const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                            if (!smsResult.success) {
                                console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                            } else {
                                console.log(`OTP sent successfully via SMS to ${formattedMobile}`);
                            }
                        } catch (smsError) {
                            console.error('Exception while sending OTP via SMS:', smsError);
                        }

                        // Return success response (user data not needed for new registration)
                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.otpSendSuccessfully || ['OTP sent successfully', 'OTP सफलतापूर्वक भेजा गया', 'OTP यशस्वीरित्या पाठवले'],
                            message: 'New user created. OTP sent successfully.'
                        });
                    });
                });

                return; // Exit early after handling new user creation
            }

            // If multiple users found (different user_type), use the first one
            // In most cases, there should be only one match
            const user = queryResult[0];
            const user_id = user.user_id;

            // Check if account is deactivated (only for existing active users)
            if (user.active_flag === 0) {
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.accountdeactivated || ['Account is deactivated', 'खाता निष्क्रिय है', 'खाते निष्क्रिय आहे']
                });
            }

            var otp = await generateRandomOTP(6, mobile);
            console.log(`Generated OTP for mobile ${mobile} (user_id: ${user_id}): ${otp}`);

            // Update OTP in database
            var sql = "UPDATE user_master SET otp = ?, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";

            connection.query(sql, [otp, user_id], async (error, result) => {

                if (error) {
                    console.error('Error updating OTP in database:', error);
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: error.message
                    });
                }

                if (result.affectedRows === 0) {
                    console.error('No rows updated when trying to update OTP for mobile:', mobile);
                    return response.status(200).json({
                        success: false,
                        msg: ['Failed to update OTP. Please try again.', 'OTP अपडेट करने में विफल। कृपया पुनः प्रयास करें।', 'OTP अपडेट करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.']
                    });
                }

                // Send OTP via SMS India Hub
                // Ensure phone_code is a string (it might be stored as number in DB or come as +91 format)
                const phoneCodeStr = phone_code ? String(phone_code).replace(/[^0-9]/g, '') : '91';
                const formattedMobile = smsIndiaHubService.formatMobileNumber(phoneCodeStr, mobile);

                console.log(`Attempting to send OTP to: ${formattedMobile} (original: ${phone_code} ${mobile})`);

                try {
                    const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                    if (!smsResult.success) {
                        console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                        // Still return success if OTP is stored in DB, but log the SMS failure
                        // OTP is still valid for verification even if SMS fails
                    } else {
                        console.log(`OTP sent successfully via SMS to ${formattedMobile}`);
                    }
                } catch (smsError) {
                    console.error('Exception while sending OTP via SMS:', smsError);
                    // Continue - OTP is still stored in DB and can be verified
                }

                // If user exists and is active, return user data
                // For new registrations, user might not have complete profile yet
                if (user_id) {
                    fetchUserData(user_id, async (error, userDataArray) => {

                        if (error) {
                            console.error('Error fetching user data after OTP resend:', error);
                            // Still return success since OTP was sent
                            return response.status(200).json({
                                success: true,
                                msg: languageMessage.otpSendSuccessfully || ['OTP sent successfully', 'OTP सफलतापूर्वक भेजा गया', 'OTP यशस्वीरित्या पाठवले'],
                                message: 'OTP sent. User data could not be fetched.'
                            });
                        }

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.otpSendSuccessfully || ['OTP sent successfully', 'OTP सफलतापूर्वक भेजा गया', 'OTP यशस्वीरित्या पाठवले'],
                            userDataArray
                        });

                    });
                } else {
                    // If no user_id (shouldn't happen, but handle gracefully)
                    return response.status(200).json({
                        success: true,
                        msg: languageMessage.otpSendSuccessfully || ['OTP sent successfully', 'OTP सफलतापूर्वक भेजा गया', 'OTP यशस्वीरित्या पाठवले']
                    });
                }

            });

        });

    } catch (error) {

        console.error('Exception in resendOtp:', error);
        return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: error.message
        });

    }

};

const otpVerify = async (request, response) => {
    try {
        const { error, value } = otpVerifySchema.validate(request.body);
        if (error) {
            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });
        }

        const { user_id, otp } = value;
        // user check exists or not

        const query1 = "SELECT user_id,active_flag FROM user_master WHERE delete_flag=0 and user_id = ?";
        const values1 = [user_id];
        connection.query(query1, values1, async (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError });

            }

            if (queryResult.length <= 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }
            if (queryResult[0].active_flag === 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['Your account has been suspended. Please contact support.', 'आपका खाता निलंबित कर दिया गया है। कृपया सहायता से संपर्क करें।', 'तुमचे खाते निलंबित केले गेले आहे. कृपया समर्थनाशी संपर्क साधा.'],
                    key: 'account_suspended'
                });
            }

            // Verify OTP - check if OTP matches (expiry check removed)
            const checksql = "SELECT otp FROM user_master WHERE user_id = ? AND delete_flag = 0";
            connection.query(checksql, [user_id], async (err, data) => {

                if (err) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                } else {
                    if (data.length > 0) {
                        const storedOtp = data[0].otp;

                        // Check if OTP exists
                        if (!storedOtp || storedOtp === null || storedOtp === '') {
                            return response.status(200).json({
                                success: false,
                                msg: ['OTP not found. Please request a new OTP.', 'OTP नहीं मिला। कृपया नया OTP अनुरोध करें।', 'OTP सापडले नाही. कृपया नवीन OTP विनंती करा.'],
                                key: 'otp_not_found'
                            });
                        }

                        // Check if OTP matches (trim whitespace and compare)
                        const providedOtp = String(otp).trim();
                        const storedOtpTrimmed = String(storedOtp).trim();

                        if (providedOtp !== storedOtpTrimmed) {
                            return response.status(200).json({
                                success: false,
                                msg: languageMessage.wrongotp || ['Invalid OTP. Please try again.', 'अमान्य OTP। कृपया पुनः प्रयास करें।', 'अवैध OTP. कृपया पुन्हा प्रयत्न करा.'],
                                key: 'invalid_otp'
                            });
                        }

                        // OTP expiry check removed - OTP will remain valid until verified or new OTP is generated
                        console.log(`OTP Verification - User: ${user_id}, OTP matched successfully. Expiry check disabled.`);

                        // OTP is valid, proceed with verification
                        // Clear OTP after successful verification for security
                        // Generate current timestamp for last_login_date_time
                        const currentTime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
                        const updatesql = "UPDATE user_master SET otp_verify = 1, signup_step = 2, otp = NULL, last_login_date_time = ?, updatetime = now() WHERE user_id = ? AND delete_flag = 0";
                        connection.query(updatesql, [currentTime, user_id], (err, information) => {
                            if (err) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                            } else {
                                // Check if user already has a personal account
                                const checkPersonalAccountQuery = "SELECT user_account_id FROM user_account_master WHERE user_id = ? AND user_type = 1 AND delete_flag = 0";
                                connection.query(checkPersonalAccountQuery, [user_id], (checkErr, checkResult) => {
                                    if (checkErr) {
                                        console.error('Error checking personal account:', checkErr);
                                        // Continue with normal flow even if check fails
                                        fetchUserData(user_id, async (error, userDataArray) => {
                                            if (error) {
                                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError });
                                            }
                                            return response.status(200).json({ success: true, msg: languageMessage.otpverifysuccess, userDataArray });
                                        });
                                        return;
                                    }

                                    // If no personal account exists, create one
                                    if (checkResult.length === 0) {
                                        const createPersonalAccountQuery = "INSERT INTO user_account_master (account_name, user_id, user_type, createtime, updatetime) VALUES (?, ?, 1, NOW(), NOW())";
                                        const personalAccountName = `Personal`;

                                        connection.query(createPersonalAccountQuery, [personalAccountName, user_id], (createErr, createResult) => {
                                            if (createErr) {
                                                console.error('Error creating personal account:', createErr);
                                                // Continue with normal flow even if personal account creation fails
                                            } else {
                                                console.log(`Personal account created for user ${user_id} with account_id ${createResult.insertId}`);
                                            }

                                            // Continue with normal flow
                                            fetchUserData(user_id, async (error, userDataArray) => {
                                                if (error) {
                                                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError });
                                                }
                                                return response.status(200).json({ success: true, msg: languageMessage.otpverifysuccess, userDataArray });
                                            });
                                        });
                                    } else {
                                        // Personal account already exists, continue with normal flow
                                        fetchUserData(user_id, async (error, userDataArray) => {
                                            if (error) {
                                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError });
                                            }
                                            return response.status(200).json({ success: true, msg: languageMessage.otpverifysuccess, userDataArray });
                                        });
                                    }
                                });
                            }
                        });
                    } else {
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.wrongotp || ['Invalid OTP. Please try again.', 'अमान्य OTP। कृपया पुनः प्रयास करें।', 'अवैध OTP. कृपया पुन्हा प्रयत्न करा.'],
                            key: 'invalid_otp'
                        });
                    }

                }

            });

        });

    } catch (error) {

        return response.status(200).json({ success: false, msg: message.internalServerError, error: error.message });

    }

};
const contactUs = (request, response) => {

    try {

        const { error, value } = contactUsSchema.validate(request.body);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }

        const { user_id, name, email, message: msgBody, user_type } = value;

        var sql1 = "SELECT user_id, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ? AND delete_flag = 0";

        connection.query(sql1, [user_id], async (err, information) => {

            if (err) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

            }

            if (information.length <= 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }

            if (information[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });

            }
            const insertQuery = "INSERT INTO contact_us_master (user_type,user_id, name, email, message, createtime, updatetime) VALUES (?, ?, ?, ?, ?, NOW(), NOW())";

            connection.query(insertQuery, [user_type, user_id, name, email, msgBody], async (err, result) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err, });

                }

                return response.status(200).json({ success: true, msg: languageMessage.contactUsMsg });

            });

        });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error });

    }

};

const deleteAccount = (request, response) => {

    try {

        const { error, value } = deleteAccountSchema.validate(request.body);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }

        const { user_id, reason } = value;



        // check user exists start

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {

            if (err) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, });

            }

            if (userInfo.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }

            // if (userInfo[0].active_flag === 0) {

            //     return response.status(200).json({success: false,msg: message.accountdeactivated,active_status: 0});

            // }

            let delete_flag = 1;

            connection.query("update user_master set delete_flag = ?,updatetime=now(),delete_reason=? where user_id=?", [delete_flag, reason, user_id], (err, information) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "7" });

                } else {

                    return response.status(200).json({ success: true, msg: languageMessage.deleteAccount });

                }

            });

        });

        // check user exists end

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "2", error: error.message });

    };

};

const editProfile = async (request, response) => {
    try {
        const { error, value } = createProfileSchema.validate(request.body);
        if (error) {
            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });
        }
        const { name, email, DOB, gender, user_id, mobile, state } = value;
        let image = request.file ? request.file.path : null; // Cloudinary returns the secure_url in the file object
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
            [user_id], (err, userInfo) => {
                if (err) {
                    return response.status(500).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                }
                if (userInfo.length === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
                }
                if (userInfo[0].active_flag === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });
                }
                // Update only the profile fields: name, email, dob, gender, mobile
                let updateFields = [];
                let updateValues = [];

                if (name !== undefined && name !== null) {
                    updateFields.push("name = ?");
                    updateValues.push(name);
                }

                if (email !== undefined && email !== null) {
                    updateFields.push("email = ?");
                    updateValues.push(email);
                }

                if (DOB !== undefined && DOB !== null) {
                    updateFields.push("dob = ?"); // Database column is 'dob', not 'DOB'
                    // Fix: Handle timezone offset to prevent one-day lag
                    // If frontend sends UTC (e.g., previous day 18:30 for IST), this ensures we get the correct local date
                    updateValues.push(moment(DOB).tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD'));
                }

                if (gender !== undefined && gender !== null) {
                    updateFields.push("gender = ?");
                    updateValues.push(gender);
                }

                if (mobile !== undefined && mobile !== null) {
                    updateFields.push("mobile = ?");
                    updateValues.push(mobile);
                }

                if (state !== undefined && state !== null) {
                    updateFields.push("state = ?");
                    updateValues.push(state);
                }

                if (image) {
                    updateFields.push("image = ?");
                    updateValues.push(image);
                }

                if (updateFields.length === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['No fields to update', 'अपडेट करने के लिए कोई फील्ड नहीं', 'अपडेट करण्यासाठी कोणतेही फील्ड नाही']
                    });
                }

                updateFields.push("updatetime = NOW()");
                updateValues.push(user_id);

                const updateQuery = `UPDATE user_master SET ${updateFields.join(', ')} WHERE user_id = ? AND delete_flag = 0`;
                connection.query(updateQuery, updateValues, (updateErr, result) => {
                    if (updateErr) {
                        return response.status(500).json({ success: false, msg: languageMessage.internalServerError, error: updateErr.message });
                    }

                    if (result.affectedRows === 0) {
                        return response.status(200).json({
                            success: false,
                            msg: ['Failed to update profile', 'प्रोफ़ाइल अपडेट करने में विफल', 'प्रोफाइल अपडेट करण्यात अयशस्वी']
                        });
                    }

                    // Get updated profile data - only the required fields
                    const getProfileQuery = `
                        SELECT 
                            user_id,
                            name,
                            email,
                            dob as DOB,
                            gender,
                            mobile,
                            state,
                            phone_code,
                            image
                        FROM user_master 
                        WHERE user_id = ? AND delete_flag = 0
                    `;

                    connection.query(getProfileQuery, [user_id], (profileErr, profileResult) => {
                        if (profileErr) {
                            return response.status(200).json({
                                success: false,
                                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                error: profileErr.message
                            });
                        }

                        if (profileResult.length === 0) {
                            return response.status(200).json({
                                success: false,
                                msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
                            });
                        }

                        const profileData = {
                            user_id: profileResult[0].user_id,
                            name: profileResult[0].name || null,
                            email: profileResult[0].email || null,
                            DOB: profileResult[0].DOB || null,
                            gender: profileResult[0].gender || null,
                            mobile: profileResult[0].mobile || null,
                            phone_code: profileResult[0].phone_code || null,
                            image: profileResult[0].image || null
                        };

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.profileUpdated || ['Profile updated successfully', 'प्रोफ़ाइल सफलतापूर्वक अपडेट की गई', 'प्रोफाइल यशस्वीरित्या अपडेट केली'],
                            data: profileData
                        });
                    });
                });
            }
        );
    } catch (error) {
        return response.status(500).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

/**
 * Get User Profile Controller
 * Retrieves user profile information using user_id from token
 */
const getUserProfile = async (request, response) => {
    try {
        const user_id = request.userId;

        if (!user_id) {
            return response.status(200).json({
                success: false,
                msg: languageMessage.empt_params || ['User ID not found', 'उपयोगकर्ता ID नहीं मिला', 'वापरकर्ता ID सापडले नाही'],
                key: "user_id"
            });
        }

        // Get only profile fields: name, email, dob, gender, mobile
        const profileQuery = `
            SELECT 
                user_id,
                name,
                email,
                dob as DOB,
                gender,
                mobile,
                phone_code,
                image
            FROM user_master 
            WHERE user_id = ? AND delete_flag = 0
        `;

        connection.query(profileQuery, [user_id], async (error, results) => {
            if (error) {
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: error.message
                });
            }

            if (results.length === 0) {
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.msgDataNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही'],
                    key: "user_not_found"
                });
            }

            const userData = results[0];

            // Return only the required profile fields
            const profileData = {
                user_id: userData.user_id,
                name: userData.name || null,
                email: userData.email || null,
                DOB: userData.DOB || null,
                gender: userData.gender || null,
                mobile: userData.mobile || null,
                phone_code: userData.phone_code || null,
                image: userData.image || null
            };

            return response.status(200).json({
                success: true,
                msg: languageMessage.msgDataFound || ['User profile retrieved successfully', 'उपयोगकर्ता प्रोफ़ाइल सफलतापूर्वक प्राप्त', 'वापरकर्ता प्रोफाइल यशस्वीरित्या मिळाले'],
                data: profileData
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

const authenticateUser = async (request, response) => {
    try {
        const { error, value } = loginWithMobileSchema.validate(request.body);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed'],
                errors: error.details.map(detail => detail.message)
            });
        }

        const { mobile, phone_code, player_id, device_type, user_type, name, email } = value;

        // Generate current timestamp for this request
        let createtime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

        var otp = await generateRandomOTP(6, mobile);
        const payload = { subject: mobile };
        const token = jwt.sign(payload, SECRET_KEY);

        // Check if user exists with same user_type
        var sqlSelect = "SELECT user_id, mobile, otp_verify, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0 AND user_type = ? ";
        connection.query(sqlSelect, [phone_code, mobile, user_type], async (error, userSelectResult) => {
            if (error) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
            }

            // CASE 1: USER EXISTS -> LOGIN
            if (userSelectResult.length > 0) {
                var user_id = userSelectResult[0].user_id;
                var active_flag = userSelectResult[0].active_flag;

                if (active_flag === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Your account has been suspended. Please contact support.', 'आपका खाता निलंबित कर दिया गया है। कृपया सहायता से संपर्क करें।', 'तुमचे खाते निलंबित केले गेले आहे. कृपया समर्थनाशी संपर्क साधा.'],
                        key: 'account_suspended'
                    });
                }

                // Update OTP and optional name/email for existing user
                let updateFields = ["mobile = ?", "phone_code = ?", "otp = ?", "updatetime = NOW()", "last_login_date_time = ?"];
                let updateValues = [mobile, phone_code, otp, createtime];

                if (name !== undefined && name !== null && name !== '') {
                    updateFields.push("name = ?");
                    updateValues.push(name);
                }

                if (email !== undefined && email !== null && email !== '') {
                    updateFields.push("email = ?");
                    updateValues.push(email);
                }

                updateValues.push(user_id); // Add user_id at the end for WHERE clause

                var updateUserSQL = `UPDATE user_master SET ${updateFields.join(', ')} WHERE user_id = ? AND delete_flag = 0`;
                connection.query(updateUserSQL, updateValues, async (error, updateUserResult) => {
                    if (error) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                    }
                    if (updateUserResult.affectedRows > 0) {
                        await DeviceTokenStore_1_Signal(user_id, device_type, player_id, function (result) { });

                        // Send OTP via SMS India Hub
                        const formattedMobile = smsIndiaHubService.formatMobileNumber(phone_code, mobile);
                        const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                        if (!smsResult.success) {
                            console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                        }

                        fetchUserData(user_id, async (error, userDataArray) => {
                            if (error) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                            }

                            return response.status(200).json({
                                success: true,
                                msg: languageMessage.otpSendSuccessfully,
                                userDataArray,
                                token: token,
                                is_new_user: false
                            });
                        });
                    } else {
                        return response.status(200).json({ success: false, msg: languageMessage.errorUpdatingUserData });
                    }
                });
            } else {
                // CASE 2: USER DOES NOT EXIST -> SIGNUP

                // Check if mobile number is already registered with different user_type
                const checkMobileQuery = "SELECT user_id, mobile, user_type, active_flag FROM user_master WHERE phone_code = ? AND mobile = ? AND delete_flag = 0";
                connection.query(checkMobileQuery, [phone_code, mobile], async (checkErr, checkResult) => {
                    if (checkErr) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkErr.message });
                    }

                    // If mobile number exists with different user_type, reject
                    if (checkResult.length > 0) {
                        // Check if existing user is a Manager (user_type = 0)
                        if (checkResult[0].user_type === 0) {
                            return response.status(200).json({
                                success: false,
                                msg: ['This mobile number is already registered with a manager account', 'यह मोबाइल नंबर पहले से एक मैनेजर खाते के साथ पंजीकृत है', 'हा मोबाइल नंबर आधीपासून मैनेजर खात्यासह नोंदणीकृत आहे'],
                                key: 'mobile_already_exists_manager'
                            });
                        }

                        return response.status(200).json({
                            success: false,
                            msg: ['This mobile number is already registered with a different account type.', 'यह मोबाइल नंबर पहले से एक अलग खाता प्रकार के साथ पंजीकृत है।', 'हा मोबाइल नंबर आधीपासून वेगळ्या खाते प्रकारासह नोंदणीकृत आहे.'],
                            key: 'mobile_already_exists'
                        });
                    }

                    // Mobile number is not registered, create new user
                    let insertFields = ["mobile", "phone_code", "otp", "otp_verify", "user_type", "login_type", "createtime", "updatetime", "signup_step"];
                    let insertValues = [mobile, phone_code, otp, 0, user_type, 0, createtime, createtime, 1];

                    if (name !== undefined && name !== null && name !== '') {
                        insertFields.push("name");
                        insertValues.push(name);
                    }

                    if (email !== undefined && email !== null && email !== '') {
                        insertFields.push("email");
                        insertValues.push(email);
                    }

                    const insertUser = `INSERT INTO user_master (${insertFields.join(', ')}) VALUES (${insertFields.map(() => '?').join(', ')})`;
                    const values = insertValues;
                    connection.query(insertUser, values, async (insertErr, data) => {
                        if (insertErr) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: insertErr.message });
                        }
                        const user_id = data.insertId;
                        await DeviceTokenStore_1_Signal(user_id, device_type, player_id, function () { });

                        // Safety cleanup: Remove any subscription_id = 1 (referral reward)
                        const preCleanupQuery = `
                            DELETE FROM user_subscription_master 
                            WHERE user_id = ? AND subscription_id = 1 AND delete_flag = 0
                        `;
                        connection.query(preCleanupQuery, [user_id], (preCleanupErr, preCleanupResult) => { });

                        // Automatically assign ONLY free trial subscription (subscription_id = 0) for new users
                        connection.beginTransaction((transactionErr) => {
                            if (!transactionErr) {
                                const checkExistingSubscriptionQuery = `
                                    SELECT user_subscription_id, subscription_id 
                                    FROM user_subscription_master 
                                    WHERE user_id = ? AND delete_flag = 0
                                `;
                                connection.query(checkExistingSubscriptionQuery, [user_id], (checkErr, checkResult) => {
                                    if (!checkErr && checkResult.length === 0) {
                                        const getValidityQuery = `
                                            SELECT subscription_id, validity_days, text, description 
                                            FROM subscription_master 
                                            WHERE subscription_id = 0 AND delete_flag = 0 
                                            LIMIT 1
                                        `;
                                        connection.query(getValidityQuery, (validityErr, validityResult) => {
                                            if (!validityErr && validityResult.length > 0) {
                                                const plan = validityResult[0];
                                                const validityDays = plan.validity_days || 15;
                                                const subscriptionText = plan.text || '15 Days Free Trial';
                                                const subscriptionDescription = plan.description || 'Free Trial Plan (15 Days)';

                                                const now = new Date();
                                                const endDate = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

                                                const insertSubscriptionQuery = `
                                                    INSERT INTO user_subscription_master 
                                                    (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime)
                                                    VALUES (0, ?, 0.00, 0, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())
                                                `;

                                                connection.query(insertSubscriptionQuery, [user_id, subscriptionText, subscriptionDescription, now, endDate], (subInsertErr, subInsertResult) => {
                                                    if (!subInsertErr) {
                                                        connection.commit((commitErr) => { });
                                                    } else {
                                                        connection.rollback(() => { });
                                                    }
                                                });
                                            } else {
                                                connection.rollback(() => { });
                                            }
                                        });
                                    } else {
                                        connection.rollback(() => { });
                                    }
                                });
                            }
                        });

                        // Send OTP via SMS India Hub
                        const formattedMobile = smsIndiaHubService.formatMobileNumber(phone_code, mobile);
                        const smsResult = await smsIndiaHubService.sendOTP(formattedMobile, otp);

                        if (!smsResult.success) {
                            console.error('Failed to send OTP via SMS India Hub:', smsResult.error);
                        }

                        fetchUserData(user_id, async (fetchErr, userDataArray) => {
                            if (fetchErr) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: fetchErr.message });
                            }

                            const updateLoginTime = "UPDATE user_master SET last_login_date_time = ? WHERE user_id = ? AND delete_flag = 0";
                            connection.query(updateLoginTime, [createtime, user_id], async (updateErr2) => {
                                if (updateErr2) {
                                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, err: updateErr2.message });
                                }

                                return response.status(200).json({
                                    success: true,
                                    msg: languageMessage.otpSendSuccessfully,
                                    userDataArray,
                                    token,
                                    is_new_user: true
                                });
                            });
                        });
                    });
                });
            }
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

export { loginWithMobile, signUpWithMobile, resendOtp, otpVerify, contactUs, deleteAccount, editProfile, getUserProfile, authenticateUser }