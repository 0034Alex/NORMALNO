const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (e) {}
}

module.exports = async (req, res) => {
  try {
    const now = new Date().toISOString();

    const carsResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.auction&start_notified=eq.false&auction_starts_at=lte.${now}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const cars = await carsResp.json();

    for (const car of cars || []) {
      const favResp = await fetch(
        `${SUPABASE_URL}/rest/v1/favorites?car_id=eq.${car.id}&select=user_id`,
        { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
      );
      const favs = await favResp.json();

      for (const fav of favs || []) {
        const profResp = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${fav.user_id}&select=telegram_user_id`,
          { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
        );
        const profs = await profResp.json();
        const tgId = profs && profs[0] && profs[0].telegram_user_id;
        if (tgId) {
          await sendTelegramMessage(tgId, `🔨 Торги розпочались! ${car.brand} ${car.model}, ${car.year} — стартова ціна ${car.start_price} ${car.currency}. Встигніть зробити ставку!`);
        }
      }

      await fetch(`${SUPABASE_URL}/rest/v1/cars?id=eq.${car.id}`, {
        method: 'PATCH',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ start_notified: true })
      });
    }

    res.status(200).json({ processed: (cars || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
