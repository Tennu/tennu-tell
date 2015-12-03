# tennu-tell

A plugin for the [tennu](https://github.com/Tennu/tennu) irc framework.

MemoServ replacement with extra features. Purpose built specifically for my main IRC channel, time-tested by users.

Compatible with [tennu-cooldown](https://github.com/LordWingZero/tennu-cooldown). Lets regular users run it every X seconds.

### Usage
````!tell <nick[,nick2]> <message>````


### Features
- Distinguishes between private and public tells depending on if you sent the tell directly to the bot.
- Plays tells back privately or publicly depending on if you pm the bot after recieving tells.
- Hooks into dbcore (We have a web interface where tells can be edited, so database storage is very useful)
- Prevents saving tells for the bot
- Prevents saving one tell to the same person twice ````!tell LordWingZero,LordWingZero hello world```` (filters out uniqe)

### Configuration
- **maxAtOnce** : Prevents people from saving > n tells at once.
```` Javascript
"agoogle":{
  "limitResults": 1,
  "maxUserDefinedLimit": 3
}
````

### Requires
- [tennu-dblogger](https://github.com/LordWingZero/tennu-dblogger)
  - [tennu-dbcore](https://github.com/LordWingZero/tennu-dbcore)


### Installing Into Tennu

See Downloadable Plugins [here](https://tennu.github.io/plugins/).

### Todo:

- Tests
