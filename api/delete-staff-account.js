const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { adminRowId, staffUserId, callerAccessToken } = req.body;
    if (adminRowId === undefined || adminRowId === null || !staffUserId || !callerAccessToken) {
      res.status(400).json({ error: 'Відсутні дані для видалення' });
      return;
    }

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };

    // Перевіряємо, хто саме викликає — має бути власник
    const callerResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${callerAccessToken}` }
    });
    const callerData = await callerResp.json();
    if (!callerData || !callerData.id) {
      res.status(401).json({ error: 'Не вдалося перевірити користувача' });
      return;
    }

    const callerAdminResp = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${callerData.id}&select=role`, { headers });
    const callerAdminRows = await callerAdminResp.json();
    if (!callerAdminRows || !callerAdminRows[0] || callerAdminRows[0].role !== 'owner') {
      res.status(403).json({ error: 'Тільки власник може видаляти акаунти' });
      return;
    }

    // 1) Прибираємо доступ до CRM
    await fetch(`${SUPABASE_URL}/rest/v1/admin_users?id=eq.${adminRowId}`, {
      method: 'DELETE', headers
    });

    // 2) Видаляємо профіль
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${staffUserId}`, {
      method: 'DELETE', headers
    });

    // 3) Видаляємо сам обліковий запис (логін)
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${staffUserId}`, {
      method: 'DELETE', headers
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
