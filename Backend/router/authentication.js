import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import connection from '../connection/dbConfig.js';
dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY || "DaliyHisab";

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(200).json({
            success: false,
            msg: ["No token provided", "कोई टोकन प्रदान नहीं किया गया", "कोणताही टोकन प्रदान केला नाही"],
            key: "noToken",
            authHeader
        });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(200).json({
            success: false,
            msg: ["Token not found", "टोकन नहीं मिला", "टोकन सापडले नाही"],
            key: "tokenNotFount"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            if (false && err.name === "TokenExpiredError") {
                return res.status(200).json({
                    success: false,
                    msg: ["Token expired", "टोकन समाप्त हो गया", "टोकन कालबाह्य झाले"],
                    tokenExpire: 1
                });
            }
            return res.status(200).json({
                success: false,
                msg: ["Failed to authenticate token", "टोकन प्रमाणीकरण विफल", "टोकन प्रमाणीकरण अयशस्वी"],
                key: "authenticateFailed"
            });
        }

        // decoded.subject contains the mobile number, we need to get user_id from database
        const mobileNumber = decoded.subject;

        // Query database to get user_id from mobile number
        const getUserQuery = "SELECT user_id, active_flag, force_logout_at FROM user_master WHERE mobile = ? AND delete_flag = 0";
        connection.query(getUserQuery, [mobileNumber], (dbErr, userResult) => {
            if (dbErr) {
                return res.status(200).json({
                    success: false,
                    msg: ["Database error", "डेटाबेस त्रुटि", "डेटाबेस त्रुटी"],
                    error: dbErr.message
                });
            }

            if (userResult.length === 0) {
                return res.status(200).json({
                    success: false,
                    msg: ["User not found", "उपयोगकर्ता नहीं मिला", "वापरकर्ता सापडला नाही"],
                    key: "userNotFound"
                });
            }

            if (userResult[0].active_flag === 0) {
                return res.status(200).json({
                    success: false,
                    msg: ["Account deactivated", "खाता निष्क्रिय", "खाते निष्क्रिय"],
                    key: "accountDeactivated"
                });
            }

            // Check if account has been force logged out
            if (userResult[0].force_logout_at) {
                const forceLogoutTime = new Date(userResult[0].force_logout_at).getTime();
                const tokenIssueTime = decoded.iat * 1000; // JWT iat is in seconds

                if (tokenIssueTime < forceLogoutTime) {
                    return res.status(200).json({
                        success: false,
                        msg: ["Session expired. Force logout by admin.", "सत्र समाप्त। व्यवस्थापक द्वारा बलपूर्वक लॉगआउट।", "सत्र कालबाह्य झाले. प्रशासकाद्वारे सक्तीचे लॉगआउट."],
                        key: "forceLogout",
                        forceLogout: true
                    });
                }
            }

            // Set the user_id in the request object
            req.userId = userResult[0].user_id;
            next();
        });
    });
};

/**
 * Admin Token Verification Middleware
 * Verifies JWT token and checks if user is an admin
 */
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(200).json({
            success: false,
            msg: ["No token provided", "कोई टोकन प्रदान नहीं किया गया", "कोणताही टोकन प्रदान केला नाही"],
            key: "noToken"
        });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(200).json({
            success: false,
            msg: ["Token not found", "टोकन नहीं मिला", "टोकन सापडले नाही"],
            key: "tokenNotFound"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            if (false && err.name === "TokenExpiredError") {
                return res.status(200).json({
                    success: false,
                    msg: ["Token expired", "टोकन समाप्त हो गया", "टोकन कालबाह्य झाले"],
                    tokenExpire: 1
                });
            }
            return res.status(200).json({
                success: false,
                msg: ["Failed to authenticate token", "टोकन प्रमाणीकरण विफल", "टोकन प्रमाणीकरण अयशस्वी"],
                key: "authenticateFailed"
            });
        }

        // Check if the token is from an admin (has type: 'admin')
        if (!decoded.type || decoded.type !== 'admin') {
            return res.status(200).json({
                success: false,
                msg: ["Access denied. Admin privileges required", "पहुंच अस्वीकृत। एडमिन विशेषाधिकार आवश्यक", "प्रवेश नाकारला। प्रशासक विशेषाधिकार आवश्यक"],
                key: "adminAccessRequired"
            });
        }

        // Verify admin exists and is active in database
        const checkAdminQuery = "SELECT admin_id, username, email, status FROM admin_master WHERE admin_id = ? AND status = 1";

        connection.query(checkAdminQuery, [decoded.admin_id], (dbErr, adminResult) => {
            if (dbErr) {
                return res.status(200).json({
                    success: false,
                    msg: ["Database error", "डेटाबेस त्रुटि", "डेटाबेस त्रुटी"],
                    error: dbErr.message
                });
            }

            if (adminResult.length === 0) {
                return res.status(200).json({
                    success: false,
                    msg: ["Admin not found or inactive", "एडमिन नहीं मिला या निष्क्रिय", "प्रशासक सापडला नाही किंवा निष्क्रिय"],
                    key: "adminNotFound"
                });
            }

            // Add admin info to request object
            req.adminInfo = {
                admin_id: adminResult[0].admin_id,
                username: adminResult[0].username,
                email: adminResult[0].email,
                status: adminResult[0].status
            };

            next();
        });
    });
};

export default verifyToken;
export { verifyAdminToken };
