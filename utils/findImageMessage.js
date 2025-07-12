/**
 * Finds the first message that contains either:
 * - an attachment (file image)
 * - or an embed image
 * @param {import('discord.js').Collection<string, import('discord.js').Message>} messages
 * @returns {Promise<import('discord.js').Message|null>}
 */
async function findImageMessage(messages) {
  return messages.find(msg =>
    msg.attachments.size > 0 ||
    (msg.embeds.length > 0 && msg.embeds[0].image?.url)
  ) || null;
}

/**
 * Extracts the image URL from a message:
 * - Prefers attachment first
 * - Falls back to embed image if no attachment
 * @param {import('discord.js').Message} message
 * @returns {string}
 */
function extractImageUrl(message) {
  return (
    message.attachments.first()?.url || 
    message.embeds[0]?.image?.url || 
    ''
  );
}

module.exports = {
  findImageMessage,
  extractImageUrl
};
