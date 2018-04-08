const zephyr = require('zephyr');
const discord = require('discord.js');
const wordwrap = require('wordwrap')(70);
const settings = require(`${process.cwd()}/settings`);

const client = new discord.Client({disableEveryone: true});
zephyr.subscribe(
    settings.classes.map(([c, _]) => [c, '*', '*']),
    err => { if (err) console.error(err); });
const zephyrToDiscord = new Map(settings.classes);
const discordToZephyr = new Map(settings.classes.map(pair => pair.reverse()));

client.on('ready', () => {
  for (const guild of client.guilds.values())
    if (discordToZephyr.has(guild.name)) {
      const nickname = `-c ${discordToZephyr.get(guild.name)}`;
      if (guild.me.nickname != nickname)
        guild.me.setNickname(nickname).catch(err => console.error(err));
    }
  client.user.setActivity('Zephyr', {type: 'LISTENING'});

  zephyr.check(async (err, msg) => {
    if (err) return console.error(err);
    if (!msg.message.trim() || msg.opcode) return;
    const sender = msg.sender.split('@')[0];
    const server = zephyrToDiscord.get(msg.class);
    const guild = server && Array.from(client.guilds.values()).find(c => c.name === server);
    const channel = guild && (Array.from(guild.channels.values())
        .find(c => c.type == 'text' && c.name == msg.instance)
        || guild.systemChannel
        || Array.from(guild.channels.values()).find(c => c.type == 'text'));
    const ignore = channel ? '' : ' \x1b[31mignoring\x1b[0m';
    console.log(`\x1b[35;1mZephyr:\x1b[0m${ignore} ${msg.class} / ${msg.instance} / ${sender}`);
    if (ignore) return;
    const webhook = await channel.fetchWebhooks()
        .then(c => c.first() || channel.createWebhook(msg.instance))
        .catch(err => console.error(err));
    if (webhook) webhook.send(msg.message, {username: sender, split: true});
    else channel.send(msg.message, {split: true});
  });
});

client.on('disconnect', evt => console.error(evt));
client.on('error', evt => console.error(evt));
client.on('warn', info => console.warn(info));
//client.on('debug', info => console.debug(info));

client.on('message', async msg => {
  if (msg.author.bot) return;
  const server = msg.guild ? msg.guild.name : null;
  const channel = msg.channel.name;
  const sender = msg.member ? msg.member.displayName : msg.author.username;
  const ignore = discordToZephyr.has(server) ? '' : ' \x1b[31mignoring\x1b[0m';
  console.log(`\x1b[34;1mDiscord:\x1b[0m${ignore} ${server} / ${channel} / ${sender}`);
  if (ignore) return;
  const signature = [];
  const game = (msg.member || msg.author).presence.game;
  if (game && (game.url || game.name)) signature.push(game.url || game.name);
  const invite = await msg.channel.createInvite({maxAge: 0}).catch(err => console.error(err));
  signature.push((invite && invite.url) || 'Discord');
  const content = [];
  if (msg.cleanContent.trim()) content.push(wordwrap(msg.cleanContent));
  for (const c of msg.attachments.values()) content.push(c.url);
  zephyr.send({
    class: discordToZephyr.get(server),
    instance: channel,
    opcode: 'discord',
    sender: sender,
    message: content.join('\n'),
    signature: signature.join(') ('),
  }, err => { if (err) console.error(err); });
});

client.login(settings.discordToken);
