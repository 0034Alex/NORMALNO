const crypto = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Метод не разрешен' });
    возвращаться;
  }

  пытаться {
    const { initData } = req.body;
    if (!initData) {
      res.status(400).json({ error: 'No initData' });
      возвращаться;
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
      res.status(401).json({ error: 'Недействительная подпись Telegram' });
      возвращаться;
    }

    const tgUser = JSON.parse(params.get('user'));
    const tgId = tgUser.id;
    const tgUsername = tgUser.username || '';

    const authSecret = process.env.AUTH_SECRET;
    const email = `tg${tgId}@normalno.local`;
    const password = crypto.createHmac('sha256', authSecret).update(String(tgId)).digest('hex').slice(0, 24);

    const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
      заголовки: {
        apikey: SERVICE_KEY,
        Авторизация: `Bearer ${SERVICE_KEY}`
      }
    });
    const listData = await listResp.json();
    let user = (listData.users || []).find(u => u.email === email);

    let isNewUser = false;

    если (!user) {
      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        метод: 'POST',
        заголовки: {
          apikey: SERVICE_KEY,
          Авторизация: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const created = await createResp.json();

      if (!createResp.ok) {
        res.status(500).json({ error: 'createUser failed: ' + JSON.stringify(created) });
        возвращаться;
      }

      пользователь = создан;
      isNewUser = true;

      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        метод: 'POST',
        заголовки: {
          apikey: SERVICE_KEY,
          Авторизация: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Предпочтительный вариант: 'return=minimal'
        },
        тело: JSON.stringify({
          user_id: user.id,
          telegram_username: tgUsername,
          телефон: '',
          роль: null
        })
      });
    }

    res.status(200).json({ email, password, isNewUser });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
