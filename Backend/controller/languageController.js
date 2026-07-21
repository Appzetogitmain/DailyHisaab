import connection from '../connection/dbConfig.js';
import languageMessage from './languageMessage.js';

// Get all languages (for admin and user app)
export const getLanguages = (req, res) => {
    // Ordered by name
    const query = `SELECT * FROM language_master ORDER BY name ASC`;

    connection.query(query, (error, results) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }
        res.status(200).json({
            success: true,
            data: results
        });
    });
};

// Add a new language (Admin only)
export const addLanguage = (req, res) => {
    const { code, name, native_name } = req.body;

    // Check if language code already exists
    const checkQuery = `SELECT * FROM language_master WHERE code = ?`;

    connection.query(checkQuery, [code], (checkError, checkResult) => {
        if (checkError) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: checkError.message
            });
        }

        if (checkResult.length > 0) {
            return res.status(200).json({
                success: false,
                msg: ['Language code already exists', 'भाषा कोड पहले से मौजूद है', 'भाषा कोड आधीच अस्तित्वात आहे']
            });
        }

        // Using 'created_at' and 'updated_at' matching the database schema
        const insertQuery = `INSERT INTO language_master (code, name, native_name, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, NOW(), NOW())`;

        connection.query(insertQuery, [code, name, native_name], (insertError, result) => {
            if (insertError) {
                return res.status(200).json({
                    success: false,
                    msg: languageMessage.internalServerError,
                    error: insertError.message
                });
            }
            res.status(200).json({
                success: true,
                msg: ['Language added successfully', 'भाषा सफलतापूर्वक जोड़ी गई', 'भाषा यशस्वीरित्या जोडली'],
                id: result.insertId
            });
        });
    });
};

// Edit language details
export const editLanguage = (req, res) => {
    const { id, language_id, code, name, native_name } = req.body;
    const targetId = id || language_id;

    // Using 'updated_at' matching the database schema
    const query = `UPDATE language_master SET code = ?, name = ?, native_name = ?, updated_at = NOW() WHERE id = ?`;

    connection.query(query, [code, name, native_name, targetId], (error, result) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }
        res.status(200).json({
            success: true,
            msg: ['Language updated successfully', 'भाषा सफलतापूर्वक अपडेट की गई', 'भाषा यशस्वीरित्या अपडेट केली']
        });
    });
};

// Delete language
export const deleteLanguage = (req, res) => {
    const { id, language_id } = req.body;
    const targetId = id || language_id;

    const query = `DELETE FROM language_master WHERE id = ?`;

    connection.query(query, [targetId], (error, result) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }
        res.status(200).json({
            success: true,
            msg: ['Language deleted successfully', 'भाषा सफलतापूर्वक हटा दी गई', 'भाषा यशस्वीरित्या हटविली']
        });
    });
};

// Toggle language status (Admin only)
export const toggleLanguageStatus = (req, res) => {
    const { id, language_id } = req.body;
    const targetId = id || language_id;

    // Using 'updated_at' matching the database schema
    const query = `UPDATE language_master SET is_active = NOT is_active, updated_at = NOW() WHERE id = ?`;

    connection.query(query, [targetId], (error, result) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }
        res.status(200).json({
            success: true,
            msg: ['Language status updated', 'भाषा की स्थिति अपडेट की गई', 'भाषेची स्थिती अपडेट केली']
        });
    });
};

// Update user language preference (User App)
export const updateUserLanguage = (req, res) => {
    const { language_code } = req.body;
    const userId = req.user.user_id;

    // Keep 'updatetime' for user_master if that's what it uses, or change if you know user_master schema.
    // Assuming user_master still uses 'updatetime' based on previous context.
    const query = `UPDATE user_master SET language_code = ?, updatetime = NOW() WHERE user_id = ?`;

    connection.query(query, [language_code, userId], (error, result) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }
        res.status(200).json({
            success: true,
            msg: ['Language updated successfully', 'भाषा सफलतापूर्वक अपडेट की गई', 'भाषा यशस्वीरित्या अपडेट केली']
        });
    });
};

// Get language analytics (for Admin Dashboard)
export const getLanguageAnalytics = (req, res) => {
    const query = `
        SELECT 
            COALESCE(u.language_code, 'en') as language_code,
            l.name as language_name,
            COUNT(u.user_id) as user_count
        FROM user_master u
        LEFT JOIN language_master l ON (u.language_code = l.code OR (u.language_code IS NULL AND l.code = 'en'))
        WHERE u.delete_flag = 0
        GROUP BY COALESCE(u.language_code, 'en')
    `;

    connection.query(query, (error, results) => {
        if (error) {
            return res.status(200).json({
                success: false,
                msg: languageMessage.internalServerError,
                error: error.message
            });
        }

        const totalUsers = results.reduce((acc, curr) => acc + curr.user_count, 0);
        const data = results.map(item => ({
            name: item.language_name || item.language_code,
            code: item.language_code,
            value: item.user_count,
            percentage: totalUsers > 0 ? ((item.user_count / totalUsers) * 100).toFixed(2) : 0
        }));

        res.status(200).json({
            success: true,
            data: data
        });
    });
};
