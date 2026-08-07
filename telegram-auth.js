const crypto = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ error: 'No initData' });
      return;
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const pairs = [...params.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (computedHash !== hash) {
      res.status(401).json({ error: 'Invalid Telegram signature' });
      return;
    }

    const tgUser = JSON.parse(params.get('user'));
    const tgId = tgUser.id;
    const tgUsername = tgUser.username || '';

    const authSecret = process.env.AUTH_SECRET;
    const email = `tg${tgId}@normalno.local`;
    const password = crypto.createHmac('sha256', authSecret).update(String(tgId)).digest('hex').slice(0, 24);

    const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });
    const listData = await listResp.json();
    let user = (listData.users || []).find(u => u.email === email);

    let isNewUser = false;

    if (!user) {
      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const created = await createResp.json();

      if (!createResp.ok) {
        res.status(500).json({ error: 'createUser failed: ' + JSON.stringify(created) });
        return;
      }

      user = created;
      isNewUser = true;

      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id,
          telegram_username: tgUsername,
          phone: '',
          role: null
        })
      });
    }

    res.status(200).json({ email, password, isNewUser });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
