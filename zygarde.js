const zephyr = require('zephyr');
const discord = require('discord.js');
const wordwrap = require('wordwrap')(70);
const settings = require(process.argv[2] || `${process.cwd()}/settings`);

function zephyrNormalize(str) {
  return str.normalize('NFKC').toLowerCase();
}
function discordNormalize(str) {
  // The regexes are copied from the Discord web client. The '-' is empirically
  // the result of trying to create a channel using only invalid characters.
  return str.replace(/[\s-~]+/g, '-').replace(/^-+/, '')
      .replace(/[\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '').toLowerCase() || '-';
}

// Start everything up...
const client = new discord.Client({disableEveryone: true});
zephyr.subscribe(
    settings.classes.map(({zephyrClass}) => [zephyrClass, '*', '*']),
    err => err && console.error(err));

client.on('ready', () => {
  // Set the bot's nickname to list each class linked to this Discord server, if
  // it doesn't already. (Nicknames are per-server, while activity is global.)
  for (const guild of client.guilds.cache.values()) {
    const matching = settings.classes
        .filter(({discordServer}) => discordServer == guild.name)
        .map(({zephyrClass}) => zephyrClass);
    const nickname = matching.length ? '-c ' + matching.join(', ') : '';
    if (nickname ? (guild.me.nickname != nickname) : guild.me.nickname)
      guild.me.setNickname(nickname).catch(err => console.error(err));
  }
  status = () => client.user.setActivity('Zephyr', {type: 'LISTENING'});
  status();
  setInterval(status, 60 * 60 * 1000);
});

// Set the handler to be called when a zephyr comes in. Ignore anything with
// an opcode or no message body.
zephyr.check(async (err, msg) => {
  if (err) return console.error(err);
  if (!msg.message.trim() || msg.opcode) return;

  // Chop off the realm from the sender.
  const sender = msg.sender.split('@')[0];
  // Find every server that matches the class, then every channel that matches
  // the instance, including fallbacks if none do.
  const channels = [];
  for (const entry of settings.classes)
    if (zephyrNormalize(entry.zephyrClass) == zephyrNormalize(msg.class) &&
        !entry.doNotSendToDiscord)
      for (const guild of client.guilds.cache.values())
        if (entry.discordServer == guild.name)
          channels.push(getChannel(guild, msg.instance, entry.createChannel));
  const matching = (await Promise.all(channels)).filter(chan => chan);
  // OK! Now we know if this message is going anywhere.
  const ignore = matching.length ? '' : '\x1b[31mignoring\x1b[0m ';
  console.log(`\x1b[35;1mZephyr:\x1b[0m ${ignore}` +
      `${msg.class} / ${msg.instance} / ${sender}`);
  if (ignore) return;

  // Send the messages.
  for (const [channel, guild] of matching) {
    const member = Array.from(guild.members.cache.values())
        .find(mem => mem.displayName == sender || mem.user.username == sender);
    channel.send(msg.message, {split: true, username: sender,
        avatarURL: member && member.user.displayAvatarURL({dynamic: true})});
  }
});

async function getChannel(guild, instance, create) {
  const name = discordNormalize(zephyrNormalize(instance));
  const channels = Array.from(guild.channels.cache.values())
      .filter(chan => chan.type == 'text');
  // Exact match to the instance, if there is one.
  let channel = channels.find(chan => zephyrNormalize(chan.name) == name);
  // If creation is enabled, try creating one.
  if (!channel && create)
    channel = await guild.channels.create(name, {type: 'text'})
        .catch(err => console.error(err));
  // Otherwise, fall back to a default.
  if (!channel) channel = guild.systemChannel || channels[0];
  // No luck. This means the server has no text channels at all, in which case,
  // why are you running this bridge?
  if (!channel) return;
  // Reuse or create a webhook so that we can set the sender.
  const webhook = await channel.fetchWebhooks()
      .then(hooks => hooks.first() || channel.createWebhook('zygarde'))
      .catch(err => console.error(err));
  // If no webhook, return the channel. Either can be used to send messages.
  return [webhook || channel, guild];
}

client.on('disconnect', evt => console.error(evt));
client.on('error', evt => console.error(evt));
client.on('warn', info => console.warn(info));
//client.on('debug', info => console.debug(info));

// Now for Discord messages. Ignore bot messages and DMs.
client.on('message', async msg => {
  if (msg.author.bot || !msg.guild) return;

  // It sounds like the only way for msg.member to be unset is if the author
  // left the server in between sending the message and the bot receiving it.
  const sender = msg.member ? msg.member.displayName : msg.author.username;
  // Find every class that matches the server. This is easier since we're just
  // sending to strings, rather than having to find a server with that name.
  const matching = [];
  for (const entry of settings.classes)
    if (entry.discordServer == msg.guild.name && !entry.doNotSendToZephyr)
      matching.push(entry.zephyrClass);
  // Now we know if this message is going anywhere.
  const ignore = matching.length ? '' : '\x1b[31mignoring\x1b[0m ';
  console.log(`\x1b[34;1mDiscord:\x1b[0m ${ignore}` +
      `${msg.guild.name} / ${msg.channel.name} / ${sender}`);
  if (ignore) return;

  // Let's stuff some extra stuff into the zsig. First, the user's activity,
  // if they have anything set.
  const signature = [];
  for (const game of (msg.member || msg.author).presence.activities) {
    if (game.emoji && !game.emoji.url) signature.push(game.emoji.name);
    if (game.type != 'CUSTOM_STATUS' && game.name) signature.push(game.name);
    if (game.state) signature.push(game.state);
    if (game.details) signature.push(game.details);
    if (game.url) signature.push(game.url);
  }
  // Next, reuse or create an invite, if possible. If not, just say "Discord".
  const invite = await msg.channel.createInvite({maxAge: 0})
      .catch(err => console.error(err));
  signature.push((invite && invite.url) || 'Discord');
  // Finally, line-wrap to 70 characters, then if there are any attachments,
  // append their URLs to the message.
  const content = [];
  if (msg.cleanContent.trim()) content.push(wordwrap(msg.cleanContent));
  for (const attach of msg.attachments.values()) content.push(attach.url);

  // Send the zephyrs!
  for (const zclass of matching)
    zephyr.send({
      class: zclass,
      instance: msg.channel.name,
      opcode: 'discord',
      sender: sender,
      message: content.join('\n'),
      signature: signature.join(') ('),
    }, err => err && console.error(err));
});

client.login(settings.discordToken);
