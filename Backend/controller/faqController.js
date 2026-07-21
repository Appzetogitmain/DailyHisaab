import connection from "../connection/dbConfig.js";
import moment from "moment-timezone";
import languageMessage from "./languageMessage.js";

// ===== USER FAQ ENDPOINTS =====

// Get FAQ categories with counts
export const getFaqCategories = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const query = `
      SELECT 
        fc.category_id,
        fc.category_name,
        fc.category_title,
        fc.category_description,
        fc.category_icon,
        fc.sort_order,
        COUNT(fi.faq_id) as total_faqs,
        COUNT(CASE WHEN fi.is_active = 1 AND fi.delete_flag = 0 THEN 1 END) as active_faqs
      FROM faq_categories fc
      LEFT JOIN faq_items fi ON fc.category_id = fi.category_id
      WHERE fc.is_active = 1
      GROUP BY fc.category_id
      ORDER BY fc.sort_order ASC, fc.category_name ASC
    `;

    connection.query(query, (err, result) => {
      if (err) {
        console.error("Get FAQ categories error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const formattedCategories = result.map(category => ({
        category_id: category.category_id,
        category_name: category.category_name,
        category_title: category.category_title,
        category_description: category.category_description,
        category_icon: category.category_icon,
        total_faqs: parseInt(category.total_faqs),
        active_faqs: parseInt(category.active_faqs),
        sort_order: category.sort_order
      }));

      response.status(200).json({
        success: true,
        msg: ['FAQ categories retrieved successfully', 'FAQ श्रेणियां सफलतापूर्वक प्राप्त', 'FAQ श्रेण्या यशस्वीरित्या मिळाले'],
        data: formattedCategories
      });
    });

  } catch (error) {
    console.error("Get FAQ categories error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Get FAQs by category
export const getFaqsByCategory = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { category_name = 'all' } = request.params;
    const { user_id } = request.query;

    // Build the query based on category
    let whereClause = 'WHERE fi.is_active = 1 AND fi.delete_flag = 0 AND fc.is_active = 1';
    let queryParams = [];

    if (category_name !== 'all') {
      whereClause += ' AND fc.category_name = ?';
      queryParams.push(category_name);
    }

    const query = `
      SELECT 
        fi.faq_id,
        fi.category_id,
        fc.category_name,
        fc.category_title,
        fc.category_icon,
        fi.question,
        fi.answer,
        fi.youtube_tutorial_url,
        fi.youtube_thumbnail_url,
        fi.youtube_video_id,
        fi.is_featured,
        fi.view_count,
        fi.sort_order,
        fi.created_at,
        fi.updated_at
      FROM faq_items fi
      INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
      ${whereClause}
      ORDER BY fi.is_featured DESC, fi.sort_order ASC, fi.created_at DESC
    `;

    connection.query(query, queryParams, (err, result) => {
      if (err) {
        console.error("Get FAQs by category error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const formattedFaqs = result.map(faq => ({
        faq_id: faq.faq_id,
        category_id: faq.category_id,
        category_name: faq.category_name,
        category_title: faq.category_title,
        category_icon: faq.category_icon,
        question: faq.question,
        answer: faq.answer,
        youtube_tutorial_url: faq.youtube_tutorial_url,
        youtube_thumbnail_url: faq.youtube_thumbnail_url,
        youtube_video_id: faq.youtube_video_id,
        is_featured: Boolean(faq.is_featured),
        view_count: faq.view_count,
        sort_order: faq.sort_order,
        created_at: moment(faq.created_at).tz("Asia/Kolkata").format("DD MMM, YYYY"),
        updated_at: faq.updated_at ? moment(faq.updated_at).tz("Asia/Kolkata").format("DD MMM, YYYY") : null
      }));

      response.status(200).json({
        success: true,
        msg: ['FAQs retrieved successfully', 'FAQ सफलतापूर्वक प्राप्त', 'FAQ यशस्वीरित्या मिळाले'],
        data: {
          category_name: category_name,
          total_faqs: formattedFaqs.length,
          faqs: formattedFaqs
        }
      });
    });

  } catch (error) {
    console.error("Get FAQs by category error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Get single FAQ by ID
export const getFaqById = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { faq_id } = request.params;
    const { user_id } = request.query;

    const query = `
      SELECT 
        fi.faq_id,
        fi.category_id,
        fc.category_name,
        fc.category_title,
        fc.category_icon,
        fi.question,
        fi.answer,
        fi.youtube_tutorial_url,
        fi.youtube_thumbnail_url,
        fi.youtube_video_id,
        fi.is_featured,
        fi.view_count,
        fi.sort_order,
        fi.created_at,
        fi.updated_at
      FROM faq_items fi
      INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
      WHERE fi.faq_id = ? AND fi.is_active = 1 AND fi.delete_flag = 0 AND fc.is_active = 1
    `;

    connection.query(query, [faq_id], (err, result) => {
      if (err) {
        console.error("Get FAQ by ID error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      if (result.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['FAQ not found', 'FAQ नहीं मिला', 'FAQ सापडले नाही']
        });
      }

      const faq = result[0];

      // Increment view count (only for non-deleted items)
      const updateViewCountQuery = `
        UPDATE faq_items 
        SET view_count = view_count + 1 
        WHERE faq_id = ? AND (delete_flag = 0 OR delete_flag IS NULL)
      `;
      connection.query(updateViewCountQuery, [faq_id]);

      // Track view if user_id is provided
      if (user_id) {
        const trackViewQuery = `
          INSERT INTO faq_view_tracking (faq_id, user_id, ip_address, user_agent, device_type)
          VALUES (?, ?, ?, ?, ?)
        `;
        const ipAddress = request.ip || request.connection.remoteAddress;
        const userAgent = request.get('User-Agent') || 'Unknown';
        const deviceType = request.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'web';

        connection.query(trackViewQuery, [faq_id, user_id, ipAddress, userAgent, deviceType]);
      }

      const formattedFaq = {
        faq_id: faq.faq_id,
        category_id: faq.category_id,
        category_name: faq.category_name,
        category_title: faq.category_title,
        category_icon: faq.category_icon,
        question: faq.question,
        answer: faq.answer,
        youtube_tutorial_url: faq.youtube_tutorial_url,
        youtube_thumbnail_url: faq.youtube_thumbnail_url,
        youtube_video_id: faq.youtube_video_id,
        is_featured: Boolean(faq.is_featured),
        view_count: faq.view_count + 1, // Show updated count
        sort_order: faq.sort_order,
        created_at: moment(faq.created_at).tz("Asia/Kolkata").format("DD MMM, YYYY"),
        updated_at: faq.updated_at ? moment(faq.updated_at).tz("Asia/Kolkata").format("DD MMM, YYYY") : null
      };

      response.status(200).json({
        success: true,
        msg: ['FAQ retrieved successfully', 'FAQ सफलतापूर्वक प्राप्त', 'FAQ यशस्वीरित्या मिळाले'],
        data: formattedFaq
      });
    });

  } catch (error) {
    console.error("Get FAQ by ID error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Search FAQs
export const searchFaqs = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { search_query, category_name, user_id } = request.query;

    if (!search_query || search_query.trim().length < 2) {
      return response.status(200).json({
        success: false,
        msg: ['Search query must be at least 2 characters', 'खोज क्वेरी कम से कम 2 अक्षर होनी चाहिए', 'शोध क्वेरी किमान 2 अक्षरे असावी']
      });
    }

    let whereClause = 'WHERE fi.is_active = 1 AND fi.delete_flag = 0 AND fc.is_active = 1';
    let queryParams = [];

    // Add search condition
    whereClause += ' AND (fi.question LIKE ? OR fi.answer LIKE ?)';
    const searchTerm = `%${search_query.trim()}%`;
    queryParams.push(searchTerm, searchTerm);

    // Add category filter if provided
    if (category_name && category_name !== 'all') {
      whereClause += ' AND fc.category_name = ?';
      queryParams.push(category_name);
    }

    const query = `
      SELECT 
        fi.faq_id,
        fi.category_id,
        fc.category_name,
        fc.category_title,
        fc.category_icon,
        fi.question,
        fi.answer,
        fi.youtube_tutorial_url,
        fi.youtube_thumbnail_url,
        fi.youtube_video_id,
        fi.is_featured,
        fi.view_count,
        fi.sort_order,
        fi.created_at
      FROM faq_items fi
      INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN fi.question LIKE ? THEN 1
          WHEN fi.answer LIKE ? THEN 2
          ELSE 3
        END,
        fi.is_featured DESC,
        fi.view_count DESC
      LIMIT 50
    `;

    // Add search terms for ordering
    queryParams.push(searchTerm, searchTerm);

    connection.query(query, queryParams, (err, result) => {
      if (err) {
        console.error("Search FAQs error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const formattedFaqs = result.map(faq => ({
        faq_id: faq.faq_id,
        category_id: faq.category_id,
        category_name: faq.category_name,
        category_title: faq.category_title,
        category_icon: faq.category_icon,
        question: faq.question,
        answer: faq.answer,
        youtube_tutorial_url: faq.youtube_tutorial_url,
        youtube_thumbnail_url: faq.youtube_thumbnail_url,
        youtube_video_id: faq.youtube_video_id,
        is_featured: Boolean(faq.is_featured),
        view_count: faq.view_count,
        sort_order: faq.sort_order,
        created_at: moment(faq.created_at).tz("Asia/Kolkata").format("DD MMM, YYYY")
      }));

      response.status(200).json({
        success: true,
        msg: ['Search results retrieved successfully', 'खोज परिणाम सफलतापूर्वक प्राप्त', 'शोध परिणाम यशस्वीरित्या मिळाले'],
        data: {
          search_query: search_query,
          category_filter: category_name || 'all',
          total_results: formattedFaqs.length,
          faqs: formattedFaqs
        }
      });
    });

  } catch (error) {
    console.error("Search FAQs error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// ===== ADMIN FAQ MANAGEMENT =====

// Get all FAQ categories for admin
export const getAllFaqCategories = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const query = `
      SELECT 
        fc.category_id,
        fc.category_name,
        fc.category_title,
        fc.category_description,
        fc.category_icon,
        fc.is_active,
        fc.sort_order,
        fc.created_at,
        fc.updated_at,
        COUNT(fi.faq_id) as total_faqs,
        COUNT(CASE WHEN fi.is_active = 1 AND fi.delete_flag = 0 THEN 1 END) as active_faqs
      FROM faq_categories fc
      LEFT JOIN faq_items fi ON fc.category_id = fi.category_id
      GROUP BY fc.category_id
      ORDER BY fc.sort_order ASC, fc.created_at ASC
    `;

    connection.query(query, (err, result) => {
      if (err) {
        console.error("Get all FAQ categories error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const formattedCategories = result.map(category => ({
        ...category,
        total_faqs: parseInt(category.total_faqs),
        active_faqs: parseInt(category.active_faqs),
        created_at: moment(category.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
        updated_at: category.updated_at ? moment(category.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
      }));

      response.status(200).json({
        success: true,
        msg: ['FAQ categories retrieved successfully', 'FAQ श्रेणियां सफलतापूर्वक प्राप्त', 'FAQ श्रेण्या यशस्वीरित्या मिळाले'],
        data: formattedCategories
      });
    });

  } catch (error) {
    console.error("Get all FAQ categories error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Get all FAQs for admin
export const getAllFaqs = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { category_id, page = 1, limit = 20, search } = request.query;

    let whereConditions = [];
    let queryParams = [];

    // Always filter out deleted items
    whereConditions.push('fi.delete_flag = 0');

    if (category_id) {
      whereConditions.push('fi.category_id = ?');
      queryParams.push(category_id);
    }

    if (search) {
      whereConditions.push('(fi.question LIKE ? OR fi.answer LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM faq_items fi
      INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
      ${whereClause}
    `;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        console.error("Count FAQs error:", countErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const totalCount = countResult[0].total;

      // Data query
      const dataQuery = `
        SELECT 
          fi.faq_id,
          fi.category_id,
          fc.category_name,
          fc.category_title,
          fi.question,
          fi.answer,
          fi.youtube_tutorial_url,
          fi.youtube_thumbnail_url,
          fi.youtube_video_id,
          fi.is_featured,
          fi.is_active,
          fi.delete_flag,
          fi.view_count,
          fi.sort_order,
          fi.created_at,
          fi.updated_at
        FROM faq_items fi
        INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
        ${whereClause}
        ORDER BY fi.is_featured DESC, fi.sort_order ASC, fi.created_at DESC
        LIMIT ? OFFSET ?
      `;

      connection.query(dataQuery, [...queryParams, parseInt(limit), offset], (dataErr, dataResult) => {
        if (dataErr) {
          console.error("Get all FAQs error:", dataErr);
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: dataErr.message
          });
        }

        const formattedFaqs = dataResult.map(faq => ({
          ...faq,
          is_featured: Boolean(faq.is_featured),
          is_active: Boolean(faq.is_active),
          delete_flag: Boolean(faq.delete_flag),
          created_at: moment(faq.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
          updated_at: faq.updated_at ? moment(faq.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
        }));

        response.status(200).json({
          success: true,
          msg: ['FAQs retrieved successfully', 'FAQ सफलतापूर्वक प्राप्त', 'FAQ यशस्वीरित्या मिळाले'],
          data: {
            total_faqs: totalCount,
            current_page: parseInt(page),
            total_pages: Math.ceil(totalCount / parseInt(limit)),
            faqs: formattedFaqs
          }
        });
      });
    });

  } catch (error) {
    console.error("Get all FAQs error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Create FAQ category
export const createFaqCategory = async (request, response) => {
  try {
    const { category_name, category_title, category_description, category_icon, sort_order } = request.body;

    // Check if category name already exists
    const checkQuery = "SELECT category_id FROM faq_categories WHERE category_name = ?";
    connection.query(checkQuery, [category_name], (checkErr, checkResult) => {
      if (checkErr) {
        console.error("Check FAQ category error:", checkErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Category name already exists', 'श्रेणी का नाम पहले से मौजूद है', 'श्रेणीचे नाव आधीच अस्तित्वात आहे']
        });
      }

      const insertQuery = `
        INSERT INTO faq_categories (category_name, category_title, category_description, category_icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `;

      connection.query(insertQuery, [category_name, category_title, category_description, category_icon, sort_order], (insertErr, insertResult) => {
        if (insertErr) {
          console.error("Create FAQ category error:", insertErr);
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: insertErr.message
          });
        }

        response.status(200).json({
          success: true,
          msg: ['FAQ category created successfully', 'FAQ श्रेणी सफलतापूर्वक बनाई गई', 'FAQ श्रेणी यशस्वीरित्या तयार केली'],
          data: {
            category_id: insertResult.insertId,
            category_name: category_name,
            category_title: category_title
          }
        });
      });
    });

  } catch (error) {
    console.error("Create FAQ category error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Create FAQ item
export const createFaqItem = async (request, response) => {
  try {
    const {
      category_id,
      question,
      answer,
      youtube_tutorial_url,
      youtube_thumbnail_url,
      youtube_video_id,
      is_featured,
      sort_order
    } = request.body;

    const insertQuery = `
      INSERT INTO faq_items (
        category_id, question, answer, youtube_tutorial_url, 
        youtube_thumbnail_url, youtube_video_id, is_featured, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(insertQuery, [
      category_id, question, answer, youtube_tutorial_url,
      youtube_thumbnail_url, youtube_video_id, is_featured || 0, sort_order || 0
    ], (insertErr, insertResult) => {
      if (insertErr) {
        console.error("Create FAQ item error:", insertErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: insertErr.message
        });
      }

      response.status(200).json({
        success: true,
        msg: ['FAQ item created successfully', 'FAQ आइटम सफलतापूर्वक बनाया गया', 'FAQ आयटम यशस्वीरित्या तयार केले'],
        data: {
          faq_id: insertResult.insertId,
          category_id: category_id,
          question: question
        }
      });
    });

  } catch (error) {
    console.error("Create FAQ item error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Update FAQ item
export const updateFaqItem = async (request, response) => {
  try {
    const { faq_id } = request.params;
    const {
      category_id,
      question,
      answer,
      youtube_tutorial_url,
      youtube_thumbnail_url,
      youtube_video_id,
      is_featured,
      is_active,
      sort_order
    } = request.body;

    const updateQuery = `
      UPDATE faq_items 
      SET category_id = ?, question = ?, answer = ?, youtube_tutorial_url = ?,
          youtube_thumbnail_url = ?, youtube_video_id = ?, is_featured = ?,
          is_active = ?, sort_order = ?, updated_at = NOW()
      WHERE faq_id = ?
    `;

    connection.query(updateQuery, [
      category_id, question, answer, youtube_tutorial_url,
      youtube_thumbnail_url, youtube_video_id, is_featured || 0,
      is_active !== undefined ? is_active : 1, sort_order || 0, faq_id
    ], (updateErr, updateResult) => {
      if (updateErr) {
        console.error("Update FAQ item error:", updateErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: updateErr.message
        });
      }

      if (updateResult.affectedRows === 0) {
        return response.status(200).json({
          success: false,
          msg: ['FAQ item not found', 'FAQ आइटम नहीं मिला', 'FAQ आयटम सापडले नाही']
        });
      }

      response.status(200).json({
        success: true,
        msg: ['FAQ item updated successfully', 'FAQ आइटम सफलतापूर्वक अपडेट किया गया', 'FAQ आयटम यशस्वीरित्या अपडेट केले'],
        data: {
          faq_id: faq_id,
          updated_at: moment().tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
        }
      });
    });

  } catch (error) {
    console.error("Update FAQ item error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Delete FAQ item (soft delete)
export const deleteFaqItem = async (request, response) => {
  try {
    const { faq_id } = request.params;

    const deleteQuery = `
      UPDATE faq_items 
      SET delete_flag = 1, updated_at = NOW()
      WHERE faq_id = ?
    `;

    connection.query(deleteQuery, [faq_id], (deleteErr, deleteResult) => {
      if (deleteErr) {
        console.error("Delete FAQ item error:", deleteErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: deleteErr.message
        });
      }

      if (deleteResult.affectedRows === 0) {
        return response.status(200).json({
          success: false,
          msg: ['FAQ item not found', 'FAQ आइटम नहीं मिला', 'FAQ आयटम सापडले नाही']
        });
      }

      response.status(200).json({
        success: true,
        msg: ['FAQ item deleted successfully', 'FAQ आइटम सफलतापूर्वक हटाया गया', 'FAQ आयटम यशस्वीरित्या हटवले'],
        data: {
          faq_id: faq_id,
          deleted_at: moment().tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
        }
      });
    });

  } catch (error) {
    console.error("Delete FAQ item error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Get FAQ analytics
export const getFaqAnalytics = async (request, response) => {
  try {
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { start_date, end_date } = request.query;

    let dateFilter = '';
    let queryParams = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE fvt.viewed_at BETWEEN ? AND ?';
      queryParams.push(start_date, end_date);
    }

    const analyticsQuery = `
      SELECT 
        fi.faq_id,
        fi.question,
        fc.category_name,
        fc.category_title,
        fi.view_count,
        COUNT(fvt.tracking_id) as tracked_views,
        COUNT(DISTINCT fvt.user_id) as unique_users
      FROM faq_items fi
      INNER JOIN faq_categories fc ON fi.category_id = fc.category_id
      LEFT JOIN faq_view_tracking fvt ON fi.faq_id = fvt.faq_id ${dateFilter}
      WHERE fi.is_active = 1 AND fi.delete_flag = 0
      GROUP BY fi.faq_id
      ORDER BY fi.view_count DESC, tracked_views DESC
      LIMIT 50
    `;

    connection.query(analyticsQuery, queryParams, (err, result) => {
      if (err) {
        console.error("Get FAQ analytics error:", err);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const analytics = result.map(item => ({
        faq_id: item.faq_id,
        question: item.question,
        category_name: item.category_name,
        category_title: item.category_title,
        view_count: item.view_count,
        tracked_views: parseInt(item.tracked_views),
        unique_users: parseInt(item.unique_users)
      }));

      response.status(200).json({
        success: true,
        msg: ['FAQ analytics retrieved successfully', 'FAQ एनालिटिक्स सफलतापूर्वक प्राप्त', 'FAQ विश्लेषण यशस्वीरित्या मिळाले'],
        data: {
          total_faqs: analytics.length,
          date_range: start_date && end_date ? { start_date, end_date } : null,
          analytics: analytics
        }
      });
    });

  } catch (error) {
    console.error("Get FAQ analytics error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Update FAQ category
export const updateFaqCategory = async (request, response) => {
  try {
    const { category_id } = request.params;
    const { category_name, category_title, category_description, category_icon, sort_order, is_active } = request.body;

    // Check if category name already exists for other categories
    const checkQuery = "SELECT category_id FROM faq_categories WHERE category_name = ? AND category_id != ?";
    connection.query(checkQuery, [category_name, category_id], (checkErr, checkResult) => {
      if (checkErr) {
        console.error("Check FAQ category error:", checkErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Category name already exists', 'श्रेणी का नाम पहले से मौजूद है', 'श्रेणीचे नाव आधीच अस्तित्वात आहे']
        });
      }

      const updateQuery = `
        UPDATE faq_categories 
        SET category_name = ?, category_title = ?, category_description = ?, 
            category_icon = ?, sort_order = ?, is_active = ?, updated_at = NOW()
        WHERE category_id = ?
      `;

      connection.query(updateQuery, [
        category_name, category_title, category_description, 
        category_icon, sort_order || 0, is_active !== undefined ? is_active : 1, category_id
      ], (updateErr, updateResult) => {
        if (updateErr) {
          console.error("Update FAQ category error:", updateErr);
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        response.status(200).json({
          success: true,
          msg: ['FAQ category updated successfully', 'FAQ श्रेणी सफलतापूर्वक अपडेट की गई', 'FAQ श्रेणी यशस्वीरित्या अपडेट केली'],
          data: {
            category_id: category_id,
            category_name: category_name,
            category_title: category_title
          }
        });
      });
    });

  } catch (error) {
    console.error("Update FAQ category error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

// Delete FAQ category
export const deleteFaqCategory = async (request, response) => {
  try {
    const { category_id } = request.params;

    // First soft-delete all FAQs under this category
    const deleteFaqsQuery = `
      UPDATE faq_items 
      SET delete_flag = 1, updated_at = NOW() 
      WHERE category_id = ?
    `;

    connection.query(deleteFaqsQuery, [category_id], (faqsErr, faqsResult) => {
      if (faqsErr) {
        console.error("Delete FAQs under category error:", faqsErr);
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: faqsErr.message
        });
      }

      // Now delete the category
      const deleteCatQuery = "DELETE FROM faq_categories WHERE category_id = ?";
      connection.query(deleteCatQuery, [category_id], (catErr, catResult) => {
        if (catErr) {
          console.error("Delete FAQ category error:", catErr);
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: catErr.message
          });
        }

        response.status(200).json({
          success: true,
          msg: ['FAQ category deleted successfully', 'FAQ श्रेणी सफलतापूर्वक हटा दी गई', 'FAQ श्रेणी यशस्वीरित्या हटविली']
        });
      });
    });

  } catch (error) {
    console.error("Delete FAQ category error:", error);
    return response.status(200).json({
      success: false,
      msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

