const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.auction&auction_ends_at=lt.${cutoff}`,
      {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' }
      }
    );

    res.status(200).json({ ok: resp.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
