module.exports.discordToken = '???';

/*
  The format of each list element is: {
    zephyrClass:
      The zephyr class name.
    discordServer:
      The display name (not the numeric code) of the Discord server.
    <optional flags>
    doNotSendToZephyr:
      If true, do not bridge Discord messages to zephyr. Zephyr messages will
      still be bridged to Discord.
    doNotSendToDiscord:
      If true, do not bridge zephyr messages to Discord. Discord messages will
      still be bridged to zephyr.
    createChannel:
      If true, if a zephyr message's instance does not match any existing
      channel, it will be sent to a newly created channel rather than an
      existing default one.
  }
*/
module.exports.classes = [
  {zephyrClass: 'zephyr-class', discordServer: 'Discord Server'},
];
