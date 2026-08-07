const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let isNewUser = false;
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingList.users.find(u => u.email === email);

    если (!user) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        электронная почта,
        пароль,
        email_confirm: true
      });
      if (createError) {
        res.status(500).json({ error: createError.message });
        возвращаться;
      }
      пользователь = created.user;
      isNewUser = true;

      await supabaseAdmin.from('profiles').insert({
        user_id: user.id,
        telegram_username: tgUsername,
        телефон: '',
        роль: null
      });
    }

    res.status(200).json({ email, password, isNewUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
