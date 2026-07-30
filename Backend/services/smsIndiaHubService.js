import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * SMSIndia Hub SMS Service for Daily Hisab
 * Handles OTP sending via SMSIndia Hub API
 */
class SMSIndiaHubService {
  constructor() {
    this.apiKey = process.env.SMSINDIAHUB_API_KEY;
    this.senderId = process.env.SMSINDIAHUB_SENDER_ID;
    this.baseUrl = 'http://cloud.smsindiahub.in/vendorsms/pushsms.aspx';
    
    // Test mobile numbers that should get OTP 123456 without sending SMS
    this.testMobileNumbers = [
      '6261096283',
      '9685974247'
    ];
    
    if (!this.apiKey || !this.senderId) {
      console.warn('SMSIndia Hub credentials not configured. SMS functionality will be disabled.');
    }
  }

  /**
   * Check if mobile number is in test whitelist (should get OTP 123456 without SMS)
   * @param {string} phone - Phone number to check
   * @returns {boolean} - True if number is in test whitelist
   */
  isTestMobileNumber(phone) {
    // Normalize phone number to 10 digits
    const digits = phone.replace(/[^0-9]/g, '');
    const last10Digits = digits.slice(-10);
    
    // Check if last 10 digits match any test number
    return this.testMobileNumbers.includes(last10Digits);
  }

  /**
   * Check if SMSIndia Hub is properly configured
   * @returns {boolean}
   */
  isConfigured() {
    // Load credentials dynamically in case they weren't available during construction
    const apiKey = this.apiKey || process.env.SMSINDIAHUB_API_KEY;
    const senderId = this.senderId || process.env.SMSINDIAHUB_SENDER_ID;

    return !!(apiKey && senderId);
  }

  /**
   * Normalize phone number to Indian format with country code
   * @param {string} phone - Phone number to normalize
   * @returns {string} - Normalized phone number with country code (91XXXXXXXXXX)
   */
  normalizePhoneNumber(phone) {
    // Remove all non-digit characters
    const digits = phone.replace(/[^0-9]/g, '');

    // If it already has country code 91 and is 12 digits, return as is
    if (digits.startsWith('91') && digits.length === 12) {
      return digits;
    }

    // If it's 10 digits, add country code 91
    if (digits.length === 10) {
      return '91' + digits;
    }

    // If it's 11 digits and starts with 0, remove the 0 and add country code
    if (digits.length === 11 && digits.startsWith('0')) {
      return '91' + digits.substring(1);
    }

    // Return with country code as fallback
    return '91' + digits.slice(-10);
  }

  /**
   * Format mobile number for SMS API (compatible with existing code)
   * @param {string} phoneCode - Country code (e.g., "+91", "91")
   * @param {string} mobile - Mobile number
   * @returns {string} - Formatted mobile number
   */
  formatMobileNumber(phoneCode, mobile) {
    // Remove any non-digit characters
    const cleanPhoneCode = phoneCode.replace(/\D/g, '');
    const cleanMobile = mobile.replace(/\D/g, '');

    // Combine country code and mobile number
    const combined = cleanPhoneCode + cleanMobile;

    // Normalize to ensure it's in the correct format
    return this.normalizePhoneNumber(combined);
  }

  /**
   * Send OTP via SMS using SMSIndia Hub
   * @param {string} phone - Phone number to send SMS to
   * @param {string} otp - OTP code to send
   * @returns {Promise<Object>} - Response object
   */
  async sendOTP(phone, otp) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);
      
      // Check if this is a test mobile number (should get OTP 123456 without SMS)
      if (this.isTestMobileNumber(phone)) {
        const testMobile = normalizedPhone.slice(-10);
        console.log(`🧪 TEST MODE: Mobile ${testMobile} - Skipping SMS, OTP will be 123456`);
        
        // Return success without sending SMS
        return {
          success: true,
          messageId: `test_${Date.now()}`,
          status: 'skipped',
          to: normalizedPhone,
          body: `Welcome to the DailyHisab Pro powered by Appzeto.Your OTP for registration is 123456.BGADEC`,
          provider: 'SMSIndia Hub (Test Mode)',
          isTestMode: true,
          note: 'SMS skipped for test number, OTP is 123456'
        };
      }

      // Load credentials dynamically
      const apiKey = this.apiKey || process.env.SMSINDIAHUB_API_KEY;
      const senderId = this.senderId || process.env.SMSINDIAHUB_SENDER_ID || 'BGADEC';
      const entityId = process.env.SMSINDIAHUB_ENTITY_ID || '1001164203633432409';
      const templateId = process.env.SMSINDIAHUB_TEMPLATE_ID || '1007282516644508833';
      
      if (!apiKey || !senderId) {
        throw new Error('SMSIndia Hub not configured. Please check your environment variables.');
      }
      
      // Validate phone number (should be 12 digits with country code)
      if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('91')) {
        throw new Error(`Invalid phone number format: ${phone}. Expected 10-digit Indian mobile number.`);
      }

      // Must match DLT approved template exactly:
      // Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC
      const brandName = process.env.SMS_BRAND_NAME || 'DailyHisab Pro';
      const message = `Welcome to the ${brandName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;

      // Build the API URL with query parameters
      const params = new URLSearchParams({
        APIKey: apiKey,
        msisdn: normalizedPhone,
        sid: senderId,
        msg: message,
        fl: '0',
        dc: '0',
        gwid: '2',
        EntityID: entityId,
        TemplateID: templateId
      });

      const apiUrl = `${this.baseUrl}?${params.toString()}`;

      console.log(`📱 Sending OTP via SMSIndia Hub to ${normalizedPhone}`);

      // Make GET request to SMSIndia Hub API
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'DailyHisab/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000 // 15 second timeout
      });

      console.log('SMSIndia Hub Response Status:', response.status);
      console.log('SMSIndia Hub Response Data:', response.data);
      console.log('SMSIndia Hub Sender ID used:', senderId);

      // SMSIndia Hub returns JSON or plain text like "Failed#senderid not valid"
      const responseData = response.data;
      const responseText = typeof responseData === 'string'
        ? responseData
        : JSON.stringify(responseData);

      if (typeof responseData === 'string' && responseData.toLowerCase().includes('failed')) {
        console.error(`❌ SMSIndia Hub failed: ${responseData}`);
        throw new Error(`SMSIndia Hub failed: ${responseData}`);
      }

      // Check for success indicators in the response
      if (responseData.ErrorCode === '000' && responseData.ErrorMessage === 'Done') {
        const messageId = responseData.MessageData && responseData.MessageData[0]
          ? responseData.MessageData[0].MessageId
          : `sms_${Date.now()}`;

        console.log(`✅ OTP sent successfully via SMSIndia Hub to ${normalizedPhone}`);

        return {
          success: true,
          messageId: messageId,
          jobId: responseData.JobId,
          status: 'sent',
          to: normalizedPhone,
          body: message,
          provider: 'SMSIndia Hub',
          response: responseData
        };
      } else if (responseData.ErrorCode && responseData.ErrorCode !== '000') {
        console.error(`❌ SMSIndia Hub API error: ${responseData.ErrorMessage} (Code: ${responseData.ErrorCode})`);
        throw new Error(`SMSIndia Hub API error: ${responseData.ErrorMessage} (Code: ${responseData.ErrorCode})`);
      } else {
        console.error(`❌ Unexpected SMSIndia Hub response: ${responseText}`);
        throw new Error(`Unexpected SMSIndia Hub response: ${responseText}`);
      }

    } catch (error) {
      // Handle specific error cases
      if (error.response) {
        const errorData = error.response.data;

        if (error.response.status === 401) {
          console.error('❌ SMSIndia Hub authentication failed. Please check your API key.');
          throw new Error('SMSIndia Hub authentication failed. Please check your API key.');
        } else if (error.response.status === 400) {
          console.error('❌ SMSIndia Hub request error: Invalid request parameters');
          throw new Error(`SMSIndia Hub request error: Invalid request parameters`);
        } else if (error.response.status === 429) {
          console.error('❌ SMSIndia Hub rate limit exceeded. Please try again later.');
          throw new Error('SMSIndia Hub rate limit exceeded. Please try again later.');
        } else if (error.response.status === 500) {
          console.error('❌ SMSIndia Hub server error. Please try again later.');
          throw new Error('SMSIndia Hub server error. Please try again later.');
        } else {
          console.error(`❌ SMSIndia Hub API error (${error.response.status}):`, errorData);
          throw new Error(`SMSIndia Hub API error (${error.response.status}): ${errorData}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error('❌ SMSIndia Hub request timeout. Please try again.');
        throw new Error('SMSIndia Hub request timeout. Please try again.');
      } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        console.error('❌ Unable to connect to SMSIndia Hub service. Please check your internet connection.');
        throw new Error('Unable to connect to SMSIndia Hub service. Please check your internet connection.');
      } else if (error.code === 'ECONNRESET') {
        console.error('❌ SMSIndia Hub connection was reset. Please try again.');
        throw new Error('SMSIndia Hub connection was reset. Please try again.');
      }

      console.error('❌ SMSIndia Hub Error:', error.message);
      throw error;
    }
  }

  /**
   * Send custom SMS message
   * @param {string} phone - Phone number to send SMS to
   * @param {string} message - Custom message to send
   * @returns {Promise<Object>} - Response object
   */
  async sendCustomSMS(phone, message) {
    try {
      // Load credentials dynamically
      const apiKey = this.apiKey || process.env.SMSINDIAHUB_API_KEY;
      const senderId = this.senderId || process.env.SMSINDIAHUB_SENDER_ID;

      if (!apiKey || !senderId) {
        throw new Error('SMSIndia Hub not configured. Please check your environment variables.');
      }

      const normalizedPhone = this.normalizePhoneNumber(phone);

      // Validate phone number (should be 12 digits with country code)
      if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('91')) {
        throw new Error(`Invalid phone number format: ${phone}. Expected 10-digit Indian mobile number.`);
      }

      // Build the API URL with query parameters
      const params = new URLSearchParams({
        APIKey: apiKey,
        msisdn: normalizedPhone,
        sid: senderId,
        msg: message,
        fl: '0', // Flash message flag (0 = normal SMS)
        dc: '0', // Delivery confirmation (0 = no confirmation)
        gwid: '2' // Gateway ID (2 = transactional)
      });

      const apiUrl = `${this.baseUrl}?${params.toString()}`;

      // Make GET request to SMSIndia Hub API
      const response = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'DailyHisab/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000 // 15 second timeout
      });

      const responseData = response.data;

      // Check for success indicators in the response
      if (responseData.ErrorCode === '000' && responseData.ErrorMessage === 'Done') {
        return {
          success: true,
          messageId: responseData.MessageData && responseData.MessageData[0]
            ? responseData.MessageData[0].MessageId
            : `sms_${Date.now()}`,
          jobId: responseData.JobId,
          status: 'sent',
          to: normalizedPhone,
          body: message,
          provider: 'SMSIndia Hub',
          response: responseData
        };
      } else if (responseData.ErrorCode && responseData.ErrorCode !== '000') {
        throw new Error(`SMSIndia Hub API error: ${responseData.ErrorMessage} (Code: ${responseData.ErrorCode})`);
      } else {
        return {
          success: true,
          messageId: `sms_${Date.now()}`,
          status: 'sent',
          to: normalizedPhone,
          body: message,
          provider: 'SMSIndia Hub',
          response: responseData
        };
      }

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get account balance from SMSIndia Hub
   * @returns {Promise<Object>} - Balance information
   */
  async getBalance() {
    try {
      // Load credentials dynamically
      const apiKey = this.apiKey || process.env.SMSINDIAHUB_API_KEY;

      if (!apiKey) {
        throw new Error('SMSIndia Hub not configured.');
      }

      // SMSIndia Hub balance API endpoint
      const balanceUrl = `http://cloud.smsindiahub.in/vendorsms/checkbalance.aspx?APIKey=${apiKey}`;

      const response = await axios.get(balanceUrl, {
        headers: {
          'User-Agent': 'DailyHisab/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });

      const responseText = response.data.toString();

      // Parse balance from response (SMSIndia Hub typically returns balance as text)
      const balanceMatch = responseText.match(/(\d+\.?\d*)/);
      const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

      return {
        success: true,
        balance: balance,
        currency: 'INR',
        response: responseText
      };
    } catch (error) {
      throw new Error(`Failed to fetch SMSIndia Hub balance: ${error.message}`);
    }
  }
}

// Create singleton instance
const smsIndiaHubService = new SMSIndiaHubService();

export default smsIndiaHubService;

