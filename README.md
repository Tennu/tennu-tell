# tennu-tell

A plugin for the [tennu](https://github.com/Tennu/tennu) irc framework.

MemoServ replacement with extra features. Purpose built specifically for my main IRC channel, time-tested by users.

Compatible with [tennu-cooldown](https://github.com/LordWingZero/tennu-cooldown). Lets regular users run it every X seconds.

### Usage
```
"tell": [
    "Save a tell for a user(s).",
    "{{!}}tell <nick1[,<nick2>,<nick3>]> <message>",
    "Example:",
    '{{!}}tell JaneDoe,FarmerGuy Hello World'
],
"tellrefresh": [
    "Re-pull down all tells from the DB into cache, delayed tells are cleared and restored into pending.",
    "Alias: !reloadtells"
],
"delaytells <duration>": [
    "This will hold your tells for a duration",
    "durations: 1d 5h 10s ect."
],
"forcetells": [
    "Forces out any delayed tells"
]
```

### Features
- Delay a tell from emitting with the duration of your choice
- Distinguishes between private and public tells depending on if you sent the tell directly to the bot.
- Plays tells back privately or publicly depending on if you pm the bot after recieving tells.
- Hooks into dbcore (We have a web interface where tells can be edited, so database storage is very useful)
- Prevents saving tells for the bot
- Prevents saving one tell to the same person twice ````!tell LordWingZero,LordWingZero hello world```` (filters out uniqe)

### Configuration
- **maxAtOnce** : Prevents people from saving > n tells at once.
```` Javascript
"tell":{
  "limitResults": 1,
  "floodDelay": 1500
}
````

### Installing Into Tennu

See Downloadable Plugins [here](https://tennu.github.io/plugins/).

### Todo:

- Tests
