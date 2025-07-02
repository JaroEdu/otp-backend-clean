import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { appendOtpRow } from '../lib/sheets.js'; // if used
import { sendToLeadSquared } from '../lib/leadsquared.js'; // ✅ Add this

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const GROWTEL_API_KEY = 'your-key';
const SENDER_ID = 'JaroEd';
const ENTITY_ID = 'your-entity-id';
const TEMPLATE_ID = 'your-template-id';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ success: false, message: 'Phone number required' });
  }

  const otp = generateOtp();
  const timestamp = Date.now();

  // 1. Save to Supabase
  const { error } = await supabase.from('otps').upsert({
    phone: phoneNumber,
    otp,
    timestamp
  });

  if (error) {
    return res.status(500).json({ success: false, message: 'Database error', error });
  }

  // 2. Send OTP via Growtel
  const message = `Your OTP for accessing the Jaro Connect app is ${otp}...`;

  try {
    const response = await axios.get('https://api.grow-infinity.io/api/sms', {
      params: {
        key: GROWTEL_API_KEY,
        to: phoneNumber,
        from: SENDER_ID,
        body: message,
        entityid: ENTITY_ID,
        templateid: TEMPLATE_ID
      }
    });

    if (response.data.status === 100) {
      // ✅ 3. Send to LeadSquared HERE:
      await sendToLeadSquared(phoneNumber);

      // ✅ 4. Optionally log to Google Sheets
      // await appendOtpRow({ phone: phoneNumber, otp });

      return res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      return res.status(500).json({ success: false, message: 'SMS failed', details: response.data });
    }

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Growtel error', error: err.message });
  }
}
