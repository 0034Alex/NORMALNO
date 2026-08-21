const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { sendPushToUsers } = require('../lib/push-helper');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { carId, carLabel, oldPrice, newPrice, currency } = req.body;

    const favResp = await fetch(
      `${SUPABASE_URL}/rest/v1/favorites?car_id=eq.${carId}&select=user_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const favs = await favResp.json();
    const userIds = (favs || []).map(f => f.user_id);

    if (userIds.length === 0) {
      res.status(200).json({ notified: 0 });
      return;
    }

    await sendPushToUsers(userIds, {
      title: '❤️ Ціна знижена!',
      body: `${carLabel}: ${oldPrice} → ${newPrice} ${currency}`,
      url: `/car.html?id=${carId}`
    });

    res.status(200).json({ notified: userIds.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
