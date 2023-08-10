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
function guildMatch(entry, guild) {
  return entry.discordServer == guild.name || entry.discordServer == guild.id;
}

// Start everything up...
const client = new discord.Client({ws: {large_threshold: 250}, intents: [
  discord.GatewayIntentBits.Guilds,
  discord.GatewayIntentBits.GuildMembers,
  discord.GatewayIntentBits.GuildMessages,
  discord.GatewayIntentBits.GuildWebhooks,
  discord.GatewayIntentBits.GuildInvites,
  discord.GatewayIntentBits.GuildPresences,
  discord.GatewayIntentBits.MessageContent,
]});

zephyr.subscribe(
    settings.classes.map(({zephyrClass}) => [zephyrClass, '*', '*']),
    err => err && console.error(err));

client.on('ready', () => {
  // Set the bot's nickname to list each class linked to this Discord server, if
  // it doesn't already. (Nicknames are per-server, while activity is global.)
  for (const guild of client.guilds.cache.values()) {
    const matching = settings.classes.filter(entry => guildMatch(entry, guild))
        .map(({zephyrClass}) => zephyrClass);
    const nickname = matching.length ? '-c ' + matching.join(', ') : null;
    if ((guild.members.me.nickname || null) != nickname)
      guild.members.me.setNickname(nickname).catch(err => console.error(err));
  }
  status = () => client.user.setActivity('Zephyr',
      {type: discord.ActivityType.Listening});
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
        if (guildMatch(entry, guild))
          channels.push(getChannel(guild, msg.instance, entry));
  const matching = (await Promise.all(channels)).filter(chan => chan);
  // OK! Now we know if this message is going anywhere.
  const ignore = matching.length ? '' : '\x1b[31mignoring\x1b[0m ';
  console.log(`\x1b[35;1mZephyr:\x1b[0m ${ignore}` +
      `${msg.class} / ${msg.instance} / ${sender}`);
  if (ignore) return;

  // Send the messages.
  for (const {webhook, channel, thread, guild} of matching) {
    if (!webhook) {
      (thread || channel).send(sender + ': ' + msg.message);
      continue;
    }
    const member = Array.from(guild.members.cache.values()).find(m =>
        [m.nickname, m.user.globalName, m.user.username].includes(sender));
    webhook.send({content: msg.message, threadId: thread?.id, username: sender,
        avatarURL: member && member.user.displayAvatarURL({dynamic: true})});
  }
});

async function getChannel(guild, instance, {createChannel, defaultChannel}) {
  const channels = Array.from(guild.channels.cache.values())
      .filter(chan => chan.isTextBased());
  const name = zephyrNormalize(instance);
  let channel = null;
  let thread = null;
  // Let's first see if this goes in a thread. I have to make up some logic for
  // this, even if it's unlikely to matter, so: if the parent channel exists,
  // the bridge will try to use or create a thread. If the parent channel
  // doesn't exist, the bridge will go back to using the full (unsplit) instance
  // instead of creating both a parent channel and a thread.
  const dot = name.indexOf('.');
  if (dot > 0) {
    channel = channels.find(chan => chan.type == discord.ChannelType.GuildText &&
        discordNormalize(name.substr(0, dot)) == zephyrNormalize(chan.name));
    if (channel) {
      thread = Array.from(channel.threads.cache.values()).find(thr =>
          name.substr(dot + 1) == zephyrNormalize(thr.name) && !thr.archived);
      if (!thread)
        thread = await channel.threads.create({name: name.substr(dot + 1)})
            .catch(err => console.error(err));
    }
  }
  // Exact match to the instance, if there is one.
  if (!channel)
    channel = channels.find(chan => (chan.type == discord.ChannelType.GuildText ?
        discordNormalize(name) : name) == zephyrNormalize(chan.name));
  // If creation is enabled, try creating one.
  if (!channel && createChannel)
    channel = await guild.channels.create(name)
        .catch(err => console.error(err));
  // Otherwise, fall back to a default.
  if (!channel && defaultChannel)
    channel = channels.find(chan => defaultChannel == chan.name);
  if (!channel) channel = guild.systemChannel || channels[0];
  // No luck. This means the server has no text channels at all, in which case,
  // why are you running this bridge?
  if (!channel) return;
  // Reuse or create a webhook so that we can set the sender.
  const webhook = await channel.fetchWebhooks()
      .then(hooks =>
          Array.from(hooks.values()).find(hook => hook.owner == client.user) ||
          channel.createWebhook({name: 'zygarde'}))
      .catch(err => console.error(err));
  // We can send a message using any of webhook, channel, or thread.
  return {webhook, channel, thread, guild};
}

// Now for Discord messages. Ignore bot messages and DMs.
client.on('messageCreate', async msg => {
  if (msg.author.bot || !msg.guild) return;
  // For threads, include the name of the parent channel, separated with a dot.
  let channel = msg.channel;
  let instance = channel.name;
  if (channel.isThread()) {
    channel = channel.parent;
    instance = channel.name + '.' + instance;
  }

  // It sounds like the only way for msg.member to be unset is if the author
  // left the server in between sending the message and the bot receiving it.
  const sender = msg.member ? msg.member.displayName : msg.author.displayName;
  // Find every class that matches the server. This is easier since we're just
  // sending to strings, rather than having to find a server with that name.
  const matching = [];
  for (const entry of settings.classes)
    if (guildMatch(entry, msg.guild) && !entry.doNotSendToZephyr)
      matching.push(entry.zephyrClass);
  // Now we know if this message is going anywhere.
  const ignore = matching.length ? '' : '\x1b[31mignoring\x1b[0m ';
  console.log(`\x1b[34;1mDiscord:\x1b[0m ${ignore}` +
      `${msg.guild.name} / ${instance} / ${sender}`);
  if (ignore) return;

  // Let's stuff some extra stuff into the zsig. First, the user's activity,
  // if they have anything set.
  const signature = [];
  for (const game of msg.member?.presence?.activities || []) {
    if (game.emoji && !game.emoji.url) signature.push(game.emoji.name);
    if (game.type != discord.ActivityType.Custom && game.name)
      signature.push(game.name);
    if (game.state) signature.push(game.state);
    if (game.details) signature.push(game.details);
    if (game.url) signature.push(game.url);
  }
  // Next, reuse or create an invite, if possible. If not, just say "Discord".
  const invite = await channel.createInvite({maxAge: 0})
      .catch(err => console.error(err));
  signature.push(invite?.url || 'Discord');
  // Finally, line-wrap to 70 characters, then if there are any attachments,
  // append their URLs to the message.
  const content = [];
  if (msg.cleanContent.trim()) content.push(wordwrap(msg.cleanContent));
  for (const attach of msg.attachments.values()) content.push(attach.url);

  // Send the zephyrs!
  for (const zclass of matching)
    zephyr.send({
      class: zclass,
      instance: instance,
      opcode: 'discord',
      sender: sender,
      message: content.join('\n'),
      signature: signature.join(') ('),
    }, err => err && console.error(err));
});

client.on('threadCreate', thread =>
  thread.join().catch(err => console.error(err)));
client.on('disconnect', evt => console.error(evt));
client.on('error', evt => console.error(evt));
client.on('warn', info => console.warn(info));
//client.on('debug', info => console.debug(info));
client.login(settings.discordToken);
