import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';

// Helper functions for support ticket labels
function getPriorityLabel(priority) {
  const labels = {
    1: 'Low',
    2: 'Medium',
    3: 'High',
    4: 'Urgent'
  };
  return labels[priority] || 'Unknown';
}

function getCategoryLabel(categoryId) {
  const labels = {
    1: 'General',
    2: 'Technical Issue',
    3: 'Account & Login',
    4: 'Payment & Billing',
    5: 'Data & Backup',
    6: 'Feature Request',
    7: 'Bug Report',
    8: 'Other'
  };
  return labels[categoryId] || 'Unknown';
}

function getStatusLabel(status) {
  const labels = {
    0: 'Pending',
    1: 'In Progress',
    2: 'Open',
    3: 'Resolved'
  };
  return labels[status] || 'Unknown';
}

/**
 * Update Support Ticket Status Controller
 * Updates ticket status and adds admin notes
 */
const updateSupportTicketStatus = async (request, response) => {
  try {
    const { support_ticket_id, status, admin_notes } = request.body;

    if (!support_ticket_id || status === undefined) {
      return response.status(200).json({
        success: false,
        msg: ['support_ticket_id and status are required', 'support_ticket_id और status आवश्यक हैं', 'support_ticket_id आणि status आवश्यक आहेत'],
        key: "support_ticket_id, status"
      });
    }

    // Validate status
    if (![0, 1, 2, 3].includes(parseInt(status))) {
      return response.status(200).json({
        success: false,
        msg: ['Invalid status. Must be 0 (Pending), 1 (In Progress), 2 (Open), or 3 (Resolved)', 'अमान्य स्थिति', 'अवैध स्थिती'],
        key: "status"
      });
    }

    // Check if ticket exists
    const checkQuery = "SELECT support_ticket_id, status FROM support_tickets_master WHERE support_ticket_id = ? AND delete_flag = 0";
    connection.query(checkQuery, [support_ticket_id], (checkErr, checkResult) => {
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
          msg: ['Support ticket not found', 'सहायता टिकट नहीं मिला', 'सहायता टिकट सापडले नाही'],
          key: "ticket_not_found"
        });
      }

      const currentStatus = checkResult[0].status;
      const updatetime = moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

      // Update ticket status
      const updateQuery = "UPDATE support_tickets_master SET status = ?, updatetime = ? WHERE support_ticket_id = ?";
      connection.query(updateQuery, [status, updatetime, support_ticket_id], (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Support ticket status updated successfully', 'सहायता टिकट स्थिति सफलतापूर्वक अपडेट', 'सहायता टिकट स्थिती यशस्वीरित्या अपडेट'],
          data: {
            support_ticket_id: support_ticket_id,
            previous_status: currentStatus,
            previous_status_label: getStatusLabel(currentStatus),
            new_status: status,
            new_status_label: getStatusLabel(status),
            admin_notes: admin_notes || null,
            updated_at: updatetime
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
 * Delete Support Ticket Controller
 * Soft deletes a support ticket
 */
const deleteSupportTicket = async (request, response) => {
  try {
    const { support_ticket_id } = request.body;

    if (!support_ticket_id) {
      return response.status(200).json({
        success: false,
        msg: ['support_ticket_id is required', 'support_ticket_id आवश्यक है', 'support_ticket_id आवश्यक आहे'],
        key: "support_ticket_id"
      });
    }

    // Check if ticket exists
    const checkQuery = "SELECT support_ticket_id FROM support_tickets_master WHERE support_ticket_id = ? AND delete_flag = 0";
    connection.query(checkQuery, [support_ticket_id], (checkErr, checkResult) => {
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
          msg: ['Support ticket not found', 'सहायता टिकट नहीं मिला', 'सहायता टिकट सापडले नाही'],
          key: "ticket_not_found"
        });
      }

      // Soft delete ticket
      const deleteQuery = "UPDATE support_tickets_master SET delete_flag = 1, updatetime = NOW() WHERE support_ticket_id = ?";
      connection.query(deleteQuery, [support_ticket_id], (deleteErr, deleteResult) => {
        if (deleteErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: deleteErr.message
          });
        }

        return response.status(200).json({
          success: true,
          msg: ['Support ticket deleted successfully', 'सहायता टिकट सफलतापूर्वक हटाया गया', 'सहायता टिकट यशस्वीरित्या हटवले'],
          data: {
            support_ticket_id: support_ticket_id,
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
 * Get Support Ticket Details Controller
 * Returns detailed information about a specific ticket
 */
const getSupportTicketDetails = async (request, response) => {
  try {
    const { support_ticket_id } = request.query;

    if (!support_ticket_id) {
      return response.status(200).json({
        success: false,
        msg: ['support_ticket_id is required', 'support_ticket_id आवश्यक है', 'support_ticket_id आवश्यक आहे'],
        key: "support_ticket_id"
      });
    }

    const detailsQuery = `
      SELECT 
        st.support_ticket_id,
        st.user_id,
        st.description,
        st.priority,
        st.category_id,
        st.status,
        st.screenshot,
        st.delete_flag,
        st.createtime,
        st.updatetime,
        u.name as user_name,
        u.email as user_email,
        u.mobile as user_mobile,
        u.phone_code as user_phone_code
      FROM support_tickets_master st
      JOIN user_master u ON st.user_id = u.user_id
      WHERE st.support_ticket_id = ?
    `;

    connection.query(detailsQuery, [support_ticket_id], (detailsErr, detailsResult) => {
      if (detailsErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: detailsErr.message
        });
      }

      if (detailsResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Support ticket not found', 'सहायता टिकट नहीं मिला', 'सहायता टिकट सापडले नाही'],
          key: "ticket_not_found"
        });
      }

      const ticket = detailsResult[0];
      const ticketDetails = {
        support_ticket_id: ticket.support_ticket_id,
        user_info: {
          user_id: ticket.user_id,
          name: ticket.user_name,
          email: ticket.user_email,
          mobile: ticket.user_mobile,
          phone_code: ticket.user_phone_code
        },
        ticket_info: {
          description: ticket.description,
          priority: ticket.priority,
          priority_label: getPriorityLabel(ticket.priority),
          category_id: ticket.category_id,
          category_label: getCategoryLabel(ticket.category_id),
          status: ticket.status,
          status_label: getStatusLabel(ticket.status),
          screenshot: ticket.screenshot, // Now contains Cloudinary URL
          screenshot_url: ticket.screenshot || null // Direct Cloudinary URL
        },
        timestamps: {
          created_at: moment(ticket.createtime).format('DD MMM, YYYY HH:mm A'),
          updated_at: moment(ticket.updatetime).format('DD MMM, YYYY HH:mm A'),
          created_ago: moment(ticket.createtime).fromNow(),
          updated_ago: moment(ticket.updatetime).fromNow()
        },
        flags: {
          is_deleted: ticket.delete_flag == 1,
          delete_flag: ticket.delete_flag
        }
      };

      return response.status(200).json({
        success: true,
        msg: ['Support ticket details retrieved successfully', 'सहायता टिकट विवरण सफलतापूर्वक प्राप्त', 'सहायता टिकट तपशील यशस्वीरित्या पुनर्प्राप्त'],
        data: ticketDetails
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
 * Get Support Ticket Statistics Controller
 * Returns analytics and statistics for support tickets
 */
const getSupportTicketStats = async (request, response) => {
  try {
    const { period = '30' } = request.query; // days
    const daysAgo = moment().subtract(parseInt(period), 'days').format('YYYY-MM-DD');

    // Get overall statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN delete_flag = 0 THEN 1 END) as active_tickets,
        COUNT(CASE WHEN delete_flag = 1 THEN 1 END) as deleted_tickets,
        COUNT(CASE WHEN status = 0 THEN 1 END) as pending_tickets,
        COUNT(CASE WHEN status = 1 THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 2 THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 3 THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN priority = 1 THEN 1 END) as low_priority,
        COUNT(CASE WHEN priority = 2 THEN 1 END) as medium_priority,
        COUNT(CASE WHEN priority = 3 THEN 1 END) as high_priority,
        COUNT(CASE WHEN priority = 4 THEN 1 END) as urgent_priority,
        COUNT(CASE WHEN createtime >= ? THEN 1 END) as recent_tickets
      FROM support_tickets_master
    `;

    connection.query(statsQuery, [daysAgo], (statsErr, statsResult) => {
      if (statsErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: statsErr.message
        });
      }

      const stats = statsResult[0];

      // Get category-wise distribution
      const categoryQuery = `
        SELECT 
          category_id,
          COUNT(*) as count
        FROM support_tickets_master 
        WHERE delete_flag = 0
        GROUP BY category_id
        ORDER BY count DESC
      `;

      connection.query(categoryQuery, (categoryErr, categoryResult) => {
        if (categoryErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: categoryErr.message
          });
        }

        const categoryDistribution = categoryResult.map(item => ({
          category_id: item.category_id,
          category_label: getCategoryLabel(item.category_id),
          count: item.count,
          percentage: stats.active_tickets > 0 ? Math.round((item.count / stats.active_tickets) * 100) : 0
        }));

        // Get daily ticket creation trend
        const trendQuery = `
          SELECT 
            DATE(createtime) as date,
            COUNT(*) as tickets_created
          FROM support_tickets_master 
          WHERE createtime >= ? AND delete_flag = 0
          GROUP BY DATE(createtime)
          ORDER BY date DESC
          LIMIT 30
        `;

        connection.query(trendQuery, [daysAgo], (trendErr, trendResult) => {
          if (trendErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: trendErr.message
            });
          }

          const dailyTrend = trendResult.map(item => ({
            date: moment(item.date).format('DD MMM'),
            tickets_created: item.tickets_created
          }));

          return response.status(200).json({
            success: true,
            msg: ['Support ticket statistics retrieved successfully', 'सहायता टिकट आंकड़े सफलतापूर्वक प्राप्त', 'सहायता टिकट आकडेवारी यशस्वीरित्या पुनर्प्राप्त'],
            data: {
              overview: {
                total_tickets: stats.total_tickets,
                active_tickets: stats.active_tickets,
                deleted_tickets: stats.deleted_tickets,
                recent_tickets: stats.recent_tickets,
                period_days: parseInt(period)
              },
              status_distribution: {
                pending: stats.pending_tickets,
                in_progress: stats.in_progress_tickets,
                open: stats.open_tickets,
                resolved: stats.resolved_tickets
              },
              priority_distribution: {
                low: stats.low_priority,
                medium: stats.medium_priority,
                high: stats.high_priority,
                urgent: stats.urgent_priority
              },
              category_distribution: categoryDistribution,
              daily_trend: dailyTrend,
              response_metrics: {
                resolution_rate: stats.active_tickets > 0 ? Math.round((stats.resolved_tickets / stats.active_tickets) * 100) : 0,
                pending_rate: stats.active_tickets > 0 ? Math.round((stats.pending_tickets / stats.active_tickets) * 100) : 0
              }
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

export { updateSupportTicketStatus, deleteSupportTicket, getSupportTicketDetails, getSupportTicketStats };
