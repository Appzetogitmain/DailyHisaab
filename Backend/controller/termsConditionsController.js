import connection from "../connection/dbConfig.js";
import moment from "moment-timezone";

// ===== ADMIN POLICY MANAGEMENT =====

// Get all policy categories
export const getAllPolicyCategories = (request, response) => {
  try {
    const query = `
      SELECT 
        pc.category_id,
        pc.category_name,
        pc.category_title,
        pc.category_description,
        pc.is_active,
        pc.sort_order,
        pc.created_at,
        pc.updated_at,
        COUNT(pp.point_id) as total_points,
        COUNT(CASE WHEN pp.is_active = 1 AND pp.delete_flag = 0 THEN 1 END) as active_points
      FROM policy_categories pc
      LEFT JOIN policy_points pp ON pc.category_id = pp.category_id
      WHERE pc.is_active = 1
      GROUP BY pc.category_id
      ORDER BY pc.sort_order ASC, pc.created_at ASC
    `;

    connection.query(query, (err, result) => {
      if (err) {
        console.error("Get policy categories error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      const formattedCategories = result.map(category => ({
        ...category,
        created_at: moment(category.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
        updated_at: category.updated_at ? moment(category.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
      }));

      response.json({
        success: true,
        msg: ["Policy categories retrieved successfully", "नीति श्रेणियां सफलतापूर्वक प्राप्त", "नीती श्रेण्या यशस्वीरित्या पुनर्प्राप्त"],
        data: formattedCategories
      });
    });

  } catch (error) {
    console.error("Get policy categories error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get policy points by category
export const getPolicyPointsByCategory = (request, response) => {
  try {
    const { category_id } = request.params;
    const { is_active } = request.query;

    let whereConditions = ["pp.delete_flag = 0"];
    let queryParams = [category_id];

    if (is_active !== undefined) {
      whereConditions.push("pp.is_active = ?");
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `AND ${whereConditions.join(" AND ")}` : "";

    const query = `
      SELECT 
        pp.point_id,
        pp.category_id,
        pp.point_title,
        pp.point_description,
        pp.point_order,
        pp.is_active,
        pp.created_at,
        pp.updated_at,
        pc.category_name,
        pc.category_title,
        u.username as created_by_name
      FROM policy_points pp
      JOIN policy_categories pc ON pp.category_id = pc.category_id
      LEFT JOIN user_master u ON pp.created_by = u.user_id
      WHERE pp.category_id = ? ${whereClause}
      ORDER BY pp.point_order ASC, pp.created_at ASC
    `;

    connection.query(query, queryParams, (err, result) => {
      if (err) {
        console.error("Get policy points error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      const formattedPoints = result.map(point => ({
        ...point,
        created_at: moment(point.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
        updated_at: point.updated_at ? moment(point.updated_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm") : null
      }));

      response.json({
        success: true,
        msg: ["Policy points retrieved successfully", "नीति बिंदु सफलतापूर्वक प्राप्त", "नीती बिंदू यशस्वीरित्या पुनर्प्राप्त"],
        data: formattedPoints
      });
    });

  } catch (error) {
    console.error("Get policy points error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Create new policy point
export const createPolicyPoint = (request, response) => {
  try {
    const {
      category_id,
      point_title,
      point_description,
      point_order = 0
    } = request.body;

    const adminId = request.adminInfo.admin_id;

    const insertQuery = `
      INSERT INTO policy_points 
      (category_id, point_title, point_description, point_order, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;

    connection.query(insertQuery, [
      category_id,
      point_title,
      point_description,
      point_order,
      adminId
    ], (err, result) => {
      if (err) {
        console.error("Create policy point error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      response.status(201).json({
        success: true,
        msg: ["Policy point created successfully", "नीति बिंदु सफलतापूर्वक बनाया गया", "नीती बिंदू यशस्वीरित्या तयार केले"],
        data: {
          point_id: result.insertId,
          category_id,
          point_title,
          point_description,
          point_order,
          is_active: true,
          created_by: adminId
        }
      });
    });

  } catch (error) {
    console.error("Create policy point error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Update policy point
export const updatePolicyPoint = (request, response) => {
  try {
    const { point_id } = request.params;
    const {
      point_title,
      point_description,
      point_order,
      is_active
    } = request.body;

    // Build update fields dynamically
    const updateFields = [];
    const updateValues = [];

    if (point_title !== undefined) {
      updateFields.push("point_title = ?");
      updateValues.push(point_title);
    }
    if (point_description !== undefined) {
      updateFields.push("point_description = ?");
      updateValues.push(point_description);
    }
    if (point_order !== undefined) {
      updateFields.push("point_order = ?");
      updateValues.push(point_order);
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

    updateValues.push(point_id);

    const updateQuery = `
      UPDATE policy_points 
      SET ${updateFields.join(", ")}
      WHERE point_id = ? AND delete_flag = 0
    `;

    connection.query(updateQuery, updateValues, (err, result) => {
      if (err) {
        console.error("Update policy point error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Policy point not found", "नीति बिंदु नहीं मिला", "नीती बिंदू सापडला नाही"],
          key: "policyPointNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Policy point updated successfully", "नीति बिंदु सफलतापूर्वक अपडेट", "नीती बिंदू यशस्वीरित्या अपडेट केले"],
        data: { point_id: parseInt(point_id) }
      });
    });

  } catch (error) {
    console.error("Update policy point error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Delete policy point (soft delete)
export const deletePolicyPoint = (request, response) => {
  try {
    const { point_id } = request.params;

    const deleteQuery = `
      UPDATE policy_points 
      SET delete_flag = 1, updated_at = CURRENT_TIMESTAMP
      WHERE point_id = ? AND delete_flag = 0
    `;

    connection.query(deleteQuery, [point_id], (err, result) => {
      if (err) {
        console.error("Delete policy point error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Policy point not found", "नीति बिंदु नहीं मिला", "नीती बिंदू सापडला नाही"],
          key: "policyPointNotFound"
        });
      }

      response.json({
        success: true,
        msg: ["Policy point deleted successfully", "नीति बिंदु सफलतापूर्वक हटाया गया", "नीती बिंदू यशस्वीरित्या हटवले"],
        data: { point_id: parseInt(point_id) }
      });
    });

  } catch (error) {
    console.error("Delete policy point error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Reorder policy points
export const reorderPolicyPoints = (request, response) => {
  try {
    const { category_id } = request.params;
    const { points } = request.body; // Array of {point_id, point_order}

    if (!Array.isArray(points) || points.length === 0) {
      return response.status(400).json({
        success: false,
        msg: ["Invalid points data", "अमान्य बिंदु डेटा", "अवैध बिंदू डेटा"],
        key: "invalidPointsData"
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

      let completedUpdates = 0;
      let hasError = false;

      points.forEach((point, index) => {
        const updateQuery = `
          UPDATE policy_points 
          SET point_order = ?
          WHERE point_id = ? AND category_id = ? AND delete_flag = 0
        `;

        connection.query(updateQuery, [point.point_order, point.point_id, category_id], (updateErr, updateResult) => {
          if (updateErr) {
            hasError = true;
            console.error("Update point order error:", updateErr);
          }

          completedUpdates++;

          if (completedUpdates === points.length) {
            if (hasError) {
              connection.rollback(() => {
                response.status(500).json({
                  success: false,
                  msg: ["Failed to reorder points", "बिंदुओं को पुनः व्यवस्थित करने में विफल", "बिंदू पुन्हा व्यवस्थित करण्यात अयशस्वी"],
                  error: "Transaction failed"
                });
              });
            } else {
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
                  msg: ["Policy points reordered successfully", "नीति बिंदु सफलतापूर्वक पुनः व्यवस्थित", "नीती बिंदू यशस्वीरित्या पुन्हा व्यवस्थित"],
                  data: { category_id: parseInt(category_id), updated_points: points.length }
                });
              });
            }
          }
        });
      });
    });

  } catch (error) {
    console.error("Reorder policy points error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Create policy version
export const createPolicyVersion = (request, response) => {
  try {
    const {
      category_id,
      version_number,
      version_description,
      effective_date,
      policy_data
    } = request.body;

    const adminId = request.adminInfo.admin_id;

    const insertQuery = `
      INSERT INTO policy_version_history 
      (category_id, version_number, version_description, policy_data, created_by, effective_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    connection.query(insertQuery, [
      category_id,
      version_number,
      version_description,
      JSON.stringify(policy_data),
      adminId,
      effective_date
    ], (err, result) => {
      if (err) {
        console.error("Create policy version error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      response.status(201).json({
        success: true,
        msg: ["Policy version created successfully", "नीति संस्करण सफलतापूर्वक बनाया गया", "नीती आवृत्ती यशस्वीरित्या तयार केली"],
        data: {
          version_id: result.insertId,
          category_id,
          version_number,
          version_description,
          effective_date,
          created_by: adminId
        }
      });
    });

  } catch (error) {
    console.error("Create policy version error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get policy version history
export const getPolicyVersionHistory = (request, response) => {
  try {
    const { category_id } = request.params;

    const query = `
      SELECT 
        pvh.version_id,
        pvh.category_id,
        pvh.version_number,
        pvh.version_description,
        pvh.effective_date,
        pvh.created_at,
        pc.category_name,
        pc.category_title,
        u.username as created_by_name
      FROM policy_version_history pvh
      JOIN policy_categories pc ON pvh.category_id = pc.category_id
      LEFT JOIN user_master u ON pvh.created_by = u.user_id
      WHERE pvh.category_id = ?
      ORDER BY pvh.effective_date DESC, pvh.created_at DESC
    `;

    connection.query(query, [category_id], (err, result) => {
      if (err) {
        console.error("Get policy version history error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      const formattedVersions = result.map(version => ({
        ...version,
        effective_date: moment(version.effective_date).tz("Asia/Kolkata").format("DD/MM/YYYY"),
        created_at: moment(version.created_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
      }));

      response.json({
        success: true,
        msg: ["Policy version history retrieved successfully", "नीति संस्करण इतिहास सफलतापूर्वक प्राप्त", "नीती आवृत्ती इतिहास यशस्वीरित्या पुनर्प्राप्त"],
        data: formattedVersions
      });
    });

  } catch (error) {
    console.error("Get policy version history error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// ===== USER POLICY ENDPOINTS =====

// Get public policy content for users
export const getPublicPolicyContent = (request, response) => {
  try {
    const { category_name } = request.params;

    // Map common category name variations to database names
    const categoryNameMap = {
      'terms_conditions': 'terms',
      'privacy_policy': 'privacy',
      'about_us': 'about',
      'terms': 'terms',
      'privacy': 'privacy',
      'about': 'about'
    };

    const mappedCategoryName = categoryNameMap[category_name] || category_name;

    // Get category information
    const categoryQuery = `
      SELECT 
        pc.category_id,
        pc.category_name,
        pc.category_title,
        pc.category_description
      FROM policy_categories pc
      WHERE pc.category_name = ? AND pc.is_active = 1
    `;

    connection.query(categoryQuery, [mappedCategoryName], (categoryErr, categoryResult) => {
      if (categoryErr) {
        console.error("Get policy category error:", categoryErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: categoryErr.message
        });
      }

      if (categoryResult.length === 0) {
        return response.status(404).json({
          success: false,
          msg: ["Policy category not found", "नीति श्रेणी नहीं मिली", "नीती श्रेणी सापडली नाही"],
          key: "categoryNotFound"
        });
      }

      const category = categoryResult[0];

      // Get policy points
      const pointsQuery = `
        SELECT 
          pp.point_id,
          pp.point_title,
          pp.point_description,
          pp.point_order
        FROM policy_points pp
        WHERE pp.category_id = ? AND pp.is_active = 1 AND pp.delete_flag = 0
        ORDER BY pp.point_order ASC, pp.created_at ASC
      `;

      connection.query(pointsQuery, [category.category_id], (pointsErr, pointsResult) => {
        if (pointsErr) {
          console.error("Get policy points error:", pointsErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: pointsErr.message
          });
        }

        // Get latest version
        const versionQuery = `
          SELECT 
            pvh.version_id,
            pvh.version_number,
            pvh.effective_date,
            pvh.created_at
          FROM policy_version_history pvh
          WHERE pvh.category_id = ?
          ORDER BY pvh.effective_date DESC, pvh.created_at DESC
          LIMIT 1
        `;

        connection.query(versionQuery, [category.category_id], (versionErr, versionResult) => {
          if (versionErr) {
            console.error("Get policy version error:", versionErr);
            return response.status(500).json({
              success: false,
              msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
              error: versionErr.message
            });
          }

          const latestVersion = versionResult.length > 0 ? {
            ...versionResult[0],
            effective_date: moment(versionResult[0].effective_date).tz("Asia/Kolkata").format("DD/MM/YYYY"),
            created_at: moment(versionResult[0].created_at).tz("Asia/Kolkata").format("DD/MM/YYYY")
          } : null;

          response.json({
            success: true,
            msg: ["Policy content retrieved successfully", "नीति सामग्री सफलतापूर्वक प्राप्त", "नीती सामग्री यशस्वीरित्या पुनर्प्राप्त"],
            data: {
              category: {
                category_id: category.category_id,
                category_name: category.category_name,
                category_title: category.category_title,
                category_description: category.category_description
              },
              points: pointsResult,
              latest_version: latestVersion
            }
          });
        });
      });
    });

  } catch (error) {
    console.error("Get public policy content error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Accept policy version
export const acceptPolicyVersion = (request, response) => {
  try {
    const { version_id } = request.params;
    const { category_id } = request.body;

    const userId = request.user.user_id;
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent');

    // Check if user has already accepted this version
    const checkQuery = `
      SELECT acceptance_id 
      FROM user_policy_acceptance 
      WHERE user_id = ? AND category_id = ? AND version_id = ?
    `;

    connection.query(checkQuery, [userId, category_id, version_id], (checkErr, checkResult) => {
      if (checkErr) {
        console.error("Check policy acceptance error:", checkErr);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: checkErr.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(400).json({
          success: false,
          msg: ["Policy version already accepted", "नीति संस्करण पहले से स्वीकृत", "नीती आवृत्ती आधीपासून स्वीकृत"],
          key: "alreadyAccepted"
        });
      }

      // Insert acceptance record
      const insertQuery = `
        INSERT INTO user_policy_acceptance 
        (user_id, category_id, version_id, ip_address, user_agent, device_type)
        VALUES (?, ?, ?, ?, ?, 'mobile')
      `;

      connection.query(insertQuery, [
        userId,
        category_id,
        version_id,
        ipAddress,
        userAgent
      ], (insertErr, insertResult) => {
        if (insertErr) {
          console.error("Insert policy acceptance error:", insertErr);
          return response.status(500).json({
            success: false,
            msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
            error: insertErr.message
          });
        }

        response.json({
          success: true,
          msg: ["Policy version accepted successfully", "नीति संस्करण सफलतापूर्वक स्वीकृत", "नीती आवृत्ती यशस्वीरित्या स्वीकृत"],
          data: {
            acceptance_id: insertResult.insertId,
            user_id: userId,
            category_id: parseInt(category_id),
            version_id: parseInt(version_id),
            accepted_at: moment().tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm")
          }
        });
      });
    });

  } catch (error) {
    console.error("Accept policy version error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};

// Get user policy acceptance history
export const getUserPolicyAcceptance = (request, response) => {
  try {
    const userId = request.user.user_id;

    const query = `
      SELECT 
        upa.acceptance_id,
        upa.category_id,
        upa.version_id,
        upa.accepted_at,
        upa.device_type,
        pc.category_name,
        pc.category_title,
        pvh.version_number,
        pvh.effective_date
      FROM user_policy_acceptance upa
      JOIN policy_categories pc ON upa.category_id = pc.category_id
      JOIN policy_version_history pvh ON upa.version_id = pvh.version_id
      WHERE upa.user_id = ?
      ORDER BY upa.accepted_at DESC
    `;

    connection.query(query, [userId], (err, result) => {
      if (err) {
        console.error("Get user policy acceptance error:", err);
        return response.status(500).json({
          success: false,
          msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
          error: err.message
        });
      }

      const formattedAcceptances = result.map(acceptance => ({
        ...acceptance,
        accepted_at: moment(acceptance.accepted_at).tz("Asia/Kolkata").format("DD/MM/YYYY HH:mm"),
        effective_date: moment(acceptance.effective_date).tz("Asia/Kolkata").format("DD/MM/YYYY")
      }));

      response.json({
        success: true,
        msg: ["User policy acceptance retrieved successfully", "उपयोगकर्ता नीति स्वीकृति सफलतापूर्वक प्राप्त", "वापरकर्ता नीती स्वीकृती यशस्वीरित्या पुनर्प्राप्त"],
        data: formattedAcceptances
      });
    });

  } catch (error) {
    console.error("Get user policy acceptance error:", error);
    response.status(500).json({
      success: false,
      msg: ["Internal server error", "आंतरिक सर्वर त्रुटि", "आंतरिक सर्व्हर त्रुटी"],
      error: error.message
    });
  }
};
