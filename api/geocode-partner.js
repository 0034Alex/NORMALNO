const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { partnerId, address } = req.body;
    if (!partnerId || !address) {
      res.status(400).json({ error: 'Missing partnerId or address' });
      return;
    }

    const geoResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'NORMALNO-app/1.0 (contact: normalno@example.com)' } }
    );
    const geoData = await geoResp.json();

    if (!geoData || geoData.length === 0) {
      res.status(200).json({ success: false, error: 'Адресу не знайдено' });
      return;
    }

    const lat = parseFloat(geoData[0].lat);
    const lng = parseFloat(geoData[0].lon);

    await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${partnerId}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal'
      },
      body: JSON.stringify({ lat, lng })
    });

    res.status(200).json({ success: true, lat, lng });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
