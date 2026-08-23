const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const FUEL_LABELS = { petrol: 'Бензин', diesel: 'Дизель', hybrid: 'Гібрид', gas: 'Газ', electric: 'Електро' };
const TRANSMISSION_LABELS = { manual: 'Механіка', automatic: 'Автомат', variator: 'Варіатор' };

// Рядок з деталями авто у вигляді компактних міток замість "через кому":
// "⛽ Дизель   ⚙️ Автомат   🛣️ 45 000 км"
function buildDetailsLine(car) {
  const parts = [];
  if (car.fuel_type && FUEL_LABELS[car.fuel_type]) parts.push(`⛽ ${FUEL_LABELS[car.fuel_type]}`);
  if (car.transmission && TRANSMISSION_LABELS[car.transmission]) parts.push(`⚙️ ${TRANSMISSION_LABELS[car.transmission]}`);
  if (car.mileage) parts.push(`🛣️ ${Number(car.mileage).toLocaleString('uk-UA')} км`);
  return parts.join('   ');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { carId, eventType } = req.body; // eventType: 'new' | 'price_drop' | 'sold' | 'converted_to_auction'
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
    const details = buildDetailsLine(car);
    const region = car.region ? `📍 ${car.region}` : '';
    const extraLines = [details, region].filter(Boolean).map(l => `\n${l}`).join('');

    let caption = '';
    if (eventType === 'price_drop') {
      caption = `📉 Знижена ціна!\n\n🚗 ${car.brand} ${car.model}, ${car.year}\n💰 Нова ціна: ${priceStr}${extraLines}`;
    } else if (eventType === 'sold') {
      caption = `✅ Продано${car.listing_type === 'auction' ? ' на аукціоні' : ''}!\n\n🚗 ${car.brand} ${car.model}, ${car.year}`;
    } else if (eventType === 'converted_to_auction') {
      caption = `🔨 Переведено в аукціон!\n\n🚗 ${car.brand} ${car.model}, ${car.year}\n💰 Стартова ціна: ${priceStr}${extraLines}`;
    } else {
      caption = `🆕 Нове авто${car.listing_type === 'auction' ? ' на аукціоні' : ''}!\n\n🚗 ${car.brand} ${car.model}, ${car.year}\n💰 ${priceStr}${extraLines}`;
    }

    const url = `https://normalno-a55.vercel.app/${car.listing_type === 'auction' ? 'lot' : 'car'}.html?id=${car.id}`;
    const photos = (car.photos && car.photos.length ? car.photos : (car.photo_url ? [car.photo_url] : [])).slice(0, 5);

    const buttons = [[{ text: '📄 Детальніше', url }]];
    const showLeasingBtn = car.listing_type !== 'auction' && (eventType === 'new' || eventType === 'price_drop');
    if (showLeasingBtn) {
      buttons.push([{ text: '📊 Розрахувати в лізинг', url: `${url}&openLeasing=1` }]);
    }
    const replyMarkup = { inline_keyboard: buttons };

    if (photos.length > 1) {
      // Альбом з кількома фото — Telegram НЕ дозволяє кнопки під альбомом,
      // тому підпис ставимо на перше фото, а кнопки шлемо окремим повідомленням одразу після.
      const media = photos.map((p, i) => i === 0 ? { type: 'photo', media: p, caption } : { type: 'photo', media: p });
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMediaGroup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, media })
      });
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, text: '👇', reply_markup: replyMarkup })
      });
    } else if (photos.length === 1) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: channel, photo: photos[0], caption, reply_markup: replyMarkup })
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
