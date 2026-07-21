import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import connection from '../connection/dbConfig.js';
import languageMessage from '../controller/languageMessage.js';

dotenv.config();
const SECRET_KEY = process.env.SECRET_KEY || "DaliyHisab";

/**
 * Manager Token Verification Middleware
 * Verifies JWT token and checks if user is a manager with access to specific business account
 */
const verifyManagerToken = (req, res, next) => {
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

    // Check if the token is from a manager (has type: 'manager')
    if (!decoded.type || decoded.type !== 'manager') {
      return res.status(200).json({
        success: false,
        msg: ["Access denied. Manager privileges required", "पहुंच अस्वीकृत। मैनेजर विशेषाधिकार आवश्यक", "प्रवेश नाकारला। मॅनेजर विशेषाधिकार आवश्यक"],
        key: "managerAccessRequired"
      });
    }

    // Verify manager exists and is active in database
    const checkManagerQuery = `
            SELECT 
                bmm.manager_id,
                bmm.manager_user_id,
                bmm.owner_user_id,
                bmm.business_account_id,
                bmm.manager_role,
                bmm.permissions,
                bmm.status,
                um.name as manager_name,
                um.mobile as manager_mobile,
                owner.name as owner_name,
                uam.account_name as business_account_name
            FROM business_manager_master bmm
            LEFT JOIN user_master um ON bmm.manager_user_id = um.user_id AND um.delete_flag = 0 AND um.active_flag = 1
            LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
            LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
            WHERE bmm.manager_id = ? AND bmm.status = 'active' AND bmm.delete_flag = 0
            AND um.user_id IS NOT NULL
            AND um.active_flag = 1
            AND owner.user_id IS NOT NULL
        `;

    connection.query(checkManagerQuery, [decoded.manager_id], (dbErr, managerResult) => {
      if (dbErr) {
        return res.status(200).json({
          success: false,
          msg: ["Database error", "डेटाबेस त्रुटि", "डेटाबेस त्रुटी"],
          error: dbErr.message
        });
      }

      if (managerResult.length === 0) {
        return res.status(200).json({
          success: false,
          msg: ["Manager not found or inactive", "मैनेजर नहीं मिला या निष्क्रिय", "मॅनेजर सापडला नाही किंवा निष्क्रिय"],
          key: "managerNotFound"
        });
      }

      // Add manager info to request object
      req.managerInfo = {
        manager_id: managerResult[0].manager_id,
        manager_user_id: managerResult[0].manager_user_id,
        owner_user_id: managerResult[0].owner_user_id,
        business_account_id: managerResult[0].business_account_id,
        manager_role: managerResult[0].manager_role,
        permissions: managerResult[0].permissions ? JSON.parse(managerResult[0].permissions) : null,
        status: managerResult[0].status,
        manager_name: managerResult[0].manager_name,
        manager_mobile: managerResult[0].manager_mobile,
        owner_name: managerResult[0].owner_name,
        business_account_name: managerResult[0].business_account_name
      };

      // Update last accessed time
      const updateAccessQuery = "UPDATE business_manager_master SET last_accessed = NOW() WHERE manager_id = ?";
      connection.query(updateAccessQuery, [decoded.manager_id]);

      // Log the activity
      const logQuery = `
                INSERT INTO manager_activity_log 
                (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
                VALUES (?, ?, ?, 'login', ?, ?, ?, NOW())
            `;

      connection.query(logQuery, [
        decoded.manager_id,
        managerResult[0].owner_user_id,
        managerResult[0].business_account_id,
        `Manager ${managerResult[0].manager_name} logged in`,
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent')
      ]);

      next();
    });
  });
};

/**
 * Manager Permission Check Middleware
 * Checks if manager has permission to perform specific action
 */
const checkManagerPermission = (permissionType, action) => {
  return (req, res, next) => {
    const managerInfo = req.managerInfo;

    if (!managerInfo) {
      return res.status(200).json({
        success: false,
        msg: ["Manager information not found", "मैनेजर जानकारी नहीं मिली", "मॅनेजर माहिती सापडली नाही"],
        key: "managerInfoNotFound"
      });
    }

    // Full access managers can do everything
    if (managerInfo.manager_role === 'full_access') {
      return next();
    }

    // Check specific permissions
    if (managerInfo.permissions && managerInfo.permissions[permissionType]) {
      const permission = managerInfo.permissions[permissionType];

      if (permission[action] === true) {
        return next();
      }
    }

    // View only managers can only view
    if (managerInfo.manager_role === 'view_only' && action === 'view') {
      return next();
    }

    return res.status(200).json({
      success: false,
      msg: ["Insufficient permissions", "अपर्याप्त अनुमतियां", "अपुरे परवानग्या"],
      key: "insufficientPermissions",
      required_permission: `${permissionType}.${action}`
    });
  };
};

/**
 * Manager Context Middleware
 * Sets up the request context for manager operations by replacing user_id with owner's user_id
 * and adding business_account_id to the request
 */
const setupManagerContext = (req, res, next) => {
  const managerInfo = req.managerInfo;

  if (!managerInfo) {
    return res.status(200).json({
      success: false,
      msg: ["Manager information not found", "मैनेजर जानकारी नहीं मिली", "मॅनेजर माहिती सापडली नाही"],
      key: "managerInfoNotFound"
    });
  }

  // Store original user_id for logging purposes
  req.originalUserId = req.userId;

  // Replace user_id with owner's user_id for business operations
  req.userId = managerInfo.owner_user_id;

  // Add business account context
  req.businessAccountId = managerInfo.business_account_id;

  // Add manager context for logging
  req.managerContext = {
    manager_id: managerInfo.manager_id,
    manager_user_id: managerInfo.manager_user_id,
    manager_name: managerInfo.manager_name,
    manager_role: managerInfo.manager_role
  };

  next();
};

/**
 * Log Manager Activity Middleware
 * Logs manager activities for audit purposes
 */
const logManagerActivity = (activityType, activityDescription) => {
  return (req, res, next) => {
    // Store the activity info for logging after the request completes
    req.managerActivity = {
      activity_type: activityType,
      activity_description: activityDescription,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.get('User-Agent')
    };

    // Log the activity immediately
    if (req.managerInfo) {
      const logQuery = `
                INSERT INTO manager_activity_log 
                (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
                VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
            `;

      connection.query(logQuery, [
        req.managerInfo.manager_id,
        req.managerInfo.owner_user_id,
        req.managerInfo.business_account_id,
        activityType,
        activityDescription,
        req.managerActivity.ip_address,
        req.managerActivity.user_agent
      ], (err) => {
        if (err) {
          console.error('Error logging manager activity:', err);
        }
      });
    }

    next();
  };
};

/**
 * Enhanced Manager Token Verification with Context Setup
 * Combines token verification and context setup for manager operations
 */
const verifyManagerTokenWithContext = (req, res, next) => {
  // First verify the manager token
  verifyManagerToken(req, res, (err) => {
    if (err) return; // Error response already sent by verifyManagerToken

    // Then setup the manager context
    setupManagerContext(req, res, next);
  });
};

/**
 * Enhanced Manager Token Verification with Context Setup and Activity Logging
 * Combines token verification, context setup, and activity logging for manager operations
 */
const verifyManagerTokenWithContextAndLogging = (activityType, activityDescription) => {
  return [
    verifyManagerTokenWithContext,
    logManagerActivity(activityType, activityDescription)
  ];
};

/**
 * Generate Manager JWT Token
 * Creates a JWT token for manager authentication
 */
const generateManagerToken = (managerId, managerUserId) => {
  const payload = {
    manager_id: managerId,
    manager_user_id: managerUserId,
    type: 'manager'
  };

  return jwt.sign(payload, SECRET_KEY);
};

/**
 * Manager Login Controller
 * Handles manager login and token generation
 */
const managerLogin = async (req, res) => {
  try {
    const { mobile, phone_code } = req.body;

    if (!mobile || !phone_code) {
      return res.status(200).json({
        success: false,
        msg: ["Mobile and phone code are required", "मोबाइल और फोन कोड आवश्यक है", "मोबाइल आणि फोन कोड आवश्यक आहे"]
      });
    }

    // Check if user exists
    const userQuery = "SELECT user_id, name, mobile, phone_code, active_flag FROM user_master WHERE mobile = ? AND phone_code = ? AND delete_flag = 0";
    connection.query(userQuery, [mobile, phone_code], (userErr, userResult) => {
      if (userErr) {
        return res.status(200).json({
          success: false,
          msg: languageMessage.internalServerError,
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return res.status(200).json({
          success: false,
          msg: ["User not found", "उपयोगकर्ता नहीं मिला", "वापरकर्ता सापडला नाही"]
        });
      }

      if (userResult[0].active_flag === 0) {
        return res.status(200).json({
          success: false,
          msg: ["Account deactivated", "खाता निष्क्रिय", "खाते निष्क्रिय"]
        });
      }

      const userId = userResult[0].user_id;

      // Check if user is a manager
      // Ensure manager user is active and not deleted, and owner is not deleted
      const managerQuery = `
                SELECT 
                    bmm.manager_id,
                    bmm.manager_user_id,
                    bmm.owner_user_id,
                    bmm.business_account_id,
                    bmm.manager_role,
                    bmm.permissions,
                    bmm.status,
                    owner.name as owner_name,
                    uam.account_name as business_account_name
                FROM business_manager_master bmm
                LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
                LEFT JOIN user_master manager ON bmm.manager_user_id = manager.user_id AND manager.delete_flag = 0 AND manager.active_flag = 1
                LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
                WHERE bmm.manager_user_id = ? 
                AND bmm.status = 'active' 
                AND bmm.delete_flag = 0
                AND manager.user_id IS NOT NULL
                AND manager.active_flag = 1
                AND owner.user_id IS NOT NULL
            `;

      connection.query(managerQuery, [userId], (managerErr, managerResult) => {
        if (managerErr) {
          return res.status(200).json({
            success: false,
            msg: languageMessage.internalServerError,
            error: managerErr.message
          });
        }

        if (managerResult.length === 0) {
          return res.status(200).json({
            success: false,
            msg: ["No manager access found", "कोई मैनेजर पहुंच नहीं मिली", "कोणतेही मॅनेजर प्रवेश सापडले नाही"]
          });
        }

        // Generate token for the first manager account (in case user manages multiple accounts)
        const manager = managerResult[0];
        const token = generateManagerToken(manager.manager_id, manager.manager_user_id);

        // Update last accessed time
        const updateAccessQuery = "UPDATE business_manager_master SET last_accessed = NOW() WHERE manager_id = ?";
        connection.query(updateAccessQuery, [manager.manager_id]);

        // Log the activity
        const logQuery = `
                    INSERT INTO manager_activity_log 
                    (manager_id, owner_user_id, business_account_id, activity_type, activity_description, ip_address, user_agent, createtime) 
                    VALUES (?, ?, ?, 'login', ?, ?, ?, NOW())
                `;

        connection.query(logQuery, [
          manager.manager_id,
          manager.owner_user_id,
          manager.business_account_id,
          `Manager ${userResult[0].name} logged in`,
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent')
        ]);

        return res.status(200).json({
          success: true,
          msg: ["Manager login successful", "मैनेजर लॉगिन सफल", "मॅनेजर लॉगिन यशस्वी"],
          data: {
            token: token,
            manager_id: manager.manager_id,
            manager_user_id: manager.manager_user_id,
            manager_name: userResult[0].name,
            manager_mobile: userResult[0].mobile,
            owner_user_id: manager.owner_user_id,
            owner_name: manager.owner_name,
            business_account_id: manager.business_account_id,
            business_account_name: manager.business_account_name,
            manager_role: manager.manager_role,
            permissions: manager.permissions ? JSON.parse(manager.permissions) : null,
            all_managed_accounts: managerResult.map(m => ({
              manager_id: m.manager_id,
              manager_user_id: m.manager_user_id,
              owner_user_id: m.owner_user_id,
              owner_name: m.owner_name,
              business_account_id: m.business_account_id,
              business_account_name: m.business_account_name,
              manager_role: m.manager_role
            }))
          }
        });
      });
    });

  } catch (error) {
    return res.status(200).json({
      success: false,
      msg: languageMessage.internalServerError,
      error: error.message
    });
  }
};

export default verifyManagerToken;
export {
  verifyManagerToken,
  verifyManagerTokenWithContext,
  checkManagerPermission,
  setupManagerContext,
  generateManagerToken,
  managerLogin
};
