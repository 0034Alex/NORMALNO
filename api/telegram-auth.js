const crypto = require('crypto');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SB_HEADERS = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

async function sendTG(chatId, text, replyMarkup) {
  try {
    const body = { chat_id: chatId, text };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { /* ignore send errors */ }
}

const OPEN_APP_BUTTON = { inline_keyboard: [[{ text: 'Відкрити NORMALNO', web_app: { url: 'https://normalno-a55.vercel.app/register2.html' } }]] };

// ===== Обробка вхідних повідомлень боту (Telegram webhook) =====
// Використовується для сценарію "скидання паролю через бота": якщо у користувача
// є активний pending-запит на скидання паролю для цього chat_id — наступне його
// текстове повідомлення трактується як новий пароль.
async function handleBotMessage(message, res) {
  const chatId = String(message.chat.id);
  const text = (message.text || '').trim();

  const reqResp = await fetch(
    `${SUPABASE_URL}/rest/v1/password_reset_requests?telegram_chat_id=eq.${chatId}&status=eq.pending&order=created_at.desc&limit=1`,
    { headers: SB_HEADERS }
  );
  const reqs = await reqResp.json();
  const pending = Array.isArray(reqs) ? reqs[0] : null;

  if (pending && new Date(pending.expires_at) > new Date()) {
    if (!text || text.length < 6) {
      await sendTG(chatId, 'Пароль має містити мінімум 6 символів. Напишіть, будь ласка, ще раз.');
    } else {
      const updResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${pending.user_id}`, {
        method: 'PUT',
        headers: SB_HEADERS,
        body: JSON.stringify({ password: text })
      });
      if (updResp.ok) {
        await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests?id=eq.${pending.id}`, {
          method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify({ status: 'used' })
        });
        await sendTG(chatId, '✅ Пароль змінено!\n\nУвійти з новим паролем треба в самому застосунку NORMALNO (кнопка нижче) — тут, у чаті бота, увійти не можна, бот лише прийняв ваш новий пароль.', OPEN_APP_BUTTON);
      } else {
        await sendTG(chatId, 'Сталася помилка при зміні паролю. Спробуйте пізніше або зверніться в підтримку.');
      }
    }
  }
  // Telegram завжди очікує 200, інакше почне повторно слати update
  res.status(200).json({ ok: true });
}

// ===== Запит на скидання паролю (викликається з forgotPassword() на сайті) =====
async function handlePasswordResetRequest(identifier, res) {
  if (!identifier) { res.status(200).json({ error: 'Введіть email або телефон' }); return; }

  let userId = null;
  if (identifier.includes('@')) {
    const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(identifier)}`, { headers: SB_HEADERS });
    const listData = await listResp.json();
    const u = (listData.users || []).find(u => u.email === identifier);
    if (u) userId = u.id;
  } else {
    const profResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?phone=eq.${encodeURIComponent(identifier)}&select=user_id`, { headers: SB_HEADERS });
    const profs = await profResp.json();
    userId = profs && profs[0] && profs[0].user_id;
  }

  if (!userId) { res.status(200).json({ error: 'Користувача не знайдено' }); return; }

  const profResp2 = await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}&select=telegram_user_id`, { headers: SB_HEADERS });
  const profs2 = await profResp2.json();
  const telegramChatId = profs2 && profs2[0] && profs2[0].telegram_user_id;

  if (!telegramChatId) {
    res.status(200).json({ error: 'До вашого акаунта не прив\'язано Telegram. Увійдіть один раз через кнопку "Telegram" на сайті, щоб прив\'язати, потім спробуйте скинути пароль знову.' });
    return;
  }

  // деактивуємо попередні незавершені запити цього користувача
  await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests?user_id=eq.${userId}&status=eq.pending`, {
    method: 'PATCH', headers: SB_HEADERS, body: JSON.stringify({ status: 'expired' })
  });

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await fetch(`${SUPABASE_URL}/rest/v1/password_reset_requests`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, telegram_chat_id: String(telegramChatId), status: 'pending', expires_at: expiresAt })
  });

  await sendTG(telegramChatId, 'Ви запросили скидання паролю на NORMALNO.\n\nНапишіть сюди одним повідомленням новий пароль (мінімум 6 символів). Запит дійсний 15 хвилин. Якщо це були не ви — просто ігноруйте це повідомлення.');

  res.status(200).json({ ok: true });
}

// ===== Реєстрація email+пароль (register2.html) =====
// Робиться через service role, а не sb.auth.signUp() з клієнта, з двох причин:
// 1) sb.auth.signUp() не дає активної сесії поки email не підтверджено — тому
//    подальший insert в profiles з клієнта блокувався RLS і "ім'я/телефон губились".
// 2) email_confirm:true одразу активує акаунт — не треба листа з підтвердженням,
//    що в Mini App відкривав Safari і "губив" користувача (див. п.3 запиту).
async function handleRegister(body, res) {
  const { name, phone, email, password, refCode } = body;
  if (!name || !phone || !email || !password) {
    res.status(200).json({ error: "Заповніть ім'я, телефон, email і пароль" });
    return;
  }

  const listResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: SB_HEADERS });
  const listData = await listResp.json();
  if ((listData.users || []).some(u => u.email === email)) {
    res.status(200).json({ error: 'Цей email вже зареєстровано. Спробуйте увійти або скинути пароль.' });
    return;
  }

  const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST', headers: SB_HEADERS,
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  const created = await createResp.json();
  if (!createResp.ok) {
    res.status(200).json({ error: 'Не вдалося створити акаунт: ' + (created.msg || created.error_description || JSON.stringify(created)) });
    return;
  }

  let referredBy = null;
  let referredByPartner = null;
  if (refCode) {
    const rpcResp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_referral_code`, {
      method: 'POST', headers: SB_HEADERS, body: JSON.stringify({ code_input: refCode.toUpperCase() })
    });
    const rpcData = await rpcResp.json();
    if (rpcData && rpcData[0]) { referredBy = rpcData[0].user_id; referredByPartner = rpcData[0].partner_id; }
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let newCode = '';
  for (let i = 0; i < 7; i++) newCode += chars[Math.floor(Math.random() * chars.length)];

  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: created.id, name, phone,
      referred_by: referredBy, referred_by_partner: referredByPartner,
      referral_code: newCode
    })
  });

  if (referredBy || referredByPartner) {
    await fetch(`${SUPABASE_URL}/rest/v1/referral_events`, {
      method: 'POST',
      headers: { ...SB_HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify({
        referrer_user_id: referredBy, referrer_partner_id: referredByPartner,
        referred_user_id: created.id, event_type: 'registration', points: 10
      })
    });
  }

  res.status(200).json({ ok: true, email, password });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 1) Вхідне повідомлення від Telegram (webhook update від бота)
    if (req.body && req.body.message) {
      await handleBotMessage(req.body.message, res);
      return;
    }

    // 2) Реєстрація email+пароль
    if (req.body && req.body.action === 'register') {
      await handleRegister(req.body, res);
      return;
    }

    // 3) Запит на скидання паролю з сайту
    if (req.body && req.body.action === 'password_reset_request') {
      await handlePasswordResetRequest(req.body.identifier, res);
      return;
    }

    // 4) Стандартний вхід через Telegram Mini App (initData)
    const { initData, startParam } = req.body;
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
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const listData = await listResp.json();
    let user = (listData.users || []).find(u => u.email === email);

    let isNewUser = false;

    if (!user) {
      const createResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const created = await createResp.json();

      if (!createResp.ok) {
        res.status(500).json({ error: 'createUser failed: ' + JSON.stringify(created) });
        return;
      }

      user = created;
      isNewUser = true;

      let referredBy = null;
      if (startParam) {
        const refResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${startParam.toUpperCase()}&select=user_id`, {
          headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        });
        const refData = await refResp.json();
        if (refData && refData[0]) referredBy = refData[0].user_id;
      }

      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let newCode = '';
      for (let i = 0; i < 7; i++) newCode += chars[Math.floor(Math.random() * chars.length)];

      await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          user_id: user.id,
          telegram_username: tgUsername,
          telegram_user_id: String(tgId),
          phone: '',
          referred_by: referredBy,
          referral_code: newCode
        })
      });

      if (referredBy) {
        await fetch(`${SUPABASE_URL}/rest/v1/referral_events`, {
          method: 'POST',
          headers: {
            apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json', Prefer: 'return=minimal'
          },
          body: JSON.stringify({
            referrer_user_id: referredBy,
            referred_user_id: user.id,
            event_type: 'registration',
            points: 10
          })
        });
      }
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal'
        },
        body: JSON.stringify({ telegram_user_id: String(tgId), telegram_username: tgUsername })
      });
    }

    res.status(200).json({ email, password, isNewUser });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
};
