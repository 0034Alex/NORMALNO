const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  try {
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' };

    // 1) Звичайні оголошення старші 30 днів, не продані, не в архіві
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const expiredResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.sale&archived=eq.false&sold=eq.false&created_at=lt.${thirtyDaysAgo}`,
      { method: 'PATCH', headers, body: JSON.stringify({ archived: true, archived_at: new Date().toISOString() }) }
    );

    // 2) Завершені аукціони (час вийшов), ще не в архіві
    const now = new Date().toISOString();
    const endedResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.auction&archived=eq.false&auction_ends_at=lt.${now}`,
      { method: 'PATCH', headers, body: JSON.stringify({ archived: true, archived_at: new Date().toISOString() }) }
    );

    res.status(200).json({ ok: expiredResp.ok && endedResp.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
