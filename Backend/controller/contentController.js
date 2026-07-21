import connection from "../connection/dbConfig.js";
import moment from "moment-timezone";

// ===== BANNER MANAGEMENT =====

// Create new banner
export const createBanner = (request, response) => {
  try {
    const {
      banner_text,
      banner_url,
      banner_link = null,
      banner_type = 'announcement',
      priority = 1,
      start_date = null,
      end_date = null,
      target_audience = 'all_users'
    } = request.body;

    const adminId = request.adminInfo.admin_id;

    // Validate dates if provided
    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return response.status(400).json({
        success: false,
        msg: ["End date must be after start date", "समाप्ति तिथि प्रारंभ तिथि के बाद होनी चाहिए", "समाप्ती तारीख प्रारंभ तारीखीनंतर असावी"],
        key: "invalidDateRange"
      });
    }

    const insertQuery = `
      INSERT INTO banner_master 
      (banner_text, banner_url, banner_link, banner_type, priority, start_date, end_date, target_audience, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(insertQuery, [
      banner_text,
      banner_url,
      banner_link,
      banner_type,
      priority,
      start_date,
      end_date,
      target_audience,
      adminId
    ], (err, result) => {
      if (err) {
        console.error("Create banner error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      response.status(201).json({
        success: true,
        msg: ["Banner created successfully", "बैनर सफलतापूर्वक बनाया गया", "बॅनर यशस्वीरित्या तयार केले"],
        data: {
          banner_id: result.insertId,
          banner_text,
          banner_url,
          banner_link,
          banner_type,
          priority,
          start_date,
          end_date,
          target_audience,
          is_active: true,
          created_by: adminId
        }
      });
    });

  } catch (error) {
    console.error("Create banner error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get all banners with filtering and pagination
export const getAllBanners = (request, response) => {
  try {
    const {
      page = 1,
      limit = 10,
      banner_type,
      is_active,
      target_audience,
      search
    } = request.query;

    const offset = (page - 1) * limit;
    let whereConditions = ["b.delete_flag = 0"];
    let queryParams = [];

    // Build WHERE conditions
    if (banner_type) {
      whereConditions.push("b.banner_type = ?");
      queryParams.push(banner_type);
    }

    if (is_active !== undefined) {
      whereConditions.push("b.is_active = ?");
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    if (target_audience) {
      whereConditions.push("b.target_audience = ?");
      queryParams.push(target_audience);
    }

    if (search) {
      whereConditions.push("(b.banner_text LIKE ? OR b.banner_url LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM banner_master b 
      ${whereClause}
    `;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        console.error("Get banners count error:", countErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: countErr.message
        });
      }

      const totalBanners = countResult[0].total;

      // Get banners with admin info
      const bannersQuery = `
        SELECT 
          b.banner_id,
          b.banner_text,
          b.banner_url,
          b.banner_link,
          b.banner_type,
          b.priority,
          b.is_active,
          b.start_date,
          b.end_date,
          b.target_audience,
          b.created_at,
          b.updated_at,
          u.username as created_by_name
        FROM banner_master b
        LEFT JOIN user_master u ON b.created_by = u.user_id
        ${whereClause}
        ORDER BY b.priority DESC, b.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const bannersParams = [...queryParams, parseInt(limit), offset];

      connection.query(bannersQuery, bannersParams, (bannersErr, banners) => {
        if (bannersErr) {
          console.error("Get banners error:", bannersErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: bannersErr.message
          });
        }

        // Format dates
        const formattedBanners = banners.map(banner => ({
          ...banner,
          created_at: moment(banner.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
          updated_at: banner.updated_at ? moment(banner.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null,
          start_date: banner.start_date ? moment(banner.start_date).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null,
          end_date: banner.end_date ? moment(banner.end_date).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
        }));

        response.json({
          success: true,
          msg: ["Banners retrieved successfully", "बैनर सफलतापूर्वक प्राप्त", "बॅनर यशस्वीरित्या पुनर्प्राप्त"],
          data: {
            banners: formattedBanners,
            pagination: {
              current_page: parseInt(page),
              total_pages: Math.ceil(totalBanners / limit),
              total_banners: totalBanners,
              limit: parseInt(limit)
            }
          }
        });
      });
    });

  } catch (error) {
    console.error("Get banners error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Update banner
export const updateBanner = (request, response) => {
  try {
    const { banner_id } = request.params;
    const {
      banner_text,
      banner_url,
      banner_link,
      banner_type,
      priority,
      start_date,
      end_date,
      target_audience,
      is_active
    } = request.body;

    // Validate dates if provided
    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      return response.status(400).json({
        success: false,
        msg: ["End date must be after start date", "समाप्ति तिथि प्रारंभ तिथि के बाद होनी चाहिए", "समाप्ती तारीख प्रारंभ तारीखीनंतर असावी"],
        key: "invalidDateRange"
      });
    }

    // Build update fields dynamically
    const updateFields = [];
    const updateValues = [];

    if (banner_text !== undefined) {
      updateFields.push("banner_text = ?");
      updateValues.push(banner_text);
    }
    if (banner_url !== undefined) {
      updateFields.push("banner_url = ?");
      updateValues.push(banner_url);
    }
    if (banner_link !== undefined) {
      updateFields.push("banner_link = ?");
      updateValues.push(banner_link);
    }
    if (banner_type !== undefined) {
      updateFields.push("banner_type = ?");
      updateValues.push(banner_type);
    }
    if (priority !== undefined) {
      updateFields.push("priority = ?");
      updateValues.push(priority);
    }
    if (start_date !== undefined) {
      updateFields.push("start_date = ?");
      updateValues.push(start_date);
    }
    if (end_date !== undefined) {
      updateFields.push("end_date = ?");
      updateValues.push(end_date);
    }
    if (target_audience !== undefined) {
      updateFields.push("target_audience = ?");
      updateValues.push(target_audience);
    }
    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return response.status(400).json({
        success: false,
        msg: ["No fields to update", "अपडेट के लिए कोई फ़ील्ड नहीं", "अपडेट करण्यासाठी फील्ड नाही"],
        key: "noFieldsToUpdate"
      });
    }

    updateValues.push(banner_id);

    const updateQuery = `
      UPDATE banner_master 
      SET ${updateFields.join(", ")}
      WHERE banner_id = ? AND delete_flag = 0
    `;

    connection.query(updateQuery, updateValues, (err, result) => {
      if (err) {
        console.error("Update banner error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Banner not found", "बैनर नहीं मिला", "बॅनर सापडला नाही"],
          key: "bannerNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Banner updated successfully", "बैनर सफलतापूर्वक अपडेट", "बॅनर यशस्वीरित्या अपडेट केले"],
        data: { banner_id: parseInt(banner_id) }
      });
    });

  } catch (error) {
    console.error("Update banner error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Delete banner (soft delete)
export const deleteBanner = (request, response) => {
  try {
    const { banner_id } = request.params;

    const deleteQuery = `
      UPDATE banner_master 
      SET delete_flag = 1, updated_at = CURRENT_TIMESTAMP
      WHERE banner_id = ? AND delete_flag = 0
    `;

    connection.query(deleteQuery, [banner_id], (err, result) => {
      if (err) {
        console.error("Delete banner error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Banner not found", "बैनर नहीं मिला", "बॅनर सापडला नाही"],
          key: "bannerNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Banner deleted successfully", "बैनर सफलतापूर्वक हटाया गया", "बॅनर यशस्वीरित्या हटवले"],
        data: { banner_id: parseInt(banner_id) }
      });
    });

  } catch (error) {
    console.error("Delete banner error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== TUTORIAL MANAGEMENT =====

// Create new tutorial
export const createTutorial = (request, response) => {
  try {
    const {
      tutorial_title,
      tutorial_description = null,
      video_url,
      thumbnail_url = null,
      language = 'hindi',
      category = 'getting_started',
      difficulty_level = 'beginner',
      duration_minutes = null,
      is_featured = false,
      sort_order = 0
    } = request.body;

    const adminId = request.adminInfo.admin_id;

    const insertQuery = `
      INSERT INTO tutorial_master 
      (tutorial_title, tutorial_description, video_url, thumbnail_url, language, category, 
       difficulty_level, duration_minutes, is_featured, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    connection.query(insertQuery, [
      tutorial_title,
      tutorial_description,
      video_url,
      thumbnail_url,
      language,
      category,
      difficulty_level,
      duration_minutes,
      is_featured ? 1 : 0,
      sort_order,
      adminId
    ], (err, result) => {
      if (err) {
        console.error("Create tutorial error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      response.status(201).json({
        success: true,
        msg: ["Tutorial created successfully", "ट्यूटोरियल सफलतापूर्वक बनाया गया", "ट्यूटोरियल यशस्वीरित्या तयार केले"],
        data: {
          tutorial_id: result.insertId,
          tutorial_title,
          tutorial_description,
          video_url,
          thumbnail_url,
          language,
          category,
          difficulty_level,
          duration_minutes,
          is_featured,
          sort_order,
          is_active: true,
          created_by: adminId
        }
      });
    });

  } catch (error) {
    console.error("Create tutorial error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get all tutorials with filtering and pagination
export const getAllTutorials = (request, response) => {
  try {
    const {
      page = 1,
      limit = 10,
      language,
      category,
      difficulty_level,
      is_featured,
      is_active,
      search
    } = request.query;

    const offset = (page - 1) * limit;
    let whereConditions = ["t.delete_flag = 0"];
    let queryParams = [];

    // Build WHERE conditions
    if (language) {
      whereConditions.push("t.language = ?");
      queryParams.push(language);
    }

    if (category) {
      whereConditions.push("t.category = ?");
      queryParams.push(category);
    }

    if (difficulty_level) {
      whereConditions.push("t.difficulty_level = ?");
      queryParams.push(difficulty_level);
    }

    if (is_featured !== undefined) {
      whereConditions.push("t.is_featured = ?");
      queryParams.push(is_featured === 'true' ? 1 : 0);
    }

    if (is_active !== undefined) {
      whereConditions.push("t.is_active = ?");
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    if (search) {
      whereConditions.push("(t.tutorial_title LIKE ? OR t.tutorial_description LIKE ?)");
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM tutorial_master t 
      ${whereClause}
    `;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        console.error("Get tutorials count error:", countErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: countErr.message
        });
      }

      const totalTutorials = countResult[0].total;

      // Get tutorials with admin info
      const tutorialsQuery = `
        SELECT 
          t.tutorial_id,
          t.tutorial_title,
          t.tutorial_description,
          t.video_url,
          t.thumbnail_url,
          t.language,
          t.category,
          t.difficulty_level,
          t.duration_minutes,
          t.is_featured,
          t.sort_order,
          t.view_count,
          t.is_active,
          t.created_at,
          t.updated_at,
          u.username as created_by_name
        FROM tutorial_master t
        LEFT JOIN user_master u ON t.created_by = u.user_id
        ${whereClause}
        ORDER BY t.sort_order ASC, t.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const tutorialsParams = [...queryParams, parseInt(limit), offset];

      connection.query(tutorialsQuery, tutorialsParams, (tutorialsErr, tutorials) => {
        if (tutorialsErr) {
          console.error("Get tutorials error:", tutorialsErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: tutorialsErr.message
          });
        }

        // Format dates
        const formattedTutorials = tutorials.map(tutorial => ({
          ...tutorial,
          created_at: moment(tutorial.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
          updated_at: tutorial.updated_at ? moment(tutorial.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
        }));

        response.json({
          success: true,
          msg: ["Tutorials retrieved successfully", "ट्यूटोरियल सफलतापूर्वक प्राप्त", "ट्यूटोरियल यशस्वीरित्या पुनर्प्राप्त"],
          data: {
            tutorials: formattedTutorials,
            pagination: {
              current_page: parseInt(page),
              total_pages: Math.ceil(totalTutorials / limit),
              total_tutorials: totalTutorials,
              limit: parseInt(limit)
            }
          }
        });
      });
    });

  } catch (error) {
    console.error("Get tutorials error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Update tutorial
export const updateTutorial = (request, response) => {
  try {
    const { tutorial_id } = request.params;
    const {
      tutorial_title,
      tutorial_description,
      video_url,
      thumbnail_url,
      language,
      category,
      difficulty_level,
      duration_minutes,
      is_featured,
      sort_order,
      is_active
    } = request.body;

    // Build update fields dynamically
    const updateFields = [];
    const updateValues = [];

    if (tutorial_title !== undefined) {
      updateFields.push("tutorial_title = ?");
      updateValues.push(tutorial_title);
    }
    if (tutorial_description !== undefined) {
      updateFields.push("tutorial_description = ?");
      updateValues.push(tutorial_description);
    }
    if (video_url !== undefined) {
      updateFields.push("video_url = ?");
      updateValues.push(video_url);
    }
    if (thumbnail_url !== undefined) {
      updateFields.push("thumbnail_url = ?");
      updateValues.push(thumbnail_url);
    }
    if (language !== undefined) {
      updateFields.push("language = ?");
      updateValues.push(language);
    }
    if (category !== undefined) {
      updateFields.push("category = ?");
      updateValues.push(category);
    }
    if (difficulty_level !== undefined) {
      updateFields.push("difficulty_level = ?");
      updateValues.push(difficulty_level);
    }
    if (duration_minutes !== undefined) {
      updateFields.push("duration_minutes = ?");
      updateValues.push(duration_minutes);
    }
    if (is_featured !== undefined) {
      updateFields.push("is_featured = ?");
      updateValues.push(is_featured ? 1 : 0);
    }
    if (sort_order !== undefined) {
      updateFields.push("sort_order = ?");
      updateValues.push(sort_order);
    }
    if (is_active !== undefined) {
      updateFields.push("is_active = ?");
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return response.status(400).json({
        success: false,
        msg: ["No fields to update", "अपडेट के लिए कोई फ़ील्ड नहीं", "अपडेट करण्यासाठी फील्ड नाही"],
        key: "noFieldsToUpdate"
      });
    }

    updateValues.push(tutorial_id);

    const updateQuery = `
      UPDATE tutorial_master 
      SET ${updateFields.join(", ")}
      WHERE tutorial_id = ? AND delete_flag = 0
    `;

    connection.query(updateQuery, updateValues, (err, result) => {
      if (err) {
        console.error("Update tutorial error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Tutorial not found", "ट्यूटोरियल नहीं मिला", "ट्यूटोरियल सापडले नाही"],
          key: "tutorialNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Tutorial updated successfully", "ट्यूटोरियल सफलतापूर्वक अपडेट", "ट्यूटोरियल यशस्वीरित्या अपडेट केले"],
        data: { tutorial_id: parseInt(tutorial_id) }
      });
    });

  } catch (error) {
    console.error("Update tutorial error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Delete tutorial (soft delete)
export const deleteTutorial = (request, response) => {
  try {
    const { tutorial_id } = request.params;

    const deleteQuery = `
      UPDATE tutorial_master 
      SET delete_flag = 1, updated_at = CURRENT_TIMESTAMP
      WHERE tutorial_id = ? AND delete_flag = 0
    `;

    connection.query(deleteQuery, [tutorial_id], (err, result) => {
      if (err) {
        console.error("Delete tutorial error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Tutorial not found", "ट्यूटोरियल नहीं मिला", "ट्यूटोरियल सापडले नाही"],
          key: "tutorialNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Tutorial deleted successfully", "ट्यूटोरियल सफलतापूर्वक हटाया गया", "ट्यूटोरियल यशस्वीरित्या हटवले"],
        data: { tutorial_id: parseInt(tutorial_id) }
      });
    });

  } catch (error) {
    console.error("Delete tutorial error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Track tutorial view
export const trackTutorialView = (request, response) => {
  try {
    const { tutorial_id } = request.params;
    const { device_type = 'mobile' } = request.body;
    const userId = request.user?.user_id || null;

    // Insert view tracking
    const insertQuery = `
      INSERT INTO tutorial_views (tutorial_id, user_id, device_type)
      VALUES (?, ?, ?)
    `;

    connection.query(insertQuery, [tutorial_id, userId, device_type], (insertErr) => {
      if (insertErr) {
        console.error("Track tutorial view insert error:", insertErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: insertErr.message
        });
      }

      // Update view count in tutorial_master
      const updateQuery = `
        UPDATE tutorial_master 
        SET view_count = view_count + 1
        WHERE tutorial_id = ? AND delete_flag = 0
      `;

      connection.query(updateQuery, [tutorial_id], (updateErr) => {
        if (updateErr) {
          console.error("Track tutorial view update error:", updateErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: updateErr.message
          });
        }

        response.json({
          success: true,
          msg: ["View tracked successfully", "दृश्य सफलतापूर्वक ट्रैक", "दृश्य यशस्वीरित्या ट्रॅक केले"],
          data: { tutorial_id: parseInt(tutorial_id) }
        });
      });
    });

  } catch (error) {
    console.error("Track tutorial view error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get tutorial analytics
export const getTutorialAnalytics = (request, response) => {
  try {
    const { tutorial_id } = request.params;

    // Get tutorial basic info
    const tutorialQuery = `
      SELECT 
        tutorial_id,
        tutorial_title,
        view_count,
        language,
        category,
        difficulty_level,
        is_featured,
        created_at
      FROM tutorial_master 
      WHERE tutorial_id = ? AND delete_flag = 0
    `;

    connection.query(tutorialQuery, [tutorial_id], (tutorialErr, tutorialResult) => {
      if (tutorialErr) {
        console.error("Get tutorial analytics tutorial error:", tutorialErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: tutorialErr.message
        });
      }

      if (tutorialResult.length === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Tutorial not found", "ट्यूटोरियल नहीं मिला", "ट्यूटोरियल सापडले नाही"],
          key: "tutorialNotFound"
        });
      }

      const tutorial = tutorialResult[0];

      // Get view analytics
      const analyticsQuery = `
        SELECT 
          COUNT(*) as total_views,
          COUNT(DISTINCT user_id) as unique_viewers,
          COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as authenticated_views,
          COUNT(CASE WHEN user_id IS NULL THEN 1 END) as anonymous_views,
          COUNT(CASE WHEN device_type = 'mobile' THEN 1 END) as mobile_views,
          COUNT(CASE WHEN device_type = 'desktop' THEN 1 END) as desktop_views,
          COUNT(CASE WHEN device_type = 'tablet' THEN 1 END) as tablet_views
        FROM tutorial_views 
        WHERE tutorial_id = ?
      `;

      connection.query(analyticsQuery, [tutorial_id], (analyticsErr, analyticsResult) => {
        if (analyticsErr) {
          console.error("Get tutorial analytics analytics error:", analyticsErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: analyticsErr.message
          });
        }

        const analytics = analyticsResult[0];

        // Get recent views
        const recentViewsQuery = `
          SELECT 
            tv.viewed_at,
            tv.device_type,
            tv.user_id,
            u.username as user_name
          FROM tutorial_views tv
          LEFT JOIN user_master u ON tv.user_id = u.user_id
          WHERE tv.tutorial_id = ?
          ORDER BY tv.viewed_at DESC
          LIMIT 10
        `;

        connection.query(recentViewsQuery, [tutorial_id], (recentErr, recentViews) => {
          if (recentErr) {
            console.error("Get tutorial analytics recent views error:", recentErr);
            return response.status(500).json({
              success: false,
              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
              error: recentErr.message
            });
          }

          // Format dates
          const formattedRecentViews = recentViews.map(view => ({
            ...view,
            viewed_at: moment(view.viewed_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
          }));

          response.json({
            success: true,
            msg: ["Tutorial analytics retrieved successfully", "ट्यूटोरियल एनालिटिक्स सफलतापूर्वक प्राप्त", "ट्यूटोरियल विश्लेषण यशस्वीरित्या पुनर्प्राप्त"],
            data: {
              tutorial: {
                ...tutorial,
                created_at: moment(tutorial.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
              },
              analytics,
              recent_views: formattedRecentViews
            }
          });
        });
      });
    });

  } catch (error) {
    console.error("Get tutorial analytics error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};