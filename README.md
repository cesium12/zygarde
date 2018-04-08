<img src="https://cdn.bulbagarden.net/upload/9/93/718Zygarde-Cell.png" width="200">

This isn't a very good README.

1. After cloning, run `npm install` in this directory to get the dependencies.
1. You'll probably get build errors due to missing headers. You'll specifically need the zephyr headers to build the zephyr module. How you install these depends on your OS/distro: on Debian/Ubuntu, for example, `apt-get build-dep zephyr` should help. Unfortunately, distros tend to be bad at packaging Node, so you may also have to struggle a bit to get an up-to-date version.
1. Get a [Discord API token](https://discordjs.guide/#/preparations/setting-up-a-bot-application).
1. Copy `settings.template.js` to `settings.js`. Fill in your token, and the list of connections you want. Use the names of the zephyr classes and the display names (not the numeric codes) of the Discord servers.
1. [Add the bot](https://discordjs.guide/#/preparations/adding-your-bot-to-servers) to your server (and then yell at me when it doesn't work). You'll want `&permissions=536890385` or similar so the bot can generate invites and change its name, though it will fall back gracefully to some degree if it can't.
1. Unfortunately, since zephyr doesn't deal with NATs well, you likely want to be on the MIT network, or at least have a public IP, for the zephyr half to not immediately time out. We sure made some life choices hanging on to an 80's-era chat protocol, huh?
- The bot does not understand unclasses or other modifications of the class or instance. Each zephyr instance maps to a Discord channel, unless there is no channel named exactly the same thing, in which case it goes to a default channel (usually the first one, but configurable as the one labeled `new member messages channel` in Discord server settings). If you really want your bot to be able to create arbitrary numbers of channels, that would also be doable.
- When bridging, all Discord messages from BOTs and all zephyr messages with opcodes are ignored. This prevents loops from forming, but it would also prevent you from chaining bridges or getting other Discord/zephyr bots onto zephyr/Discord, if for some reason you want that.
- The name Zygarde is sort of the closest thing that vaguely sounds like Discord and has a Z in it. Last time I got to use Zirconium, but I guess people don't use IRC anymore.
