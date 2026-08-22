const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { carId, eventType } = req.body; // eventType: 'new' | 'price_drop' | 'sold'
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    const carResp = await fetch(`${SUPABASE_URL}/rest/v1/cars?id=eq.${carId}&select=*`, { headers });
    const cars = await carResp.json();
    const car = cars && cars[0];
    if (!car) { res.status(200).json({ skipped: 'car not found' }); return; }

    const partnerResp = await fetch(`${SUPABASE_URL}/rest/v1/partners?user_id=eq.${car.user_id}&status=eq.approved&select=telegram_channel`, { headers });
    const partners = await partnerResp.json();
    const channel = partners && partners[0] && partners[0].telegram_channel;
    if (!channel) { res.status(200).json({ skipped: 'no channel configured' }); return; }

    const priceStr = `${Number(car.price || car.start_price || 0).toLocaleString('uk-UA')} ${car.currency || ''}`;
    let caption = '';
    if (eventType === 'price_drop') {
      caption = `📉 Знижена ціна!\n\n🚗 ${car.brand} ${car.model}, ${car.year}\n💰 Нова ціна: ${priceStr}`;
    } else if (eventType === 'sold') {
      caption = `✅ Продано!\n\n🚗 ${car.brand} ${car.model}, ${car.year}`;
    } else {
      caption = `🆕 Нове авто${car.listing_type === 'auction' ? ' на аукціоні' : ''}!\n\n🚗 ${car.brand} ${car.model}, ${car.year}\n💰 ${priceStr}`;
    }

    const url = `https://normalno-a55.vercel.app/${car.listing_type === 'auction' ? 'lot' : 'car'}.html?id=${car.id}`;
    const photoUrl = (car.photos && car.photos[0]) || car.photo_url;

    const replyMarkup = { inline_keyboard: [[{ text: 'Детальніше', url }]] };

    if (photoUrl) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, photo: photoUrl, caption, reply_markup: replyMarkup })
      });
    } else {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, text: caption, reply_markup: replyMarkup })
      });
    }

    res.status(200).json({ posted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
