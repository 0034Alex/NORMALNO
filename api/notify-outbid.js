const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { previousUserId, carLabel, newBid, currency } = req.body;
    if (!previousUserId) {
      res.status(200).json({ skipped: true });
      return;
    }

    const profResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${previousUserId}&select=telegram_user_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const profs = await profResp.json();
    const tgId = profs && profs[0] && profs[0].telegram_user_id;

    if (tgId) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgId,
          text: `⚡ Вашу ставку перебили! ${carLabel} — нова ціна ${newBid} ${currency}. Встигніть відповісти!`
        })
      });
    }

    res.status(200).json({ notified: !!tgId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
