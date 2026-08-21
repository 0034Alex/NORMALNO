const { sendPushToAll } = require('../lib/push-helper');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { title, body } = req.body;
    if (!title || !body) {
      res.status(400).json({ error: 'Заповніть заголовок і текст' });
      return;
    }

    const sent = await sendPushToAll({ title, body, url: '/index.html' });
    res.status(200).json({ sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
