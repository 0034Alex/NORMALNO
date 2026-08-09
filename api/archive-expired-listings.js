const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { sendPushToUsers } = require('./push-helper');

const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

module.exports = async (req, res) => {
  try {
    // 1) Звичайні оголошення старші 30 днів, не продані, не в архіві
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.sale&archived=eq.false&sold=eq.false&created_at=lt.${thirtyDaysAgo}`,
      { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ archived: true, archived_at: new Date().toISOString() }) }
    );

    // 2) Завершені аукціони (час вийшов), ще не в архіві — обробляємо по одному, щоб визначити переможця
    const now = new Date().toISOString();
    const endedResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.auction&archived=eq.false&auction_ends_at=lt.${now}&select=*`,
      { headers }
    );
    const endedLots = await endedResp.json();

    for (const lot of endedLots || []) {
      const reserveMet = !lot.reserve_price || (lot.current_bid || 0) >= lot.reserve_price;
      const won = lot.bid_count > 0 && reserveMet && lot.current_bid_user_id;

      const updateData = { archived: true, archived_at: new Date().toISOString() };
      if (won) {
        updateData.sold = true;
        updateData.sold_via = 'auction';
      }

      await fetch(`${SUPABASE_URL}/rest/v1/cars?id=eq.${lot.id}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(updateData)
      });

      if (won) {
        await sendPushToUsers([lot.current_bid_user_id], {
          title: '🏆 Ви виграли аукціон!',
          body: `${lot.brand} ${lot.model}, ${lot.year} — фінальна ставка ${lot.current_bid} ${lot.currency}`,
          url: `/lot.html?id=${lot.id}`
        }).catch(() => {});
      }
    }

    // 3) Нагадування за ~10 хвилин до завершення торгів, ще не надіслане
    const soonThreshold = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const soonResp = await fetch(
      `${SUPABASE_URL}/rest/v1/cars?listing_type=eq.auction&archived=eq.false&auction_ends_at=lt.${soonThreshold}&auction_ends_at=gt.${now}&ending_soon_notified=eq.false&select=*`,
      { headers }
    );
    const soonLots = await soonResp.json();

    for (const lot of soonLots || []) {
      const bidsResp = await fetch(`${SUPABASE_URL}/rest/v1/bids?car_id=eq.${lot.id}&select=user_id`, { headers });
      const bids = await bidsResp.json();
      const participantIds = [...new Set((bids || []).map(b => b.user_id))];

      if (participantIds.length > 0) {
        await sendPushToUsers(participantIds, {
          title: '⏰ Аукціон завершується!',
          body: `${lot.brand} ${lot.model}, ${lot.year} — залишилось менше 10 хвилин`,
          url: `/lot.html?id=${lot.id}`
        }).catch(() => {});
      }

      await fetch(`${SUPABASE_URL}/rest/v1/cars?id=eq.${lot.id}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ ending_soon_notified: true })
      });
    }

    res.status(200).json({ ok: true, ended: (endedLots || []).length, soon: (soonLots || []).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
