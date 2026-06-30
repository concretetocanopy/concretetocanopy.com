const Stripe = require('stripe');
const { getSupabase } = require('./_supabase');
const { TOURS, PRICE_PER_TICKET_CAD, VALID_TIMES } = require('./_tours');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/create-checkout-session
// Body: { tourId, date, time, tickets }
//
// Steps:
// 1. Validate input
// 2. Re-check the slot isn't already confirmed-booked by another tour (race-safe
//    double check; the database's unique index is the real backstop)
// 3. Insert a "pending" booking row
// 4. Create a Stripe Checkout Session for $50 x tickets, tagging it with our
//    booking id in metadata so the webhook can find it later
// 5. Return the Checkout Session URL for the browser to redirect to
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tourId, date, time, tickets } = req.body || {};

  const tour = TOURS[tourId];
  if (!tour) return res.status(400).json({ error: 'Unknown tour' });
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  if (!VALID_TIMES.includes(time)) {
    return res.status(400).json({ error: 'Invalid time' });
  }
  const ticketCount = parseInt(tickets, 10);
  if (!ticketCount || ticketCount < 1 || ticketCount > 10) {
    return res.status(400).json({ error: 'Invalid ticket count' });
  }

  const supabase = getSupabase();

  try {
    // Re-check availability right before booking (best-effort; the DB's
    // unique index on confirmed bookings is what actually guarantees no
    // double-booking even under a race condition)
    const { data: existing, error: checkErr } = await supabase
      .from('bookings')
      .select('id')
      .eq('booking_date', date)
      .eq('booking_time', time)
      .eq('status', 'confirmed')
      .limit(1);

    if (checkErr) throw checkErr;
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'That time slot was just booked. Please pick another.' });
    }

    // Create a pending booking row
    const { data: inserted, error: insertErr } = await supabase
      .from('bookings')
      .insert({
        tour_id: tourId,
        tour_name: tour.name,
        booking_date: date,
        booking_time: time,
        tickets: ticketCount,
        status: 'pending'
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    const totalCents = ticketCount * PRICE_PER_TICKET_CAD * 100;

    const origin = req.headers.origin || 'https://concretetocanopy.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `${tour.name} — ${date} at ${time}`
            },
            unit_amount: PRICE_PER_TICKET_CAD * 100
          },
          quantity: ticketCount
        }
      ],
      metadata: {
        booking_id: inserted.id,
        tour_id: tourId,
        tour_name: tour.name,
        date,
        time,
        tickets: String(ticketCount)
      },
      success_url: `${origin}/?booking=success`,
      cancel_url: `${origin}/?booking=cancelled`
    });

    // Save the Stripe session id on the booking row so the webhook can
    // cross-reference it
    await supabase
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', inserted.id);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
};
