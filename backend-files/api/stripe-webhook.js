const Stripe = require('stripe');
const { getSupabase } = require('./_supabase');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel needs the raw request body to verify the Stripe signature,
// so we disable the default JSON body parsing for this route.
module.exports.config = {
  api: {
    bodyParser: false
  }
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

// POST /api/stripe-webhook
// Configured in the Stripe Dashboard to call this URL on checkout events.
// On checkout.session.completed, marks the matching booking as "confirmed".
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const rawBody = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const bookingId = session.metadata && session.metadata.booking_id;

    if (bookingId) {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed',
          customer_email: session.customer_details ? session.customer_details.email : null
        })
        .eq('id', bookingId);

      if (error) {
        // If this fails because the unique index rejected a duplicate
        // confirmed slot (extremely rare race condition), log it for
        // manual follow-up/refund - this should not normally happen
        // since we re-check availability before creating the session.
        console.error('Failed to confirm booking', bookingId, error);
      }
    }
  }

  return res.status(200).json({ received: true });
};
