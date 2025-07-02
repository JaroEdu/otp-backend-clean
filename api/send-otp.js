import axios from 'axios';
import { supabase } from '../../lib/supabase.js';
import { sendToLeadSquared } from '../../lib/leadsquared.js';
// import { appendOtpRow } from '../../lib/sheets.js'; // Optional if you use Google Sheets

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Growtel SMS credentials
const GROWTEL_API_KEY = 'SZ5tXohW'; // Replace with actual key if needed
const SENDER_ID = 'JaroEd';
const ENTITY_ID = '1001696454968857192';
const TEMPLATE_ID = '1007125343764448982'; // IFEEL - OTP template

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }

  const otp = generateOtp();
  const timestamp = Date.now();

  // 1. Store OTP in Supabase
  const { error } = await supabase.from('otps').upsert({
    phone: phoneNumber,
    otp,
    timestamp,
  });

  if (error) {
    return res.status(500).json({
      success: false,
      message: 'Database error',
      error,
    });
  }

  // 2. Send OTP via Growtel using IFEEL template
  const message = `Your OTP for accessing the Jaro Connect app is ${otp}. Explore career growth, alumni networking, and lifelong learning—all in one place.– Jaro Education`;

  try {
    const smsRes = await axios.get('https://api.grow-infinity.io/api/sms', {
      params: {
        key: GROWTEL_API_KEY,
        to: phoneNumber,
        from: SENDER_ID,
        body: message,
        entityid: ENTITY_ID,
        templateid: TEMPLATE_ID,
      },
    });

    if (smsRes.data.status !== 100) {
      return res.status(500).json({
        success: false,
        message: 'SMS failed',
        details: smsRes.data,
      });
    }

    // 3. Sync phone to LeadSquared
    await sendToLeadSquared(phoneNumber);

    // 4. Optional: log to Google Sheet
    // await appendOtpRow({ phone: phoneNumber, otp });

    return res.json({ success: true, message: 'OTP sent successfully' });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Growtel error',
      error: err.message,
    });
  }
}
