const BaseCommand = require('../../utils/structures/BaseCommand');
const MusicUtil = require("../../lavalinkClient/musicUtil");
const musicUtil = new MusicUtil;

module.exports = class SummonCommand extends BaseCommand {
    constructor() {
        super({
            name: "summon",
            aliases: ["sum"],
            description: "Make the bot join your channel",
            category: "music",
            cooldown: 5,
        })
    }
    async run({ message, internalCall, guildData, skipConditions }) {
        let authorVoiceChannel;
        if (!skipConditions) {
            const conditions = await this.testConditions({ message, internalCall });
            if (conditions.error) return { error: conditions.error }
            else authorVoiceChannel = conditions.authorVoiceChannel;
        }
        else authorVoiceChannel = skipConditions;

        const player = await message.client.lavalinkClient.create({
            guild: message.guild,
            voiceChannel: authorVoiceChannel,
            textChannel: message.channel,
            selfDeafen: true,
            volume: (guildData.settings.music.volume.limit && guildData.settings.music.volume.value > 100) ? 100 : parseInt(guildData.settings.music.volume.value)
        });

        //apply guild settings to player
        switch (guildData.settings.music.loop.value) {
            case "q": player.setQueueRepeat(true);
                break;
            case "t": player.setTrackRepeat(true);
                break;
            default:
                break;
        }

        await player.setEQ(guildData.settings.music.eq.bands.map((gain, index) => { return { band: index, gain } }));

        //additional player data
        player.guildOBJ = message.guild;
        player.client = message.client;
        player.previousTracks = [];

        //connect to the channel
        await player.connect();

        //access player from guild
        message.guild.player = player;

        if (!internalCall) {
            const joinedEmbed = new this.discord.MessageEmbed()
                .setDescription(`**Joined your voice channel!**`)
                .addField("Player Voice Channel", `${this.appearance.playerEmojis.voice_channel_icon_normal.emoji} ${authorVoiceChannel.name}`)
                .addField("Player Text Channel", `<#${message.channel.id}>`)
                .addField("Volume", `${player.volume}`, true)
                .addField("Loop", `${player.trackRepeat ? `Track` : (player.queueRepeat ? `Queue` : `Disabled`)}`, true)
                .addField("Volume limit to 100", `${!guildData.settings.music.volume.limit ? `Disabled` : `Enabled`}`, true)
                .setColor(this.getClientColour(message.guild))
            await message.channel.send(joinedEmbed);
        }

        return { player: player, guild: message.guild };
    }

    async testConditions({ message, internalCall }) {
        if (!internalCall) if (!message.channel.clientPermissions.has("EMBED_LINKS")) {
            await message.channel.send("I don't have permissions to send message embeds in this channel");
            return { error: { message: "NO_BOT_PERMS", code: 11 } };
        }

        const { authorVoiceChannel, error } = await musicUtil.canModifyPlayer({ message, noPlayer: true, requiredPerms: "SUMMON_PLAYER", errorEmbed: true, spawningPlayer: true });
        if (error) return { error: error };

        let errorEmbed = new this.discord.MessageEmbed().setColor(this.appearance.error.colour);
        const permissions = authorVoiceChannel.permissionsFor(message.client.user);
        if (!permissions.has("VIEW_CHANNEL")) {
            await message.channel.send(errorEmbed.setDescription("I don't have permissions to view your channel!"));
            return { error: { message: "NO_BOT_PERMS_VIEW_CHANNEL", code: 12 } }
        }
        if (!permissions.has("CONNECT")) {
            await message.channel.send(errorEmbed.setDescription("I don't have permissions to join your channel!"));
            return { error: { message: "NO_BOT_PERMS_CONNECT", code: 13 } }
        }
        if (!permissions.has("SPEAK")) {
            await message.channel.send(errorEmbed.setDescription("I don't have permissions to speak in your channel!"));
            return { error: { message: "NO_BOT_PERMS_SPEAK", code: 14 } }
        }

        return { authorVoiceChannel: authorVoiceChannel }
    }
}