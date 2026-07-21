import connection from '../connection/dbConfig.js'



function generateRandomOTP(length, mobile = null) {
  // Test mobile numbers that should always get OTP 123456
  const testMobileNumbers = [
    '1234567890',  // Play Store testing
    '6261096283',  // Test number 1
    '9685974247'   // Test number 2
  ];

  // Check if this is a test mobile number
  if (mobile) {
    // Normalize mobile number to 10 digits
    const digits = mobile.replace(/[^0-9]/g, '');
    const last10Digits = digits.slice(-10);

    if (testMobileNumbers.includes(last10Digits)) {
      console.log(`🧪 TEST OTP for mobile ${last10Digits}: 123456`);
      return '123456';
    }
  }

  // Production mode - generate random OTP for all other numbers
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
}

// OTP generation now only returns 123456 for mobile number 1234567890 (Play Store testing)



function fetchUserData(userId, callback) {



  const query = "SELECT app_lock_status,app_lock_code,profile_complete,name,zipcode,notification_status,user_id,apple_id,google_id,city_id,country_id, login_type,gender, user_type, f_name, l_name, username, dob, age, phone_code, mobile, otp, otp_verify, email, password, image, address, latitude, longitude,  delete_flag, createtime, updatetime FROM user_master WHERE  user_id = ? AND delete_flag =0";



  connection.query(query, [userId], async (error, results) => {



    if (error) {



      callback(error, null);



      return;



    }



    if (results.length > 0) {



      const userData = results[0];



      const userDataArray = {

        user_id: userData.user_id,

        login_type: userData.login_type,

        login_type_label: "0=app, 1=google, 2=apple",

        user_type: userData.user_type,

        user_type_label: userData.user_type === 0 ? 'Manager' : userData.user_type === 1 ? 'User' : 'Unknown',

        profile_complete: userData.profile_complete,

        profile_complete_label: "0 for not completed , 1 for completed",

        email: userData.email,

        username: userData.username,

        name: userData.name,

        DOB: userData.dob,

        gender: userData.gender,

        gender_label: "1 for male, 2 for female, 3 for other",

        apple_id: userData.apple_id,

        google_id: userData.google_id,

        zipcode: userData.zipcode,

        city_id: userData.city_id,

        mobile: userData.mobile,

        phone_code: userData.phone_code,

        otp: userData.otp,

        otp_verify: userData.otp_verify,

        image: userData.image,

        address: userData.address,

        latitude: userData.latitude,

        longitude: userData.longitude,

        createtime: userData.createtime,

        updatetime: userData.updatetime,

        notification_status: userData.notification_status,

        notification_status_label: "0=off,1=on",

        app_lock_code: userData.app_lock_code,

        app_lock_status: userData.app_lock_status,

        app_lock_status_label: "0 = off, 1 = on",

      };



      callback(null, userDataArray);



    } else {



      callback(null, null);



    }



  });



}



function fetchManagerData(managerId, callback) {
  const query = `
    SELECT 
      bmm.manager_id,
      bmm.manager_user_id,
      bmm.owner_user_id,
      bmm.business_account_id,
      bmm.manager_role,
      bmm.permissions,
      bmm.status,
      bmm.invited_at,
      bmm.accepted_at,
      bmm.last_accessed,
      bmm.access_expires_at,
      bmm.notes,
      bmm.otp,
      bmm.otp_generated_at,
      bmm.last_otp_sent_at,
      bmm.createtime,
      bmm.updatetime,
      um.user_id,
      um.name,
      um.email,
      um.mobile,
      um.phone_code,
      um.username,
      um.f_name,
      um.l_name,
      um.dob,
      um.age,
      um.gender,
      um.image,
      um.address,
      um.zipcode,
      um.city_id,
      um.country_id,
      um.latitude,
      um.longitude,
      um.login_type,
      um.user_type,
      um.profile_complete,
      um.apple_id,
      um.google_id,
      um.otp_verify,
      um.notification_status,
      um.app_lock_code,
      um.app_lock_status,
      owner.name as owner_name,
      owner.mobile as owner_mobile,
      owner.email as owner_email,
      uam.account_name as business_account_name
    FROM business_manager_master bmm
    LEFT JOIN user_master um ON bmm.manager_user_id = um.user_id AND um.delete_flag = 0
    LEFT JOIN user_master owner ON bmm.owner_user_id = owner.user_id AND owner.delete_flag = 0
    LEFT JOIN user_account_master uam ON bmm.business_account_id = uam.user_account_id
    WHERE bmm.manager_id = ? AND bmm.delete_flag = 0
  `;

  connection.query(query, [managerId], async (error, results) => {
    if (error) {
      callback(error, null);
      return;
    }

    if (results.length > 0) {
      const managerData = results[0];

      const managerDataArray = {
        manager_id: managerData.manager_id,
        manager_user_id: managerData.manager_user_id,
        owner_user_id: managerData.owner_user_id,
        business_account_id: managerData.business_account_id,
        manager_role: managerData.manager_role,
        manager_role_label: "full_access, limited_access, view_only",
        permissions: managerData.permissions ? JSON.parse(managerData.permissions) : null,
        status: managerData.status,
        status_label: "active, inactive, pending",
        invited_at: managerData.invited_at,
        accepted_at: managerData.accepted_at,
        last_accessed: managerData.last_accessed,
        access_expires_at: managerData.access_expires_at,
        notes: managerData.notes,
        otp: managerData.otp,
        otp_generated_at: managerData.otp_generated_at,
        last_otp_sent_at: managerData.last_otp_sent_at,
        createtime: managerData.createtime,
        updatetime: managerData.updatetime,

        // User details
        user_id: managerData.user_id,
        name: managerData.name,
        email: managerData.email,
        mobile: managerData.mobile,
        phone_code: managerData.phone_code,
        username: managerData.username,
        f_name: managerData.f_name,
        l_name: managerData.l_name,
        dob: managerData.dob,
        age: managerData.age,
        gender: managerData.gender,
        gender_label: "1 for male, 2 for female, 3 for other",
        image: managerData.image,
        address: managerData.address,
        zipcode: managerData.zipcode,
        city_id: managerData.city_id,
        country_id: managerData.country_id,
        latitude: managerData.latitude,
        longitude: managerData.longitude,
        login_type: managerData.login_type,
        login_type_label: "0=app, 1=google, 2=apple",
        user_type: managerData.user_type,
        user_type_label: "0 = admin,1 = user,2 = driver",
        profile_complete: managerData.profile_complete,
        profile_complete_label: "0 for not completed , 1 for completed",
        apple_id: managerData.apple_id,
        google_id: managerData.google_id,
        otp_verify: managerData.otp_verify,
        notification_status: managerData.notification_status,
        notification_status_label: "0=off,1=on",
        app_lock_code: managerData.app_lock_code,
        app_lock_status: managerData.app_lock_status,
        app_lock_status_label: "0 = off, 1 = on",

        // Owner details
        owner_name: managerData.owner_name,
        owner_mobile: managerData.owner_mobile,
        owner_email: managerData.owner_email,

        // Business account details
        business_account_name: managerData.business_account_name
      };

      callback(null, managerDataArray);
    } else {
      callback(null, null);
    }
  });
}

function DeviceTokenStore_1_Signal(user_id, device_type, player_id, callback) {



  const inserttime = new Date().toISOString().slice(0, 19).replace('T', ' ');



  const selectSql = "SELECT user_notification_id FROM user_notification WHERE user_id = ?";



  connection.query(selectSql, [user_id], (err, result) => {



    if (err) {



      return callback({ success: false, msg: languageMessages.internalServerError, error: err.message });



    }



    if (result.length > 0) {



      const updateSql = "UPDATE user_notification SET device_type = ?, player_id = ? WHERE user_id = ?";



      connection.query(updateSql, [device_type, player_id, user_id], (err, updateResult) => {



        if (err) {



          return callback({ success: false, msg: languageMessages.internalServerError, error: err.message });



        }



        return callback({ success: true, msg: "Notification updated successfully" });



      });



    } else {



      // INSERT if user_id does not exist



      const insertSql = "INSERT INTO user_notification (user_id, device_type, player_id, inserttime) VALUES (?, ?, ?, ?)";



      connection.query(insertSql, [user_id, device_type, player_id, inserttime], (err, insertResult) => {



        if (err) {



          return callback({ success: false, msg: languageMessages.internalServerError, error: err.message });



        }



        return callback({ success: true, msg: "Notification inserted successfully" });



      });



    }



  });



}



export { generateRandomOTP, fetchUserData, fetchManagerData, DeviceTokenStore_1_Signal };