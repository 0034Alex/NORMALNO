const webpush = require('web-push');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

webpush.setVapidDetails(
  'mailto:normalno@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function getSubscriptionsForUsers(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const orClause = userIds.map(id => `user_id.eq.${id}`).join(',');
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?or=(${orClause})`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  return resp.json();
}

async function getAllSubscriptions() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?select=*`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  return resp.json();
}

async function sendPushToSubscriptions(subs, payload) {
  const results = await Promise.allSettled(
    (subs || []).map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      ).catch(async (err) => {
        // Підписка більше не дійсна (застосунок видалено/дозвіл відкликано) — видаляємо
        if (err.statusCode === 404 || err.statusCode === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
            method: 'DELETE',
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
          }).catch(() => {});
        }
      })
    )
  );
  return results.length;
}

async function sendPushToUsers(userIds, payload) {
  const subs = await getSubscriptionsForUsers(userIds);
  return sendPushToSubscriptions(subs, payload);
}

async function sendPushToAll(payload) {
  const subs = await getAllSubscriptions();
  return sendPushToSubscriptions(subs, payload);
}

module.exports = { sendPushToUsers, sendPushToAll };
