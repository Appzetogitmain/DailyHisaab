
import connection from '../connection/dbConfig.js';

/**
 * Get user acquisition statistics (counts by source)
 */
export const getUserAcquisitionStats = async (req, res) => {
  try {
    const query = `
            SELECT 
                source as channel, 
                COUNT(*) as users 
            FROM user_master 
            WHERE delete_flag = 0 
            GROUP BY source 
            ORDER BY users DESC
        `;

    connection.query(query, (error, results) => {
      if (error) {
        return res.status(200).json({
          success: false,
          msg: ['Failed to fetch acquisition stats', 'अधिग्रहण आँकड़े लाने में विफल', 'अधिग्रहण आकडे मिळवण्यात अयशस्वी'],
          error: error.message
        });
      }

      res.status(200).json({
        success: true,
        data: results
      });
    });
  } catch (error) {
    res.status(200).json({
      success: false,
      msg: ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'अंतर्गत सर्व्हर त्रुटी'],
      error: error.message
    });
  }
};

/**
 * Get user acquisition details (paginated list)
 */
export const getUserAcquisitionDetails = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const countQuery = "SELECT COUNT(*) as total FROM user_master WHERE delete_flag = 0";
    const dataQuery = `
            SELECT 
                user_id, name, mobile, source, medium, campaign, installed_at 
            FROM user_master 
            WHERE delete_flag = 0 
            ORDER BY installed_at DESC 
            LIMIT ? OFFSET ?
        `;

    connection.query(countQuery, (countErr, countResult) => {
      if (countErr) {
        return res.status(200).json({ success: false, error: countErr.message });
      }

      const total = countResult[0].total;

      connection.query(dataQuery, [limit, offset], (dataErr, dataResults) => {
        if (dataErr) {
          return res.status(200).json({ success: false, error: dataErr.message });
        }

        res.status(200).json({
          success: true,
          data: dataResults,
          pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
          }
        });
      });
    });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
};
