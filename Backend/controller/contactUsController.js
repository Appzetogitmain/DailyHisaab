import moment from 'moment-timezone';
import connection from '../connection/dbConfig.js';
import {
  createContactConfigSchema,
  updateContactConfigSchema,
  deleteContactConfigSchema,
  createAppDownloadLinkSchema,
  updateAppDownloadLinkSchema,
  deleteAppDownloadLinkSchema
} from '../validations/signUpWithMobile.js';
import languageMessage from './languageMessage.js';

/**
 * Get Contact Us Data (Public)
 * Retrieves all active contact us configuration for the app
 */
const getContactUsData = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Get contact us configuration
    const contactQuery = `
      SELECT 
        config_type,
        config_key,
        config_value,
        display_text,
        icon_name,
        sort_order
      FROM contact_us_config 
      WHERE is_active = 1
      ORDER BY sort_order, config_type
    `;

    // Get app download links
    const downloadQuery = `
      SELECT 
        platform,
        platform_name,
        download_url,
        icon_name,
        sort_order
      FROM app_download_links 
      WHERE is_active = 1
      ORDER BY sort_order
    `;

    connection.query(contactQuery, (contactErr, contactResult) => {
      if (contactErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: contactErr.message
        });
      }

      connection.query(downloadQuery, (downloadErr, downloadResult) => {
        if (downloadErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: downloadErr.message
          });
        }

        // Organize contact data by type
        const contactData = {
          whatsapp: {},
          phone: {},
          email: {},
          website: {},
          support_hours: {}
        };

        contactResult.forEach(item => {
          if (contactData[item.config_type]) {
            contactData[item.config_type][item.config_key] = {
              value: item.config_value,
              display_text: item.display_text,
              icon_name: item.icon_name
            };
          }
        });

        // Format response data
        const responseData = {
          contact_options: {
            whatsapp: {
              number: contactData.whatsapp.whatsapp_number?.value || '',
              message: contactData.whatsapp.whatsapp_message?.display_text || 'Chat with us',
              icon: contactData.whatsapp.whatsapp_number?.icon_name || 'whatsapp'
            },
            phone: {
              number: contactData.phone.phone_number?.value || '',
              message: contactData.phone.phone_message?.display_text || 'Call us for support',
              icon: contactData.phone.phone_number?.icon_name || 'phone'
            }
          },
          other_ways: [
            {
              type: 'email',
              title: contactData.email.email_address?.display_text || 'Email Support',
              value: contactData.email.email_address?.value || '',
              icon: contactData.email.email_address?.icon_name || 'email'
            },
            {
              type: 'website',
              title: contactData.website.website_url?.display_text || 'Website',
              value: contactData.website.website_url?.value || '',
              icon: contactData.website.website_url?.icon_name || 'website'
            },
            {
              type: 'support_hours',
              title: contactData.support_hours.support_hours?.display_text || 'Support Hours',
              value: contactData.support_hours.support_hours?.value || '',
              icon: contactData.support_hours.support_hours?.icon_name || 'clock'
            }
          ],
          app_download: {
            title: 'Download Our App',
            links: downloadResult.map(link => ({
              platform: link.platform,
              platform_name: link.platform_name,
              download_url: link.download_url,
              icon: link.icon_name
            }))
          }
        };

        return response.status(200).json({
          success: true,
          msg: ['Contact us data retrieved successfully', 'संपर्क डेटा सफलतापूर्वक प्राप्त किया गया', 'संपर्क डेटा यशस्वीरित्या मिळाले'],
          data: responseData
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
 * Create Contact Config (Admin)
 * Creates a new contact configuration entry
 */
const createContactConfig = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = createContactConfigSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { config_type, config_key, config_value, display_text, icon_name, sort_order, is_active } = value;

    // Check if config key already exists
    const checkQuery = `
      SELECT config_id FROM contact_us_config 
      WHERE config_key = ?
    `;

    connection.query(checkQuery, [config_key], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Config key already exists', 'कॉन्फ़िग कुंजी पहले से मौजूद है', 'कॉन्फिग की आधीपासून अस्तित्वात आहे'],
          error: 'CONFIG_KEY_EXISTS'
        });
      }

      // Insert new config with proper error handling
      const insertQuery = `
        INSERT INTO contact_us_config 
        (config_type, config_key, config_value, display_text, icon_name, sort_order, is_active, createtime, updatetime) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;

      connection.query(insertQuery, [config_type, config_key, config_value, display_text, icon_name, sort_order, is_active], (insertErr, insertResult) => {
        if (insertErr) {
          // Handle specific database errors
          if (insertErr.code === 'ER_DUP_ENTRY') {
            return response.status(200).json({
              success: false,
              msg: ['Config key already exists', 'कॉन्फ़िग कुंजी पहले से मौजूद है', 'कॉन्फिग की आधीपासून अस्तित्वात आहे'],
              error: 'DUPLICATE_ENTRY'
            });
          }

          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: insertErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Contact config created successfully', 'संपर्क कॉन्फ़िग सफलतापूर्वक बनाया गया', 'संपर्क कॉन्फिग यशस्वीरित्या तयार केले'],
          data: {
            config_id: insertResult.insertId,
            config_type,
            config_key,
            config_value,
            display_text,
            icon_name,
            sort_order,
            is_active,
            created_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Update Contact Config (Admin)
 * Updates an existing contact configuration entry
 */
const updateContactConfig = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = updateContactConfigSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { config_id, config_type, config_key, config_value, display_text, icon_name, sort_order, is_active } = value;

    // Check if config exists
    const checkQuery = "SELECT config_id, config_type, config_key FROM contact_us_config WHERE config_id = ?";
    connection.query(checkQuery, [config_id], (checkErr, checkResult) => {
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
          msg: ['Contact config not found', 'संपर्क कॉन्फ़िग नहीं मिला', 'संपर्क कॉन्फिग सापडले नाही']
        });
      }

      const existingConfig = checkResult[0];

      // Check if config_key is being changed and if it conflicts
      if (config_key && config_key !== existingConfig.config_key) {
        const keyCheckQuery = "SELECT config_id FROM contact_us_config WHERE config_key = ? AND config_id != ?";
        connection.query(keyCheckQuery, [config_key, config_id], (keyErr, keyResult) => {
          if (keyErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: keyErr.message
            });
          }

          if (keyResult.length > 0) {
            return response.status(200).json({
              success: false,
              msg: ['Config key already exists', 'कॉन्फ़िग कुंजी पहले से मौजूद है', 'कॉन्फिग की आधीपासून अस्तित्वात आहे']
            });
          }

          // Proceed with update
          performUpdate();
        });
      } else {
        // No config_key change, proceed directly
        performUpdate();
      }

      function performUpdate() {
        // Build update query dynamically
        const updateFields = [];
        const updateValues = [];

        if (config_type !== undefined) {
          updateFields.push('config_type = ?');
          updateValues.push(config_type);
        }
        if (config_key !== undefined) {
          updateFields.push('config_key = ?');
          updateValues.push(config_key);
        }
        if (config_value !== undefined) {
          updateFields.push('config_value = ?');
          updateValues.push(config_value);
        }
        if (display_text !== undefined) {
          updateFields.push('display_text = ?');
          updateValues.push(display_text);
        }
        if (icon_name !== undefined) {
          updateFields.push('icon_name = ?');
          updateValues.push(icon_name);
        }
        if (sort_order !== undefined) {
          updateFields.push('sort_order = ?');
          updateValues.push(sort_order);
        }
        if (is_active !== undefined) {
          updateFields.push('is_active = ?');
          updateValues.push(is_active);
        }

        if (updateFields.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['No fields to update', 'अपडेट करने के लिए कोई फ़ील्ड नहीं', 'अपडेएट करण्यासाठी फील्ड नाही']
          });
        }

        updateFields.push('updatetime = NOW()');
        updateValues.push(config_id);

        const updateQuery = `UPDATE contact_us_config SET ${updateFields.join(', ')} WHERE config_id = ?`;

        connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
          if (updateErr) {
            // Handle specific database errors
            if (updateErr.code === 'ER_DUP_ENTRY') {
              return response.status(200).json({
                success: false,
                msg: ['Config key already exists', 'कॉन्फ़िग कुंजी पहले से मौजूद है', 'कॉन्फिग की आधीपासून अस्तित्वात आहे'],
                error: 'DUPLICATE_ENTRY'
              });
            }

            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: updateErr.message
            });
          }

          return response.status(200).json({
            success: true,
            msg: ['Contact config updated successfully', 'संपर्क कॉन्फ़िग सफलतापूर्वक अपडेट किया गया', 'संपर्क कॉन्फिग यशस्वीरित्या अपडेट केले'],
            data: {
              config_id,
              config_type: config_type || existingConfig.config_type,
              config_key: config_key || existingConfig.config_key,
              updated_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
            }
          });
        });
      }
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
 * Delete Contact Config (Admin)
 * Hard deletes a contact configuration entry
 */
const deleteContactConfig = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = deleteContactConfigSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { config_id } = value;

    // Check if config exists
    const checkQuery = "SELECT config_id, config_type, config_key, config_value FROM contact_us_config WHERE config_id = ?";
    connection.query(checkQuery, [config_id], (checkErr, checkResult) => {
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
          msg: ['Contact config not found', 'संपर्क कॉन्फ़िग नहीं मिला', 'संपर्क कॉन्फिग सापडले नाही']
        });
      }

      const config = checkResult[0];

      // Hard delete config
      const deleteQuery = "DELETE FROM contact_us_config WHERE config_id = ?";
      connection.query(deleteQuery, [config_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        // Check if any rows were affected
        if (deleteResult.affectedRows === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Contact config not found', 'संपर्क कॉन्फ़िग नहीं मिला', 'संपर्क कॉन्फिग सापडले नाही']
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Contact config deleted successfully', 'संपर्क कॉन्फ़िग सफलतापूर्वक हटाया गया', 'संपर्क कॉन्फिग यशस्वीरित्या हटवले'],
          data: {
            config_id,
            config_type: config.config_type,
            config_key: config.config_key,
            config_value: config.config_value,
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

/**
 * Get All Contact Configs (Admin)
 * Retrieves all contact configurations for admin management
 */
const getAllContactConfigs = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { config_type, is_active, page = 1, limit = 50 } = request.query;
    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];

    if (config_type) {
      whereConditions.push('config_type = ?');
      queryParams.push(config_type);
    }

    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM contact_us_config ${whereClause}`;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const total = countResult[0].total;

      // Get configs with pagination
      const dataQuery = `
        SELECT 
          config_id,
          config_type,
          config_key,
          config_value,
          display_text,
          icon_name,
          is_active,
          sort_order,
          createtime,
          updatetime
        FROM contact_us_config 
        ${whereClause}
        ORDER BY sort_order, config_type, createtime DESC
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

        return response.status(200).json({
          success: true,
          msg: ['Contact configs retrieved successfully', 'संपर्क कॉन्फ़िग सफलतापूर्वक प्राप्त किए गए', 'संपर्क कॉन्फिग यशस्वीरित्या मिळाले'],
          data: {
            configs: dataResult,
            pagination: {
              current_page: parseInt(page),
              per_page: parseInt(limit),
              total_items: total,
              total_pages: Math.ceil(total / limit)
            }
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
 * Create App Download Link (Admin)
 * Creates a new app download link
 */
const createAppDownloadLink = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = createAppDownloadLinkSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { platform, platform_name, download_url, icon_name, sort_order } = value;

    // Check if platform already exists
    const checkQuery = "SELECT link_id FROM app_download_links WHERE platform = ?";
    connection.query(checkQuery, [platform], (checkErr, checkResult) => {
      if (checkErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: checkErr.message
        });
      }

      if (checkResult.length > 0) {
        return response.status(200).json({
          success: false,
          msg: ['Platform already exists', 'प्लेटफ़ॉर्म पहले से मौजूद है', 'प्लॅटफॉर्म आधीपासून अस्तित्वात आहे']
        });
      }

      // Insert new download link
      const insertQuery = `
        INSERT INTO app_download_links 
        (platform, platform_name, download_url, icon_name, sort_order, createtime, updatetime) 
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `;

      connection.query(insertQuery, [platform, platform_name, download_url, icon_name, sort_order], (insertErr, insertResult) => {
        if (insertErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: insertErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['App download link created successfully', 'ऐप डाउनलोड लिंक सफलतापूर्वक बनाया गया', 'ऐप डाउनलोड लिंक यशस्वीरित्या तयार केले'],
          data: {
            link_id: insertResult.insertId,
            platform,
            platform_name,
            download_url,
            icon_name,
            sort_order,
            created_at: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
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
 * Update App Download Link (Admin)
 * Updates an existing app download link
 */
const updateAppDownloadLink = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = updateAppDownloadLinkSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { link_id, platform_name, download_url, icon_name, sort_order, is_active } = value;

    // Check if link exists
    const checkQuery = "SELECT link_id, platform FROM app_download_links WHERE link_id = ?";
    connection.query(checkQuery, [link_id], (checkErr, checkResult) => {
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
          msg: ['App download link not found', 'ऐप डाउनलोड लिंक नहीं मिला', 'ऐप डाउनलोड लिंक सापडले नाही']
        });
      }

      const existingLink = checkResult[0];

      // Build update query dynamically
      const updateFields = [];
      const updateValues = [];

      if (platform_name !== undefined) {
        updateFields.push('platform_name = ?');
        updateValues.push(platform_name);
      }
      if (download_url !== undefined) {
        updateFields.push('download_url = ?');
        updateValues.push(download_url);
      }
      if (icon_name !== undefined) {
        updateFields.push('icon_name = ?');
        updateValues.push(icon_name);
      }
      if (sort_order !== undefined) {
        updateFields.push('sort_order = ?');
        updateValues.push(sort_order);
      }
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(is_active);
      }

      if (updateFields.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['No fields to update', 'अपडेट करने के लिए कोई फ़ील्ड नहीं', 'अपडेट करण्यासाठी फील्ड नाही']
        });
      }

      updateFields.push('updatetime = NOW()');
      updateValues.push(link_id);

      const updateQuery = `UPDATE app_download_links SET ${updateFields.join(', ')} WHERE link_id = ?`;

      connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['App download link updated successfully', 'ऐप डाउनलोड लिंक सफलतापूर्वक अपडेट किया गया', 'ऐप डाउनलोड लिंक यशस्वीरित्या अपडेट केले'],
          data: {
            link_id,
            platform: existingLink.platform,
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
 * Delete App Download Link (Admin)
 * Soft deletes an app download link
 */
const deleteAppDownloadLink = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Validate request body
    const { error, value } = deleteAppDownloadLinkSchema.validate(request.body);

    if (error) {
      return response.status(200).json({
        success: false,
        msg: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
        errors: error.details.map(detail => detail.message)
      });
    }

    const { link_id } = value;

    // Check if link exists
    const checkQuery = "SELECT link_id, platform, platform_name, download_url FROM app_download_links WHERE link_id = ?";
    connection.query(checkQuery, [link_id], (checkErr, checkResult) => {
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
          msg: ['App download link not found', 'ऐप डाउनलोड लिंक नहीं मिला', 'ऐप डाउनलोड लिंक सापडले नाही']
        });
      }

      const link = checkResult[0];

      // Hard delete link
      const deleteQuery = "DELETE FROM app_download_links WHERE link_id = ?";
      connection.query(deleteQuery, [link_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['App download link deleted successfully', 'ऐप डाउनलोड लिंक सफलतापूर्वक हटाया गया', 'ऐप डाउनलोड लिंक यशस्वीरित्या हटवले'],
          data: {
            link_id,
            platform: link.platform,
            platform_name: link.platform_name,
            download_url: link.download_url,
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

/**
 * Get All App Download Links (Admin)
 * Retrieves all app download links for admin management
 */
const getAllAppDownloadLinks = async (request, response) => {
  try {
    // Set cache control headers
    response.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { platform, is_active, page = 1, limit = 50 } = request.query;
    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions = [];
    let queryParams = [];

    if (platform) {
      whereConditions.push('platform = ?');
      queryParams.push(platform);
    }

    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM app_download_links ${whereClause}`;

    connection.query(countQuery, queryParams, (countErr, countResult) => {
      if (countErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: countErr.message
        });
      }

      const total = countResult[0].total;

      // Get links with pagination
      const dataQuery = `
        SELECT 
          link_id,
          platform,
          platform_name,
          download_url,
          icon_name,
          is_active,
          sort_order,
          createtime,
          updatetime
        FROM app_download_links 
        ${whereClause}
        ORDER BY sort_order, platform, createtime DESC
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

        return response.status(200).json({
          success: true,
          msg: ['App download links retrieved successfully', 'ऐप डाउनलोड लिंक सफलतापूर्वक प्राप्त किए गए', 'ऐप डाउनलोड लिंक यशस्वीरित्या मिळाले'],
          data: {
            links: dataResult,
            pagination: {
              current_page: parseInt(page),
              per_page: parseInt(limit),
              total_items: total,
              total_pages: Math.ceil(total / limit)
            }
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

export {
  getContactUsData,
  createContactConfig,
  updateContactConfig,
  deleteContactConfig,
  getAllContactConfigs,
  createAppDownloadLink,
  updateAppDownloadLink,
  deleteAppDownloadLink,
  getAllAppDownloadLinks
};
