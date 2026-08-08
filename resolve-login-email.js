const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { identifier } = req.body;
    if (!identifier) {
      res.status(400).json({ error: 'No identifier' });
      return;
    }

    if (identifier.includes('@')) {
      res.status(200).json({ email: identifier });
      return;
    }

    const profResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?phone=eq.${encodeURIComponent(identifier)}&select=user_id`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const profs = await profResp.json();
    const userId = profs && profs[0] && profs[0].user_id;

    if (!userId) {
      res.status(404).json({ error: 'Користувача з таким номером не знайдено' });
      return;
    }

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    const userData = await userResp.json();

    if (!userData || !userData.email) {
      res.status(404).json({ error: 'Не вдалося знайти обліковий запис' });
      return;
    }

    res.status(200).json({ email: userData.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
