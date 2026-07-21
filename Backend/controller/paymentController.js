import Razorpay from 'razorpay';
import connection from '../connection/dbConfig.js';
import moment from 'moment-timezone';
import languageMessage from './languageMessage.js';
import crypto from 'crypto';

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

/**
 * Create Razorpay Order for Subscription
 * Creates a Razorpay order for subscription plan payment
 */
const createRazorpayOrder = async (request, response) => {
  try {
    const { user_id, subscription_id, amount, currency = 'INR' } = request.body;

    // Validate required fields
    if (!user_id || !subscription_id || !amount) {
      return response.status(200).json({
        success: false,
        msg: ['user_id, subscription_id, and amount are required', 'आवश्यक फ़ील्ड गुम हैं', 'आवश्यक फील्ड गहाळ आहेत'],
        key: "user_id, subscription_id, amount"
      });
    }

    // Validate amount
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return response.status(200).json({
        success: false,
        msg: ['Amount must be a positive number', 'राशि सकारात्मक संख्या होनी चाहिए', 'रक्कम सकारात्मक संख्या असणे आवश्यक आहे'],
        key: "amount"
      });
    }

    // Check if user exists and is active
    const userQuery = "SELECT user_id, name, email, mobile FROM user_master WHERE user_id = ? AND delete_flag = 0 AND active_flag = 1";
    connection.query(userQuery, [user_id], (userErr, userResult) => {
      if (userErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: userErr.message
        });
      }

      if (userResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.msgUserNotFound || ['User not found', 'उपयोगकर्ता नहीं मिला', 'वापरकर्ता सापडला नाही'],
          key: "user_not_found"
        });
      }

      // Check if subscription plan exists
      const subscriptionQuery = "SELECT subscription_id, description, amount, subscription_type FROM subscription_master WHERE subscription_id = ? AND delete_flag = 0";
      connection.query(subscriptionQuery, [subscription_id], (subErr, subResult) => {
        if (subErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: subErr.message
          });
        }

        if (subResult.length === 0) {
          return response.status(200).json({
            success: false,
            msg: ['Subscription plan not found', 'सब्सक्रिप्शन प्लान नहीं मिला', 'सब्सक्रिप्शन प्लॅन सापडले नाही'],
            key: "subscription_not_found"
          });
        }

        const user = userResult[0];
        const subscription = subResult[0];

        // Create Razorpay order
        const orderOptions = {
          amount: Math.round(parseFloat(amount) * 100), // Convert to paise
          currency: currency,
          receipt: `sub_${subscription_id}_${user_id}_${Date.now()}`,
          notes: {
            user_id: user_id,
            subscription_id: subscription_id,
            plan_name: subscription.description,
            subscription_type: subscription.subscription_type
          }
        };

        razorpay.orders.create(orderOptions, (err, order) => {
          if (err) {
            return response.status(200).json({
              success: false,
              msg: ['Failed to create payment order', 'भुगतान ऑर्डर बनाने में विफल', 'पेमेंट ऑर्डर तयार करण्यात अयशस्वी'],
              error: err.message
            });
          }

          // Store order details in database
          const orderData = {
            razorpay_order_id: order.id,
            user_id: user_id,
            subscription_id: subscription_id,
            amount: amount,
            currency: currency,
            status: 'created',
            receipt: order.receipt,
            notes: JSON.stringify(orderOptions.notes),
            createtime: moment().tz(process.env.TIME_ZONE || 'Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
          };

          const insertOrderQuery = `
            INSERT INTO razorpay_orders 
            (razorpay_order_id, user_id, subscription_id, amount, currency, status, receipt, notes, createtime, updatetime) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          connection.query(insertOrderQuery, [
            orderData.razorpay_order_id,
            orderData.user_id,
            orderData.subscription_id,
            orderData.amount,
            orderData.currency,
            orderData.status,
            orderData.receipt,
            orderData.notes,
            orderData.createtime,
            orderData.createtime
          ], (insertErr, insertResult) => {
            if (insertErr) {
              return response.status(200).json({
                success: false,
                msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                error: insertErr.message
              });
            }

            return response.status(200).json({
              success: true,
              msg: ['Payment order created successfully', 'भुगतान ऑर्डर सफलतापूर्वक बनाया गया', 'पेमेंट ऑर्डर यशस्वीरित्या तयार केले'],
              data: {
                order_id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt,
                key: process.env.RAZORPAY_KEY_ID,
                user: {
                  name: user.name,
                  email: user.email,
                  mobile: user.mobile
                },
                subscription: {
                  id: subscription.subscription_id,
                  name: subscription.description,
                  type: subscription.subscription_type,
                  type_label:
                    subscription.subscription_type == 0 ? "Free or Referral" :
                      subscription.subscription_type == 1 ? "Yearly" :
                        subscription.subscription_type == 2 ? "Monthly" :
                          subscription.subscription_type == 3 ? "Lifetime" :
                            subscription.subscription_type == 4 ? "Other" :
                              "Unknown"
                }
              }
            });
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

/**
 * Verify Razorpay Payment
 * Verifies the payment signature and updates subscription
 */
const verifyRazorpayPayment = async (request, response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return response.status(200).json({
        success: false,
        msg: ['Payment verification failed - missing parameters', 'भुगतान सत्यापन विफल', 'पेमेंट सत्यापन अयशस्वी'],
        key: "missing_parameters"
      });
    }

    // Get order details from database
    const orderQuery = "SELECT * FROM razorpay_orders WHERE razorpay_order_id = ? AND status = 'created'";
    connection.query(orderQuery, [razorpay_order_id], (orderErr, orderResult) => {
      if (orderErr) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: orderErr.message
        });
      }

      if (orderResult.length === 0) {
        return response.status(200).json({
          success: false,
          msg: ['Order not found or already processed', 'ऑर्डर नहीं मिला या पहले से संसाधित', 'ऑर्डर सापडले नाही किंवा आधीच प्रक्रिया केले'],
          key: "order_not_found"
        });
      }

      const order = orderResult[0];

      // Verify payment signature
      const body = order.razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return response.status(200).json({
          success: false,
          msg: ['Payment verification failed - invalid signature', 'भुगतान सत्यापन विफल - अमान्य हस्ताक्षर', 'पेमेंट सत्यापन अयशस्वी - अवैध स्वाक्षरी'],
          key: "invalid_signature"
        });
      }

      // Update order status
      const updateOrderQuery = `
        UPDATE razorpay_orders 
        SET razorpay_payment_id = ?, razorpay_signature = ?, status = 'paid', updatetime = NOW() 
        WHERE razorpay_order_id = ?
      `;

      connection.query(updateOrderQuery, [razorpay_payment_id, razorpay_signature, razorpay_order_id], (updateErr, updateResult) => {
        if (updateErr) {
          return response.status(200).json({
            success: false,
            msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
            error: updateErr.message
          });
        }

        // Get subscription details
        const subscriptionQuery = "SELECT * FROM subscription_master WHERE subscription_id = ?";
        connection.query(subscriptionQuery, [order.subscription_id], (subErr, subResult) => {
          if (subErr) {
            return response.status(200).json({
              success: false,
              msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
              error: subErr.message
            });
          }

          const subscription = subResult[0];

          // Calculate subscription dates
          const now = new Date();
          let start_date = now;
          let end_date;

          if (subscription.subscription_type == 1) {
            end_date = new Date(now);
            end_date.setFullYear(end_date.getFullYear() + 1);
          } else if (subscription.subscription_type == 2) {
            end_date = new Date(now);
            end_date.setMonth(end_date.getMonth() + 1);
          }

          // Expire current active subscription
          const expirePromise = new Promise((resolve) => {
            const getActiveSubQuery = `
               SELECT user_subscription_id 
               FROM user_subscription_master 
               WHERE user_id = ? AND delete_flag = 0 AND end_date > NOW()
               ORDER BY user_subscription_id DESC LIMIT 1
             `;
            connection.query(getActiveSubQuery, [order.user_id], (activeErr, activeResult) => {
              if (!activeErr && activeResult.length > 0) {
                const expireQuery = "UPDATE user_subscription_master SET end_date = NOW() WHERE user_subscription_id = ?";
                connection.query(expireQuery, [activeResult[0].user_subscription_id], () => resolve());
              } else {
                resolve();
              }
            });
          });

          expirePromise.then(() => {
            // Create user subscription
            const createSubscriptionQuery = `
              INSERT INTO user_subscription_master 
              (subscription_id, user_id, amount, subscription_type, text, description, start_date, end_date, razorpay_order_id, razorpay_payment_id, delete_flag, createtime, updatetime, mysqltime) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW(), NOW())
            `;

            connection.query(createSubscriptionQuery, [
              order.subscription_id,
              order.user_id,
              order.amount,
              subscription.subscription_type,
              subscription.text,
              subscription.description,
              start_date,
              end_date,
              razorpay_order_id,
              razorpay_payment_id
            ], (createErr, createResult) => {
              if (createErr) {
                return response.status(200).json({
                  success: false,
                  msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
                  error: createErr.message
                });
              }

              return response.status(200).json({
                success: true,
                msg: ['Payment verified and subscription activated successfully', 'भुगतान सत्यापित और सब्सक्रिप्शन सक्रिय', 'पेमेंट सत्यापित आणि सब्सक्रिप्शन सक्रिय'],
                data: {
                  payment_id: razorpay_payment_id,
                  order_id: razorpay_order_id,
                  subscription_id: createResult.insertId,
                  amount: order.amount,
                  currency: order.currency,
                  start_date: moment(start_date).format('DD MMM, YYYY'),
                  end_date: moment(end_date).format('DD MMM, YYYY'),
                  subscription_type: subscription.subscription_type,
                  subscription_type_label:
                    subscription.subscription_type == 0 ? "Free or Referral" :
                      subscription.subscription_type == 1 ? "Yearly" :
                        subscription.subscription_type == 2 ? "Monthly" :
                          subscription.subscription_type == 3 ? "Lifetime" :
                            subscription.subscription_type == 4 ? "Other" :
                              "Unknown"
                }
              });
            });
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

/**
 * Get Payment History
 * Retrieves payment history for a user
 */
const getPaymentHistory = async (request, response) => {
  try {
    const { user_id } = request.query;

    if (!user_id) {
      return response.status(200).json({
        success: false,
        msg: ['user_id is required', 'user_id आवश्यक है', 'user_id आवश्यक आहे'],
        key: "user_id"
      });
    }

    const historyQuery = `
      SELECT 
        ro.razorpay_order_id,
        ro.razorpay_payment_id,
        ro.amount,
        ro.currency,
        ro.status,
        ro.createtime,
        ro.updatetime,
        sm.description as plan_name,
        sm.subscription_type,
        usm.start_date,
        usm.end_date
      FROM razorpay_orders ro
      LEFT JOIN subscription_master sm ON ro.subscription_id = sm.subscription_id
      LEFT JOIN user_subscription_master usm ON ro.razorpay_order_id = usm.razorpay_order_id
      WHERE ro.user_id = ?
      ORDER BY ro.createtime DESC
    `;

    connection.query(historyQuery, [user_id], (err, result) => {
      if (err) {
        return response.status(200).json({
          success: false,
          msg: languageMessage.internalServerError || ['Internal server error', 'आंतरिक सर्वर त्रुटि', 'आंतरिक सर्व्हर त्रुटी'],
          error: err.message
        });
      }

      const paymentHistory = result.map(payment => ({
        order_id: payment.razorpay_order_id,
        payment_id: payment.razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        status_label: payment.status === 'paid' ? 'Success' : 'Pending',
        plan_name: payment.plan_name,
        subscription_type: payment.subscription_type,
        subscription_type_label:
          payment.subscription_type == 0 ? "Free or Referral" :
            payment.subscription_type == 1 ? "Yearly" :
              payment.subscription_type == 2 ? "Monthly" :
                payment.subscription_type == 3 ? "Lifetime" :
                  payment.subscription_type == 4 ? "Other" :
                    "Unknown",
        start_date: payment.start_date ? moment(payment.start_date).format('DD MMM, YYYY') : null,
        end_date: payment.end_date ? moment(payment.end_date).format('DD MMM, YYYY') : null,
        created_at: moment(payment.createtime).format('DD MMM, YYYY HH:mm A'),
        updated_at: moment(payment.updatetime).format('DD MMM, YYYY HH:mm A')
      }));

      return response.status(200).json({
        success: true,
        msg: ['Payment history retrieved successfully', 'भुगतान इतिहास सफलतापूर्वक प्राप्त', 'पेमेंट इतिहास यशस्वीरित्या पुनर्प्राप्त'],
        data: {
          payments: paymentHistory,
          total_payments: paymentHistory.length,
          total_amount: paymentHistory.reduce((sum, payment) => sum + parseFloat(payment.amount), 0)
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
 * Razorpay Webhook Handler
 * Handles Razorpay webhook events
 */
const handleRazorpayWebhook = async (request, response) => {
  try {
    const signature = request.headers['x-razorpay-signature'];
    const body = JSON.stringify(request.body);

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return response.status(400).json({
        success: false,
        msg: 'Invalid webhook signature'
      });
    }

    const event = request.body;

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        // Payment was successful
        console.log('Payment captured:', event.payload.payment.entity.id);
        break;

      case 'payment.failed':
        // Payment failed
        console.log('Payment failed:', event.payload.payment.entity.id);
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    return response.status(200).json({
      success: true,
      msg: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return response.status(500).json({
      success: false,
      msg: 'Webhook processing failed',
      error: error.message
    });
  }
};

export { createRazorpayOrder, verifyRazorpayPayment, getPaymentHistory, handleRazorpayWebhook };
