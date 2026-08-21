const { sendPushToUsers } = require('../lib/push-helper');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { recipientId, text, chatId } = req.body;
    if (!recipientId) {
      res.status(200).json({ skipped: true });
      return;
    }

    await sendPushToUsers([recipientId], {
      title: '💬 Нове повідомлення',
      body: text.length > 100 ? text.slice(0, 100) + '…' : text,
      url: `/chat.html?id=${chatId}`
    });

    res.status(200).json({ notified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
