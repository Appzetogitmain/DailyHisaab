import moment from 'moment-timezone';
import connection from '../connection/dbConfig.js'
import { addCategorySchema, addTeamMemberSchema, categoryDeleteSchema, categoryEditSchema, editTeamMemberSchema, faqSchema, resendOtpSchema, validateAppLock, removeAppLockSchema, customerEditSchema, customerDeleteSchema, getAllCategorySchema, getUserInfoSchema, getUserAccountSchema, getUserAccountMonthSchema } from '../validations/signUpWithMobile.js';
import { fetchUserData } from './function.js';
import languageMessage from "./languageMessage.js";
import { Parser } from 'json2csv';

const setAppLock = async (request, response) => {

    const { error, value } = validateAppLock.validate(request.body);

    if (error) {

        return response.status(200).json({ success: false, msg: error.details[0].message })

    }

    const { user_id, app_lock_code } = value;

    try {

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                const sqlUpdate = "UPDATE user_master SET app_lock_code = ?, app_lock_status = 1, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";

                connection.query(sqlUpdate, [app_lock_code, user_id], (updateError, updateResult) => {

                    if (updateError) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: updateError.message });

                    }

                    if (updateResult.affectedRows === 0) {

                        return response.status(200).json({ success: false, msg: languageMessage.errorUpdatingData })

                    } else {

                        fetchUserData(user_id, async (error, userDataArray) => {

                            if (error) {

                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError });

                            }

                            return response.status(200).json({ success: true, msg: languageMessage.appLockSetSuccessfully, userDataArray });

                        });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const updateAppLock = async (request, response) => {

    const { error, value } = validateAppLock.validate(request.body);

    if (error) {

        return response.status(200).json({ success: false, msg: error.details[0].message })

    }

    const { user_id, app_lock_code } = value;

    try {

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                const sqlUpdate = "UPDATE user_master SET app_lock_code = ?, app_lock_status = 1, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";

                connection.query(sqlUpdate, [app_lock_code, user_id], (updateError, updateResult) => {

                    if (updateError) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: updateError.message });

                    }

                    if (updateResult.affectedRows === 0) {

                        return response.status(200).json({ success: false, msg: languageMessage.errorUpdatingData })

                    } else {

                        fetchUserData(user_id, async (error, userDataArray) => {

                            if (error) {

                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError });

                            }

                            return response.status(200).json({ success: true, msg: languageMessage.appLockUpdatedSuccessfully, userDataArray });

                        });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const addCategory = async (request, response) => {

    try {

        const { error, value } = addCategorySchema.validate(request.body);

        if (error) {

            return response.status(200).json({ success: false, msg: ["Validation failed"], errors: error.details.map((d) => d.message) });

        }

        const { category_name, user_id, category_type, account_type, account_id } = value;

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }



                const icon = request.file ? request.file.path : ''; // Cloudinary returns the secure_url in the file object

                if (!icon) {

                    return response.status(200).json({ success: false, msg: languageMessage.iconRequired, key: 'icon' });

                }

                // Build category uniqueness check query based on whether account_id is provided
                let checkCategorySql, checkParams;

                if (account_id) {
                    // Check for duplicate category name within the same account
                    checkCategorySql = "SELECT category_id FROM category_master WHERE category_name = ? AND user_id = ? AND delete_flag = 0 AND category_type = ? AND account_type = ? AND account_id = ?";
                    checkParams = [category_name, user_id, category_type, account_type, account_id];
                } else {
                    // Check for duplicate category name within the same account_type (legacy behavior)
                    checkCategorySql = "SELECT category_id FROM category_master WHERE category_name = ? AND user_id = ? AND delete_flag = 0 AND category_type = ? AND account_type = ? AND account_id IS NULL";
                    checkParams = [category_name, user_id, category_type, account_type];
                }

                connection.query(checkCategorySql, checkParams, async (checkError, checkResult) => {

                    if (checkError) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkError.message });

                    }

                    if (checkResult.length > 0) {

                        return response.status(200).json({ success: false, msg: languageMessage.categoryAlreadyExists, key: 'category_name' });

                    }

                    // Build insert query based on whether account_id is provided
                    let sqlInsert, insertParams;

                    if (account_id) {
                        sqlInsert = "INSERT INTO category_master(category_type, category_name, icon, added_by, user_id, account_type, account_id, deletable, createtime, updatetime) VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())";
                        insertParams = [category_type, category_name, icon, 1, user_id, account_type, account_id];
                    } else {
                        sqlInsert = "INSERT INTO category_master(category_type, category_name, icon, added_by, user_id, account_type, account_id, deletable, createtime, updatetime) VALUES (?, ?, ?, ?, ?, ?, NULL, 1, NOW(), NOW())";
                        insertParams = [category_type, category_name, icon, 1, user_id, account_type];
                    }

                    connection.query(sqlInsert, insertParams, (insertError, insertResult) => {

                        if (insertError) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: insertError.message });

                        }

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.categoryAdded,
                            category_id: insertResult.insertId,
                            account_specific: account_id ? true : false,
                            account_id: account_id || null
                        });

                    });

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

};

const getUserCategory = async (request, response) => {

    try {

        const { error, value } = getAllCategorySchema.validate(request.query);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }

        const { user_id, account_type, account_id } = value;

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                // Build query with optional account_type and account_id filtering
                let query = "SELECT category_id,user_id,category_name,icon,category_type,account_type,account_id,createtime,added_by,deletable FROM category_master WHERE delete_flag = 0";

                // Exclude admin categories deleted/hidden by this user
                query += " AND category_id NOT IN (SELECT category_id FROM user_deleted_admin_categories WHERE user_id = ?)";
                let queryParams = [user_id];

                // If account_id is provided, show only categories for that specific account + admin categories for the same account_type
                if (account_id) {
                    query += " AND ((user_id = ? AND account_id = ?) OR (added_by = 0 AND account_type = ? AND account_id IS NULL))";
                    queryParams.push(user_id, account_id, account_type);
                } else {
                    // Legacy behavior: show user categories + admin categories for the same account_type
                    query += " AND ((user_id = ? AND account_id IS NULL) OR (added_by = 0 AND account_type = ? AND account_id IS NULL))";
                    queryParams.push(user_id, account_type);
                }

                if (account_type && !account_id) {
                    query += " AND account_type = ?";
                    queryParams.push(account_type);
                }

                query += " ORDER BY added_by ASC, category_id DESC";

                connection.query(query, queryParams, (err, results) => {

                    if (err) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                    }

                    if (results.length === 0) {

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, category_data: "NA" });

                    }

                    var category_data = [];

                    if (results.length > 0) {

                        // Get base URL for icon URLs
                        const baseUrl = process.env.BASE_URL || `${request.protocol}://${request.get('host')}`;

                        for (var data of results) {

                            category_data.push({

                                category_id: data.category_id,

                                category_name: data.category_name,

                                icon: data.icon,

                                icon_url: data.icon ? (data.icon.startsWith('http') ? data.icon : `${baseUrl}/images/${data.icon}`) : null,

                                category_type: data.category_type,

                                category_type_label: data.category_type == 1 ? "Expense" : "Income",

                                account_type: data.account_type,

                                account_type_label: data.account_type === 1 ? "Personal" : data.account_type === 2 ? "Business" : "Unknown",

                                account_id: data.account_id,

                                account_specific: data.account_id ? true : false,

                                createtime: moment(data.createtime).format('YYYY-MM-DD HH:mm A'),

                                added_by: data.added_by,

                                is_admin_category: data.added_by === 0,

                                is_user_category: data.added_by === 1,

                                can_delete: data.added_by === 1 && data.deletable === 1,

                                deletable: data.deletable,

                                deletable_label: data.deletable === 1 ? "Deletable by users" : "Not deletable by users"

                            });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, category_data: category_data.length > 0 ? category_data : "NA" });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const editCategory = (req, res) => {
    try {
        const { error, value } = categoryEditSchema.validate(req.body);

        if (error) {
            return res.status(200).json({ success: false, errors: error.details.map(e => e.message) });
        }

        const { category_id, category_name, user_id, category_type, account_type, account_id } = value;

        // Build uniqueness check query based on whether account_id is provided
        let checkCategorySql, checkParams;

        if (account_id) {
            checkCategorySql = `SELECT category_id FROM category_master WHERE category_name = ? AND user_id = ? AND delete_flag = 0 AND category_type = ? AND account_type = ? AND account_id = ? AND category_id != ?`;
            checkParams = [category_name, user_id, category_type, account_type, account_id, category_id];
        } else {
            checkCategorySql = `SELECT category_id FROM category_master WHERE category_name = ? AND user_id = ? AND delete_flag = 0 AND category_type = ? AND account_type = ? AND account_id IS NULL AND category_id != ?`;
            checkParams = [category_name, user_id, category_type, account_type, category_id];
        }

        connection.query(checkCategorySql, checkParams, (checkError, checkResult) => {

            if (checkError) {

                return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkError.message });

            }

            if (checkResult.length > 0) {

                return res.status(409).json({ success: false, msg: languageMessage.categoryAlreadyExists, key: 'category_name' });

            }

            // Get icon URL from Cloudinary - check multiple properties to ensure we get the URL
            let icon = null;
            if (req.file) {
                // CloudinaryStorage returns the secure_url in different properties
                // Check path first (most common), then secure_url, then url
                icon = req.file.path || req.file.secure_url || req.file.url || null;
            }

            let sql, params;

            if (icon) {

                if (account_id) {
                    sql = `UPDATE category_master SET category_type = ?, category_name = ?, icon = ?, account_type = ?, account_id = ? WHERE category_id = ? AND user_id = ? AND delete_flag = 0`;
                    params = [category_type, category_name, icon, account_type, account_id, category_id, user_id];
                } else {
                    sql = `UPDATE category_master SET category_type = ?, category_name = ?, icon = ?, account_type = ?, account_id = NULL WHERE category_id = ? AND user_id = ? AND delete_flag = 0`;
                    params = [category_type, category_name, icon, account_type, category_id, user_id];
                }

            } else {

                if (account_id) {
                    sql = `UPDATE category_master SET category_type = ?, category_name = ?, account_type = ?, account_id = ? WHERE category_id = ? AND user_id = ? AND delete_flag = 0`;
                    params = [category_type, category_name, account_type, account_id, category_id, user_id];
                } else {
                    sql = `UPDATE category_master SET category_type = ?, category_name = ?, account_type = ?, account_id = NULL WHERE category_id = ? AND user_id = ? AND delete_flag = 0`;
                    params = [category_type, category_name, account_type, category_id, user_id];
                }

            }

            connection.query(sql, params, (err, result) => {

                if (err) {

                    return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }



                if (result.affectedRows === 0) {

                    return res.status(200).json({ success: false, msg: languageMessage.categoryNotFound });

                }

                return res.status(200).json({ success: true, msg: languageMessage.categoryUpdated });

            });

        });
    } catch (error) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: error.message
        });
    }

};

const deleteCategory = (req, res) => {
    try {
        const { error, value } = categoryDeleteSchema.validate(req.body);

        if (error) {
            return res.status(200).json({ success: false, errors: error.details.map(e => e.message) });
        }

        const { category_id, user_id } = value;

        // First check if the category exists and if it's deletable
        const checkSql = "SELECT category_id, added_by, deletable FROM category_master WHERE category_id = ? AND delete_flag = 0";

        connection.query(checkSql, [category_id], (checkErr, checkResult) => {

            if (checkErr) {
                return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkErr.message });
            }

            if (checkResult.length === 0) {
                return res.status(200).json({ success: false, msg: languageMessage.categoryNotFound });
            }

            // Check if the category is deletable by users
            if (checkResult[0].deletable === 0) {
                return res.status(200).json({
                    success: false,
                    msg: ['This category cannot be deleted by users', 'यह कैटेगरी उपयोगकर्ताओं द्वारा हटाई नहीं जा सकती', 'ही श्रेणी वापरकर्त्यांद्वारे हटवली जाऊ शकत नाही'],
                    key: "category_not_deletable"
                });
            }


            // Proceed with deletion logic based on who added the category
            if (checkResult[0].added_by === 0) {
                // Admin category - hide it for this specific user
                const hideSql = "INSERT INTO user_deleted_admin_categories (user_id, category_id, deleted_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE deleted_at = NOW()";

                connection.query(hideSql, [user_id, category_id], (hideErr, hideResult) => {
                    if (hideErr) {
                        return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: hideErr.message });
                    }
                    return res.status(200).json({ success: true, msg: languageMessage.categoryDeleted || 'Category deleted successfully' });
                });

            } else {
                // User category - perform soft delete as before
                const sql = "UPDATE category_master SET delete_flag = 1 WHERE category_id = ? AND delete_flag = 0";

                connection.query(sql, [category_id], (err, result) => {

                    if (err) {

                        return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                    }

                    if (result.affectedRows === 0) {

                        return res.status(200).json({ success: false, msg: languageMessage.categoryNotFound });

                    }

                    res.status(200).json({ success: true, msg: languageMessage.categoryDeleted });

                });
            }
        });
    } catch (error) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: error.message
        });
    }

};

const getAllCategory = async (request, response) => {

    try {

        const { error, value } = getAllCategorySchema.validate(request.query);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }

        const { user_id, account_type, account_id } = value;

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                // Build query with optional account_type and account_id filtering
                let query = "SELECT category_id, user_id, category_name, icon, category_type, account_type, account_id, createtime, added_by, deletable FROM category_master WHERE delete_flag = 0";

                // Exclude admin categories deleted/hidden by this user
                query += " AND category_id NOT IN (SELECT category_id FROM user_deleted_admin_categories WHERE user_id = ?)";
                let queryParams = [user_id];

                // If account_id is provided, show only categories for that specific account + admin categories for the same account_type
                if (account_id) {
                    query += " AND ((user_id = ? AND account_id = ?) OR (added_by = 0 AND account_type = ? AND account_id IS NULL))";
                    queryParams.push(user_id, account_id, account_type);
                } else {
                    // Legacy behavior: show user categories + admin categories for the same account_type
                    query += " AND ((user_id = ? AND account_id IS NULL) OR (added_by = 0 AND account_type = ? AND account_id IS NULL))";
                    queryParams.push(user_id, account_type);
                }

                if (account_type && !account_id) {
                    query += " AND account_type = ?";
                    queryParams.push(account_type);
                }

                query += " ORDER BY category_id DESC";

                connection.query(query, queryParams, (err, results) => {

                    if (err) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                    }

                    if (results.length === 0) {

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, category_data: "NA" });

                    }

                    var category_data = [];

                    if (results.length > 0) {

                        // Get base URL for icon URLs
                        const baseUrl = process.env.BASE_URL || `${request.protocol}://${request.get('host')}`;

                        for (var data of results) {

                            category_data.push({

                                category_id: data.category_id,

                                category_name: data.category_name,

                                icon: data.icon,

                                icon_url: data.icon ? (data.icon.startsWith('http') ? data.icon : `${baseUrl}/images/${data.icon}`) : null,

                                category_type: data.category_type,

                                category_type_label: data.category_type == 1 ? "Expense" : "Income",

                                account_type: data.account_type,

                                account_type_label: data.account_type === 1 ? "Personal" : data.account_type === 2 ? "Business" : "Unknown",

                                account_id: data.account_id,

                                account_specific: data.account_id ? true : false,

                                createtime: moment(data.createtime).format('YYYY-MM-DD HH:mm A'),

                                added_by: data.added_by,

                                is_admin_category: data.added_by === 0,

                                is_user_category: data.added_by === 1,

                                can_delete: data.added_by === 1 && data.deletable === 1,

                                deletable: data.deletable,

                                deletable_label: data.deletable === 1 ? "Deletable by users" : "Not deletable by users"

                            });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, category_data: category_data.length > 0 ? category_data : "NA" });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const getFaq = async (request, response) => {

    try {

        const { error, value } = faqSchema.validate(request.query);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }

        const { user_id, faq_type } = value;

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                const sqlSelectFaq = faq_type == 0 ? "SELECT faq_id, answer, question, createtime FROM faq_master WHERE delete_flag = 0 ORDER BY faq_id DESC;" : `SELECT faq_id, answer, question, createtime FROM faq_master WHERE faq_type = ${faq_type} AND delete_flag = 0 ORDER BY faq_id DESC;`;

                connection.query(sqlSelectFaq, async (err, results) => {

                    if (err) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                    }

                    if (results.length === 0) {

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, faq_data: "NA" });

                    }

                    var faq_data = [];

                    if (results.length > 0) {

                        for (var data of results) {

                            faq_data.push({

                                faq_id: data.faq_id,

                                answer: data.answer,

                                question: data.question,

                                createtime: moment(data.createtime).format('YYYY-MM-DD HH:mm A')

                            });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, faq_data: faq_data.length > 0 ? faq_data : "NA" });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const addCustomers = async (request, response) => {

    const { user_id, customer_name, description, account_id } = request.body;

    try {

        if (!user_id) {

            return response.status(200).json({ success: false, msg: ["user_id is required"] })

        }

        if (!customer_name) {

            return response.status(200).json({ success: false, msg: ["customer_name is required"] })

        }

        if (!account_id) {

            return response.status(200).json({ success: false, msg: ["customer_name is required"] })

        }

        if (!description) {

            return response.status(200).json({ success: false, msg: ["description is required"] })

        }

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                connection.query("INSERT INTO udhari_customer_master (account_id,user_id, customer_name, description, createtime, updatetime) VALUES (?,?, ?, ?, NOW(), NOW())",

                    [account_id, user_id, customer_name, description], (err, result) => {

                        if (err) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.customerAdded });

                    });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const getTeamMembers = async (request, response) => {

    try {

        const { error, value } = getUserAccountSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id } = value;

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }



            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }



            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }



            const sqlSelect = "SELECT team_member_id, name, email,mobile,phone_code, account_type, role, user_id, createtime FROM team_member_master WHERE delete_flag = 0 AND user_id = ? AND account_type = ? ORDER BY team_member_id DESC";

            connection.query(sqlSelect, [user_id, account_id], (error, resultTeamMember) => {

                if (error) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "2", error: error.message });

                }

                var result_team_member_arr = [];

                if (resultTeamMember.length === 0) {

                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, result_team_member_arr: "NA" });

                }



                if (resultTeamMember.length > 0) {

                    resultTeamMember.forEach(member => {

                        result_team_member_arr.push({

                            team_member_id: member.team_member_id,

                            name: member.name,

                            email: member.email,

                            mobile: member.mobile,

                            phone_code: member.phone_code,

                            account_type: member.account_type,

                            // account_type_label: "1 for personal, 2 for Business",

                            role: member.role,

                            user_id: member.user_id,

                            createtime: moment(member.createtime).format('YYYY-MM-DD HH:mm A')

                        });

                    });

                }



                return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, result_team_member_arr: result_team_member_arr.length > 0 ? result_team_member_arr : "NA" });

            });

        });



    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

};

const deleteTeamMember = async (request, response) => {

    const { user_id, team_member_id } = request.body;

    try {

        if (!user_id) {

            return response.status(200).json({ success: false, msg: ["user_id is required"] })

        }

        if (!team_member_id) {

            return response.status(200).json({ success: false, msg: ["team_member_id is required"] })

        }

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }



                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });



                }

                connection.query("UPDATE team_member_master SET delete_flag = 1, updatetime = NOW() WHERE team_member_id = ? AND user_id = ? AND delete_flag = 0",

                    [team_member_id, user_id], (err, result) => {

                        if (err) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                        }

                        if (result.affectedRows === 0) {

                            return response.status(200).json({ success: false, msg: languageMessage.teamMemberNotFound });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.teamMemberDeleted });

                    }

                );

            }

        );

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const addTeamMember = async (request, response) => {

    try {

        const { error, value } = addTeamMemberSchema.validate(request.body);

        if (error) {

            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

        }



        const { user_id, name, mobile, phone_code, role, account_type } = value;

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }

            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }

            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            const checkEmailSql = "SELECT team_member_id FROM team_member_master WHERE mobile = ? AND delete_flag = 0";

            connection.query(checkEmailSql, [mobile], (checkError, checkResult) => {

                if (checkError) {



                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkError.message });

                }

                if (checkResult.length > 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.emailAlreadyExists });

                }

                if (checkResult.length === 0) {

                    const sql = "INSERT INTO team_member_master (user_id, name, mobile,phone_code, role, account_type, createtime, updatetime) VALUES (?, ?, ?, ?, ?,?, NOW(), NOW())";

                    connection.query(sql, [user_id, name, mobile, phone_code, role, account_type], (err, result) => {

                        if (err) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.teamMemberAdded });

                    });

                }

            });

        });



    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const editTeamMember = async (request, response) => {

    const { error, value } = editTeamMemberSchema.validate(request.body);

    if (error) {

        return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });

    }

    const { user_id, name, mobile, phone_code, role, account_type, team_member_id } = value;

    try {

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }

            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }

            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            const checkEmailSql = "SELECT team_member_id FROM team_member_master WHERE mobile = ? AND delete_flag = 0 AND team_member_id != ?";

            connection.query(checkEmailSql, [mobile, team_member_id], (checkError, checkResult) => {

                if (checkError) {



                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkError.message });

                }

                if (checkResult.length > 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.emailAlreadyExists });

                }

                if (checkResult.length === 0) {

                    const sql = "UPDATE team_member_master SET name = ?, mobile = ?, phone_code = ?, role = ?, account_type = ?, updatetime = NOW() WHERE team_member_id = ? AND user_id = ? AND delete_flag = 0";

                    connection.query(sql, [name, mobile, phone_code, role, account_type, team_member_id, user_id], (updateError, updateResult) => {

                        if (updateError) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: updateError.message });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.teamMemberUpdated });

                    });

                }

            });

        });



    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const removeAppLock = async (request, response) => {

    const { error, value } = removeAppLockSchema.validate(request.body);

    if (error) {

        return response.status(200).json({ success: false, msg: error.details[0].message })

    }

    const { user_id } = value;

    try {

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }



                const sqlUpdate = "UPDATE user_master SET app_lock_code = 0, app_lock_status = 0, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";

                connection.query(sqlUpdate, [user_id], (updateErr, updateResult) => {

                    if (updateErr) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: updateErr.message });

                    }

                    fetchUserData(user_id, async (error, userDataArray) => {

                        if (error) {

                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError });

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.appLockRemoved, userDataArray });

                    });

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const createSupportTicket = async (request, response) => {

    try {

        const { user_id, description, priority, category_id } = request.body;

        // Get Cloudinary URL if image is uploaded
        const imageUrl = request.file ? request.file.path : null;

        if (!user_id) {

            return response.status(200).json({ success: false, msg: ["user_id is required"] })

        }

        if (!description) {

            return response.status(200).json({ success: false, msg: ["description is required"] })

        }

        if (!priority) {

            return response.status(200).json({ success: false, msg: ["priority is required"] })

        }

        if (!category_id) {

            return response.status(200).json({ success: false, msg: ["category_id is required"] })

        }

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }



            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }



            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            const sqlInsert = "INSERT INTO support_tickets_master (screenshot,user_id, description, priority, category_id, createtime, updatetime) VALUES (?, ?, ?, ?, ?, NOW(), NOW())";

            connection.query(sqlInsert, [imageUrl, user_id, description, priority, category_id], (err, result) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                return response.status(200).json({
                    success: true,
                    msg: languageMessage.supportTicketCreated,
                    data: {
                        support_ticket_id: result.insertId,
                        screenshot: imageUrl
                    }
                });

            });

        });



    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const getSupportTickets = async (request, response) => {
    try {
        const { error, value } = getUserInfoSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id } = value;

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }



            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }



            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            const query = "SELECT support_ticket_id,status, category_id, priority, description, user_id, screenshot FROM support_tickets_master WHERE delete_flag = 0 AND user_id = ? ORDER BY support_ticket_id DESC";

            connection.query(query, [user_id], (error, supportResults) => {

                if (error) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

                }

                let support_arr = [];

                if (supportResults.length === 0) {

                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, support_arr: "NA" });

                }

                if (supportResults.length > 0) {

                    for (var data of supportResults) {

                        support_arr.push({

                            support_ticket_id: data.support_ticket_id,

                            category_id: data.category_id,

                            category_id_type: "1 for General, 2 for Technical issue, 3 for Account & Login,4 for Payment $ Billing,5 for Data & Backup, 6 for Feature Request,7 Bug Report, 8 for Other ",

                            priority: data.priority,

                            priority_label: "1 for Low, 2 for medium, 3 for High, 4 for Urgent",

                            description: data.description,

                            user_id: data.user_id,

                            screenshot: data.screenshot, // Now contains Cloudinary URL

                            status: data.status,

                            status_label: "0 for Pending, 1 for In Progress, 2 for Open, 3 for Resolved",

                            createtime: moment(data.createtime).format('YYYY-MM-DD')

                        })

                    }

                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, support_arr: support_arr.length > 0 ? support_arr : "NA" });

                }

            });

        });



    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const createUserAccount = async (request, response) => {

    try {

        const { account_name, user_id, user_type } = request.body;

        if (!account_name || !user_id || !user_type) {

            return response.status(200).json({
                success: false,
                msg: ["account_name, user_id, and user_type are required"],
                key: "account_name, user_id, user_type"
            });

        }

        // Validate user_type
        if (![1, 2, 3].includes(parseInt(user_type))) {
            return response.status(200).json({
                success: false,
                msg: ["Invalid user_type. Must be 1 (Personal) or 2 (Business)"],
                key: "user_type"
            });
        }

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }

            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }

            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            // Check account limits based on user_type
            if (parseInt(user_type) === 1) {
                // Check if user already has a personal account (user_type = 1)
                const checkPersonalQuery = "SELECT user_account_id FROM user_account_master WHERE user_id = ? AND user_type = 1 AND delete_flag = 0";

                connection.query(checkPersonalQuery, [user_id], (checkError, checkResult) => {
                    if (checkError) {
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.internalServerError,
                            error: checkError.message
                        });
                    }

                    if (checkResult.length > 0) {
                        return response.status(200).json({
                            success: false,
                            msg: ["You can only create one personal account", "आप केवल एक व्यक्तिगत खाता बना सकते हैं", "तुम्ही फक्त एक वैयक्तिक खाते तयार करू शकता"],
                            key: "personal_account_limit"
                        });
                    }

                    // Create personal account
                    createAccount();
                });
            } else if (parseInt(user_type) === 2) {
                // Check if user already has 2 business accounts (user_type = 2)
                const checkBusinessQuery = "SELECT COUNT(*) as business_count FROM user_account_master WHERE user_id = ? AND user_type = 2 AND delete_flag = 0";

                connection.query(checkBusinessQuery, [user_id], (checkError, checkResult) => {
                    if (checkError) {
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.internalServerError,
                            error: checkError.message
                        });
                    }

                    const businessCount = checkResult[0].business_count;
                    if (businessCount >= 2) {
                        return response.status(200).json({
                            success: false,
                            msg: ["You can only create two business accounts", "आप केवल दो व्यापारिक खाते बना सकते हैं", "तुम्ही फक्त दोन व्यापारी खाते तयार करू शकता"],
                            key: "business_account_limit",
                            data: {
                                current_count: businessCount,
                                max_allowed: 2
                            }
                        });
                    }

                    // Create business account
                    createAccount();
                });
            } else {
                // For business (2) accounts, allow multiple
                createAccount();
            }

            function createAccount() {
                const query = "INSERT INTO user_account_master (account_name, user_id, user_type, createtime, updatetime) VALUES (?, ?, ?, NOW(), NOW())";

                connection.query(query, [account_name, user_id, user_type], (error, result) => {
                    if (error) {
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.internalServerError,
                            error: error.message
                        });
                    }

                    const accountTypeLabels = {
                        1: "Personal",
                        2: "Business",
                    };

                    return response.status(200).json({
                        success: true,
                        msg: [`${accountTypeLabels[user_type]} account created successfully`,
                        `${accountTypeLabels[user_type]} खाता सफलतापूर्वक बनाया गया`,
                        `${accountTypeLabels[user_type]} खाते यशस्वीरित्या तयार केले`],
                        data: {
                            user_account_id: result.insertId,
                            account_name: account_name,
                            user_id: user_id,
                            user_type: user_type,
                            user_type_label: accountTypeLabels[user_type]
                        }
                    });
                });
            }

        });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const getUserAccount = async (request, response) => {
    try {
        const { error, value } = getUserInfoSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id } = value;

        var sqlSelect = "SELECT user_account_id, user_id, user_type, account_name, createtime FROM user_account_master WHERE (user_id = ? OR user_type = 0) AND delete_flag = 0 ORDER BY user_account_id DESC";

        connection.query(sqlSelect, [user_id], async (error, resultUserAccount) => {

            if (error) {

                return response.status(200).json({ success: false, message: languageMessage.internalServerError, error: error.message });

            }

            var account_arr = [];

            if (resultUserAccount.length <= 0) {

                return response.status(200).json({ success: true, message: languageMessage.msgDataFound, account_arr: "NA" });

            }

            if (resultUserAccount.length > 0) {

                for (var data of resultUserAccount) {

                    account_arr.push({

                        user_account_id: data.user_account_id,

                        user_id: data.user_id,

                        account_name: data.account_name,

                        createtime: moment(data.createtime).format("DD MMM, YYYY")

                    })

                }

                return response.status(200).json({ success: true, message: languageMessage.msgDataFound, account_arr: account_arr.length > 0 ? account_arr : "NA" });

            }

        })

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const deleteUserAccount = async (request, response) => {

    const { user_account_id, user_id } = request.body;

    try {

        if (!user_account_id) {

            return response.status(200).json({ success: false, msg: ["user_account_id are required"] });

        }

        if (!user_id) {

            return response.status(200).json({ success: false, msg: ["user_id are required"] });

        }

        const query1 = "SELECT user_id, mobile, phone_code, active_flag FROM user_master WHERE delete_flag = 0 AND user_id = ?";

        connection.query(query1, [user_id], (queryError, queryResult) => {

            if (queryError) {

                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, key: "1" });

            }



            if (queryResult.length === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

            }



            if (queryResult[0].active_flag === 0) {

                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated });

            }

            // First, get all managers assigned to this business account
            const getManagersQuery = `
                        SELECT manager_id, manager_user_id 
                        FROM business_manager_master 
                        WHERE business_account_id = ? AND delete_flag = 0
                    `;

            connection.query(getManagersQuery, [user_account_id], (managersErr, managersResult) => {
                if (managersErr) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError,
                        error: managersErr.message
                    });
                }

                // Delete all managers assigned to this business account permanently
                const managerIds = managersResult.map(m => m.manager_id);
                const managerUserIds = managersResult.map(m => m.manager_user_id);

                // 1. Delete manager activity logs
                if (managerIds.length > 0) {
                    const deleteLogsQuery = `DELETE FROM manager_activity_log WHERE manager_id IN (${managerIds.map(() => '?').join(',')})`;
                    connection.query(deleteLogsQuery, managerIds, (logsErr) => {
                        if (logsErr) {
                            console.error('Error deleting manager logs:', logsErr);
                        }
                    });
                }

                // 2. Permanently delete managers from business_manager_master
                if (managerIds.length > 0) {
                    const deleteManagersQuery = `DELETE FROM business_manager_master WHERE manager_id IN (${managerIds.map(() => '?').join(',')})`;
                    connection.query(deleteManagersQuery, managerIds, (deleteManagersErr) => {
                        if (deleteManagersErr) {
                            console.error('Error deleting managers:', deleteManagersErr);
                        }
                    });
                }

                // 3. Delete business account related data
                // Delete expense/income records for this account
                const deleteExpenseIncomeQuery = "DELETE FROM expense_income_master WHERE account_id = ? AND user_id = ?";
                connection.query(deleteExpenseIncomeQuery, [user_account_id, user_id], (expErr) => {
                    if (expErr) {
                        console.error('Error deleting expense/income:', expErr);
                    }
                });

                // Delete budget records for this account
                const deleteBudgetQuery = "DELETE FROM budget_master WHERE account_id = ? AND user_id = ?";
                connection.query(deleteBudgetQuery, [user_account_id, user_id], (budgetErr) => {
                    if (budgetErr) {
                        console.error('Error deleting budgets:', budgetErr);
                    }
                });

                // Delete team members for this account
                const deleteTeamMembersQuery = "DELETE FROM team_member_master WHERE account_id = ? AND user_id = ?";
                connection.query(deleteTeamMembersQuery, [user_account_id, user_id], (teamErr) => {
                    if (teamErr) {
                        console.error('Error deleting team members:', teamErr);
                    }
                });

                // Finally, delete the business account itself
                var deleteUserAccountSql = "DELETE FROM user_account_master WHERE user_account_id = ? AND user_id = ?";

                connection.query(deleteUserAccountSql, [user_account_id, user_id], async (error, resultAccountDelete) => {
                    if (error) {
                        return response.status(200).json({
                            success: false,
                            msg: languageMessage.internalServerError,
                            error: error.message
                        });
                    }

                    return response.status(200).json({
                        success: true,
                        msg: languageMessage.accountDeletedSuccessfully,
                        data: {
                            deleted_managers_count: managerIds.length,
                            deleted_account_id: user_account_id
                        }
                    });
                });
            });

        });

    } catch (error) {

        return response.status(200).json({ success: false, message: languageMessage.internalServerError, errors: error.message });

    }

}

const getSubscriptionData = async (request, response) => {

    try {

        // Debug: Log the incoming query parameters
        console.log('getSubscriptionData - Request query:', request.query);

        const { error, value } = getUserInfoSchema.validate(request.query);

        if (error) {
            console.error('getSubscriptionData - Validation error:', error.details);
            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });
        }

        const { user_id } = value;
        console.log('getSubscriptionData - Validated user_id:', user_id);

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });

                }

                const sqlSelect = "SELECT subscription_id, description, text, amount, subscription_type, features FROM subscription_master WHERE delete_flag = 0 ORDER BY subscription_id DESC";

                connection.query(sqlSelect, async (error, subscriptionResults) => {

                    if (error) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

                    }

                    let subscription_arr = [];

                    if (subscriptionResults.length === 0) {

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, subscription_arr: "NA" });

                    }

                    if (subscriptionResults.length > 0) {

                        for (var data of subscriptionResults) {
                            // Parse features from JSON string to array
                            let featuresArray = [];
                            if (data.features) {
                                try {
                                    const parsed = JSON.parse(data.features);
                                    if (Array.isArray(parsed)) {
                                        featuresArray = parsed;
                                    }
                                } catch (e) {
                                    featuresArray = [];
                                }
                            }

                            subscription_arr.push({

                                subscription_id: data.subscription_id,

                                subscription_type: data.subscription_type,

                                subscription_type_label:
                                    data.subscription_type == 0 ? "Free or Referral" :
                                        data.subscription_type == 1 ? "Yearly" :
                                            data.subscription_type == 2 ? "Monthly" :
                                                data.subscription_type == 3 ? "Lifetime" :
                                                    data.subscription_type == 4 ? "Other" :
                                                        "Unknown",

                                description: data.description,

                                text: data.text,

                                amount: data.amount,

                                features: featuresArray,

                                createtime: moment(data.createtime).format('YYYY-MM-DD')

                            })

                        }

                        return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, subscription_arr: subscription_arr.length > 0 ? subscription_arr : "NA" });

                    }

                });

            });

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const getUserSubscription = async (request, response) => {

    try {

        const { error, value } = getUserInfoSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id } = value;

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",

            [user_id], (err, userInfo) => {

                if (err) {

                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });

                }

                if (userInfo.length === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });

                }

                if (userInfo[0].active_flag === 0) {

                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || ['Account is deactivated'], active_status: 0 });

                }

                var subscription_arr = [];
                const now = new Date();

                // Get the current active subscription (end_date > NOW()) - prioritize active subscriptions
                // If no active subscription exists, get the most recent expired subscription
                // FIXED: Join with subscription_master using subscription_id to get correct plan name
                // FIXED: Prioritize active subscriptions over expired ones
                // FIXED: Return most recently purchased active plan (by createtime/user_subscription_id), not the one with furthest end_date
                const sqlSelect = `
                            SELECT 
                                usm.user_subscription_id,
                                usm.user_id,
                                usm.subscription_id,
                                usm.amount,
                                usm.subscription_type,
                                usm.text as subscription_text,
                                usm.description as subscription_description,
                                usm.start_date,
                                usm.end_date,
                                usm.createtime,
                                usm.updatetime,
                                sm.description as plan_description,
                                sm.text as plan_text,
                                sm.amount as plan_amount,
                                CASE 
                                    WHEN usm.end_date > NOW() THEN 1 
                                    ELSE 0 
                                END as is_active_priority
                            FROM user_subscription_master usm
                            LEFT JOIN subscription_master sm ON usm.subscription_id = sm.subscription_id AND sm.delete_flag = 0
                            WHERE usm.delete_flag = 0 AND usm.user_id = ?
                            ORDER BY is_active_priority DESC, usm.user_subscription_id DESC, usm.createtime DESC
                            LIMIT 1
                        `;

                connection.query(sqlSelect, [user_id], async (error, userSubscription) => {

                    if (error) {

                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

                    }

                    if (userSubscription.length === 0) {

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.msgDataFound,
                            subscription_arr: "NA",
                            subscription_status: {
                                has_active_subscription: false,
                                can_purchase: true,
                                current_subscription: null
                            }
                        })

                    }

                    if (userSubscription.length > 0) {

                        const data = userSubscription[0];
                        const end = new Date(data.end_date);
                        const remaining_days = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
                        const isActive = end > now;

                        // Use plan name from subscription_master if available, otherwise use from user_subscription_master
                        const planName = data.plan_description || data.subscription_description || 'Unknown Plan';
                        const planText = data.plan_text || data.subscription_text || 'Unknown';

                        subscription_arr.push({
                            user_subscription_id: data.user_subscription_id,
                            user_id: data.user_id,
                            subscription_id: data.subscription_id,
                            amount: data.amount,
                            subscription_type: data.subscription_type,
                            subscription_type_label:
                                data.subscription_type == 0 ? "Free or Referral" :
                                    data.subscription_type == 1 ? "Yearly" :
                                        data.subscription_type == 2 ? "Monthly" :
                                            data.subscription_type == 3 ? "Lifetime" :
                                                data.subscription_type == 4 ? "Other" :
                                                    "Unknown",
                            plan_name: planName,
                            plan_text: planText,
                            start_date: moment(data.start_date).format("DD MMM, YYYY"),
                            end_date: moment(data.end_date).format("DD MMM, YYYY"),
                            createtime: moment(data.createtime).format("DD-MM-YYYY"),
                            remaining_days: remaining_days,
                            is_active: isActive
                        });

                        return response.status(200).json({
                            success: true,
                            msg: languageMessage.msgDataFound,
                            subscription_arr: subscription_arr,
                            subscription_status: {
                                has_active_subscription: isActive,
                                can_purchase: !isActive,
                                current_subscription: {
                                    subscription_id: data.subscription_id,
                                    user_subscription_id: data.user_subscription_id,
                                    subscription_type: data.subscription_type,
                                    plan_name: planName,
                                    plan_text: planText,
                                    amount: data.amount,
                                    start_date: data.start_date,
                                    end_date: data.end_date,
                                    days_remaining: remaining_days,
                                    is_active: isActive
                                }
                            }
                        })

                    }

                })

            })

    } catch (error) {

        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });

    }

}

const addBudget = async (request, response) => {
    const { amount, duration, budget_type, category_id, user_id, account_id } = request.body;
    try {
        if (!user_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "user_id" });
        }
        if (!account_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "account_id" });
        }
        if (!amount) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "amount" });
        }
        if (!duration) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "duration" });
        }
        if (!budget_type) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "budget_type" });
        }
        if (budget_type == 2) {
            if (!category_id) {
                return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "category_id" });
            }
        }
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
            [user_id], async (err, userInfo) => {
                if (err) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                }
                if (userInfo.length === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
                }

                if (userInfo[0].active_flag === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
                }
                const sqlInsert = `INSERT INTO budget_master (account_id,user_id, amount, duration, budget_type, category_id, createtime,updatetime) VALUES (?, ?, ?, ?, ?, ?,NOW(),NOW())`;
                const values = [account_id, user_id, amount, duration, budget_type, budget_type == 2 ? category_id : 0];
                connection.query(sqlInsert, values, (err2, result) => {
                    if (err2) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err2.message });
                    }
                    return response.status(200).json({ success: true, msg: languageMessage.BudgetAddedSuccess, budget_id: result.insertId });
                });
            }
        );
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const notificationOnOff = async (request, response) => {
    // Get user_id from body or from token (for user route)
    const user_id = request.body.user_id || request.userId || request.adminInfo?.admin_id || request.managerInfo?.user_id;
    const { notification_status } = request.body;
    try {
        if (!user_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params || ['User ID is required', 'उपयोगकर्ता ID आवश्यक है', 'वापरकर्ता ID आवश्यक आहे'], key: "user_id" });
        }
        if (notification_status === undefined || notification_status === null) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params || ['Notification status is required', 'अधिसूचना स्थिति आवश्यक है', 'सूचना स्थिती आवश्यक आहे'], key: "notification_status" });
        }
        connection.query("SELECT user_id, active_flag, notification_status FROM user_master WHERE user_id = ? AND delete_flag = 0",
            [user_id], async (err, userInfo) => {
                if (err) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                }
                if (userInfo.length === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
                }

                if (userInfo[0].active_flag === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
                }
                var updateSql = "UPDATE user_master SET notification_status = ?, updatetime = NOW() WHERE user_id = ? AND delete_flag = 0";
                connection.query(updateSql, [notification_status, user_id], async (error, resultUpdate) => {
                    if (error) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                    }
                    return response.status(200).json({ success: true, msg: notification_status == 1 ? languageMessage.notificationOn : languageMessage.notificationOff });
                })
            });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
}

const purchaseSubscription = (request, response) => {
    const { user_id, subscription_type, amount, text, description, subscription_id } = request.body;

    try {
        if (!user_id || !subscription_type || !amount || !text || !description || !subscription_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "user_id, subscription_type, amount, text, description, subscription_id" });
        }
        const now = new Date();
        let start_date = now;
        let end_date;

        // Check if user has any active subscription
        connection.query("SELECT * FROM user_subscription_master WHERE user_id = ? AND delete_flag = 0 AND end_date > NOW() ORDER BY end_date DESC",
            [user_id], (error, resultSubscription) => {
                if (error) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                }

                // If user has active subscriptions, end all of them before creating new one
                if (resultSubscription.length > 0) {
                    // End all active subscriptions by setting end_date to NOW()
                    // This ensures only one subscription is active at a time
                    const endCurrentSubQuery = "UPDATE user_subscription_master SET end_date = NOW(), updatetime = NOW() WHERE user_id = ? AND delete_flag = 0 AND end_date > NOW()";
                    connection.query(endCurrentSubQuery, [user_id], (endErr, endResult) => {
                        if (endErr) {
                            console.error('Error ending current subscriptions:', endErr);
                            return response.status(200).json({
                                success: false,
                                msg: languageMessage.internalServerError,
                                error: 'Failed to end current subscription: ' + endErr.message
                            });
                        } else {
                            console.log(`✅ Ended ${endResult.affectedRows} active subscription(s) for user ${user_id}`);

                            // After ending current subscriptions, proceed with creating new subscription
                            createNewSubscription();
                        }
                    });
                } else {
                    // No active subscription, proceed directly to create new subscription
                    createNewSubscription();
                }

                // Function to create new subscription (called after ending old ones or if no active subscription)
                function createNewSubscription() {
                    // Get validity days from subscription plan (using subscription_id instead of subscription_type)
                    const validityQuery = "SELECT validity_days FROM subscription_master WHERE subscription_id = ? AND delete_flag = 0 LIMIT 1";

                    connection.query(validityQuery, [subscription_id], (validityErr, validityResult) => {
                        if (validityErr) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: validityErr.message });
                        }

                        if (validityResult.length === 0) {
                            return response.status(200).json({ success: false, msg: languageMessage.invalideSubscriptionType });
                        }

                        const validityDays = validityResult[0].validity_days || 30; // Default to 30 days if not found
                        end_date = new Date(now.getTime() + (validityDays * 24 * 60 * 60 * 1000));

                        // Insert subscription with calculated end date
                        connection.query(`INSERT INTO user_subscription_master (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, delete_flag, createtime, updatetime, mysqltime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())`,
                            [subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date],
                            (error, resultInsert) => {
                                if (error) {
                                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                                }
                                return response.status(200).json({
                                    success: true,
                                    msg: languageMessage.subscriptionPurchaseSuccess,
                                    data: {
                                        subscription_id: resultInsert.insertId,
                                        start_date: start_date,
                                        end_date: end_date,
                                        subscription_type: subscription_type,
                                        amount: amount,
                                        validity_days: validityDays
                                    }
                                });
                            });
                    });
                }
            }
        );

    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};


const getCustomer = async (request, response) => {
    try {
        const { error, value } = getUserAccountSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id } = value;
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }
            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
            }
            const sqlSelectCustomer = "SELECT udhari_customer_id, customer_name, account_id, description, user_id, createtime FROM udhari_customer_master WHERE user_id = ? AND account_id = ? AND delete_flag = 0";
            connection.query(sqlSelectCustomer, [user_id, account_id], async (error, resultCustomer) => {
                if (error) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                }
                let customer_arr = [];
                if (resultCustomer.length <= 0) {
                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, customer_arr: "NA" });
                }
                if (resultCustomer.length > 0) {
                    for (var data of resultCustomer) {
                        customer_arr.push({
                            udhari_customer_id: data.udhari_customer_id,
                            customer_name: data.customer_name,
                            description: data.description,
                            createtime: moment(data.createtime).format("DD-MM-YYYY")
                        })
                    }
                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, customer_arr: customer_arr.length > 0 ? customer_arr : "NA" });
                }
            })
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
}

const addExpenseIncomeUdhari = async (request, response) => {
    const { user_id, category_id, amount, note, type, receivable_payable, customer_id, account_id, transaction_date, due_date } = request.body;
    try {
        if (!user_id || !category_id || !amount || !note || !type || !account_id || !transaction_date) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "user_id, category_id, amount, note, type, account_id, transaction_date" });
        }

        // Validate transaction date format and range
        const inputDate = new Date(transaction_date);
        const currentDate = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(currentDate.getFullYear() + 1);

        // Check if date is valid
        if (isNaN(inputDate.getTime())) {
            return response.status(200).json({
                success: false,
                msg: ['Invalid transaction date format', 'अमान्य लेनदेन तिथि प्रारूप', 'अवैध व्यवहार तारीख स्वरूप'],
                key: "invalid_date_format"
            });
        }

        // Check if date is within reasonable range (1 year ago to 1 year from now)
        if (inputDate < oneYearAgo || inputDate > oneYearFromNow) {
            return response.status(200).json({
                success: false,
                msg: ['Transaction date must be within reasonable range (1 year ago to 1 year from now)', 'लेनदेन तिथि उचित सीमा के भीतर होनी चाहिए (1 साल पहले से 1 साल बाद तक)', 'व्यवहार तारीख योग्य श्रेणीत असावी (1 वर्षापूर्वी ते 1 वर्षानंतर)'],
                key: "date_out_of_range"
            });
        }

        if (type == 3) {
            if (!customer_id) {
                return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "customer_id" });
            }
            if (!receivable_payable) {
                return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "receivable_payable" });
            }

            // Validate due_date if provided
            if (due_date) {
                const dueDate = new Date(due_date);
                const transactionDate = new Date(transaction_date);

                if (isNaN(dueDate.getTime())) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Invalid due date format', 'अमान्य देय तिथि प्रारूप', 'अवैध देय तारीख स्वरूप'],
                        key: "invalid_due_date_format"
                    });
                }

                if (dueDate <= transactionDate) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Due date cannot be before or same as transaction date', 'देय तारीख लेनदेन तारीख से पहले या समान नहीं हो सकती', 'देय तारीख व्यवहार तारीखपेक्षा आधी किंवा समान असू शकत नाही'],
                        key: "due_date_before_transaction"
                    });
                }
            }
        }
        let imageUrl = null;
        if (request.file) {
            // Cloudinary returns the secure_url in the file object
            imageUrl = request.file.path;
        }

        // Format the transaction date properly for MySQL
        const formattedDate = moment(transaction_date).format('YYYY-MM-DD HH:mm:ss');

        const sql = `INSERT INTO expense_income_master (account_id,user_id, type, amount, category_id, customer_id, note, image, receivable_payable, due_date, delete_flag, createtime, updatetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW())`;
        const values = [account_id, user_id, type, amount, category_id, customer_id || 0, note, imageUrl, receivable_payable || 0, due_date || null, formattedDate];
        connection.query(sql, values, async (error, result) => {
            if (error) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
            }

            // Check budget status after adding expense (only for type = 1, which is expense)
            let budgetWarning = null;
            if (type == 1) {
                try {
                    const month_year = moment(transaction_date).format('YYYY-MM');
                    // Pass the newly created expense_income_id to exclude it from the calculation
                    budgetWarning = await checkBudgetAlert(user_id, account_id, category_id, parseFloat(amount), month_year, result.insertId);
                } catch (budgetError) {
                    console.error('Budget check error:', budgetError);
                    // Don't fail the transaction if budget check fails
                }
            }

            const responseData = {
                expense_income_id: result.insertId,
                image: imageUrl
            };

            // Add budget warning if available
            if (budgetWarning) {
                responseData.budget_alert = budgetWarning;
            }

            return response.status(200).json({
                success: true,
                msg: languageMessage.ExpenseIncomeUdhariAdded,
                data: responseData
            });
        });

    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const getMonthlyTransactions = async (req, res) => {
    const { user_id, year, month, type = 0, account_id } = req.query;

    if (!user_id || !year || !account_id) {
        return res.status(200).json({ success: false, msg: "Missing user_id, year, or account_id" });
    }

    // Validate month: if provided, must be 1-12, or 0 for entire year
    if (month !== undefined && month !== null && month !== '0' && (parseInt(month) < 1 || parseInt(month) > 12)) {
        return res.status(200).json({ success: false, msg: "Month must be between 1-12, or 0 for entire year" });
    }

    try {
        let query = `
                    SELECT expense_income_id, image, category_id, type, amount, note, createtime as date, createtime, updatetime, customer_id, receivable_payable
                    FROM expense_income_master 
                    WHERE account_id = ? AND user_id = ? AND YEAR(createtime) = ? AND delete_flag = 0
                `;
        const params = [account_id, user_id, year];

        // If month is provided and not 0, filter by month
        if (month && parseInt(month) !== 0) {
            query += ` AND MONTH(createtime) = ?`;
            params.push(month);
        }

        // Filter by type if specified (1=Expense, 2=Income, 3=Udhari, 0=All)
        if (type == 1 || type == 2) {
            query += ` AND type = ?`;
            params.push(type);
        } else if (type == 3) {
            // If udhari is specifically requested, include it
            query += ` AND type = ?`;
            params.push(type);
        } else {
            // Default behavior: exclude udhari transactions (only show income and expense)
            query += ` AND type IN (1, 2)`;
        }

        query += ` ORDER BY createtime DESC`;

        connection.query(query, params, async (err, results) => {
            if (err) {
                return res.status(200).json({ success: false, msg: "DB Error", error: err.message });
            }

            let incomeTotal = 0;
            let expenseTotal = 0;
            let udhariReceivableTotal = 0;
            let udhariPayableTotal = 0;

            const transactions = await Promise.all(results.map(async (row) => {
                // Calculate totals (type: 1=Expense, 2=Income, 3=Udhari)
                if (row.type == 1) {
                    expenseTotal += parseFloat(row.amount);
                } else if (row.type == 2) {
                    incomeTotal += parseFloat(row.amount);
                } else if (row.type == 3) {
                    if (row.receivable_payable == 1) {
                        udhariReceivableTotal += parseFloat(row.amount);
                    } else if (row.receivable_payable == 2) {
                        udhariPayableTotal += parseFloat(row.amount);
                    }
                }

                // Check if this is a udhari payment transaction
                // Since we no longer add automatic notes, we need to identify udhari payments differently
                // We can check if the transaction has a customer_id and is income/expense type
                const isUdhariPayment = row.customer_id && (row.type == 1 || row.type == 2);

                // Get category details (name and image) - only for non-udhari payment transactions
                let categoryDetails = { category_name: null, category_image: null };
                if (!isUdhariPayment) {
                    categoryDetails = await getCategoryDetails(row.category_id, req);
                }

                // Prepare transaction object
                // Handle image field - use same simple logic as getReceivablePayableUdhari
                const transaction = {
                    expense_income_id: row.expense_income_id,
                    date: moment(row.date).format("DD MMM, YYYY"),
                    note: row.note,
                    amount: parseFloat(row.amount),
                    image: row.image || null, // Cloudinary URL is already complete - same as getReceivablePayableUdhari
                    category_id: isUdhariPayment ? null : row.category_id,
                    category_name: isUdhariPayment ? "udhari" : categoryDetails.category_name,
                    category_image: isUdhariPayment ? null : categoryDetails.category_image,
                    type: row.type == 1 ? "expense" : row.type == 2 ? "income" : "udhari",
                    created_at: moment(row.createtime).format("DD MMM, YYYY HH:mm A"),
                    updated_at: moment(row.updatetime).format("DD MMM, YYYY HH:mm A"),
                    is_updated: row.createtime !== row.updatetime
                };

                // Add customer information for udhari payment transactions
                if (isUdhariPayment && row.customer_id) {
                    transaction.customer_id = row.customer_id;
                    transaction.customer_name = await getCustomerDetails(row.customer_id);
                }

                // Add Udhari specific fields
                if (row.type == 3) {
                    transaction.customer_id = row.customer_id;
                    transaction.customer_name = await getCustomerDetails(row.customer_id);
                    transaction.receivable_payable = row.receivable_payable;
                    transaction.udhari_type = row.receivable_payable == 1 ? "receivable" : "payable";
                    // Image is already set above with same logic as getReceivablePayableUdhari
                }

                return transaction;
            }));

            // Prepare response data
            const responseData = {
                success: true,
                year: parseInt(year),
                month: month ? parseInt(month) : 0, // 0 means entire year
                income: incomeTotal,
                expense: expenseTotal,
                transactions: transactions.length > 0 ? transactions : "NA"
            };

            // Add Udhari totals if type=0 (all) or type=3 (udhari only)
            if (type == 0 || type == 3) {
                responseData.udhari = {
                    receivable: udhariReceivableTotal,
                    payable: udhariPayableTotal,
                    net: udhariReceivableTotal - udhariPayableTotal
                };
            }

            return res.status(200).json(responseData);
        });

    } catch (error) {
        return res.status(200).json({ success: false, msg: "Internal Server Error", error: error.message });
    }
};

async function getCategoryName(category_id) {
    return new Promise((resolve, reject) => {
        // Fetch category name even if category is deleted (delete_flag = 1)
        // This preserves category names in historical data (budgets, transactions, etc.)
        const sqlSelect = "SELECT category_name FROM category_master WHERE category_id = ?";
        connection.query(sqlSelect, [category_id], (error, resultCategory) => {
            if (error) return reject(error.message);
            resolve(resultCategory.length > 0 ? resultCategory[0].category_name : "NA");
        });
    });
}

async function getCategoryDetails(category_id, request = null) {
    return new Promise((resolve, reject) => {
        // Fetch category details even if category is deleted (delete_flag = 1)
        // This preserves category names and images in historical data (transactions, etc.)
        const sqlSelect = "SELECT category_name, icon FROM category_master WHERE category_id = ?";
        connection.query(sqlSelect, [category_id], (error, resultCategory) => {
            if (error) return reject(error.message);
            if (resultCategory.length > 0) {
                let categoryImageUrl = null;
                if (resultCategory[0].icon) {
                    // Check if it's already a Cloudinary URL or local path
                    if (resultCategory[0].icon.startsWith('http')) {
                        // It's already a Cloudinary URL
                        categoryImageUrl = resultCategory[0].icon;
                    } else {
                        // It's a local path, construct URL
                        if (process.env.BASE_URL) {
                            categoryImageUrl = `${process.env.BASE_URL}/images/${resultCategory[0].icon}`;
                        } else if (request) {
                            const baseUrl = `${request.protocol}://${request.get('host')}`;
                            categoryImageUrl = `${baseUrl}/images/${resultCategory[0].icon}`;
                        } else {
                            categoryImageUrl = `/images/${resultCategory[0].icon}`;
                        }
                    }
                }
                resolve({
                    category_name: resultCategory[0].category_name,
                    category_image: categoryImageUrl
                });
            } else {
                resolve({
                    category_name: "NA",
                    category_image: null
                });
            }
        });
    });
}

const getHomePageApi = async (req, res) => {
    const { user_id, account_id, year } = req.query;
    if (!user_id || !account_id) {
        return res.status(200).json({ success: false, msg: "Missing user_id or account_id" });
    }

    // If year is provided, use it; otherwise use current year for filtering
    const filterYear = year ? parseInt(year) : new Date().getFullYear();

    try {
        // Build WHERE clause with year filter if year is provided
        let yearFilter = '';
        let queryParams = [user_id, account_id];

        if (year) {
            yearFilter = ' AND YEAR(createtime) = ?';
            queryParams.push(filterYear);
        }

        const totalQuery = `SELECT 
                    SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) as total_income,
                    SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as total_expense,
                    SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) as total_profit,
                    SUM(CASE WHEN type = 2 AND DATE(createtime) = CURDATE() THEN amount ELSE 0 END) as daily_income,
                    SUM(CASE WHEN type = 1 AND DATE(createtime) = CURDATE() THEN amount ELSE 0 END) as daily_expense,
                    SUM(CASE WHEN type = 2 AND DATE(createtime) = CURDATE() THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 AND DATE(createtime) = CURDATE() THEN amount ELSE 0 END) as daily_profit,
                    SUM(CASE WHEN type = 2 AND YEARWEEK(createtime, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END) as weekly_income,
                    SUM(CASE WHEN type = 1 AND YEARWEEK(createtime, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END) as weekly_expense,
                    SUM(CASE WHEN type = 2 AND YEARWEEK(createtime, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 AND YEARWEEK(createtime, 1) = YEARWEEK(CURDATE(), 1) THEN amount ELSE 0 END) as weekly_profit,
                    SUM(CASE WHEN type = 2 AND MONTH(createtime) = MONTH(CURDATE()) AND YEAR(createtime) = YEAR(CURDATE()) THEN amount ELSE 0 END) as monthly_income,
                    SUM(CASE WHEN type = 1 AND MONTH(createtime) = MONTH(CURDATE()) AND YEAR(createtime) = YEAR(CURDATE()) THEN amount ELSE 0 END) as monthly_expense,
                    SUM(CASE WHEN type = 2 AND MONTH(createtime) = MONTH(CURDATE()) AND YEAR(createtime) = YEAR(CURDATE()) THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 AND MONTH(createtime) = MONTH(CURDATE()) AND YEAR(createtime) = YEAR(CURDATE()) THEN amount ELSE 0 END) as monthly_profit 
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? AND delete_flag = 0${yearFilter}`;

        connection.query(totalQuery, queryParams, (err, totalResult) => {
            if (err) return res.status(200).json({ success: false, msg: "DB Error", error: err.message });
            const data = totalResult[0];

            // Recent transactions query with year filter
            const recentQueryParams = year ? [user_id, account_id, filterYear] : [user_id, account_id];
            const recentQuery = `SELECT note, amount, type, category_id, customer_id, createtime as date, createtime, updatetime 
                        FROM expense_income_master 
                        WHERE user_id = ? AND account_id = ? AND delete_flag = 0 AND type != 3${yearFilter} 
                        ORDER BY createtime DESC`;

            connection.query(recentQuery, recentQueryParams, async (err, recentResult) => {
                if (err) return res.status(200).json({ success: false, msg: "Recent DB Error", error: err.message });

                const recent_transactions = await Promise.all(recentResult.map(async (row) => {
                    // Check if this is a udhari payment transaction
                    // Since we no longer add automatic notes, we need to identify udhari payments differently
                    // We can check if the transaction has a customer_id and is income/expense type
                    const isUdhariPayment = row.customer_id && (row.type == 1 || row.type == 2);

                    // Get category details (name and image) - only for non-udhari payment transactions
                    let categoryDetails = { category_name: null, category_image: null };
                    if (!isUdhariPayment) {
                        categoryDetails = await getCategoryDetails(row.category_id, req);
                    }

                    const transaction = {
                        note: row.note,
                        date: moment(row.date).format("DD MMM, YYYY"),
                        amount: row.amount,
                        type: row.type == 1 ? "expense" : "income",
                        category_id: isUdhariPayment ? null : row.category_id,
                        category_name: isUdhariPayment ? "udhari" : categoryDetails.category_name,
                        category_image: isUdhariPayment ? null : categoryDetails.category_image,
                        created_at: moment(row.createtime).format("DD MMM, YYYY HH:mm A"),
                        updated_at: moment(row.updatetime).format("DD MMM, YYYY HH:mm A"),
                        is_updated: row.createtime !== row.updatetime
                    };

                    // Add customer information for udhari payment transactions
                    if (isUdhariPayment && row.customer_id) {
                        transaction.customer_id = row.customer_id;
                        transaction.customer_name = await getCustomerDetails(row.customer_id);
                    }

                    return transaction;
                }));
                return res.status(200).json({
                    success: true,
                    year: filterYear,
                    total_income: data.total_income || 0,
                    total_expense: data.total_expense || 0,
                    total_profit: data.total_profit || 0,
                    daily_income: data.daily_income || 0,
                    daily_expense: data.daily_expense || 0,
                    daily_profit: data.daily_profit || 0,
                    daily_profit_percentage: (() => {
                        const income = data.daily_income || 0;
                        const expense = data.daily_expense || 0;
                        if (income > 0) {
                            const expenseRatio = Math.min(100, (expense / income) * 100);
                            return Math.max(0, 100 - expenseRatio).toFixed(1);
                        } else if (expense > 0) return "0.0";
                        else return "0.0";
                    })(),
                    daily_loss_percentage: (() => {
                        const income = data.daily_income || 0;
                        const expense = data.daily_expense || 0;
                        if (expense > income && expense > 0) {
                            return Math.min(100, ((expense - income) / expense) * 100).toFixed(1);
                        }
                        return "0.0";
                    })(),
                    weekly_income: data.weekly_income || 0,
                    weekly_expense: data.weekly_expense || 0,
                    weekly_profit: data.weekly_profit || 0,
                    weekly_profit_percentage: (() => {
                        const income = data.weekly_income || 0;
                        const expense = data.weekly_expense || 0;
                        if (income > 0) {
                            const expenseRatio = Math.min(100, (expense / income) * 100);
                            return Math.max(0, 100 - expenseRatio).toFixed(1);
                        } else if (expense > 0) return "0.0";
                        else return "0.0";
                    })(),
                    weekly_loss_percentage: (() => {
                        const income = data.weekly_income || 0;
                        const expense = data.weekly_expense || 0;
                        if (expense > income && expense > 0) {
                            return Math.min(100, ((expense - income) / expense) * 100).toFixed(1);
                        }
                        return "0.0";
                    })(),
                    monthly_income: data.monthly_income || 0,
                    monthly_expense: data.monthly_expense || 0,
                    monthly_profit: data.monthly_profit || 0,
                    monthly_profit_percentage: (() => {
                        const income = data.monthly_income || 0;
                        const expense = data.monthly_expense || 0;
                        if (income > 0) {
                            const expenseRatio = Math.min(100, (expense / income) * 100);
                            return Math.max(0, 100 - expenseRatio).toFixed(1);
                        } else if (expense > 0) return "0.0";
                        else return "0.0";
                    })(),
                    monthly_loss_percentage: (() => {
                        const income = data.monthly_income || 0;
                        const expense = data.monthly_expense || 0;
                        if (expense > income && expense > 0) {
                            return Math.min(100, ((expense - income) / expense) * 100).toFixed(1);
                        }
                        return "0.0";
                    })(),
                    recent_transactions: recent_transactions.length > 0 ? recent_transactions : "NA"
                });
            });
        });
    } catch (error) {
        return res.status(200).json({ success: false, msg: "Server Error", error: error.message });
    }
};

/**
* Helper function to check budget alerts when adding an expense
* Returns budget warning information if budget is exceeded or approaching limit
* @param {number} user_id - User ID
* @param {number} account_id - Account ID
* @param {number} category_id - Category ID of the new expense
* @param {number} expense_amount - Amount of the new expense being added
* @param {string} month_year - Month year in YYYY-MM format
* @param {number} exclude_expense_id - ID of newly added expense to exclude from calculation (optional)
*/
async function checkBudgetAlert(user_id, account_id, category_id, expense_amount, month_year, exclude_expense_id = null) {
    return new Promise((resolve, reject) => {
        // Get all relevant budgets (overall and category-specific)
        const budgetQuery = `
                    SELECT budget_id, amount, duration, budget_type, category_id
                    FROM budget_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND delete_flag = 0
                    AND (budget_type = 1 OR (budget_type = 2 AND category_id = ?))
                `;

        connection.query(budgetQuery, [user_id, account_id, category_id], async (err, budgets) => {
            if (err) return reject(err);
            if (budgets.length === 0) return resolve(null);

            const alerts = [];

            for (const budget of budgets) {
                const usageData = await calculateBudgetUsage(user_id, account_id, budget, month_year, exclude_expense_id);

                console.log('🔍 [BUDGET ALERT CHECK]');
                console.log('Current usage (excluding new expense):', usageData.amount_used);
                console.log('New expense amount:', expense_amount);
                console.log('Budget amount:', budget.amount);

                // Calculate projected usage after this expense
                const projectedUsed = usageData.amount_used + expense_amount;
                const projectedPercentage = budget.amount > 0 ? Math.round((projectedUsed / budget.amount) * 10000) / 100 : 0;
                const willExceed = projectedUsed > budget.amount;
                const projectedExcess = willExceed ? Math.round((projectedUsed - budget.amount) * 100) / 100 : 0;

                console.log('Projected usage (after this expense):', projectedUsed);
                console.log('Will exceed?', willExceed);
                console.log('Projected excess:', projectedExcess);

                // Generate alerts based on usage thresholds
                if (willExceed) {
                    // Budget will be exceeded
                    alerts.push({
                        budget_type: budget.budget_type === 1 ? 'Overall Budget' : 'Category Budget',
                        category_id: budget.category_id,
                        category_name: budget.category_id > 0 ? await getCategoryName(budget.category_id) : 'All Categories',
                        budget_amount: budget.amount,
                        amount_used: Math.round(projectedUsed * 100) / 100,
                        usage_percentage: projectedPercentage,
                        excess_amount: projectedExcess,
                        alert_type: 'exceeded',
                        message: [
                            `Budget exceeded by ₹${Math.round(projectedExcess)}`,
                            `बजट ₹${Math.round(projectedExcess)} से अधिक हो जाएगा`,
                            `बजेट ₹${Math.round(projectedExcess)} ने ओलांडले जाईल`
                        ]
                    });
                } else if (projectedPercentage >= 80) {
                    // Budget is at or above 80% (warning threshold)
                    alerts.push({
                        budget_type: budget.budget_type === 1 ? 'Overall Budget' : 'Category Budget',
                        category_id: budget.category_id,
                        category_name: budget.category_id > 0 ? await getCategoryName(budget.category_id) : 'All Categories',
                        budget_amount: budget.amount,
                        amount_used: Math.round(projectedUsed * 100) / 100,
                        usage_percentage: projectedPercentage,
                        amount_remaining: Math.round((budget.amount - projectedUsed) * 100) / 100,
                        alert_type: 'warning',
                        message: [
                            `${Math.round(projectedPercentage)}% of budget used`,
                            `बजट का ${Math.round(projectedPercentage)}% उपयोग हो चुका है`,
                            `बजेटचे ${Math.round(projectedPercentage)}% वापरले गेले`
                        ]
                    });
                }
            }

            resolve(alerts.length > 0 ? alerts : null);
        });
    });
}

const getBudget = async (request, response) => {
    try {
        const { error, value } = getUserAccountMonthSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id, month_year } = value;

        // Use current month if not provided
        const targetMonth = month_year || moment().format('YYYY-MM');
        const [year, month] = targetMonth.split('-');

        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }
            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
            }
            var sqlSelectBudget = "SELECT budget_id, user_id, account_id, amount, duration, category_id, budget_type, delete_flag, createtime FROM budget_master WHERE user_id = ? AND account_id = ? AND delete_flag = 0";
            connection.query(sqlSelectBudget, [user_id, account_id], async (error, resultBudget) => {
                if (error) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
                }
                if (resultBudget.length <= 0) {
                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, budget_arr: "NA" })
                }
                let budget_arr = [];
                if (resultBudget.length > 0) {
                    for (var data of resultBudget) {
                        // Calculate actual usage for this budget
                        const usageData = await calculateBudgetUsage(user_id, account_id, data, targetMonth);

                        budget_arr.push({
                            budget_id: data.budget_id,
                            user_id: data.user_id,
                            amount: data.amount,
                            amount_used: usageData.amount_used,
                            amount_remaining: usageData.amount_remaining,
                            usage_percentage: usageData.usage_percentage,
                            is_exceeded: usageData.is_exceeded,
                            excess_amount: usageData.excess_amount,
                            duration: data.duration,
                            duration_label: " 1 for daily, 2 for weekly, 3 for monthly, 4 for custom period",
                            category_id: data.category_id,
                            category_name: await getCategoryName(data.category_id),
                            budget_type: data.budget_type,
                            budget_type_label: "1 for overall, 2 for category-wise",
                            createtime: moment(data.createtime).format("MMMM YYYY"),
                            period_start: usageData.period_start,
                            period_end: usageData.period_end
                        })
                    }
                    return response.status(200).json({ success: true, msg: languageMessage.msgDataFound, budget_arr: budget_arr.length > 0 ? budget_arr : "NA", month_year: targetMonth })
                }
            })
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
}

/**
* Helper function to calculate budget usage based on duration and type
*/
async function calculateBudgetUsage(user_id, account_id, budget, month_year, exclude_expense_id = null) {
    return new Promise((resolve, reject) => {
        const [year, month] = month_year.split('-');
        const budgetAmount = parseFloat(budget.amount);
        let startDate, endDate;

        // Calculate date range based on budget duration
        switch (budget.duration) {
            case 1: // Daily - current day only
                startDate = moment().format('YYYY-MM-DD');
                endDate = moment().format('YYYY-MM-DD');
                break;
            case 2: // Weekly - current week
                startDate = moment().startOf('week').format('YYYY-MM-DD');
                endDate = moment().endOf('week').format('YYYY-MM-DD');
                break;
            case 3: // Monthly - specified month
                startDate = moment(`${year}-${month}-01`).format('YYYY-MM-DD');
                endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
                break;
            case 4: // Custom period - use the month provided
                startDate = moment(`${year}-${month}-01`).format('YYYY-MM-DD');
                endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
                break;
            default:
                startDate = moment(`${year}-${month}-01`).format('YYYY-MM-DD');
                endDate = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
        }

        // Build query to get actual expenses
        let expenseQuery = `
                    SELECT COALESCE(SUM(amount), 0) as total_expense
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND type = 1 
                    AND delete_flag = 0
                    AND DATE(createtime) BETWEEN ? AND ?
                `;

        const queryParams = [user_id, account_id, startDate, endDate];

        // Exclude the newly added expense to avoid double counting
        if (exclude_expense_id) {
            expenseQuery += ` AND expense_income_id != ?`;
            queryParams.push(exclude_expense_id);
        }

        // Add category filter for category-specific budgets
        if (budget.budget_type === 2 && budget.category_id > 0) {
            expenseQuery += ` AND category_id = ?`;
            queryParams.push(budget.category_id);
        }

        connection.query(expenseQuery, queryParams, (err, result) => {
            if (err) return reject(err);

            const amountUsed = parseFloat(result[0].total_expense) || 0;
            const amountRemaining = Math.max(0, budgetAmount - amountUsed);
            const usagePercentage = budgetAmount > 0 ? Math.round((amountUsed / budgetAmount) * 10000) / 100 : 0;
            const isExceeded = amountUsed > budgetAmount;
            const excessAmount = isExceeded ? Math.round((amountUsed - budgetAmount) * 100) / 100 : 0;

            resolve({
                amount_used: Math.round(amountUsed * 100) / 100,
                amount_remaining: Math.round(amountRemaining * 100) / 100,
                usage_percentage: usagePercentage,
                is_exceeded: isExceeded,
                excess_amount: excessAmount,
                period_start: startDate,
                period_end: endDate
            });
        });
    });
}

const updateBudget = async (request, response) => {
    const { budget_id, user_id, account_id, amount, duration, budget_type, category_id } = request.body;
    try {
        if (!budget_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "budget_id" });
        }
        if (!user_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "user_id" });
        }
        if (!account_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "account_id" });
        }
        if (!amount) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "amount" });
        }
        if (!duration) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "duration" });
        }
        if (!budget_type) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "budget_type" });
        }
        if (budget_type == 2) {
            if (!category_id) {
                return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "category_id" });
            }
        }

        // Check if user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }
            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
            }

            // Check if budget exists and belongs to user
            connection.query("SELECT budget_id FROM budget_master WHERE budget_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0",
                [budget_id, user_id, account_id], (err2, budgetInfo) => {
                    if (err2) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err2.message });
                    }
                    if (budgetInfo.length === 0) {
                        return response.status(200).json({ success: false, msg: ["Budget not found", "बजट नहीं मिला", "बजेट सापडले नाही"], key: "budgetNotFound" });
                    }

                    // Update budget
                    const sqlUpdate = `UPDATE budget_master SET amount = ?, duration = ?, budget_type = ?, category_id = ?, updatetime = NOW() WHERE budget_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0`;
                    const values = [amount, duration, budget_type, budget_type == 2 ? category_id : 0, budget_id, user_id, account_id];
                    connection.query(sqlUpdate, values, (err3, result) => {
                        if (err3) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err3.message });
                        }
                        if (result.affectedRows === 0) {
                            return response.status(200).json({ success: false, msg: ["Budget not found or no changes made", "बजट नहीं मिला या कोई बदलाव नहीं हुआ", "बजेट सापडले नाही किंवा बदल झाले नाहीत"], key: "budgetNotFound" });
                        }
                        return response.status(200).json({
                            success: true,
                            msg: ["Budget updated successfully", "बजट सफलतापूर्वक अपडेट हुआ", "बजेट यशस्वीरित्या अपडेट झाले"],
                            data: {
                                budget_id: budget_id,
                                affected_rows: result.affectedRows
                            }
                        });
                    });
                });
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const deleteBudget = async (request, response) => {
    const { budget_id, user_id, account_id } = request.body;
    try {
        if (!budget_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "budget_id" });
        }
        if (!user_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "user_id" });
        }
        if (!account_id) {
            return response.status(200).json({ success: false, msg: languageMessage.empt_params, key: "account_id" });
        }

        // Check if user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }
            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
            }

            // Check if budget exists and belongs to user
            connection.query("SELECT budget_id FROM budget_master WHERE budget_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0",
                [budget_id, user_id, account_id], (err2, budgetInfo) => {
                    if (err2) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err2.message });
                    }
                    if (budgetInfo.length === 0) {
                        return response.status(200).json({ success: false, msg: ["Budget not found", "बजट नहीं मिला", "बजेट सापडले नाही"], key: "budgetNotFound" });
                    }

                    // Soft delete budget
                    const sqlDelete = `UPDATE budget_master SET delete_flag = 1, updatetime = NOW() WHERE budget_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0`;
                    connection.query(sqlDelete, [budget_id, user_id, account_id], (err3, result) => {
                        if (err3) {
                            return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err3.message });
                        }
                        if (result.affectedRows === 0) {
                            return response.status(200).json({ success: false, msg: ["Budget not found", "बजट नहीं मिला", "बजेट सापडले नाही"], key: "budgetNotFound" });
                        }
                        return response.status(200).json({
                            success: true,
                            msg: ["Budget deleted successfully", "बजट सफलतापूर्वक हटाया गया", "बजेट यशस्वीरित्या हटवले"],
                            data: {
                                budget_id: budget_id,
                                affected_rows: result.affectedRows
                            }
                        });
                    });
                });
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const getUdhari = async (req, res) => {
    const { user_id, account_id } = req.query;

    if (!user_id || !account_id) {
        return res.status(200).json({ success: false, msg: "Missing user_id,  account_id" });
    }

    try {
        let query = `
                    SELECT expense_income_id, customer_id, image, category_id, type, amount, note, DATE(createtime) AS date, createtime, updatetime 
                    FROM expense_income_master 
                    WHERE type = 3 AND account_id = ? AND user_id = ? AND delete_flag = 0 AND amount > 0
                `;
        const params = [account_id, user_id];
        query += ` ORDER BY createtime DESC`;

        connection.query(query, params, async (err, results) => {
            if (err) {
                return res.status(200).json({ success: false, msg: "DB Error", error: err.message });
            }

            let incomeTotal = 0;
            let expenseTotal = 0;

            const transactions = await Promise.all(results.map(async (row) => {
                // Since this function only gets type=3 (Udhari), we don't need income/expense totals
                // But keeping for consistency if query changes in future

                return {
                    expense_income_id: row.expense_income_id,
                    date: moment(row.date).format("DD MMM, YYYY"),
                    note: row.note,
                    amount: row.amount,
                    image: row.image || null, // Cloudinary URL is already complete
                    customer_id: row.customer_id,
                    customer_name: await getCustomerDetails(row.customer_id),
                    category_name: await getCategoryName(row.category_id),
                    type: "udhari",
                    created_at: moment(row.createtime).format("DD MMM, YYYY HH:mm A"),
                    updated_at: moment(row.updatetime).format("DD MMM, YYYY HH:mm A"),
                    is_updated: row.createtime !== row.updatetime
                };
            }));

            return res.status(200).json({
                success: true,
                msg: languageMessage.msgDataFound,
                udhari_arr: transactions.length > 0 ? transactions : "NA"
            });
        });

    } catch (error) {
        return res.status(200).json({ success: false, msg: "Internal Server Error", error: error.message });
    }
};

async function getCustomerDetails(customer_id) {
    return new Promise((resolve, reject) => {
        var sqlSelect = "SELECT customer_name FROM udhari_customer_master WHERE udhari_customer_id = ? AND delete_flag = 0";
        connection.query(sqlSelect, [customer_id], async (error, customerResult) => {
            if (error) {
                reject(error.message)
            }
            resolve(customerResult.length > 0 ? customerResult[0].customer_name : "NA")
        })
    })
}

// Helper function to construct full image URL (handles both Cloudinary URLs and local paths)
function getImageUrl(filename, request = null) {
    if (!filename) return null;

    // Check if it's already a Cloudinary URL
    if (filename.startsWith('http')) {
        return filename;
    }

    // Handle local paths
    const cleanFilename = filename.startsWith('images/') ? filename.substring(7) : filename;

    if (process.env.BASE_URL) {
        // Use BASE_URL from environment variables (priority)
        return `${process.env.BASE_URL}/images/${cleanFilename}`;
    } else if (request) {
        // Fallback to request-based URL construction
        const baseUrl = `${request.protocol}://${request.get('host')}`;
        return `${baseUrl}/images/${cleanFilename}`;
    } else {
        // Final fallback to relative path
        return `/images/${cleanFilename}`;
    }
}


const getGrocery = async (request, response) => {
    try {
        const { error, value } = getUserAccountMonthSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id, year, month } = value;
        connection.query(
            "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
            [user_id],
            async (err, userInfo) => {
                if (err) {
                    return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                }

                if (userInfo.length === 0) {
                    return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
                }

                if (userInfo[0].active_flag === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.accountdeactivated,
                        active_status: 0,
                    });
                }

                let conditions = `user_id = ? AND account_id = ? AND delete_flag = 0`;
                const params = [user_id, account_id];
                if (year) {
                    conditions += ` AND YEAR(createtime) = ?`;
                    params.push(year);
                }
                if (month) {
                    conditions += ` AND MONTH(createtime) = ?`;
                    params.push(month);
                }
                const totalQuery = `SELECT SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS total_income, SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS total_expense, SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS total_profit, SUM(CASE WHEN type = 3 AND receivable_payable = 1 THEN amount ELSE 0 END) AS total_receivable, SUM(CASE WHEN type = 3 AND receivable_payable = 2 THEN amount ELSE 0 END) AS total_payable FROM expense_income_master WHERE ${conditions}`;
                connection.query(totalQuery, params, async (err, totalResult) => {
                    if (err) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
                    }
                    const data = totalResult[0] || {};
                    let monthly_profit_arr = await getMonthlyProfitArray(account_id, user_id, year);
                    let income_expense_profit_arr = await getMonthlySummary(account_id, user_id, year);
                    let business_arr = await getBusinessHealthScore(account_id, user_id, year, month)
                    return response.status(200).json({
                        success: true,
                        total_income: data.total_income || 0,
                        total_expense: data.total_expense || 0,
                        total_profit: data.total_profit || 0,
                        total_receivable: data.total_receivable || 0,
                        total_payable: data.total_payable || 0,
                        monthly_profit_arr: monthly_profit_arr,
                        income_expense_profit_arr: income_expense_profit_arr,
                        business_arr: business_arr,
                    });
                });
            }
        );
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

async function getMonthlyProfitArray(account_id, user_id, year) {
    return new Promise((resolve, reject) => {
        const query = `SELECT MONTH(createtime) AS month_num, MONTHNAME(createtime) AS month, SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS total_income, SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS total_expense, SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS profit FROM expense_income_master WHERE user_id = ? AND account_id = ? AND delete_flag = 0 AND YEAR(createtime) = ? GROUP BY MONTH(createtime) ORDER BY MONTH(createtime)
                `;
        connection.query(query, [user_id, account_id, year], (err, results) => {
            if (err) return reject(err);
            const dbData = {};
            results.forEach(row => {
                dbData[row.month_num] = {
                    month: row.month.substring(0, 3),
                    profit: row.profit || 0
                };
            });
            const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const fullResult = allMonths.map((name, index) => {
                const monthNum = index + 1;
                if (dbData[monthNum]) {
                    return dbData[monthNum];
                } else {
                    return { month: name, profit: 0 };
                }
            });
            resolve(fullResult);
        });
    });
}

async function getMonthlySummary(account_id, user_id, year) {
    return new Promise((resolve, reject) => {
        const query = `
                    SELECT 
                        MONTH(createtime) AS month_num,
                        MONTHNAME(createtime) AS month_name,
                        SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS income,
                        SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS expense,
                        SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS profit
                    FROM expense_income_master
                    WHERE user_id = ? AND account_id = ? AND delete_flag = 0 AND YEAR(createtime) = ?
                    GROUP BY MONTH(createtime)
                    ORDER BY MONTH(createtime)
                `;

        connection.query(query, [user_id, account_id, year], (err, results) => {
            if (err) return reject(err);

            // Map DB result to month number
            const dbData = {};
            results.forEach(row => {
                dbData[row.month_num] = {
                    month: row.month_name.substring(0, 3),
                    income: row.income || 0,
                    expense: row.expense || 0,
                    profit: row.profit || 0
                };
            });

            // Fill in all months with 0s if not present
            const allMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

            const finalResult = allMonths.map((monthName, index) => {
                const monthNum = index + 1;
                if (dbData[monthNum]) {
                    return dbData[monthNum];
                } else {
                    return {
                        month: monthName,
                        income: 0,
                        expense: 0,
                        profit: 0
                    };
                }
            });

            resolve(finalResult);
        });
    });
}

async function getBusinessHealthScore(account_id, user_id, year, month) {
    return new Promise((resolve, reject) => {
        let query = `SELECT SUM(CASE WHEN receivable_payable = 1 THEN amount ELSE 0 END) AS total_receivable,SUM(CASE WHEN receivable_payable = 2 THEN amount ELSE 0 END) AS total_payable FROM expense_income_master WHERE user_id = ? AND account_id = ? AND delete_flag = 0`;
        const params = [user_id, account_id];
        if (year) {
            query += ` AND YEAR(createtime) = ?`;
            params.push(year);
        }
        if (month) {
            query += ` AND MONTH(createtime) = ?`;
            params.push(month);
        }
        connection.query(query, params, (err, results) => {
            if (err) return reject(err);
            const data = results[0] || {};
            const total_receivable = data.total_receivable || 0;
            const total_payable = data.total_payable || 0;
            const receivableProfit = total_receivable - total_payable;
            let status;
            if (receivableProfit <= 0) {
                status = 'Poor';
            } else if (receivableProfit < 10000) {
                status = 'Good';
            } else {
                status = 'Excellent';
            }
            resolve({ total_receivable, total_payable, receivableProfit, status });
        });
    });
}
const getReceivablePayableUdhari = async (req, res) => {
    const { account_id, user_id, year, month } = req.query;

    if (!account_id || !user_id) {
        return res.status(200).json({ success: false, msg: languageMessage.empt_params, key: "Missing account_id or user_id" });
    }
    let query = `SELECT expense_income_id,customer_id,amount,note,image,DATE(createtime) AS date,createtime,receivable_payable,updatetime,due_date FROM expense_income_master WHERE account_id = ? AND user_id = ? AND delete_flag = 0 AND type = 3 AND amount > 0`;
    const params = [account_id, user_id];
    query += ` ORDER BY updatetime DESC, createtime DESC`;
    connection.query(query, params, async (err, results) => {
        if (err) {
            return res.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
        }

        const receivables = [];
        const payables = [];
        let totalReceivables = 0;
        let totalPayables = 0;

        for (const row of results) {
            const entry = {
                expense_income_id: row.expense_income_id,
                customer_id: row.customer_id,
                customer_name: await getCustomerDetails(row.customer_id),
                amount: parseFloat(row.amount),
                note: row.note,
                image: row.image || null, // Cloudinary URL is already complete
                date: moment(row.date).format("DD MMM, YYYY"),
                created_date: moment(row.date).format("DD MMM, YYYY"),
                due_date: row.due_date ? moment(row.due_date).format("DD MMM, YYYY") : null,
                due_date_raw: row.due_date,
                last_updated: moment(row.updatetime).format("DD MMM, YYYY HH:mm A"),
                is_updated: moment(row.createtime).format("YYYY-MM-DD HH:mm:ss") !== moment(row.updatetime).format("YYYY-MM-DD HH:mm:ss")
            };

            if (row.receivable_payable == 1) {
                receivables.push(entry);
                totalReceivables += parseFloat(row.amount);
            } else if (row.receivable_payable == 2) {
                payables.push(entry);
                totalPayables += parseFloat(row.amount);
            }
        }

        return res.status(200).json({
            success: true,
            msg: languageMessage.msgDataFound,
            receivables: receivables.length > 0 ? receivables : "NA",
            payables: payables.length > 0 ? payables : "NA",
            totals: {
                total_receivables: totalReceivables,
                total_payables: totalPayables,
                net_amount: totalReceivables - totalPayables
            }
        });
    });
};

const editCustomer = async (request, response) => {
    try {
        const { error, value } = customerEditSchema.validate(request.body);

        if (error) {
            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });
        }

        const { udhari_customer_id, user_id, customer_name, description, account_id } = value;

        // Check if user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }

            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });
            }

            // Check if customer exists and belongs to user
            connection.query("SELECT udhari_customer_id FROM udhari_customer_master WHERE udhari_customer_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0",
                [udhari_customer_id, user_id, account_id], (checkErr, checkResult) => {
                    if (checkErr) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkErr.message });
                    }

                    if (checkResult.length === 0) {
                        return response.status(200).json({ success: false, msg: "Customer not found" });
                    }

                    // Check if customer name already exists for this user and account (excluding current customer)
                    connection.query("SELECT udhari_customer_id FROM udhari_customer_master WHERE customer_name = ? AND user_id = ? AND account_id = ? AND delete_flag = 0 AND udhari_customer_id != ?",
                        [customer_name, user_id, account_id, udhari_customer_id], (duplicateErr, duplicateResult) => {
                            if (duplicateErr) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: duplicateErr.message });
                            }

                            if (duplicateResult.length > 0) {
                                return response.status(200).json({ success: false, msg: "Customer name already exists" });
                            }

                            // Update customer
                            connection.query("UPDATE udhari_customer_master SET customer_name = ?, description = ?, updatetime = NOW() WHERE udhari_customer_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0",
                                [customer_name, description, udhari_customer_id, user_id, account_id], (updateErr, updateResult) => {
                                    if (updateErr) {
                                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: updateErr.message });
                                    }

                                    if (updateResult.affectedRows === 0) {
                                        return response.status(200).json({ success: false, msg: "Customer not found or could not be updated" });
                                    }

                                    return response.status(200).json({ success: true, msg: "Customer updated successfully" });
                                });
                        });
                });
        });

    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const deleteCustomer = async (request, response) => {
    try {
        const { error, value } = customerDeleteSchema.validate(request.body);

        if (error) {
            return response.status(200).json({ success: false, message: ['Validation failed'], errors: error.details.map(d => d.message) });
        }

        const { udhari_customer_id, user_id } = value;

        // Check if user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }

            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated || 'Account is deactivated', active_status: 0 });
            }

            // Check if customer exists and belongs to user
            connection.query("SELECT udhari_customer_id FROM udhari_customer_master WHERE udhari_customer_id = ? AND user_id = ? AND delete_flag = 0",
                [udhari_customer_id, user_id], (checkErr, checkResult) => {
                    if (checkErr) {
                        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: checkErr.message });
                    }

                    if (checkResult.length === 0) {
                        return response.status(200).json({ success: false, msg: "Customer not found" });
                    }

                    // Soft delete customer
                    connection.query("UPDATE udhari_customer_master SET delete_flag = 1, updatetime = NOW() WHERE udhari_customer_id = ? AND user_id = ? AND delete_flag = 0",
                        [udhari_customer_id, user_id], (deleteErr, deleteResult) => {
                            if (deleteErr) {
                                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: deleteErr.message });
                            }

                            if (deleteResult.affectedRows === 0) {
                                return response.status(200).json({ success: false, msg: "Customer not found or could not be deleted" });
                            }

                            return response.status(200).json({ success: true, msg: "Customer deleted successfully" });
                        });
                });
        });

    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

const getUserImage = async (request, response) => {
    try {
        const { error, value } = getUserInfoSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id } = value;
        // Get user's image filename
        connection.query("SELECT image FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], (err, result) => {
            if (err) {
                return response.status(500).json({
                    success: false,
                    msg: "Database error",
                    error: err.message
                });
            }

            if (result.length === 0) {
                return response.status(404).json({
                    success: false,
                    msg: "User not found"
                });
            }

            const imageFilename = result[0].image;

            if (!imageFilename) {
                return response.status(404).json({
                    success: false,
                    msg: "No image found for this user"
                });
            }

            // Return the Cloudinary URL directly (no need to construct URL)
            return response.status(200).json({
                success: true,
                image_url: imageFilename, // This is already a complete Cloudinary URL
                image_filename: imageFilename
            });
        });

    } catch (error) {
        return response.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

const getDailyProfitLoss = async (request, response) => {
    try {
        const { error, value } = getUserAccountMonthSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id, year, month } = value;

        if (!year || !month) {
            return response.status(200).json({
                success: false,
                msg: ['Missing required parameters: year and month are required', 'आवश्यक पैरामीटर गुम: वर्ष और महीना आवश्यक है', 'आवश्यक पॅरामीटर गहाळ: वर्ष आणि महिना आवश्यक आहेत']
            });
        }
        // Validate user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }

            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }

            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.accountdeactivated || 'Account is deactivated',
                    active_status: 0
                });
            }

            // Query to get daily P&L data for the specified month
            const dailyPLQuery = `
                        SELECT 
                            DATE(createtime) AS transaction_date,
                            DAY(createtime) AS day_number,
                            SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) AS daily_income,
                            SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS daily_expense,
                            SUM(CASE WHEN type = 1 THEN amount ELSE 0 END) - SUM(CASE WHEN type = 2 THEN amount ELSE 0 END) AS daily_profit_loss
                        FROM expense_income_master 
                        WHERE user_id = ? 
                        AND account_id = ? 
                        AND YEAR(createtime) = ? 
                        AND MONTH(createtime) = ? 
                        AND type != 3 
                        AND delete_flag = 0
                        GROUP BY DATE(createtime)
                        ORDER BY DATE(createtime)
                    `;

            connection.query(dailyPLQuery, [user_id, account_id, year, month], (err, results) => {
                if (err) {
                    return response.status(200).json({
                        success: false,
                        msg: "Database error",
                        error: err.message
                    });
                }

                // Create a map of existing data
                const existingData = {};
                results.forEach(row => {
                    existingData[row.day_number] = {
                        date: moment(row.transaction_date).format("DD MMM, YYYY"),
                        day_number: row.day_number,
                        income: parseFloat(row.daily_income) || 0,
                        expense: parseFloat(row.daily_expense) || 0,
                        profit_loss: parseFloat(row.daily_profit_loss) || 0,
                        status: parseFloat(row.daily_profit_loss) >= 0 ? "profit" : "loss"
                    };
                });

                // Get total days in the month
                const daysInMonth = new Date(year, month, 0).getDate();
                const dailyPLData = [];

                // Fill in all days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                    if (existingData[day]) {
                        dailyPLData.push(existingData[day]);
                    } else {
                        dailyPLData.push({
                            date: moment(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`).format("DD MMM, YYYY"),
                            day_number: day,
                            income: 0,
                            expense: 0,
                            profit_loss: 0,
                            status: "neutral"
                        });
                    }
                }

                // Calculate monthly totals
                const monthlyTotals = {
                    total_income: dailyPLData.reduce((sum, day) => sum + day.income, 0),
                    total_expense: dailyPLData.reduce((sum, day) => sum + day.expense, 0),
                    total_profit_loss: dailyPLData.reduce((sum, day) => sum + day.profit_loss, 0),
                    profit_days: dailyPLData.filter(day => day.status === "profit").length,
                    loss_days: dailyPLData.filter(day => day.status === "loss").length,
                    neutral_days: dailyPLData.filter(day => day.status === "neutral").length
                };

                // Calculate profit and loss margin percentages
                const totalIncome = monthlyTotals.total_income || 0;
                const totalExpense = monthlyTotals.total_expense || 0;
                let profitPercentage = 0;
                let lossPercentage = 0;

                if (totalIncome > 0) {
                    const expenseRatio = Math.min(100, (totalExpense / totalIncome) * 100);
                    profitPercentage = Math.max(0, 100 - expenseRatio);
                } else if (totalExpense > 0 && totalIncome === 0) {
                    profitPercentage = 0;
                    lossPercentage = 100;
                } else if (totalIncome > 0 && totalExpense === 0) {
                    profitPercentage = 100;
                    lossPercentage = 0;
                }

                if (totalExpense > totalIncome && totalExpense > 0) {
                    lossPercentage = Math.min(100, ((totalExpense - totalIncome) / totalExpense) * 100);
                }

                return response.status(200).json({
                    success: true,
                    msg: "Daily P&L data retrieved successfully",
                    year: parseInt(year),
                    month: parseInt(month),
                    month_name: moment(`${year}-${month.toString().padStart(2, '0')}-01`).format("MMMM YYYY"),
                    daily_data: dailyPLData,
                    monthly_summary: {
                        ...monthlyTotals,
                        status: monthlyTotals.total_profit_loss >= 0 ? "profit" : "loss",
                        profit_percentage: parseFloat(profitPercentage.toFixed(2)),
                        loss_percentage: parseFloat(lossPercentage.toFixed(2))
                    }
                });
            });
        });

    } catch (error) {
        return response.status(200).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};



/**
* Get Razorpay Configuration
* Returns Razorpay configuration for frontend
*/
const getRazorpayConfig = async (request, response) => {
    try {
        return response.status(200).json({
            success: true,
            msg: ['Razorpay configuration retrieved successfully', 'Razorpay कॉन्फ़िगरेशन सफलतापूर्वक प्राप्त', 'Razorpay कॉन्फिगरेशन यशस्वीरित्या पुनर्प्राप्त'],
            data: {
                key_id: process.env.RAZORPAY_KEY_ID,
                currency: 'INR',
                name: 'Daily Hisab',
                description: 'Subscription Payment',
                image: '/images/logo.png', // Add your logo path
                theme: {
                    color: '#3399cc'
                }
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
* Update Udhari (Debt) Entry
* Updates an existing udhari receivable/payable entry
*/
const updateUdhari = async (request, response) => {
    const { expense_income_id, user_id, account_id, amount, note, receivable_payable, customer_id, category_id, transaction_date, due_date } = request.body;

    try {
        // Validate required fields
        if (!expense_income_id || !user_id || !account_id || !note || !receivable_payable || !customer_id || !category_id || !transaction_date) {
            return response.status(200).json({
                success: false,
                msg: ['Required fields are missing', 'आवश्यक फ़ील्ड गायब हैं', 'आवश्यक फील्ड गहाळ आहेत'],
                key: "expense_income_id, user_id, account_id, note, receivable_payable, customer_id, category_id, transaction_date"
            });
        }

        // Validate transaction date format and range
        const inputDate = new Date(transaction_date);
        const currentDate = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(currentDate.getFullYear() + 1);

        // Check if date is valid
        if (isNaN(inputDate.getTime())) {
            return response.status(200).json({
                success: false,
                msg: ['Invalid transaction date format', 'अमान्य लेनदेन तिथि प्रारूप', 'अवैध व्यवहार तारीख स्वरूप'],
                key: "invalid_date_format"
            });
        }

        // Check if date is within reasonable range (1 year ago to 1 year from now)
        if (inputDate < oneYearAgo || inputDate > oneYearFromNow) {
            return response.status(200).json({
                success: false,
                msg: ['Transaction date must be within reasonable range (1 year ago to 1 year from now)', 'लेनदेन तिथि उचित सीमा के भीतर होनी चाहिए', 'व्यवहार तारीख योग्य श्रेणीत असावी'],
                key: "date_out_of_range"
            });
        }

        // Validate receivable_payable value
        if (![1, 2].includes(parseInt(receivable_payable))) {
            return response.status(200).json({
                success: false,
                msg: ['receivable_payable must be 1 (receivable) or 2 (payable)', 'receivable_payable 1 (प्राप्य) या 2 (देय) होना चाहिए', 'receivable_payable 1 (प्राप्य) किंवा 2 (देय) असणे आवश्यक आहे'],
                key: "receivable_payable"
            });
        }

        // Validate amount (optional, but must be positive if provided)
        if (amount !== undefined && amount !== null && amount !== '' && (isNaN(amount) || parseFloat(amount) <= 0)) {
            return response.status(200).json({
                success: false,
                msg: ['Amount must be a positive number', 'राशि सकारात्मक संख्या होनी चाहिए', 'रक्कम सकारात्मक संख्या असणे आवश्यक आहे'],
                key: "amount"
            });
        }

        // Check if the udhari entry exists and belongs to the user
        const checkQuery = `
                    SELECT * FROM expense_income_master 
                    WHERE expense_income_id = ? AND user_id = ? AND account_id = ? AND type = 3 AND delete_flag = 0
                `;

        connection.query(checkQuery, [expense_income_id, user_id, account_id], (checkErr, checkResult) => {
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
                    msg: ['Udhari entry not found or access denied', 'उधारी प्रविष्टि नहीं मिली या पहुंच अस्वीकृत', 'उधारी प्रविष्टी सापडली नाही किंवा प्रवेश नाकारला'],
                    key: "udhari_not_found"
                });
            }

            const oldEntry = checkResult[0];
            const oldAmount = parseFloat(oldEntry.amount);
            const newAmount = (amount !== undefined && amount !== null && amount !== '') ? parseFloat(amount) : oldAmount;
            const amountDifference = newAmount - oldAmount;

            // Validate due_date if provided (after fetching oldEntry)
            if (due_date) {
                const dueDate = new Date(due_date);
                const transactionDate = new Date(transaction_date);
                const originalTransactionDate = new Date(oldEntry.createtime);
                const originalDueDate = oldEntry.due_date ? new Date(oldEntry.due_date) : null;

                if (isNaN(dueDate.getTime())) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Invalid due date format', 'अमान्य देय तिथि प्रारूप', 'अवैध देय तारीख स्वरूप'],
                        key: "invalid_due_date_format"
                    });
                }

                // Allow same date if it's the same as original due_date or original transaction_date (for same-day updates)
                const isSameDateAsOriginalDueDate = originalDueDate && moment(dueDate).format('YYYY-MM-DD') === moment(originalDueDate).format('YYYY-MM-DD');
                const isSameDateAsOriginalTransaction = moment(dueDate).format('YYYY-MM-DD') === moment(originalTransactionDate).format('YYYY-MM-DD');

                if (!isSameDateAsOriginalDueDate && !isSameDateAsOriginalTransaction && dueDate <= transactionDate) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Due date cannot be before or same as transaction date', 'देय तारीख लेनदेन तारीख से पहले या समान नहीं हो सकती', 'देय तारीख व्यवहार तारीखपेक्षा आधी किंवा समान असू शकत नाही'],
                        key: "due_date_before_transaction"
                    });
                }
            }

            // Format the transaction date properly for MySQL
            const formattedDate = moment(transaction_date).format('YYYY-MM-DD HH:mm:ss');

            // Update the udhari entry
            const updateQuery = `
                        UPDATE expense_income_master 
                        SET amount = ?, note = ?, receivable_payable = ?, customer_id = ?, category_id = ?, due_date = ?, createtime = ?, updatetime = NOW()
                        WHERE expense_income_id = ? AND user_id = ? AND account_id = ?
                    `;

            connection.query(updateQuery, [
                newAmount, note, receivable_payable, customer_id, category_id, due_date || null, formattedDate,
                expense_income_id, user_id, account_id
            ], (updateErr, updateResult) => {
                if (updateErr) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: updateErr.message
                    });
                }

                if (updateResult.affectedRows === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Failed to update udhari entry', 'उधारी प्रविष्टि अपडेट करने में विफल', 'उधारी प्रविष्टी अपडेट करण्यात अयशस्वी'],
                        key: "update_failed"
                    });
                }

                // Return success response with updated information
                return response.status(200).json({
                    success: true,
                    msg: ['Udhari entry updated successfully', 'उधारी प्रविष्टि सफलतापूर्वक अपडेट', 'उधारी प्रविष्टी यशस्वीरित्या अपडेट'],
                    data: {
                        expense_income_id: expense_income_id,
                        old_amount: oldAmount,
                        new_amount: newAmount,
                        amount_difference: amountDifference,
                        receivable_payable: receivable_payable,
                        receivable_payable_label: receivable_payable == 1 ? "Receivable" : "Payable",
                        customer_id: customer_id,
                        category_id: category_id,
                        note: note,
                        transaction_date: moment(transaction_date).format('DD MMM, YYYY'),
                        updated_at: moment().format('DD MMM, YYYY HH:mm A')
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
* Mark Udhari as Paid/Received
* When customer pays the debt, it should reflect in income/expense
*/
const markUdhariAsPaid = async (request, response) => {
    const { expense_income_id, user_id, account_id, payment_amount, payment_note, due_date } = request.body;

    try {
        // Validate required fields - payment_amount and payment_note are optional if only updating due_date
        if (!expense_income_id || !user_id || !account_id) {
            return response.status(200).json({
                success: false,
                msg: ['Required fields are missing', 'आवश्यक फ़ील्ड गायब हैं', 'आवश्यक फील्ड गहाळ आहेत'],
                key: "expense_income_id, user_id, account_id"
            });
        }

        // Check if at least one of payment_amount or due_date is provided
        const hasPayment = payment_amount && parseFloat(payment_amount) > 0;
        const hasDueDate = due_date && due_date.trim() !== '';

        if (!hasPayment && !hasDueDate) {
            return response.status(200).json({
                success: false,
                msg: ['Either payment_amount or due_date must be provided', 'या तो payment_amount या due_date प्रदान करना होगा', 'एकतर payment_amount किंवा due_date प्रदान करणे आवश्यक आहे'],
                key: "payment_amount_or_due_date_required"
            });
        }

        // If payment_amount is provided, payment_note is required
        if (hasPayment && !payment_note) {
            return response.status(200).json({
                success: false,
                msg: ['Payment note is required when payment amount is provided', 'भुगतान राशि प्रदान करने पर भुगतान नोट आवश्यक है', 'पेमेंट रक्कम प्रदान करताना पेमेंट नोट आवश्यक आहे'],
                key: "payment_note_required"
            });
        }

        // Validate due_date if provided
        if (due_date) {
            const dueDate = new Date(due_date);
            const currentDate = new Date();

            if (isNaN(dueDate.getTime())) {
                return response.status(200).json({
                    success: false,
                    msg: ['Invalid due date format', 'अमान्य देय तिथि प्रारूप', 'अवैध देय तारीख स्वरूप'],
                    key: "invalid_due_date_format"
                });
            }

            // Compare only date part (ignore time) - allow current date
            const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

            // Check if due date is in the past (not allowing past dates, but allowing current date)
            if (dueDateOnly < currentDateOnly) {
                return response.status(200).json({
                    success: false,
                    msg: ['Due date cannot be in the past', 'देय तिथि अतीत में नहीं हो सकती', 'देय तारीख भूतकाळात असू शकत नाही'],
                    key: "due_date_in_past"
                });
            }
        }

        // Get the udhari entry
        const udhariQuery = `
                    SELECT * FROM expense_income_master 
                    WHERE expense_income_id = ? AND user_id = ? AND account_id = ? AND type = 3 AND delete_flag = 0
                `;

        connection.query(udhariQuery, [expense_income_id, user_id, account_id], (udhariErr, udhariResult) => {
            if (udhariErr) {
                return response.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                    error: udhariErr.message
                });
            }

            if (udhariResult.length === 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['Udhari entry not found', 'उधारी प्रविष्टि नहीं मिली', 'उधारी प्रविष्टी सापडली नाही'],
                    key: "udhari_not_found"
                });
            }

            const udhariEntry = udhariResult[0];
            const udhariAmount = parseFloat(udhariEntry.amount);
            const paymentAmount = hasPayment ? parseFloat(payment_amount) : 0;

            // Validate payment amount if provided
            if (hasPayment) {
                if (paymentAmount > udhariAmount) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Payment amount cannot exceed udhari amount', 'भुगतान राशि उधारी राशि से अधिक नहीं हो सकती', 'पेमेंट रक्कम उधारी रक्कमपेक्षा जास्त असू शकत नाही'],
                        key: "payment_amount_exceeded"
                    });
                }
            }

            // Start transaction
            connection.beginTransaction((transactionErr) => {
                if (transactionErr) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: transactionErr.message
                    });
                }

                // If payment is being made, add income/expense entry
                if (hasPayment) {
                    // 1. Add income/expense entry for the payment
                    // Determine correct payment type based on udhari type
                    let correctPaymentType;
                    let paymentNote;

                    if (udhariEntry.receivable_payable == 1) {
                        // Customer owes you (Receivable) - when they pay, it's Income for you
                        correctPaymentType = 2; // Income (type 2)
                        paymentNote = payment_note; // Use user's note as-is
                    } else if (udhariEntry.receivable_payable == 2) {
                        // You owe customer (Payable) - when you pay, it's Expense for you
                        correctPaymentType = 1; // Expense (type 1)
                        paymentNote = payment_note; // Use user's note as-is
                    } else {
                        return connection.rollback(() => {
                            response.status(200).json({
                                success: false,
                                msg: ['Invalid udhari type', 'अमान्य उधारी प्रकार', 'अवैध उधारी प्रकार'],
                                key: "invalid_udhari_type"
                            });
                        });
                    }

                    const paymentCategoryId = correctPaymentType == 2 ? 18 : 19; // Use proper category IDs (18=income, 19=expense)

                    // Get image from original udhari entry to include in payment transaction
                    const udhariImage = udhariEntry.image || null;

                    const addPaymentQuery = `
                                INSERT INTO expense_income_master 
                                (account_id, user_id, type, amount, category_id, customer_id, note, image, receivable_payable, delete_flag, createtime, updatetime) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW())
                            `;

                    connection.query(addPaymentQuery, [
                        account_id, user_id, correctPaymentType, payment_amount, paymentCategoryId,
                        udhariEntry.customer_id, paymentNote, udhariImage
                    ], (paymentErr, paymentResult) => {
                        if (paymentErr) {
                            return connection.rollback(() => {
                                response.status(200).json({
                                    success: false,
                                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                    error: paymentErr.message
                                });
                            });
                        }

                        // 2. Update udhari entry - reduce amount or mark as paid
                        const remainingAmount = udhariAmount - paymentAmount;
                        updateUdhariWithPayment(remainingAmount, paymentResult.insertId, paymentAmount, correctPaymentType);
                    });
                } else {
                    // Only updating due_date, no payment
                    updateUdhariWithoutPayment();
                }

                // Helper function to update udhari when payment is made
                function updateUdhariWithPayment(remainingAmount, paymentId, paymentAmount, correctPaymentType) {
                    let updateUdhariQuery;
                    let updateValues;

                    if (remainingAmount <= 0) {
                        // Fully paid - mark as paid
                        if (hasDueDate) {
                            updateUdhariQuery = `
                                        UPDATE expense_income_master 
                                        SET amount = 0, note = ?, due_date = ?, updatetime = NOW()
                                        WHERE expense_income_id = ?
                                    `;
                            updateValues = [payment_note, due_date, expense_income_id];
                        } else {
                            updateUdhariQuery = `
                                        UPDATE expense_income_master 
                                        SET amount = 0, note = ?, updatetime = NOW()
                                        WHERE expense_income_id = ?
                                    `;
                            updateValues = [payment_note, expense_income_id];
                        }
                    } else {
                        // Partially paid - reduce amount
                        if (hasDueDate) {
                            updateUdhariQuery = `
                                        UPDATE expense_income_master 
                                        SET amount = ?, note = ?, due_date = ?, updatetime = NOW()
                                        WHERE expense_income_id = ?
                                    `;
                            updateValues = [remainingAmount, payment_note, due_date, expense_income_id];
                        } else {
                            updateUdhariQuery = `
                                        UPDATE expense_income_master 
                                        SET amount = ?, note = ?, updatetime = NOW()
                                        WHERE expense_income_id = ?
                                    `;
                            updateValues = [remainingAmount, payment_note, expense_income_id];
                        }
                    }

                    connection.query(updateUdhariQuery, updateValues, (updateErr, updateResult) => {
                        if (updateErr) {
                            return connection.rollback(() => {
                                response.status(200).json({
                                    success: false,
                                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                    error: updateErr.message
                                });
                            });
                        }

                        // Commit transaction
                        connection.commit((commitErr) => {
                            if (commitErr) {
                                return connection.rollback(() => {
                                    response.status(200).json({
                                        success: false,
                                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                        error: commitErr.message
                                    });
                                });
                            }

                            return response.status(200).json({
                                success: true,
                                msg: ['Payment recorded and udhari updated successfully', 'भुगतान दर्ज और उधारी अपडेट सफल', 'पेमेंट रेकॉर्ड आणि उधारी अपडेट यशस्वी'],
                                data: {
                                    payment_id: paymentId,
                                    udhari_id: expense_income_id,
                                    payment_amount: paymentAmount,
                                    remaining_amount: remainingAmount,
                                    payment_type: correctPaymentType,
                                    payment_type_label: correctPaymentType == 2 ? "Income" : "Expense",
                                    is_fully_paid: remainingAmount <= 0,
                                    customer_id: udhariEntry.customer_id,
                                    payment_date: moment().format('DD MMM, YYYY HH:mm A'),
                                    due_date: due_date || udhariEntry.due_date,
                                    due_date_updated: hasDueDate,
                                    payment_note: payment_note,
                                    udhari_note_updated: true
                                }
                            });
                        });
                    });
                }

                // Helper function to update udhari when only due_date is being updated
                function updateUdhariWithoutPayment() {
                    const updateUdhariQuery = `
                                UPDATE expense_income_master 
                                SET due_date = ?, updatetime = NOW()
                                WHERE expense_income_id = ?
                            `;

                    connection.query(updateUdhariQuery, [due_date, expense_income_id], (updateErr, updateResult) => {
                        if (updateErr) {
                            return connection.rollback(() => {
                                response.status(200).json({
                                    success: false,
                                    msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                    error: updateErr.message
                                });
                            });
                        }

                        // Commit transaction
                        connection.commit((commitErr) => {
                            if (commitErr) {
                                return connection.rollback(() => {
                                    response.status(200).json({
                                        success: false,
                                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                                        error: commitErr.message
                                    });
                                });
                            }

                            return response.status(200).json({
                                success: true,
                                msg: ['Due date updated successfully', 'देय तिथि सफलतापूर्वक अपडेट', 'देय तारीख यशस्वीरित्या अपडेट'],
                                data: {
                                    udhari_id: expense_income_id,
                                    due_date: due_date,
                                    due_date_updated: true,
                                    customer_id: udhariEntry.customer_id,
                                    updated_at: moment().format('DD MMM, YYYY HH:mm A')
                                }
                            });
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
* Update Income/Expense Transaction
*/
const updateExpenseIncome = async (request, response) => {
    try {
        const {
            expense_income_id,
            user_id,
            account_id,
            type,
            amount,
            category_id,
            customer_id,
            note,
            receivable_payable,
            transaction_date
        } = request.body;

        // Handle image upload if provided
        let imageUrl = null;
        if (request.file) {
            // Cloudinary returns the secure_url in the file object
            imageUrl = request.file.path;
        }

        // Validate required fields
        if (!expense_income_id || !user_id || !account_id) {
            return response.status(200).json({
                success: false,
                msg: ['Missing required fields', 'आवश्यक फ़ील्ड गुम', 'आवश्यक फील्ड गहाळ'],
                key: "missing_fields"
            });
        }

        // Validate transaction date if provided
        if (transaction_date) {
            const inputDate = new Date(transaction_date);
            const currentDate = new Date();

            // Check if the date is valid
            if (isNaN(inputDate.getTime())) {
                return response.status(200).json({
                    success: false,
                    msg: ['Invalid transaction date format', 'अमान्य लेनदेन तारीख प्रारूप', 'अवैध व्यवहार तारीख स्वरूप'],
                    key: "invalid_date_format"
                });
            }

            // Check if the date is not in the future
            if (inputDate > currentDate) {
                return response.status(200).json({
                    success: false,
                    msg: ['Transaction date cannot be in the future', 'लेनदेन की तारीख भविष्य में नहीं हो सकती', 'व्यवहाराची तारीख भविष्यात असू शकत नाही'],
                    key: "future_date_not_allowed"
                });
            }
        }

        // Check if transaction exists and belongs to user
        const checkQuery = `
                    SELECT * FROM expense_income_master 
                    WHERE expense_income_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0
                `;

        connection.query(checkQuery, [expense_income_id, user_id, account_id], (checkErr, checkResult) => {
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
                    msg: ['Transaction not found', 'लेनदेन नहीं मिला', 'व्यवहार सापडला नाही'],
                    key: "transaction_not_found"
                });
            }

            // Build update query dynamically
            let updateFields = [];
            let updateValues = [];

            if (type !== undefined) {
                updateFields.push('type = ?');
                updateValues.push(type);
            }
            if (amount !== undefined) {
                updateFields.push('amount = ?');
                updateValues.push(amount);
            }
            if (category_id !== undefined) {
                updateFields.push('category_id = ?');
                updateValues.push(category_id);
            }
            if (customer_id !== undefined) {
                updateFields.push('customer_id = ?');
                updateValues.push(customer_id);
            }
            if (note !== undefined) {
                updateFields.push('note = ?');
                updateValues.push(note);
            }
            if (receivable_payable !== undefined) {
                updateFields.push('receivable_payable = ?');
                updateValues.push(receivable_payable);
            }
            if (transaction_date !== undefined) {
                updateFields.push('createtime = ?');
                updateValues.push(moment(transaction_date).format('YYYY-MM-DD HH:mm:ss'));
            }
            if (imageUrl !== null) {
                updateFields.push('image = ?');
                updateValues.push(imageUrl);
            }

            if (updateFields.length === 0) {
                return response.status(200).json({
                    success: false,
                    msg: ['No fields to update', 'अपडेट करने के लिए कोई फ़ील्ड नहीं', 'अपडेट करण्यासाठी कोणतेही फील्ड नाही'],
                    key: "no_fields_to_update"
                });
            }

            updateValues.push(expense_income_id, user_id, account_id);

            const updateQuery = `
                        UPDATE expense_income_master 
                        SET ${updateFields.join(', ')}, updatetime = NOW() 
                        WHERE expense_income_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0
                    `;

            connection.query(updateQuery, updateValues, (updateErr, updateResult) => {
                if (updateErr) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: updateErr.message
                    });
                }

                if (updateResult.affectedRows === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Transaction not updated', 'लेनदेन अपडेट नहीं हुआ', 'व्यवहार अपडेट झाला नाही'],
                        key: "update_failed"
                    });
                }

                return response.status(200).json({
                    success: true,
                    msg: ['Transaction updated successfully', 'लेनदेन सफलतापूर्वक अपडेट हुआ', 'व्यवहार यशस्वीरित्या अपडेट झाले'],
                    data: {
                        expense_income_id: expense_income_id,
                        affected_rows: updateResult.affectedRows,
                        image: imageUrl
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
* Delete Income/Expense/Udhari Transaction
*/
const deleteExpenseIncome = async (request, response) => {
    try {
        const { expense_income_id, user_id, account_id } = request.body;

        // Validate required fields
        if (!expense_income_id || !user_id || !account_id) {
            return response.status(200).json({
                success: false,
                msg: ['Missing required fields', 'आवश्यक फ़ील्ड गुम', 'आवश्यक फील्ड गहाळ'],
                key: "missing_fields"
            });
        }

        // Check if transaction exists and belongs to user with detailed information
        const checkQuery = `
                    SELECT eim.*, cm.category_name, c.customer_name 
                    FROM expense_income_master eim
                    LEFT JOIN category_master cm ON eim.category_id = cm.category_id
                    LEFT JOIN udhari_customer_master c ON eim.customer_id = c.udhari_customer_id
                    WHERE eim.expense_income_id = ? AND eim.user_id = ? AND eim.account_id = ? AND eim.delete_flag = 0
                `;

        connection.query(checkQuery, [expense_income_id, user_id, account_id], (checkErr, checkResult) => {
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
                    msg: ['Transaction not found', 'लेनदेन नहीं मिला', 'व्यवहार सापडला नाही'],
                    key: "transaction_not_found"
                });
            }

            const transaction = checkResult[0];

            // Determine transaction type and prepare appropriate messages
            let transactionType, transactionTypeHindi, transactionTypeMarathi;
            let udhariType = null;

            if (transaction.type === 1) {
                transactionType = 'Expense';
                transactionTypeHindi = 'व्यय';
                transactionTypeMarathi = 'खर्च';
            } else if (transaction.type === 2) {
                transactionType = 'Income';
                transactionTypeHindi = 'आय';
                transactionTypeMarathi = 'उत्पन्न';
            } else if (transaction.type === 3) {
                transactionType = 'Udhari';
                transactionTypeHindi = 'उधारी';
                transactionTypeMarathi = 'उधारी';
                udhariType = transaction.receivable_payable === 1 ? 'Receivable' : 'Payable';
            }

            // Soft delete the transaction (sets delete_flag = 1, NOT permanent deletion)
            // This ensures:
            // 1. Data is preserved for audit/history purposes
            // 2. Reminders automatically exclude deleted transactions (all reminder queries filter by delete_flag = 0)
            // 3. Deleted udhari entries will no longer appear in collections, deadline, or debt health reminders
            const deleteQuery = `
                        UPDATE expense_income_master 
                        SET delete_flag = 1, updatetime = NOW() 
                        WHERE expense_income_id = ? AND user_id = ? AND account_id = ? AND delete_flag = 0
                    `;

            connection.query(deleteQuery, [expense_income_id, user_id, account_id], (deleteErr, deleteResult) => {
                if (deleteErr) {
                    return response.status(200).json({
                        success: false,
                        msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                        error: deleteErr.message
                    });
                }

                if (deleteResult.affectedRows === 0) {
                    return response.status(200).json({
                        success: false,
                        msg: ['Transaction not deleted', 'लेनदेन डिलीट नहीं हुआ', 'व्यवहार डिलीट झाला नाही'],
                        key: "delete_failed"
                    });
                }

                // Prepare response data
                const responseData = {
                    expense_income_id: expense_income_id,
                    transaction_type: transactionType,
                    amount: parseFloat(transaction.amount),
                    category_name: transaction.category_name,
                    note: transaction.note,
                    transaction_date: moment(transaction.date).format('DD MMM, YYYY'),
                    affected_rows: deleteResult.affectedRows,
                    delete_type: 'soft_delete', // Indicates soft delete (delete_flag = 1), not permanent
                    reminders_updated: transaction.type === 3 // True if udhari (reminders will be updated)
                };

                // Add udhari-specific data if it's an udhari transaction
                if (transaction.type === 3) {
                    responseData.udhari_type = udhariType;
                    responseData.customer_name = transaction.customer_name;
                    responseData.due_date = transaction.due_date ? moment(transaction.due_date).format('DD MMM, YYYY') : null;
                    responseData.reminder_note = 'This udhari entry will no longer appear in reminders (collections, deadlines, debt health)';
                }

                return response.status(200).json({
                    success: true,
                    msg: [
                        `${transactionType} transaction deleted successfully`,
                        `${transactionTypeHindi} लेनदेन सफलतापूर्वक डिलीट हुआ`,
                        `${transactionTypeMarathi} व्यवहार यशस्वीरित्या डिलीट झाले`
                    ],
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
* Get comprehensive reminders for user based on performance parameters
* Returns reminders for Daily Entry, Collections, Profitability, Cash Flow, Debt Health, Stock Turnover, Budget Usage
*/
const getUserReminders = async (request, response) => {
    try {
        const { error, value } = getUserAccountMonthSchema.validate(request.query);

        if (error) {
            return response.status(200).json({
                success: false,
                message: ['Validation failed', 'सत्यापन विफल', 'सत्यापन अयशस्वी'],
                errors: error.details.map(d => d.message)
            });
        }

        const { user_id, account_id, month_year } = value;

        // Use current month if not provided
        const targetMonth = month_year || moment().format('YYYY-MM');

        // Validate user exists and is active
        connection.query("SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0", [user_id], async (err, userInfo) => {
            if (err) {
                return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: err.message });
            }
            if (userInfo.length === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.msgUserNotFound });
            }
            if (userInfo[0].active_flag === 0) {
                return response.status(200).json({ success: false, msg: languageMessage.accountdeactivated, active_status: 0 });
            }

            // Get all reminders for the user
            const reminders = await generateAllReminders(user_id, account_id, targetMonth);

            return response.status(200).json({
                success: true,
                msg: ["Reminders retrieved successfully", "स्मरण पत्र सफलतापूर्वक प्राप्त हुए", "स्मरणपत्रे यशस्वीरित्या मिळाली"],
                data: {
                    month_year: targetMonth,
                    total_reminders: reminders.length,
                    reminders: reminders.length > 0 ? reminders : "NA"
                }
            });
        });
    } catch (error) {
        return response.status(200).json({ success: false, msg: languageMessage.internalServerError, error: error.message });
    }
};

/**
* Generate all reminders based on performance parameters
*/
async function generateAllReminders(user_id, account_id, month_year) {
    const reminders = [];

    try {
        // 1. Daily Entry Reminder
        const dailyEntryReminder = await checkDailyEntryReminder(user_id, account_id, month_year);
        if (dailyEntryReminder) reminders.push(dailyEntryReminder);

        // 2. Collections Reminder (Receivables and Payables)
        const collectionsReminders = await checkCollectionsReminder(user_id, account_id, month_year);
        if (collectionsReminders) {
            if (Array.isArray(collectionsReminders)) {
                reminders.push(...collectionsReminders);
            } else {
                reminders.push(collectionsReminders);
            }
        }

        // 2a. Deadline-Based Reminders (Udhari Deadlines)
        const deadlineReminders = await checkDeadlineReminders(user_id, account_id, month_year);
        reminders.push(...deadlineReminders);

        // 3. Profitability Reminder
        const profitabilityReminder = await checkProfitabilityReminder(user_id, account_id, month_year);
        if (profitabilityReminder) reminders.push(profitabilityReminder);

        // 4. Cash Flow Reminder
        const cashFlowReminder = await checkCashFlowReminder(user_id, account_id, month_year);
        if (cashFlowReminder) reminders.push(cashFlowReminder);

        // 5. Debt Health Reminder
        const debtHealthReminder = await checkDebtHealthReminder(user_id, account_id, month_year);
        if (debtHealthReminder) reminders.push(debtHealthReminder);

        // 6. Stock Turnover Reminder
        const stockTurnoverReminder = await checkStockTurnoverReminder(user_id, account_id, month_year);
        if (stockTurnoverReminder) reminders.push(stockTurnoverReminder);

        // 7. Budget Usage Reminder
        const budgetUsageReminders = await checkBudgetUsageReminders(user_id, account_id, month_year);
        reminders.push(...budgetUsageReminders);

    } catch (error) {
        console.error('Error generating reminders:', error);
    }

    return reminders;
}

/**
* Check Daily Entry reminder - alerts if user hasn't made entries TODAY
* This will be removed immediately once user adds any entry today
*/
async function checkDailyEntryReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        // Check only today's entries (for real-time responsiveness)
        const today = moment().format('YYYY-MM-DD');

        const query = `
                    SELECT COUNT(*) as entry_count
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND delete_flag = 0
                    AND DATE(createtime) = ?
                `;

        connection.query(query, [user_id, account_id, today], (err, result) => {
            if (err) return reject(err);

            const entryCount = result[0].entry_count;

            // If no entries today, create reminder
            if (entryCount === 0) {
                resolve({
                    type: "daily_entry",
                    message: [
                        `You haven't made any entries today. Start tracking your expenses!`,
                        `आपने आज कोई एंट्री नहीं की है। अपने खर्चों को ट्रैक करना शुरू करें!`,
                        `तुम्ही आज काही एंट्री केली नाही. तुमचे खर्च ट्रॅक करणे सुरू करा!`
                    ]
                });
            } else {
                resolve(null);
            }
        });
    });
}

/**
* Check Collections reminder - alerts for pending receivables and payables
*/
async function checkCollectionsReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const reminders = [];

        // Check Receivables (receivable_payable = 1)
        // Note: delete_flag = 0 ensures deleted udhari entries are automatically excluded from reminders
        const receivableQuery = `
                    SELECT 
                        COUNT(*) as pending_count,
                        COALESCE(SUM(amount), 0) as total_pending_amount
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND type = 3 
                    AND receivable_payable = 1 
                    AND delete_flag = 0
                    AND amount > 0
                `;

        connection.query(receivableQuery, [user_id, account_id], (err, receivableResult) => {
            if (err) return reject(err);

            const receivablePendingCount = receivableResult[0].pending_count;
            const receivableTotalPending = parseFloat(receivableResult[0].total_pending_amount) || 0;

            // If receivable pending amount > 1000, create reminder
            if (receivableTotalPending > 1000) {
                const customerLabel = receivablePendingCount > 1 ? 'customers' : 'customer';
                const customerLabelHi = receivablePendingCount > 1 ? 'ग्राहकों' : 'ग्राहक';
                const customerLabelMr = receivablePendingCount > 1 ? 'ग्राहकांकडून' : 'ग्राहकाकडून';

                reminders.push({
                    type: "collections",
                    message: [
                        `You have ₹${Math.round(receivableTotalPending)} pending from ${receivablePendingCount} ${customerLabel}. Follow up on collections!`,
                        `आपके पास ${receivablePendingCount} ${customerLabelHi} से ₹${Math.round(receivableTotalPending)} पेंडिंग है। कलेक्शन का फॉलोअप करें!`,
                        `तुमच्याकडे ${receivablePendingCount} ${customerLabelMr} ₹${Math.round(receivableTotalPending)} पेंडिंग आहे. कलेक्शनचा फॉलोअप करा!`
                    ]
                });
            }

            // Check Payables (receivable_payable = 2)
            // Note: delete_flag = 0 ensures deleted udhari entries are automatically excluded from reminders
            const payableQuery = `
                        SELECT 
                            COUNT(*) as pending_count,
                            COALESCE(SUM(amount), 0) as total_pending_amount
                        FROM expense_income_master 
                        WHERE user_id = ? AND account_id = ? 
                        AND type = 3 
                        AND receivable_payable = 2 
                        AND delete_flag = 0
                        AND amount > 0
                    `;

            connection.query(payableQuery, [user_id, account_id], (err, payableResult) => {
                if (err) return reject(err);

                const payablePendingCount = payableResult[0].pending_count;
                const payableTotalPending = parseFloat(payableResult[0].total_pending_amount) || 0;

                // If payable pending amount > 1000, create reminder
                if (payableTotalPending > 1000) {
                    const vendorLabel = payablePendingCount > 1 ? 'vendors/suppliers' : 'vendor/supplier';
                    const vendorLabelHi = payablePendingCount > 1 ? 'विक्रेताओं/आपूर्तिकर्ताओं' : 'विक्रेता/आपूर्तिकर्ता';
                    const vendorLabelMr = payablePendingCount > 1 ? 'विक्रेते/पुरवठादारांना' : 'विक्रेता/पुरवठादाराला';

                    reminders.push({
                        type: "payables",
                        message: [
                            `You owe ₹${Math.round(payableTotalPending)} to ${payablePendingCount} ${vendorLabel}. Plan your payments!`,
                            `आपको ${payablePendingCount} ${vendorLabelHi} को ₹${Math.round(payableTotalPending)} देय है। अपने भुगतान की योजना बनाएं!`,
                            `तुम्ही ${payablePendingCount} ${vendorLabelMr} ₹${Math.round(payableTotalPending)} देय आहात. तुमच्या पेमेंटची योजना करा!`
                        ]
                    });
                }

                resolve(reminders.length > 0 ? reminders : null);
            });
        });
    });
}

/**
* Check Deadline-Based Reminders for Udhari
* Alerts for overdue, approaching, and upcoming deadlines
*/
async function checkDeadlineReminders(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const deadlineReminders = [];

        // Query to get udhari entries with deadlines (both receivable and payable)
        // Note: eim.delete_flag = 0 ensures deleted udhari entries are automatically excluded from deadline reminders
        // When user deletes an udhari entry, it sets delete_flag = 1, so it won't appear in reminders anymore
        const query = `
                    SELECT 
                        eim.expense_income_id,
                        eim.amount,
                        eim.due_date,
                        eim.customer_id,
                        eim.receivable_payable,
                        cust.customer_name,
                        DATEDIFF(eim.due_date, CURDATE()) as days_until_due
                    FROM expense_income_master eim
                    LEFT JOIN udhari_customer_master cust ON eim.customer_id = cust.udhari_customer_id AND cust.delete_flag = 0
                    WHERE eim.user_id = ? 
                    AND eim.account_id = ? 
                    AND eim.type = 3 
                    AND eim.delete_flag = 0
                    AND eim.amount > 0
                    AND eim.due_date IS NOT NULL
                    ORDER BY eim.due_date ASC
                `;

        connection.query(query, [user_id, account_id], (err, results) => {
            if (err) return reject(err);

            if (results.length === 0) {
                return resolve([]);
            }

            // Group by deadline status and receivable_payable type
            const overdueReceivable = [];
            const approachingReceivable = []; // Within 3 days
            const upcomingReceivable = []; // Within 7 days but more than 3 days
            const overduePayable = [];
            const approachingPayable = []; // Within 3 days
            const upcomingPayable = []; // Within 7 days but more than 3 days

            results.forEach(row => {
                const daysUntilDue = row.days_until_due;
                const customerName = row.customer_name || 'Customer';
                const amount = Math.round(parseFloat(row.amount) || 0);
                const dueDate = moment(row.due_date).format('DD MMM, YYYY');
                const isReceivable = row.receivable_payable == 1;

                const entry = {
                    customer_name: customerName,
                    amount: amount,
                    due_date: dueDate,
                    days_until_due: daysUntilDue
                };

                if (daysUntilDue < 0) {
                    // Overdue
                    entry.days_overdue = Math.abs(daysUntilDue);
                    if (isReceivable) {
                        overdueReceivable.push(entry);
                    } else {
                        overduePayable.push(entry);
                    }
                } else if (daysUntilDue >= 0 && daysUntilDue <= 3) {
                    // Approaching (within 3 days including today)
                    entry.days_left = daysUntilDue;
                    if (isReceivable) {
                        approachingReceivable.push(entry);
                    } else {
                        approachingPayable.push(entry);
                    }
                } else if (daysUntilDue > 3 && daysUntilDue <= 7) {
                    // Upcoming (within 7 days but more than 3 days)
                    entry.days_left = daysUntilDue;
                    if (isReceivable) {
                        upcomingReceivable.push(entry);
                    } else {
                        upcomingPayable.push(entry);
                    }
                }
            });

            // Create reminders for receivable overdue entries
            if (overdueReceivable.length > 0) {
                const totalOverdueAmount = overdueReceivable.reduce((sum, item) => sum + item.amount, 0);
                const overdueCount = overdueReceivable.length;
                const customerNames = overdueReceivable.length <= 3
                    ? overdueReceivable.map(item => item.customer_name).join(', ')
                    : `${overdueReceivable[0].customer_name} and ${overdueCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_overdue",
                    message: [
                        `You have ₹${Math.round(totalOverdueAmount)} overdue from ${overdueCount} customer${overdueCount > 1 ? 's' : ''} (${customerNames}). Follow up immediately!`,
                        `आपके पास ${overdueCount} ग्राहक${overdueCount > 1 ? 'ों' : ''} से ₹${Math.round(totalOverdueAmount)} ओवरड्यू है (${customerNames})। तुरंत फॉलोअप करें!`,
                        `तुमच्याकडे ${overdueCount} ग्राहक${overdueCount > 1 ? 'ां' : ''}कडून ₹${Math.round(totalOverdueAmount)} ओव्हरड्यू आहे (${customerNames})। त्वरित फॉलोअप करा!`
                    ]
                });
            }

            // Create reminders for payable overdue entries
            if (overduePayable.length > 0) {
                const totalOverdueAmount = overduePayable.reduce((sum, item) => sum + item.amount, 0);
                const overdueCount = overduePayable.length;
                const customerNames = overduePayable.length <= 3
                    ? overduePayable.map(item => item.customer_name).join(', ')
                    : `${overduePayable[0].customer_name} and ${overdueCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_overdue_payable",
                    message: [
                        `You owe ₹${Math.round(totalOverdueAmount)} overdue to ${overdueCount} vendor${overdueCount > 1 ? 's' : ''} (${customerNames}). Pay immediately!`,
                        `आपको ${overdueCount} विक्रेता${overdueCount > 1 ? 'ों' : ''} को ₹${Math.round(totalOverdueAmount)} ओवरड्यू देय है (${customerNames})। तुरंत भुगतान करें!`,
                        `तुम्ही ${overdueCount} विक्रेता${overdueCount > 1 ? 'ां' : ''}ना ₹${Math.round(totalOverdueAmount)} ओव्हरड्यू देय आहात (${customerNames})। त्वरित पेमेंट करा!`
                    ]
                });
            }

            // Create reminder for receivable approaching deadlines (within 3 days)
            if (approachingReceivable.length > 0) {
                const totalApproachingAmount = approachingReceivable.reduce((sum, item) => sum + item.amount, 0);
                const approachingCount = approachingReceivable.length;
                const customerNames = approachingReceivable.length <= 3
                    ? approachingReceivable.map(item => item.customer_name).join(', ')
                    : `${approachingReceivable[0].customer_name} and ${approachingCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_approaching",
                    message: [
                        `You have ₹${Math.round(totalApproachingAmount)} due within 3 days from ${approachingCount} customer${approachingCount > 1 ? 's' : ''} (${customerNames}). Prepare for collection!`,
                        `आपके पास ${approachingCount} ग्राहक${approachingCount > 1 ? 'ों' : ''} से ₹${Math.round(totalApproachingAmount)} 3 दिनों के भीतर देय है (${customerNames})। कलेक्शन की तैयारी करें!`,
                        `तुमच्याकडे ${approachingCount} ग्राहक${approachingCount > 1 ? 'ां' : ''}कडून ₹${Math.round(totalApproachingAmount)} 3 दिवसांत देय आहे (${customerNames})। कलेक्शनची तयारी करा!`
                    ]
                });
            }

            // Create reminder for payable approaching deadlines (within 3 days)
            if (approachingPayable.length > 0) {
                const totalApproachingAmount = approachingPayable.reduce((sum, item) => sum + item.amount, 0);
                const approachingCount = approachingPayable.length;
                const customerNames = approachingPayable.length <= 3
                    ? approachingPayable.map(item => item.customer_name).join(', ')
                    : `${approachingPayable[0].customer_name} and ${approachingCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_approaching_payable",
                    message: [
                        `You owe ₹${Math.round(totalApproachingAmount)} due within 3 days to ${approachingCount} vendor${approachingCount > 1 ? 's' : ''} (${customerNames}). Plan your payment!`,
                        `आपको ${approachingCount} विक्रेता${approachingCount > 1 ? 'ों' : ''} को ₹${Math.round(totalApproachingAmount)} 3 दिनों के भीतर देय है (${customerNames})। अपने भुगतान की योजना बनाएं!`,
                        `तुम्ही ${approachingCount} विक्रेता${approachingCount > 1 ? 'ां' : ''}ना ₹${Math.round(totalApproachingAmount)} 3 दिवसांत देय आहात (${customerNames})। तुमच्या पेमेंटची योजना करा!`
                    ]
                });
            }

            // Create reminder for receivable upcoming deadlines (within 7 days)
            if (upcomingReceivable.length > 0 && upcomingReceivable.length <= 5) {
                // Only show if not too many (to avoid clutter)
                const totalUpcomingAmount = upcomingReceivable.reduce((sum, item) => sum + item.amount, 0);
                const upcomingCount = upcomingReceivable.length;
                const customerNames = upcomingReceivable.length <= 3
                    ? upcomingReceivable.map(item => item.customer_name).join(', ')
                    : `${upcomingReceivable[0].customer_name} and ${upcomingCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_upcoming",
                    message: [
                        `You have ₹${Math.round(totalUpcomingAmount)} due within 7 days from ${upcomingCount} customer${upcomingCount > 1 ? 's' : ''} (${customerNames}). Plan ahead!`,
                        `आपके पास ${upcomingCount} ग्राहक${upcomingCount > 1 ? 'ों' : ''} से ₹${Math.round(totalUpcomingAmount)} 7 दिनों के भीतर देय है (${customerNames})। आगे की योजना बनाएं!`,
                        `तुमच्याकडे ${upcomingCount} ग्राहक${upcomingCount > 1 ? 'ां' : ''}कडून ₹${Math.round(totalUpcomingAmount)} 7 दिवसांत देय आहे (${customerNames})। पुढे नियोजन करा!`
                    ]
                });
            }

            // Create reminder for payable upcoming deadlines (within 7 days)
            if (upcomingPayable.length > 0 && upcomingPayable.length <= 5) {
                // Only show if not too many (to avoid clutter)
                const totalUpcomingAmount = upcomingPayable.reduce((sum, item) => sum + item.amount, 0);
                const upcomingCount = upcomingPayable.length;
                const customerNames = upcomingPayable.length <= 3
                    ? upcomingPayable.map(item => item.customer_name).join(', ')
                    : `${upcomingPayable[0].customer_name} and ${upcomingCount - 1} others`;

                deadlineReminders.push({
                    type: "deadline_upcoming_payable",
                    message: [
                        `You owe ₹${Math.round(totalUpcomingAmount)} due within 7 days to ${upcomingCount} vendor${upcomingCount > 1 ? 's' : ''} (${customerNames}). Plan ahead!`,
                        `आपको ${upcomingCount} विक्रेता${upcomingCount > 1 ? 'ों' : ''} को ₹${Math.round(totalUpcomingAmount)} 7 दिनों के भीतर देय है (${customerNames})। आगे की योजना बनाएं!`,
                        `तुम्ही ${upcomingCount} विक्रेता${upcomingCount > 1 ? 'ां' : ''}ना ₹${Math.round(totalUpcomingAmount)} 7 दिवसांत देय आहात (${customerNames})। पुढे नियोजन करा!`
                    ]
                });
            }

            resolve(deadlineReminders);
        });
    });
}

/**
* Check Profitability reminder - alerts for low profit margins
*/
async function checkProfitabilityReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const [year, month] = month_year.split('-');

        const query = `
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 2 THEN amount ELSE 0 END), 0) as total_income,
                        COALESCE(SUM(CASE WHEN type = 1 THEN amount ELSE 0 END), 0) as total_expense
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND YEAR(COALESCE(transaction_date, createtime)) = ? 
                    AND MONTH(COALESCE(transaction_date, createtime)) = ?
                    AND delete_flag = 0
                    AND type IN (1, 2)
                `;

        connection.query(query, [user_id, account_id, year, month], (err, result) => {
            if (err) return reject(err);

            const totalIncome = parseFloat(result[0].total_income) || 0;
            const totalExpense = parseFloat(result[0].total_expense) || 0;
            const profit = totalIncome - totalExpense;

            // Calculate profit margin in 0-100% range based on income and expense ratio
            let profitMargin = 0;
            let lossMargin = 0;
            if (totalIncome > 0) {
                // Calculate expense ratio: (expenses / income) * 100, capped at 100%
                const expenseRatio = Math.min(100, (totalExpense / totalIncome) * 100);
                // Profit margin = 100 - expense ratio (0-100% range)
                // When expenses = 0, profit margin = 100%
                // When expenses >= income, profit margin = 0%
                profitMargin = Math.max(0, 100 - expenseRatio);

                // Calculate loss margin: 0% when expenses <= income, otherwise ((expenses - income) / expenses) * 100, capped at 100%
                if (totalExpense > totalIncome) {
                    lossMargin = Math.min(100, ((totalExpense - totalIncome) / totalExpense) * 100);
                }
            } else if (totalExpense > 0 && totalIncome === 0) {
                // When there's no income but there are expenses, profit margin = 0%, loss margin = 100%
                profitMargin = 0;
                lossMargin = 100;
            } else if (totalIncome > 0 && totalExpense === 0) {
                // When there's income but no expenses, profit margin = 100%, loss margin = 0%
                profitMargin = 100;
                lossMargin = 0;
            }

            // Create reminder based on loss margin or profit margin
            // Priority: If loss margin is high (>10%), show loss margin reminder, otherwise show profit margin reminder if low
            if (lossMargin > 10 && (totalIncome > 0 || totalExpense > 0)) {
                // Show loss margin reminder when loss is significant
                resolve({
                    type: "profitability",
                    message: [
                        `Your loss margin is ${lossMargin.toFixed(1)}%. Expenses exceed income significantly! Consider urgent cost reduction.`,
                        `आपका लॉस मार्जिन ${lossMargin.toFixed(1)}% है। खर्च आय से काफी अधिक है! तत्काल लागत में कटौती पर विचार करें।`,
                        `तुमचा लॉस मार्जिन ${lossMargin.toFixed(1)}% आहे. खर्च उत्पन्नापेक्षा खूप जास्त आहे! त्वरित खर्च कमी करण्याचा विचार करा.`
                    ],
                    profit_margin_percentage: profitMargin,
                    loss_margin_percentage: lossMargin,
                    reminder_type: "loss_margin"
                });
            } else if (profitMargin < 15 && (totalIncome > 0 || totalExpense > 0)) {
                // Show profit margin reminder when profit margin is low but loss margin is not high
                resolve({
                    type: "profitability",
                    message: [
                        `Your profit margin is ${profitMargin.toFixed(1)}%. Consider reducing expenses or increasing income!`,
                        `आपका प्रॉफिट मार्जिन ${profitMargin.toFixed(1)}% है। खर्च कम करने या आय बढ़ाने पर विचार करें!`,
                        `तुमचा प्रॉफिट मार्जिन ${profitMargin.toFixed(1)}% आहे. खर्च कमी करणे किंवा उत्पन्न वाढवणे विचारात घ्या!`
                    ],
                    profit_margin_percentage: profitMargin,
                    loss_margin_percentage: lossMargin,
                    reminder_type: "profit_margin"
                });
            } else {
                resolve(null);
            }
        });
    });
}

/**
* Check Cash Flow reminder - alerts for negative cash flow patterns
*/
async function checkCashFlowReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const [year, month] = month_year.split('-');

        // Check daily cash flow for the month
        const query = `
                    SELECT 
                        DATE(createtime) as date,
                        COALESCE(SUM(CASE WHEN type = 2 THEN amount ELSE 0 END), 0) as daily_income,
                        COALESCE(SUM(CASE WHEN type = 1 THEN amount ELSE 0 END), 0) as daily_expense
                    FROM expense_income_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND YEAR(createtime) = ? AND MONTH(createtime) = ?
                    AND delete_flag = 0
                    GROUP BY DATE(createtime)
                    ORDER BY date DESC
                    LIMIT 7
                `;

        connection.query(query, [user_id, account_id, year, month], (err, result) => {
            if (err) return reject(err);

            let negativeDays = 0;
            let totalDays = result.length;

            result.forEach(row => {
                const dailyProfit = parseFloat(row.daily_income) - parseFloat(row.daily_expense);
                if (dailyProfit < 0) {
                    negativeDays++;
                }
            });

            const negativePercentage = totalDays > 0 ? (negativeDays / totalDays) * 100 : 0;

            // If more than 40% of days have negative cash flow, create reminder
            if (negativePercentage > 40 && totalDays >= 3) {
                resolve({
                    type: "cash_flow",
                    message: [
                        `You had negative cash flow on ${negativeDays} out of ${totalDays} recent days. Focus on improving daily income!`,
                        `आपका ${totalDays} में से ${negativeDays} दिनों में नेगेटिव कैश फ्लो रहा। दैनिक आय बढ़ाने पर ध्यान दें!`,
                        `तुमचा ${totalDays} पैकी ${negativeDays} दिवस नकारात्मक कॅश फ्लो होता. दैनंदिन उत्पन्न सुधारण्यावर लक्ष द्या!`
                    ]
                });
            } else {
                resolve(null);
            }
        });
    });
}

/**
* Check Debt Health reminder - alerts for high debt ratios
*/
async function checkDebtHealthReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const [year, month] = month_year.split('-');

        // Note: total_income is calculated for the target month, but total_debt includes all outstanding debt
        const query = `
                    SELECT 
                        (SELECT COALESCE(SUM(amount), 0) FROM expense_income_master 
                         WHERE user_id = ? AND account_id = ? AND type = 2 
                         AND YEAR(createtime) = ? AND MONTH(createtime) = ? AND delete_flag = 0) as total_income,
                        (SELECT COALESCE(SUM(amount), 0) FROM expense_income_master 
                         WHERE user_id = ? AND account_id = ? AND type = 3 
                         AND receivable_payable = 2 AND delete_flag = 0 AND amount > 0) as total_debt
                `;

        connection.query(query, [user_id, account_id, year, month, user_id, account_id], (err, result) => {
            if (err) return reject(err);

            const totalIncome = parseFloat(result[0].total_income) || 0;
            const totalDebt = parseFloat(result[0].total_debt) || 0;
            const debtRatio = totalIncome > 0 ? (totalDebt / totalIncome) * 100 : (totalDebt > 0 ? 100 : 0);

            // If debt ratio > 30% or absolute debt is high (> 10,000 even with 0 income)
            if ((debtRatio > 30 || totalDebt > 10000) && totalDebt > 0) {
                resolve({
                    type: "debt_health",
                    message: [
                        `Your debt ratio is ${debtRatio.toFixed(1)}%. Consider reducing outstanding debts!`,
                        `आपका डेब्ट रेशियो ${debtRatio.toFixed(1)}% है। बकाया कर्ज कम करने पर विचार करें!`,
                        `तुमचे कर्ज गुणोत्तर ${debtRatio.toFixed(1)}% आहे. बाकी कर्ज कमी करण्याचा विचार करा!`
                    ]
                });
            } else {
                resolve(null);
            }
        });
    });
}

/**
* Check Stock Turnover reminder - alerts for slow inventory turnover
*/
async function checkStockTurnoverReminder(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        // This is a placeholder for stock turnover logic
        // In a real implementation, you would check stock levels and sales data
        // For now, we'll return null as stock management might not be fully implemented

        // You can implement this based on your stock management system
        resolve(null);
    });
}

/**
* Check Budget Usage reminders - alerts for budget exceeded or approaching limits
*/
async function checkBudgetUsageReminders(user_id, account_id, month_year) {
    return new Promise((resolve, reject) => {
        const targetMonth = month_year || moment().format('YYYY-MM');

        // Get all active budgets
        const budgetQuery = `
                    SELECT budget_id, amount, duration, budget_type, category_id
                    FROM budget_master 
                    WHERE user_id = ? AND account_id = ? 
                    AND delete_flag = 0
                `;

        connection.query(budgetQuery, [user_id, account_id], async (err, budgets) => {
            if (err) return reject(err);

            const reminders = [];

            for (const budget of budgets) {
                try {
                    const usageData = await calculateBudgetUsage(user_id, account_id, budget, targetMonth);

                    // Check if budget is exceeded
                    if (usageData.is_exceeded) {
                        const categoryName = budget.category_id > 0 ? await getCategoryName(budget.category_id) : 'overall';

                        reminders.push({
                            type: "budget_usage",
                            message: [
                                `Your ${categoryName} budget is exceeded by ₹${usageData.excess_amount}!`,
                                `आपका ${categoryName} बजट ₹${usageData.excess_amount} से अधिक हो गया है!`,
                                `तुमचा ${categoryName} बजेट ₹${usageData.excess_amount} ने ओलांडला आहे!`
                            ]
                        });
                    }
                    // Check if budget is approaching limit (80%+)
                    else if (usageData.usage_percentage >= 80) {
                        const categoryName = budget.category_id > 0 ? await getCategoryName(budget.category_id) : 'overall';

                        reminders.push({
                            type: "budget_usage",
                            message: [
                                `You've used ${usageData.usage_percentage}% of your ${categoryName} budget!`,
                                `आपने अपने ${categoryName} बजट का ${usageData.usage_percentage}% उपयोग कर लिया है!`,
                                `तुम्ही तुमच्या ${categoryName} बजेटचे ${usageData.usage_percentage}% वापरले आहे!`
                            ]
                        });
                    }
                } catch (error) {
                    console.error('Error checking budget usage:', error);
                }
            }

            resolve(reminders);
        });
    });
}

/**
* Export Income, Expense, and Udhari data for a selected year as CSV
* @route GET /export_data
* @param {number} user_id - User ID
* @param {number} account_id - Account ID
* @param {number} year - Year to export (e.g., 2024)
* @param {string} type - Optional: Filter by type (1=Expense, 2=Income, 3=Udhari, 0=All) - default is 0 (all)
* @returns CSV file download
*/
const exportData = async (req, res) => {
    const { user_id, account_id, year, type = 0, preview = false } = req.query;

    // Validate required parameters
    if (!user_id) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "user_id"
        });
    }

    if (!account_id) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "account_id"
        });
    }

    if (!year) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "year"
        });
    }

    // Validate year format
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(200).json({
            success: false,
            msg: ["Invalid year format", "अमान्य वर्ष प्रारूप", "अवैध वर्ष स्वरूप"],
            key: "invalid_year"
        });
    }

    try {
        // Check if user exists and is active
        const userCheck = await new Promise((resolve, reject) => {
            connection.query(
                "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
                [user_id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        if (userCheck.length === 0) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.msgUserNotFound
            });
        }

        if (userCheck[0].active_flag === 0) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.accountdeactivated,
                active_status: 0
            });
        }

        // Build query to fetch all transactions for the year
        let query = `
                    SELECT 
                        eim.expense_income_id,
                        eim.type,
                        eim.amount,
                        eim.note,
                        eim.category_id,
                        eim.customer_id,
                        eim.receivable_payable,
                        eim.due_date,
                        eim.image,
                        DATE_FORMAT(eim.createtime, '%d/%m/%Y') as transaction_date,
                        DATE_FORMAT(eim.createtime, '%d/%m/%Y %h:%i %p') as created_at,
                        DATE_FORMAT(eim.updatetime, '%d/%m/%Y %h:%i %p') as updated_at,
                        cm.category_name,
                        cust.customer_name
                    FROM expense_income_master eim
                    LEFT JOIN category_master cm ON eim.category_id = cm.category_id AND cm.delete_flag = 0
                    LEFT JOIN udhari_customer_master cust ON eim.customer_id = cust.udhari_customer_id AND cust.delete_flag = 0
                    WHERE eim.user_id = ? 
                    AND eim.account_id = ? 
                    AND YEAR(eim.createtime) = ?
                    AND eim.delete_flag = 0
                `;

        const params = [user_id, account_id, yearNum];

        // Filter by type if specified
        if (type == 1 || type == 2) {
            query += ` AND eim.type = ?`;
            params.push(type);
        } else if (type == 3) {
            query += ` AND eim.type = ?`;
            params.push(type);
        }

        query += ` ORDER BY eim.createtime DESC`;

        // Log the actual query with parameters for testing
        let testQuery = query;
        params.forEach((param, index) => {
            testQuery = testQuery.replace('?', typeof param === 'string' ? `'${param}'` : param);
        });
        console.log(`Export Data Test Query: ${testQuery}`);
        console.log(`Export Data Params: [${params.join(', ')}]`);

        // Execute query
        const transactions = await new Promise((resolve, reject) => {
            connection.query(query, params, (err, result) => {
                if (err) return reject(err);
                console.log(`Export Data Query: Found ${result.length} transactions for user ${user_id}, account ${account_id}, year ${yearNum}, type ${type}`);
                resolve(result);
            });
        });

        if (transactions.length === 0) {
            return res.status(200).json({
                success: false,
                msg: ["No data found for export", "निर्यात के लिए कोई डेटा नहीं मिला", "निर्यातसाठी डेटा सापडला नाही"],
                key: "no_data"
            });
        }

        // Format data for CSV export
        console.log(`Export Data Processing: Processing ${transactions.length} transactions for CSV export`);
        const csvData = transactions.map(row => {
            let typeLabel = '';
            if (row.type == 1) typeLabel = 'Expense';
            else if (row.type == 2) typeLabel = 'Income';
            else if (row.type == 3) typeLabel = 'Udhari';

            let receivablePayableLabel = '';
            if (row.type == 3) {
                if (row.receivable_payable == 1) receivablePayableLabel = 'Receivable (To Receive)';
                else if (row.receivable_payable == 2) receivablePayableLabel = 'Payable (To Pay)';
            }

            return {
                'Transaction ID': row.expense_income_id,
                'Date': row.transaction_date,
                'Type': typeLabel,
                'Category': row.category_name || 'N/A',
                'Customer': row.customer_name || 'N/A',
                'Amount (₹)': parseFloat(row.amount).toFixed(2),
                'Note': row.note || '',
                'Receivable/Payable': receivablePayableLabel,
                'Due Date': row.due_date ? moment(row.due_date).format('DD/MM/YYYY') : 'N/A',
                'Has Image': row.image ? 'Yes' : 'No',
                'Created At': row.created_at,
                'Updated At': row.updated_at
            };
        });

        console.log(`Export Data CSV Format: Formatted ${csvData.length} rows for CSV (all transactions included)`);

        // Calculate summary statistics
        let totalIncome = 0;
        let totalExpense = 0;
        let totalReceivable = 0;
        let totalPayable = 0;

        transactions.forEach(row => {
            const amount = parseFloat(row.amount);
            if (row.type == 1) totalExpense += amount;
            else if (row.type == 2) totalIncome += amount;
            else if (row.type == 3) {
                if (row.receivable_payable == 1) totalReceivable += amount;
                else if (row.receivable_payable == 2) totalPayable += amount;
            }
        });

        // Add summary rows at the end
        csvData.push({});
        csvData.push({ 'Transaction ID': 'SUMMARY' });
        csvData.push({ 'Transaction ID': 'Total Income', 'Amount (₹)': totalIncome.toFixed(2) });
        csvData.push({ 'Transaction ID': 'Total Expense', 'Amount (₹)': totalExpense.toFixed(2) });
        csvData.push({ 'Transaction ID': 'Net Profit/Loss', 'Amount (₹)': (totalIncome - totalExpense).toFixed(2) });
        csvData.push({ 'Transaction ID': 'Total Receivable (To Receive)', 'Amount (₹)': totalReceivable.toFixed(2) });
        csvData.push({ 'Transaction ID': 'Total Payable (To Pay)', 'Amount (₹)': totalPayable.toFixed(2) });
        csvData.push({ 'Transaction ID': 'Net Udhari', 'Amount (₹)': (totalReceivable - totalPayable).toFixed(2) });

        // Define CSV fields
        const fields = [
            'Transaction ID',
            'Date',
            'Type',
            'Category',
            'Customer',
            'Amount (₹)',
            'Note',
            'Receivable/Payable',
            'Due Date',
            'Has Image',
            'Created At',
            'Updated At'
        ];

        // Check if preview is requested
        if (preview === 'true' || preview === true) {
            return res.status(200).json({
                success: true,
                msg: ["Preview data retrieved successfully", "पूर्वावलोकन डेटा सफलतापूर्वक प्राप्त हुआ", "पूर्वावलोकन डेटा यशस्वीरित्या मिळाला"],
                preview: {
                    total_records: csvData.length,
                    export_info: {
                        year: yearNum,
                        account_id: account_id,
                        type_filter: type == 0 ? 'All' : (type == 1 ? 'Expense' : (type == 2 ? 'Income' : 'Udhari')),
                        filename: `DailyHisab_${year}_${account_id}_${Date.now()}.csv`
                    },
                    summary: {
                        total_income: totalIncome.toFixed(2),
                        total_expense: totalExpense.toFixed(2),
                        net_profit_loss: (totalIncome - totalExpense).toFixed(2),
                        total_receivable: totalReceivable.toFixed(2),
                        total_payable: totalPayable.toFixed(2),
                        net_udhari: (totalReceivable - totalPayable).toFixed(2)
                    },
                    data: csvData.slice(0, 10), // Show first 10 records as preview
                    total_records_shown: Math.min(10, csvData.length),
                    note: csvData.length > 10 ? `Showing first 10 of ${csvData.length} records. Full export will include all records.` : `Showing all ${csvData.length} records.`
                }
            });
        }

        // Generate CSV
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(csvData);

        console.log(`Export Data CSV: Generated CSV with ${csvData.length} total rows (${transactions.length} transactions + ${csvData.length - transactions.length} summary rows) for user ${user_id}, account ${account_id}, year ${yearNum}`);

        // Set response headers for file download
        const filename = `DailyHisab_${year}_${account_id}_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Send CSV without BOM for better mobile compatibility
        return res.send(csv);

    } catch (error) {
        console.error('Export error:', error);
        return res.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: error.message
        });
    }
};

/**
* Export Budget Data for a Selected Year as CSV
* @route GET /export_budget
* @param {number} user_id - User ID
* @param {number} account_id - Account ID
* @param {number} year - Year to export (e.g., 2024)
* @param {string} duration - Optional: Filter by duration (1=daily, 2=weekly, 3=monthly, 4=custom, all) - default is all
* @param {string} budget_type - Optional: Filter by type (1=overall, 2=category-wise, all) - default is all
* @returns CSV file download
*/
const exportBudget = async (req, res) => {
    const { user_id, account_id, year, duration = 'all', budget_type = 'all', preview = false } = req.query;

    // Validate required parameters
    if (!user_id) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "user_id"
        });
    }

    if (!account_id) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "account_id"
        });
    }

    if (!year) {
        return res.status(200).json({
            success: false,
            msg: languageMessage.empt_params,
            key: "year"
        });
    }

    // Validate year format
    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        return res.status(200).json({
            success: false,
            msg: ["Invalid year format", "अमान्य वर्ष प्रारूप", "अवैध वर्ष स्वरूप"],
            key: "invalid_year"
        });
    }

    try {
        // Check if user exists and is active
        const userCheck = await new Promise((resolve, reject) => {
            connection.query(
                "SELECT user_id, active_flag FROM user_master WHERE user_id = ? AND delete_flag = 0",
                [user_id],
                (err, result) => {
                    if (err) return reject(err);
                    resolve(result);
                }
            );
        });

        if (userCheck.length === 0) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.msgUserNotFound
            });
        }

        if (userCheck[0].active_flag === 0) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.accountdeactivated,
                active_status: 0
            });
        }

        // Build query to fetch budgets created in the selected year
        let query = `
                    SELECT 
                        bm.budget_id,
                        bm.user_id,
                        bm.account_id,
                        bm.amount,
                        bm.duration,
                        bm.budget_type,
                        bm.category_id,
                        DATE_FORMAT(bm.createtime, '%d/%m/%Y') as created_date,
                        DATE_FORMAT(bm.createtime, '%d/%m/%Y %h:%i %p') as created_at,
                        DATE_FORMAT(bm.updatetime, '%d/%m/%Y %h:%i %p') as updated_at,
                        cm.category_name
                    FROM budget_master bm
                    LEFT JOIN category_master cm ON bm.category_id = cm.category_id AND cm.delete_flag = 0
                    WHERE bm.user_id = ? 
                    AND bm.account_id = ?
                    AND YEAR(bm.createtime) = ?
                    AND bm.delete_flag = 0
                `;

        const params = [user_id, account_id, yearNum];

        // Filter by duration if specified
        if (duration !== 'all') {
            query += ` AND bm.duration = ?`;
            params.push(parseInt(duration));
        }

        // Filter by budget_type if specified
        if (budget_type !== 'all') {
            query += ` AND bm.budget_type = ?`;
            params.push(parseInt(budget_type));
        }

        query += ` ORDER BY bm.createtime DESC`;

        // Execute query
        const budgets = await new Promise((resolve, reject) => {
            connection.query(query, params, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        if (budgets.length === 0) {
            return res.status(200).json({
                success: false,
                msg: ["No budgets found for export", "निर्यात के लिए कोई बजट नहीं मिला", "निर्यातसाठी कोणतेही बजेट सापडले नाही"],
                key: "no_data"
            });
        }

        // Calculate usage for each budget across all months of the year
        const csvDataPromises = budgets.map(async (budget) => {
            const durationLabel = budget.duration == 1 ? 'Daily' :
                budget.duration == 2 ? 'Weekly' :
                    budget.duration == 3 ? 'Monthly' : 'Custom';

            const budgetTypeLabel = budget.budget_type == 1 ? 'Overall' : 'Category-wise';

            // Calculate usage for each month of the year
            const monthlyUsage = [];
            let totalUsed = 0;
            let totalExceeded = 0;

            for (let month = 1; month <= 12; month++) {
                const monthYear = `${yearNum}-${month.toString().padStart(2, '0')}`;
                try {
                    const usageData = await calculateBudgetUsage(user_id, account_id, budget, monthYear);
                    monthlyUsage.push(usageData);
                    totalUsed += usageData.amount_used;
                    if (usageData.is_exceeded) {
                        totalExceeded += usageData.excess_amount;
                    }
                } catch (error) {
                    console.error(`Error calculating budget usage for ${monthYear}:`, error);
                    monthlyUsage.push({
                        amount_used: 0,
                        usage_percentage: 0,
                        is_exceeded: false,
                        excess_amount: 0
                    });
                }
            }

            // Calculate average monthly usage
            const avgMonthlyUsage = totalUsed / 12;
            const avgUsagePercentage = budget.amount > 0 ? Math.round((avgMonthlyUsage / budget.amount) * 100) : 0;

            return {
                'Budget ID': budget.budget_id,
                'Budget Type': budgetTypeLabel,
                'Category': budget.budget_type == 2 ? (budget.category_name || 'N/A') : 'All Categories',
                'Budget Amount (₹)': parseFloat(budget.amount).toFixed(2),
                'Duration': durationLabel,
                'Total Used in Year (₹)': totalUsed.toFixed(2),
                'Average Monthly Usage (₹)': avgMonthlyUsage.toFixed(2),
                'Average Usage %': avgUsagePercentage + '%',
                'Times Exceeded': monthlyUsage.filter(m => m.is_exceeded).length,
                'Total Exceeded Amount (₹)': totalExceeded.toFixed(2),
                'Created Date': budget.created_date,
                'Created At': budget.created_at,
                'Updated At': budget.updated_at
            };
        });

        const csvData = await Promise.all(csvDataPromises);

        // Calculate summary statistics
        let totalBudgetAmount = 0;
        let totalUsedInYear = 0;
        let overallBudgets = 0;
        let categoryBudgets = 0;
        let totalExceededAmount = 0;
        let budgetsExceeded = 0;

        budgets.forEach((budget, index) => {
            totalBudgetAmount += parseFloat(budget.amount);
            if (budget.budget_type == 1) overallBudgets++;
            else categoryBudgets++;

            const usedAmount = parseFloat(csvData[index]['Total Used in Year (₹)']);
            totalUsedInYear += usedAmount;

            const exceeded = parseFloat(csvData[index]['Total Exceeded Amount (₹)']);
            if (exceeded > 0) {
                totalExceededAmount += exceeded;
                budgetsExceeded++;
            }
        });

        // Add summary rows at the end
        csvData.push({});
        csvData.push({ 'Budget ID': 'SUMMARY' });
        csvData.push({ 'Budget ID': 'Total Budgets', 'Budget Amount (₹)': budgets.length });
        csvData.push({ 'Budget ID': 'Total Budget Amount', 'Budget Amount (₹)': totalBudgetAmount.toFixed(2) });
        csvData.push({ 'Budget ID': 'Total Used in Year', 'Budget Amount (₹)': totalUsedInYear.toFixed(2) });
        csvData.push({ 'Budget ID': 'Total Exceeded Amount', 'Budget Amount (₹)': totalExceededAmount.toFixed(2) });
        csvData.push({});
        csvData.push({ 'Budget ID': 'BUDGET TYPES' });
        csvData.push({ 'Budget ID': 'Overall Budgets', 'Budget Amount (₹)': overallBudgets });
        csvData.push({ 'Budget ID': 'Category-wise Budgets', 'Budget Amount (₹)': categoryBudgets });
        csvData.push({});
        csvData.push({ 'Budget ID': 'PERFORMANCE' });
        csvData.push({ 'Budget ID': 'Budgets Exceeded', 'Budget Amount (₹)': budgetsExceeded });
        csvData.push({ 'Budget ID': 'Budgets Within Limit', 'Budget Amount (₹)': budgets.length - budgetsExceeded });
        csvData.push({ 'Budget ID': 'Success Rate', 'Budget Amount (₹)': budgets.length > 0 ? Math.round(((budgets.length - budgetsExceeded) / budgets.length) * 100) + '%' : '0%' });

        // Define CSV fields
        const fields = [
            'Budget ID',
            'Budget Type',
            'Category',
            'Budget Amount (₹)',
            'Duration',
            'Total Used in Year (₹)',
            'Average Monthly Usage (₹)',
            'Average Usage %',
            'Times Exceeded',
            'Total Exceeded Amount (₹)',
            'Created Date',
            'Created At',
            'Updated At'
        ];

        // Check if preview is requested
        if (preview === 'true' || preview === true) {
            return res.status(200).json({
                success: true,
                msg: ["Preview data retrieved successfully", "पूर्वावलोकन डेटा सफलतापूर्वक प्राप्त हुआ", "पूर्वावलोकन डेटा यशस्वीरित्या मिळाला"],
                preview: {
                    total_records: csvData.length,
                    export_info: {
                        year: yearNum,
                        account_id: account_id,
                        duration_filter: duration,
                        budget_type_filter: budget_type,
                        filename: `DailyHisab_Budget_${year}_Account${account_id}_${Date.now()}.csv`
                    },
                    summary: {
                        total_budgets: budgets.length,
                        total_budget_amount: totalBudgetAmount.toFixed(2),
                        total_used_in_year: totalUsedInYear.toFixed(2),
                        total_exceeded_amount: totalExceededAmount.toFixed(2),
                        overall_budgets: overallBudgets,
                        category_wise_budgets: categoryBudgets,
                        budgets_exceeded: budgetsExceeded,
                        budgets_within_limit: budgets.length - budgetsExceeded,
                        success_rate: budgets.length > 0 ? Math.round(((budgets.length - budgetsExceeded) / budgets.length) * 100) + '%' : '0%'
                    },
                    data: csvData.slice(0, 15), // Show first 15 records as preview
                    total_records_shown: Math.min(15, csvData.length),
                    note: csvData.length > 15 ? `Showing first 15 of ${csvData.length} records. Full export will include all records.` : `Showing all ${csvData.length} records.`
                }
            });
        }

        // Generate CSV
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(csvData);

        // Set response headers for file download
        const filename = `DailyHisab_Budget_${year}_Account${account_id}_${Date.now()}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Send CSV without BOM for better mobile compatibility
        return res.send(csv);

    } catch (error) {
        console.error('Export budget error:', error);
        return res.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: error.message
        });
    }
};

export { addExpenseIncomeUdhari, addBudget, updateBudget, deleteBudget, setAppLock, updateAppLock, addCategory, getUserCategory, editCategory, deleteCategory, getAllCategory, getFaq, addCustomers, getTeamMembers, deleteTeamMember, editTeamMember, addTeamMember, removeAppLock, createSupportTicket, getSupportTickets, createUserAccount, getSubscriptionData, getUserSubscription, getUserAccount, deleteUserAccount, notificationOnOff, purchaseSubscription, getCustomer, getMonthlyTransactions, getHomePageApi, getBudget, getUdhari, getGrocery, getReceivablePayableUdhari, editCustomer, deleteCustomer, getDailyProfitLoss, getUserImage, getRazorpayConfig, updateUdhari, markUdhariAsPaid, updateExpenseIncome, deleteExpenseIncome, getUserReminders, exportData, exportBudget };
