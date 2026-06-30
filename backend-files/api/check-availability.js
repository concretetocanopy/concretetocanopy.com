const { getSupabase } = require('./_supabase');
const { VALID_TIMES } = require('./_tours');

// GET /api/check-availability?date=2026-06-30
// Returns: { taken: ["9:30 AM"], available: ["12:30 PM", "3:30 PM"] }
//
// A time is "taken" if ANY tour has a confirmed booking for that date+time,
// since only one tour can run per time slot across the whole business.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Missing or invalid date (expected YYYY-MM-DD)' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookings')
      .select('booking_time')
      .eq('booking_date', date)
      .eq('status', 'confirmed');

    if (error) throw error;

    const taken = [...new Set(data.map(row => row.booking_time))];
    const available = VALID_TIMES.filter(t => !taken.includes(t));

    return res.status(200).json({ taken, available });
  } catch (err) {
    console.error('check-availability error:', err);
    return res.status(500).json({ error: 'Could not check availability' });
  }
};
