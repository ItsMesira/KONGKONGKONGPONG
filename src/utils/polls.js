const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js')

function buildPollEmbed(question, options, pollId) {
  const desc = options
    .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
    .join('\n')

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`📊 ${question}`)
    .setDescription(desc)
    .setFooter({ text: `โหวตด้วยปุ่มด้านล่าง • ID: ${pollId}` })
    .setTimestamp()
}

function buildPollComponents(options) {
  const row = new ActionRowBuilder()
  options.slice(0, 5).forEach((opt, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote_${i}`)
        .setLabel(String.fromCharCode(65 + i))
        .setStyle(ButtonStyle.Secondary)
    )
  })
  return [row]
}

async function postPoll(client, channelId, question, options, pollId) {
  const channel = await client.channels.fetch(channelId)
  if (!channel) throw new Error('Channel not found')

  const embed = buildPollEmbed(question, options, pollId)
  const components = buildPollComponents(options)
  const msg = await channel.send({ embeds: [embed], components })
  return msg.id
}

async function updatePollResults(client, channelId, messageId, votes) {
  const channel = await client.channels.fetch(channelId)
  if (!channel) return
  const msg = await channel.messages.fetch(messageId)
  if (!msg) return

  const embed = msg.embeds[0]
  if (!embed) return

  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1
  const descOld = embed.description || ''
  const lines = descOld.split('\n').map((line, i) => {
    const count = votes[i] || 0
    const pct = Math.round((count / total) * 100)
    const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10))
    return `${line} — ${count} โหวต (${pct}%)\n${bar}`
  })

  const updated = EmbedBuilder.from(embed)
    .setDescription(lines.join('\n'))

  await msg.edit({ embeds: [updated] })
}

let pollVotes = {}

function recordVote(pollId, optionIndex, userId) {
  if (!pollVotes[pollId]) pollVotes[pollId] = {}
  const key = `${pollId}:${userId}`
  if (pollVotes[pollId][key] !== undefined) return false
  pollVotes[pollId][key] = optionIndex
  return true
}

function getVoteCounts(pollId) {
  const counts = {}
  const votes = pollVotes[pollId] || {}
  for (const key of Object.keys(votes)) {
    const idx = votes[key]
    counts[idx] = (counts[idx] || 0) + 1
  }
  return counts
}

module.exports = { postPoll, updatePollResults, buildPollEmbed, buildPollComponents, recordVote, getVoteCounts }
