#!/bin/bash
# Production OTP test scripts for Daily Hisab
# Base URL: https://admin.dailyhisab.co.in/api

PROD_API="https://admin.dailyhisab.co.in/api"
MOBILE="6268204871"

echo "=== 1) Login with Mobile (Send OTP) ==="
curl -s -X POST "$PROD_API/login_with_mobile" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"mobile\": \"$MOBILE\",
    \"phone_code\": \"+91\",
    \"player_id\": \"test_player_id_001\",
    \"device_type\": \"android\",
    \"user_type\": \"1\"
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "=== 2) Sign Up with Mobile (Send OTP - new user) ==="
curl -s -X POST "$PROD_API/sign_up_with_mobile" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"mobile\": \"$MOBILE\",
    \"phone_code\": \"+91\",
    \"player_id\": \"test_player_id_001\",
    \"device_type\": \"android\",
    \"user_type\": \"1\",
    \"name\": \"Test User\"
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "=== 3) Resend OTP ==="
curl -s -X POST "$PROD_API/resend_otp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"mobile\": \"$MOBILE\",
    \"phone_code\": \"+91\",
    \"user_type\": \"1\"
  }" | python3 -m json.tool 2>/dev/null || cat

echo ""
echo "=== 4) Verify OTP (replace user_id + otp from login response) ==="
curl -s -X POST "$PROD_API/otp_verify" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{
    \"user_id\": 1,
    \"otp\": \"123456\"
  }" | python3 -m json.tool 2>/dev/null || cat
