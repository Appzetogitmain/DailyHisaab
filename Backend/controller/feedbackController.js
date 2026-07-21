import moment from 'moment-timezone';
import connection from '../connection/dbConfig.js';
import { createFeedbackSchema, createAppRatingSchema, updateFeedbackResponseSchema, getFeedbackSchema, deleteFeedbackSchema } from '../validations/signUpWithMobile.js';
import { fetchUserData } from './function.js';
import languageMessage from './languageMessage.js';

/**
 * Create App Rating Controller
 * Allows users to rate the app and provide feedback if rating is less than 5 stars
 */
const createAppRating = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = createAppRatingSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, rating, feedback_message, device_info } = value;

    // Process device_info - store as string without validation
    let processedDeviceInfo = null;
    if (device_info) {
      if (typeof device_info === 'object') {
        processedDeviceInfo = JSON.stringify(device_info);
      } else {
        processedDeviceInfo = String(device_info);
      }
    }

    // Check if user exists and is active
    const userCheckQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || ['Account is deactivated', 'खाता निष्क्रिय है', 'खाते निष्क्रिय आहे'],
          active_status: 0
        });
      }

      // Check if user has already rated the app
      const existingRatingQuery = "SELECT rating_id FROM app_ratings WHERE user_id = ?";
      connection.query(existingRatingQuery, [user_id], (existingErr, existingResult) => {
        if (existingErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: existingErr.message
          });
        }

        // If user has already rated, update the existing rating
        if (existingResult.length > 0) {
          const updateRatingQuery = `
            UPDATE app_ratings 
            SET rating = ?, feedback_message = ?, device_info = ?, updatetime = NOW() 
            WHERE user_id = ?
          `;

          connection.query(updateRatingQuery, [rating, feedback_message || null, processedDeviceInfo, user_id], (updateErr, updateResult) => {
            if (updateErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: updateErr.message
              });
            }

            // If rating is less than 5 and feedback is provided, also create a feedback entry
            if (rating < 5 && feedback_message && feedback_message.trim().length > 0) {
              createFeedbackEntry(user_id, rating, feedback_message, processedDeviceInfo);
            }

            return response.status(200).json({
              success: true,
              msg: ['App rating updated successfully', 'ऐप रेटिंग सफलतापूर्वक अपडेट', 'अॅप रेटिंग यशस्वीरित्या अपडेट'],
              data: {
                rating_id: existingResult[0].rating_id,
                rating: rating,
                feedback_message: feedback_message,
                updated_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
                requires_feedback: rating < 5
              }
            });
          });
        } else {
          // Insert new rating
          const insertRatingQuery = `
            INSERT INTO app_ratings 
            (user_id, rating, feedback_message, device_info, createtime, updatetime) 
            VALUES (?, ?, ?, ?, NOW(), NOW())
          `;

          connection.query(insertRatingQuery, [user_id, rating, feedback_message || null, processedDeviceInfo], (insertErr, insertResult) => {
            if (insertErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: insertErr.message
              });
            }

            // If rating is less than 5 and feedback is provided, also create a feedback entry
            if (rating < 5 && feedback_message && feedback_message.trim().length > 0) {
              createFeedbackEntry(user_id, rating, feedback_message, processedDeviceInfo);
            }

            return response.status(200).json({
              success: true,
              msg: ['App rating submitted successfully', 'ऐप रेटिंग सफलतापूर्वक जमा किया गया', 'अॅप रेटिंग यशस्वीरित्या सबमिट केले'],
              data: {
                rating_id: insertResult.insertId,
                rating: rating,
                feedback_message: feedback_message,
                submitted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
                requires_feedback: rating < 5
              }
            });
          });
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
 * Helper function to create feedback entry for low ratings
 */
const createFeedbackEntry = (user_id, rating, feedback_message, device_info) => {
  // Determine feedback type based on rating
  let feedback_type = 'general_feedback';
  let subject = '';

  if (rating === 1) {
    feedback_type = 'complaint';
    subject = 'Poor App Experience - 1 Star Rating';
  } else if (rating === 2) {
    feedback_type = 'complaint';
    subject = 'Unsatisfactory App Experience - 2 Star Rating';
  } else if (rating === 3) {
    feedback_type = 'suggestion';
    subject = 'Average App Experience - 3 Star Rating';
  } else if (rating === 4) {
    feedback_type = 'suggestion';
    subject = 'Good App Experience - 4 Star Rating';
  }

  const insertFeedbackQuery = `
    INSERT INTO feedback_master 
    (user_id, feedback_type, subject, message, device_info, createtime, updatetime) 
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  `;

  connection.query(insertFeedbackQuery, [user_id, feedback_type, subject, feedback_message, device_info], (err, result) => {
    if (err) {
      console.error('Error creating feedback entry:', err);
    }
  });
};

/**
 * Get App Rating Feedback Controller (Admin)
 * Retrieves all user feedback from app ratings with filtering and pagination
 */
const getAppRatingFeedback = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Add timeout handling
    const timeoutId = setTimeout(() => {
      if (!response.headersSent) {
        return response.status(200).json({
          success: false,
          msg: ['Request timeout', 'अनुरोध समय सीमा समाप्त', 'विनंती वेळ मर्यादा संपली'],
          error: 'REQUEST_TIMEOUT'
        });
      }
    }, 30000); // 30 second timeout

    const {
      page = 1,
      limit = 20,
      rating = null,
      has_feedback = null,
      start_date = null,
      end_date = null,
      search = null
    } = request.query;

    // First, check if app_ratings table exists
    const tableCheckQuery = `
      SELECT COUNT(*) as table_exists 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'app_ratings'
    `;

    connection.query(tableCheckQuery, (tableErr, tableResult) => {
      if (tableErr) {
        console.error("Error checking app_ratings table:", tableErr);
        return response.status(200).json({
          success: false,
          msg: ['Database error while checking table existence', 'टेबल अस्तित्व जांचते समय डेटाबेस त्रुटि', 'टेबल अस्तित्व तपासताना डेटाबेस त्रुटी'],
          error: tableErr.message
        });
      }

      const tableExists = tableResult[0].table_exists > 0;
      if (!tableExists) {
        return response.status(200).json({
          success: false,
          msg: ['App ratings table does not exist. Please run the database migration script.', 'ऐप रेटिंग टेबल मौजूद नहीं है। कृपया डेटाबेस माइग्रेशन स्क्रिप्ट चलाएं।', 'अॅप रेटिंग टेबल अस्तित्वात नाही. कृपया डेटाबेस मायग्रेशन स्क्रिप्ट चालवा.'],
          error: 'TABLE_NOT_FOUND',
          solution: 'Run: mysql -u username -p database_name < APP_RATING_DATABASE_SCHEMA.sql'
        });
      }

      // Build query with filters
      let whereConditions = [];
      let queryParams = [];

      // Filter by rating
      if (rating) {
        whereConditions.push('ar.rating = ?');
        queryParams.push(rating);
      }

      // Filter by feedback presence
      if (has_feedback === 'true') {
        whereConditions.push('ar.feedback_message IS NOT NULL AND ar.feedback_message != ""');
      } else if (has_feedback === 'false') {
        whereConditions.push('(ar.feedback_message IS NULL OR ar.feedback_message = "")');
      }

      // Filter by date range
      if (start_date) {
        whereConditions.push('DATE(ar.createtime) >= ?');
        queryParams.push(start_date);
      }

      if (end_date) {
        whereConditions.push('DATE(ar.createtime) <= ?');
        queryParams.push(end_date);
      }

      // Search in feedback message
      if (search) {
        whereConditions.push('(ar.feedback_message LIKE ? OR um.name LIKE ? OR um.mobile LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Get total count
      const countQuery = `
      SELECT COUNT(*) as total 
      FROM app_ratings ar
      LEFT JOIN user_master um ON ar.user_id = um.user_id
      ${whereClause}
    `;

      connection.query(countQuery, queryParams, (countErr, countResult) => {
        if (countErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: countErr.message
          });
        }

        const totalCount = countResult[0].total;

        // Get rating feedback data
        const dataQuery = `
        SELECT 
          ar.rating_id,
          ar.user_id,
          ar.rating,
          ar.feedback_message,
          ar.device_info,
          ar.createtime,
          ar.updatetime,
          um.name as user_name,
          um.mobile as user_mobile,
          um.email as user_email
        FROM app_ratings ar
        LEFT JOIN user_master um ON ar.user_id = um.user_id
        ${whereClause}
        ORDER BY ar.createtime DESC
        LIMIT ? OFFSET ?
      `;

        connection.query(dataQuery, [...queryParams, parseInt(limit), offset], (dataErr, dataResult) => {
          if (dataErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: dataErr.message
            });
          }

          const feedbackData = dataResult.map(rating => ({
            rating_id: rating.rating_id,
            user_id: rating.user_id,
            user_name: rating.user_name,
            user_mobile: rating.user_mobile,
            user_email: rating.user_email,
            rating: rating.rating,
            rating_stars: '⭐'.repeat(rating.rating),
            feedback_message: rating.feedback_message,
            device_info: rating.device_info || null,
            submitted_at: moment(rating.createtime).format('DD MMM, YYYY HH:mm A'),
            updated_at: moment(rating.updatetime).format('DD MMM, YYYY HH:mm A'),
            has_feedback: rating.feedback_message && rating.feedback_message.trim().length > 0
          }));

          // Get summary statistics for the filtered data
          const summaryQuery = `
          SELECT 
            COUNT(*) as total_ratings,
            AVG(ar.rating) as average_rating,
            COUNT(CASE WHEN ar.rating = 5 THEN 1 END) as five_star,
            COUNT(CASE WHEN ar.rating = 4 THEN 1 END) as four_star,
            COUNT(CASE WHEN ar.rating = 3 THEN 1 END) as three_star,
            COUNT(CASE WHEN ar.rating = 2 THEN 1 END) as two_star,
            COUNT(CASE WHEN ar.rating = 1 THEN 1 END) as one_star,
            COUNT(CASE WHEN ar.feedback_message IS NOT NULL AND ar.feedback_message != '' THEN 1 END) as with_feedback
          FROM app_ratings ar
          LEFT JOIN user_master um ON ar.user_id = um.user_id
          ${whereClause}
        `;

          connection.query(summaryQuery, queryParams, (summaryErr, summaryResult) => {
            if (summaryErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: summaryErr.message
              });
            }

            const summary = summaryResult[0];

            // Clear timeout
            clearTimeout(timeoutId);

            return response.status(200).json({
              success: true,
              msg: ['App rating feedback retrieved successfully', 'ऐप रेटिंग फीडबैक सफलतापूर्वक प्राप्त', 'अॅप रेटिंग अभिप्राय यशस्वीरित्या मिळाले'],
              data: {
                total_ratings: totalCount,
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / parseInt(limit)),
                ratings: feedbackData,
                summary: {
                  total_ratings: summary.total_ratings,
                  average_rating: parseFloat(summary.average_rating).toFixed(2),
                  rating_distribution: {
                    five_star: summary.five_star,
                    four_star: summary.four_star,
                    three_star: summary.three_star,
                    two_star: summary.two_star,
                    one_star: summary.one_star
                  },
                  feedback_count: summary.with_feedback
                },
                filters_applied: {
                  rating: rating,
                  has_feedback: has_feedback,
                  start_date: start_date,
                  end_date: end_date,
                  search: search
                }
              }
            });
          });
        });
      });
    });
  } catch (error) {
    // Clear timeout on error
    if (typeof timeoutId !== 'undefined') {
      clearTimeout(timeoutId);
    }

    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Get App Rating Statistics Controller (Admin)
 * Retrieves app rating statistics
 */
const getAppRatingStats = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Get rating statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_ratings,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
        COUNT(CASE WHEN feedback_message IS NOT NULL AND feedback_message != '' THEN 1 END) as with_feedback
      FROM app_ratings
    `;

    connection.query(statsQuery, [], (statsErr, statsResult) => {
      if (statsErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: statsErr.message
        });
      }

      const stats = statsResult[0];

      // Get recent ratings (last 30 days)
      const recentQuery = `
        SELECT 
          DATE(createtime) as date,
          COUNT(*) as count,
          AVG(rating) as avg_rating
        FROM app_ratings 
        WHERE createtime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(createtime)
        ORDER BY date DESC
      `;

      connection.query(recentQuery, [], (recentErr, recentResult) => {
        if (recentErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: recentErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['App rating statistics retrieved successfully', 'ऐप रेटिंग आंकड़े सफलतापूर्वक प्राप्त', 'अॅप रेटिंग आकडेवारी यशस्वीरित्या मिळाले'],
          data: {
            total_ratings: stats.total_ratings,
            average_rating: parseFloat(stats.average_rating).toFixed(2),
            rating_distribution: {
              five_star: stats.five_star,
              four_star: stats.four_star,
              three_star: stats.three_star,
              two_star: stats.two_star,
              one_star: stats.one_star
            },
            feedback_count: stats.with_feedback,
            recent_ratings: recentResult.map(item => ({
              date: moment(item.date).format('DD MMM, YYYY'),
              count: item.count,
              average_rating: parseFloat(item.avg_rating).toFixed(2)
            }))
          }
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
 * Create Feedback Controller
 * Allows users to submit feedback
 */
const createFeedback = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = createFeedbackSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, feedback_type, subject, message, device_info } = value;

    // Process device_info - store as string without validation
    let processedDeviceInfo = null;
    if (device_info) {
      if (typeof device_info === 'object') {
        processedDeviceInfo = JSON.stringify(device_info);
      } else {
        processedDeviceInfo = String(device_info);
      }
    }

    // Check if user exists and is active
    const userCheckQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      if (userResult[0].active_flag === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.accountdeactivated || ['Account is deactivated', 'खाता निष्क्रिय है', 'खाते निष्क्रिय आहे'],
          active_status: 0
        });
      }

      // Insert feedback
      const insertQuery = `
        INSERT INTO feedback_master 
        (user_id, feedback_type, subject, message, device_info, createtime, updatetime) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;

      connection.query(insertQuery, [user_id, feedback_type, subject, message, processedDeviceInfo], (insertErr, insertResult) => {
        if (insertErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: insertErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Feedback submitted successfully', 'फीडबैक सफलतापूर्वक जमा किया गया', 'अभिप्राय यशस्वीरित्या सबमिट केले'],
          data: {
            feedback_id: insertResult.insertId,
            subject: subject,
            feedback_type: feedback_type,
            submitted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
          }
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
 * Get User Feedback Controller
 * Retrieves feedback submitted by a specific user
 */
const getUserFeedback = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate query parameters
    const { error, value } = getFeedbackSchema.validate(request.query);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, feedback_type, page, limit } = value;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['User ID is required', 'उपयोगकर्ता ID आवश्यक है', 'वापरकर्ता ID आवश्यक आहे'],
        key: 'user_id'
      });
    }

    // Check if user exists
    const userCheckQuery = "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0";
    connection.query(userCheckQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही']
        });
      }

      // Build query with filters
      let whereConditions = ['f.user_id = ?'];
      let queryParams = [user_id];

      if (feedback_type) {
        whereConditions.push('f.feedback_type = ?');
        queryParams.push(feedback_type);
      }

      const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
      const offset = (page - 1) * limit;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM feedback_master f 
        ${whereClause}
      `;

      connection.query(countQuery, queryParams, (countErr, countResult) => {
        if (countErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: countErr.message
          });
        }

        const totalCount = countResult[0].total;

        // Get feedback data
        const dataQuery = `
          SELECT 
            f.feedback_id,
            f.feedback_type,
            f.subject,
            f.message,
            f.device_info,
            f.admin_response,
            f.createtime,
            f.updatetime,
            u.name as user_name,
            u.mobile as user_mobile
          FROM feedback_master f
          LEFT JOIN user_master u ON f.user_id = u.user_id
          ${whereClause}
          ORDER BY f.createtime DESC
          LIMIT ? OFFSET ?
        `;

        connection.query(dataQuery, [...queryParams, limit, offset], (dataErr, dataResult) => {
          if (dataErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: dataErr.message
            });
          }

          const feedbackData = dataResult.map(feedback => ({
            feedback_id: feedback.feedback_id,
            feedback_type: feedback.feedback_type,
            feedback_type_label: getFeedbackTypeLabel(feedback.feedback_type),
            subject: feedback.subject,
            message: feedback.message,
            device_info: feedback.device_info,
            admin_response: feedback.admin_response,
            user_name: feedback.user_name,
            user_mobile: feedback.user_mobile,
            submitted_at: moment(feedback.createtime).format('DD MMM, YYYY HH:mm A'),
            updated_at: moment(feedback.updatetime).format('DD MMM, YYYY HH:mm A')
          }));

          return response.status(200).json({
            success: true,
            msg: ['Feedback retrieved successfully', 'फीडबैक सफलतापूर्वक प्राप्त', 'अभिप्राय यशस्वीरित्या मिळाले'],
            data: {
              total_feedback: totalCount,
              current_page: page,
              total_pages: Math.ceil(totalCount / limit),
              feedback: feedbackData
            }
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
 * Get All Feedback Controller (Admin)
 * Retrieves all feedback with filtering and pagination
 */
const getAllFeedback = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate query parameters
    const { error, value } = getFeedbackSchema.validate(request.query);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { user_id, feedback_type, page, limit } = value;

    // Build query with filters
    let whereConditions = [];
    let queryParams = [];

    if (user_id) {
      whereConditions.push('f.user_id = ?');
      queryParams.push(user_id);
    }

    if (feedback_type) {
      whereConditions.push('f.feedback_type = ?');
      queryParams.push(feedback_type);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    const offset = (page - 1) * limit;

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM feedback_master f 
      ${whereClause}
    `;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const totalCount = countResult[0].total;

      // Get feedback data
      const dataQuery = `
        SELECT 
          f.feedback_id,
          f.user_id,
          f.feedback_type,
          f.subject,
          f.message,
          f.device_info,
          f.admin_response,
          f.createtime,
          f.updatetime,
          u.name as user_name,
          u.mobile as user_mobile,
          u.email as user_email
        FROM feedback_master f
        LEFT JOIN user_master u ON f.user_id = u.user_id
        ${whereClause}
        ORDER BY f.createtime DESC
        LIMIT ? OFFSET ?
      `;

      connection.query(dataQuery, [...queryParams, limit, offset], (dataErr, dataResult) => {
        if (dataErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: dataErr.message
          });
        }

        const feedbackData = dataResult.map(feedback => ({
          feedback_id: feedback.feedback_id,
          user_id: feedback.user_id,
          user_name: feedback.user_name,
          user_mobile: feedback.user_mobile,
          user_email: feedback.user_email,
          feedback_type: feedback.feedback_type,
          feedback_type_label: getFeedbackTypeLabel(feedback.feedback_type),
          subject: feedback.subject,
          message: feedback.message,
          device_info: feedback.device_info,
          admin_response: feedback.admin_response,
          submitted_at: moment(feedback.createtime).format('DD MMM, YYYY HH:mm A'),
          updated_at: moment(feedback.updatetime).format('DD MMM, YYYY HH:mm A')
        }));

        return response.status(200).json({
          success: true,
          msg: ['All feedback retrieved successfully', 'सभी फीडबैक सफलतापूर्वक प्राप्त', 'सर्व अभिप्राय यशस्वीरित्या मिळाले'],
          data: {
            total_feedback: totalCount,
            current_page: page,
            total_pages: Math.ceil(totalCount / limit),
            feedback: feedbackData
          }
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
 * Update Feedback Response Controller (Admin)
 * Updates admin response to feedback
 */
const updateFeedbackResponse = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = updateFeedbackResponseSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { feedback_id, admin_response } = value;

    // Check if feedback exists
    const checkQuery = "SELECT feedback_id, user_id, subject FROM feedback_master WHERE feedback_id = ?";
    connection.query(checkQuery, [feedback_id], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Feedback not found', 'फीडबैक नहीं मिला', 'अभिप्राय सापडला नाही']
        });
      }

      // Update feedback response
      const updateQuery = `
        UPDATE feedback_master 
        SET admin_response = ?, updatetime = NOW() 
        WHERE feedback_id = ?
      `;

      connection.query(updateQuery, [admin_response, feedback_id], (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Feedback response updated successfully', 'फीडबैक प्रतिक्रिया सफलतापूर्वक अपडेट', 'अभिप्राय प्रतिक्रिया यशस्वीरित्या अपडेट'],
          data: {
            feedback_id: feedback_id,
            admin_response: admin_response,
            updated_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
          }
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
 * Get Feedback Statistics Controller (Admin)
 * Retrieves basic feedback statistics
 */
const getFeedbackStats = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN feedback_type = 'bug_report' THEN 1 END) as bug_reports,
        COUNT(CASE WHEN feedback_type = 'feature_request' THEN 1 END) as feature_requests,
        COUNT(CASE WHEN feedback_type = 'general_feedback' THEN 1 END) as general_feedback,
        COUNT(CASE WHEN feedback_type = 'complaint' THEN 1 END) as complaints,
        COUNT(CASE WHEN feedback_type = 'suggestion' THEN 1 END) as suggestions,
        COUNT(CASE WHEN admin_response IS NOT NULL THEN 1 END) as responded_count
      FROM feedback_master
    `;

    connection.query(statsQuery, [], (statsErr, statsResult) => {
      if (statsErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: statsErr.message
        });
      }

      const stats = statsResult[0];

      // Get recent feedback (last 7 days)
      const recentQuery = `
        SELECT 
          DATE(createtime) as date,
          COUNT(*) as count
        FROM feedback_master 
        WHERE createtime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(createtime)
        ORDER BY date DESC
      `;

      connection.query(recentQuery, [], (recentErr, recentResult) => {
        if (recentErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: recentErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Feedback statistics retrieved successfully', 'फीडबैक आंकड़े सफलतापूर्वक प्राप्त', 'अभिप्राय आकडेवारी यशस्वीरित्या मिळाले'],
          data: {
            total_feedback: stats.total_feedback,
            responded_feedback: stats.responded_count,
            pending_response: stats.total_feedback - stats.responded_count,
            type_breakdown: {
              bug_reports: stats.bug_reports,
              feature_requests: stats.feature_requests,
              general_feedback: stats.general_feedback,
              complaints: stats.complaints,
              suggestions: stats.suggestions
            },
            recent_feedback: recentResult.map(item => ({
              date: moment(item.date).format('DD MMM, YYYY'),
              count: item.count
            }))
          }
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
 * Delete Feedback Controller (Admin)
 * Permanently deletes feedback from the database
 */
const deleteFeedback = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = deleteFeedbackSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { feedback_id } = value;

    // Check if feedback exists
    const checkQuery = "SELECT feedback_id, user_id, subject, feedback_type FROM feedback_master WHERE feedback_id = ?";
    connection.query(checkQuery, [feedback_id], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Feedback not found', 'फीडबैक नहीं मिला', 'अभिप्राय सापडला नाही']
        });
      }

      const feedback = checkResult[0];

      // Delete feedback permanently
      const deleteQuery = "DELETE FROM feedback_master WHERE feedback_id = ?";
      connection.query(deleteQuery, [feedback_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Feedback deleted successfully', 'फीडबैक सफलतापूर्वक हटाया गया', 'अभिप्राय यशस्वीरित्या हटवले'],
          data: {
            feedback_id: feedback_id,
            subject: feedback.subject,
            feedback_type: feedback.feedback_type,
            feedback_type_label: getFeedbackTypeLabel(feedback.feedback_type),
            deleted_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
          }
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

// Helper functions
const getFeedbackTypeLabel = (type) => {
  const labels = {
    'bug_report': 'Bug Report',
    'feature_request': 'Feature Request',
    'general_feedback': 'General Feedback',
    'complaint': 'Complaint',
    'suggestion': 'Suggestion'
  };
  return labels[type] || type;
};


export {
  createAppRating,
  getAppRatingFeedback,
  getAppRatingStats,
  createFeedback,
  getUserFeedback,
  getAllFeedback,
  updateFeedbackResponse,
  deleteFeedback,
  getFeedbackStats
};
