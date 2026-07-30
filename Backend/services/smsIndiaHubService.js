import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * SMSIndia Hub SMS Service for Daily Hisab
 * Matches Mynzo / SMS India Hub DLT implementation pattern.
 * App API routes are unchanged — only SMS provider call is updated.
 */
class SMSIndiaHubService {
  constructor() {
    this.baseUrl = 'https://cloud.smsindiahub.in/vendorsms/pushsms.aspx';

    // Test mobile numbers that should get OTP 123456 without sending SMS
    this.testMobileNumbers = [
      '6261096283',
      '9685974247'
    ];

    if (!this.getApiKey() || !this.getSenderId()) {
      console.warn('SMSIndia Hub credentials not configured. SMS functionality will be disabled.');
    }
  }

  // Support both naming styles (existing + Mynzo guide)
  getApiKey() {
    return process.env.SMSINDIAHUB_API_KEY || process.env.SMS_API_KEY || '';
  }

  getSenderId() {
    return process.env.SMSINDIAHUB_SENDER_ID || process.env.SMS_SENDER_ID || 'BGADEC';
  }

  getEntityId() {
    return process.env.SMSINDIAHUB_ENTITY_ID || process.env.SMS_PE_ID || '1001164203633432409';
  }

  getTemplateId() {
    return process.env.SMSINDIAHUB_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '1007282516644508833';
  }

  isTestMobileNumber(phone) {
    const digits = phone.replace(/[^0-9]/g, '');
    const last10Digits = digits.slice(-10);
    const envTestNumbers = (process.env.TEST_PHONE_NUMBERS || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    return this.testMobileNumbers.includes(last10Digits) || envTestNumbers.includes(last10Digits);
  }

  isConfigured() {
    return !!(this.getApiKey() && this.getSenderId());
  }

  normalizePhoneNumber(phone) {
    const digits = phone.replace(/[^0-9]/g, '');

    if (digits.startsWith('91') && digits.length === 12) {
      return digits;
    }

    if (digits.length === 10) {
      return '91' + digits;
    }

    if (digits.length === 11 && digits.startsWith('0')) {
      return '91' + digits.substring(1);
    }

    return '91' + digits.slice(-10);
  }

  formatMobileNumber(phoneCode, mobile) {
    const cleanPhoneCode = phoneCode.replace(/\D/g, '');
    const cleanMobile = mobile.replace(/\D/g, '');
    return this.normalizePhoneNumber(cleanPhoneCode + cleanMobile);
  }

  /**
   * Build OTP message — must match DLT approved template exactly:
   * Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC
   */
  buildOtpMessage(otp) {
    const brandName = process.env.SMS_BRAND_NAME || 'DailyHisab Pro';
    return `Welcome to the ${brandName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
  }

  /**
   * Send OTP via SMS using SMSIndia Hub (Mynzo-compatible params)
   */
  async sendOTP(phone, otp) {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);

      if (this.isTestMobileNumber(phone)) {
        const testMobile = normalizedPhone.slice(-10);
        console.log(`🧪 TEST MODE: Mobile ${testMobile} - Skipping SMS, OTP will be 123456`);

        return {
          success: true,
          messageId: `test_${Date.now()}`,
          status: 'skipped',
          to: normalizedPhone,
          body: this.buildOtpMessage('123456'),
          provider: 'SMSIndia Hub (Test Mode)',
          isTestMode: true,
          note: 'SMS skipped for test number, OTP is 123456'
        };
      }

      const apiKey = this.getApiKey();
      const senderId = this.getSenderId();
      const entityId = this.getEntityId();
      const templateId = this.getTemplateId();
      // Guide uses gwid=2 (transactional). Override with SMSINDIAHUB_GWID if needed.
      const gatewayId = process.env.SMSINDIAHUB_GWID || process.env.SMS_GWID || '2';

      if (!apiKey || !senderId) {
        throw new Error('SMSIndia Hub not configured. Please check your environment variables.');
      }

      if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('91')) {
        throw new Error(`Invalid phone number format: ${phone}. Expected 10-digit Indian mobile number.`);
      }

      const message = this.buildOtpMessage(otp);

      // Exact param names from Mynzo guide:
      // APIKey, msisdn, sid, msg, fl, gwid, EntityId, dlttemplateid
      let smsUrl =
        `${this.baseUrl}` +
        `?APIKey=${encodeURIComponent(apiKey)}` +
        `&msisdn=${encodeURIComponent(normalizedPhone)}` +
        `&sid=${encodeURIComponent(senderId)}` +
        `&msg=${encodeURIComponent(message)}` +
        `&fl=0` +
        `&gwid=${encodeURIComponent(gatewayId)}`;

      if (entityId) {
        smsUrl += `&EntityId=${encodeURIComponent(entityId)}`;
      }
      if (templateId) {
        smsUrl += `&dlttemplateid=${encodeURIComponent(templateId)}`;
      }

      console.log(`📱 Sending OTP via SMSIndia Hub to ${normalizedPhone}`);
      console.log(`SMSIndia Hub config => sid=${senderId}, gwid=${gatewayId}, EntityId=${entityId}, dlttemplateid=${templateId}`);

      const response = await axios.get(smsUrl, {
        headers: {
          'User-Agent': 'DailyHisab/1.0',
          Accept: '*/*'
        },
        timeout: 15000,
        // Provider may return text or JSON
        responseType: 'text',
        transformResponse: [(data) => data]
      });

      const raw = response.data;
      console.log('SMSIndia Hub Response Status:', response.status);
      console.log('SMSIndia Hub Response Data:', raw);
      console.log('SMSIndia Hub Sender ID used:', senderId);

      let responseData = raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.toLowerCase().includes('failed')) {
          console.error(`❌ SMSIndia Hub failed: ${trimmed}`);
          throw new Error(`SMSIndia Hub failed: ${trimmed}`);
        }
        try {
          responseData = JSON.parse(trimmed);
        } catch {
          // Non-JSON success-ish text — treat as success only if not failed
          console.log(`✅ OTP sent successfully via SMSIndia Hub to ${normalizedPhone}`);
          return {
            success: true,
            messageId: `sms_${Date.now()}`,
            status: 'sent',
            to: normalizedPhone,
            body: message,
            provider: 'SMSIndia Hub',
            response: trimmed
          };
        }
      }

      if (responseData.ErrorCode === '000' && responseData.ErrorMessage === 'Done') {
        const messageId = responseData.MessageData && responseData.MessageData[0]
          ? responseData.MessageData[0].MessageId
          : `sms_${Date.now()}`;

        console.log(`✅ OTP sent successfully via SMSIndia Hub to ${normalizedPhone}`);

        return {
          success: true,
          messageId,
          jobId: responseData.JobId,
          status: 'sent',
          to: normalizedPhone,
          body: message,
          provider: 'SMSIndia Hub',
          response: responseData
        };
      }

      if (responseData.ErrorCode && responseData.ErrorCode !== '000') {
        console.error(`❌ SMSIndia Hub API error: ${responseData.ErrorMessage} (Code: ${responseData.ErrorCode})`);
        throw new Error(`SMSIndia Hub API error: ${responseData.ErrorMessage} (Code: ${responseData.ErrorCode})`);
      }

      const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
      console.error(`❌ Unexpected SMSIndia Hub response: ${responseText}`);
      throw new Error(`Unexpected SMSIndia Hub response: ${responseText}`);
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        console.error(`❌ SMSIndia Hub API error (${error.response.status}):`, errorData);
        throw new Error(`SMSIndia Hub API error (${error.response.status}): ${errorData}`);
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('SMSIndia Hub request timeout. Please try again.');
      }
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to SMSIndia Hub service. Please check your internet connection.');
      }
      if (error.code === 'ECONNRESET') {
        throw new Error('SMSIndia Hub connection was reset. Please try again.');
      }

      console.error('❌ SMSIndia Hub Error:', error.message);
      throw error;
    }
  }

  async sendCustomSMS(phone, message) {
    const apiKey = this.getApiKey();
    const senderId = this.getSenderId();
    const entityId = this.getEntityId();
    const gatewayId = process.env.SMSINDIAHUB_GWID || process.env.SMS_GWID || '2';

    if (!apiKey || !senderId) {
      throw new Error('SMSIndia Hub not configured. Please check your environment variables.');
    }

    const normalizedPhone = this.normalizePhoneNumber(phone);
    if (normalizedPhone.length !== 12 || !normalizedPhone.startsWith('91')) {
      throw new Error(`Invalid phone number format: ${phone}. Expected 10-digit Indian mobile number.`);
    }

    let smsUrl =
      `${this.baseUrl}` +
      `?APIKey=${encodeURIComponent(apiKey)}` +
      `&msisdn=${encodeURIComponent(normalizedPhone)}` +
      `&sid=${encodeURIComponent(senderId)}` +
      `&msg=${encodeURIComponent(message)}` +
      `&fl=0` +
      `&gwid=${encodeURIComponent(gatewayId)}`;

    if (entityId) {
      smsUrl += `&EntityId=${encodeURIComponent(entityId)}`;
    }

    const response = await axios.get(smsUrl, {
      headers: { 'User-Agent': 'DailyHisab/1.0', Accept: '*/*' },
      timeout: 15000,
      responseType: 'text',
      transformResponse: [(data) => data]
    });

    return {
      success: true,
      messageId: `sms_${Date.now()}`,
      status: 'sent',
      to: normalizedPhone,
      body: message,
      provider: 'SMSIndia Hub',
      response: response.data
    };
  }

  async getBalance() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('SMSIndia Hub not configured.');
    }

    const balanceUrl = `https://cloud.smsindiahub.in/vendorsms/checkbalance.aspx?APIKey=${encodeURIComponent(apiKey)}`;
    const response = await axios.get(balanceUrl, {
      headers: { 'User-Agent': 'DailyHisab/1.0', Accept: '*/*' },
      timeout: 10000,
      responseType: 'text',
      transformResponse: [(data) => data]
    });

    const responseText = String(response.data);
    const balanceMatch = responseText.match(/(\d+\.?\d*)/);
    const balance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;

    return {
      success: true,
      balance,
      currency: 'INR',
      response: responseText
    };
  }
}

const smsIndiaHubService = new SMSIndiaHubService();

export default smsIndiaHubService;
