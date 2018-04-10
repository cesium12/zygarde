<img src="https://cdn.bulbagarden.net/upload/9/93/718Zygarde-Cell.png" width="200">

When the Kalos region's ecosystem falls into disarray, it appears and reveals its secret power.

1. If you're on Athena, you may be able to run it out of `/mit/cesium/zygarde/run.sh`. You'll still need to do the three following steps to set up Discord integration. The `settings.js` file will go in the current working directory when you run `run.sh`.
1. Otherwise, clone this repo and run `npm install` in this directory to get the dependencies. You'll probably get build errors due to missing headers; you'll specifically need the zephyr headers to build the zephyr module. How you install these depends on your OS/distro: on Debian/Ubuntu, for example, `apt-get build-dep zephyr` should help. Unfortunately, distros tend to be bad at packaging Node, so you may also have to struggle a bit to get an up-to-date version.
1. Get a [Discord API token](https://discordjs.guide/#/preparations/setting-up-a-bot-application).
1. Copy `settings.template.js` to `settings.js`. Fill in your token and the list of connections you want.
1. [Add the bot](https://discordjs.guide/#/preparations/adding-your-bot-to-servers) to your server. You'll want to add `&permissions=536890385` or similar to the URL so the bot can generate invites and change its name, though it will fall back gracefully to some degree if it can't.
1. Run the bot with `node zygarde.js`. Unfortunately, since zephyr doesn't deal with NATs well, you likely want to be on the MIT network, or at least have a public IP, for the zephyr half to not immediately time out. We sure made some life choices hanging on to an 80's-era chat protocol, huh?
- The bot does not understand unclasses or other modifications of the class or instance. Each zephyr instance maps to a Discord channel, unless there is no channel with that name, in which case it goes to a default channel (usually the first one, but configurable as the one labeled `new member messages channel` in Discord server settings). You can use a setting to create new channels instead. Be warned that since Discord prevents certain characters from being used in text channel names, the bot cannot perfectly map all instance names, and auto-created channels may end up with weird names.
- When bridging, all Discord messages from BOTs and all zephyr messages with opcodes are ignored. This prevents loops from forming, but it would also prevent you from chaining bridges or getting other Discord/zephyr bots onto zephyr/Discord, if for some reason you want that.
- Sent zephyrs have their signature set to an invite link. You can deny the bot the invite permission to disable this. Invites are per-channel, so the link will be different per instance, but they all go to the same Discord server so there's no real benefit to that. The bot will also rename itself in each Discord server on startup according to the corresponding zephyr class; you can rename it manually and it will stick until the bot restarts.
- The name Zygarde is sort of the closest thing that vaguely sounds like Discord and has a Z in it. Last time I got to use Zirconium, but I guess people don't use IRC anymore.
