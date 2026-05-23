"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Discord.jsの必要なクラスや関数をインポート
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const HiddenVoiceChannelManager_1 = require("./HiddenVoiceChannelManager");
const node_cron_1 = __importDefault(require("node-cron"));
const log4js_1 = __importDefault(require("log4js"));
log4js_1.default.configure({
    appenders: { out: { type: "stdout" } },
    categories: { default: { appenders: ["out"], level: "info" } }
});
const logger = log4js_1.default.getLogger();
dotenv_1.default.config();
// Discord Botのクライアントを作成（Botの本体）
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds, // サーバー関連のイベントを受け取る
        discord_js_1.GatewayIntentBits.GuildMembers, // メンバー関連のイベントを受け取る
        discord_js_1.GatewayIntentBits.DirectMessages, // DM関連のイベントを受け取る
        discord_js_1.GatewayIntentBits.GuildVoiceStates, // ボイスチャンネル関連のイベントを受け取る
    ],
});
// 裏通話（隠しボイスチャンネル）を管理するクラスのインスタンスを作成
const hiddenChannelManager = new HiddenVoiceChannelManager_1.HiddenVoiceChannelManager(client);
// Botが起動したときに一度だけ呼ばれる
client.on("ready", async () => {
    logger.info("Bot is ready!"); // 起動完了のログ
});
// /ping コマンドの処理
async function handlePingCommand(interaction) {
    logger.info(`/ping command executed by ${interaction.user.tag}`);
    // Pong! と返信するだけのシンプルなコマンド
    await interaction.reply('Pong!');
}
// /set_hidden_vc_panel コマンドの処理
async function handleSetHiddenVCPanelCommand(interaction) {
    // サーバー内でのみ実行可能
    const guild = interaction.guild;
    if (!guild) {
        await interaction.reply('このコマンドはサーバー内で実行してください');
        return;
    }
    // テキストチャンネル内でのみ実行可能
    const channel = interaction.channel;
    if (channel?.type !== 0) {
        await interaction.reply('このコマンドはテキストチャンネル内で実行してください');
        return;
    }
    // 埋め込みメッセージを作成
    const embed = new discord_js_1.EmbedBuilder()
        .setTitle('裏通話')
        .setDescription('ここから裏通話の操作ができます。')
        .setColor(0x00bfff);
    // 「裏通話を作成」ボタン
    const vcCreateButton = new discord_js_1.ButtonBuilder()
        .setCustomId('hidden_vc_create')
        .setLabel('裏通話を作成')
        .setStyle(discord_js_1.ButtonStyle.Primary);
    // 「裏通話を削除」ボタン
    const vcDeleteButton = new discord_js_1.ButtonBuilder()
        .setCustomId('hidden_vc_delete')
        .setLabel('裏通話を削除')
        .setStyle(discord_js_1.ButtonStyle.Danger);
    // ボタンを並べるための行
    const row = new discord_js_1.ActionRowBuilder()
        .addComponents(vcCreateButton)
        .addComponents(vcDeleteButton);
    // パネル（埋め込み＋ボタン）をチャンネルに送信
    await channel.send({ embeds: [embed], components: [row] });
    // コマンド実行者には「作成しました」とだけDMで通知
    await interaction.reply({ content: 'パネルを作成しました。', flags: discord_js_1.MessageFlags.Ephemeral });
    logger.info("Hidden VC panel created.");
}
// 「裏通話を作成」ボタンの処理
async function handleHiddenVCCreateButton(interaction) {
    logger.info(`hidden_vc_create button pressed by ${interaction.user.tag}`);
    // テキストチャンネル内でのみ動作
    const channel = interaction.channel;
    if (channel && channel.type == discord_js_1.ChannelType.GuildText) {
        const parentChannelId = channel.parentId;
        // ボイスチャンネルを新規作成（親カテゴリは今のチャンネルと同じ）
        const voiceChannel = await hiddenChannelManager.createHiddenVoiceChannel(channel.guild.id, parentChannelId, interaction.user.id, `${interaction.user.displayName}の部屋`);
        if (voiceChannel) {
            // 作成したボイスチャンネルに「ユーザ招待」ボタンを設置
            const inviteButton = new discord_js_1.ButtonBuilder()
                .setCustomId('hidden_vc_invite')
                .setLabel('ユーザ招待')
                .setStyle(discord_js_1.ButtonStyle.Primary);
            const row = new discord_js_1.ActionRowBuilder()
                .addComponents(inviteButton);
            voiceChannel.send({ content: `${interaction.user}さんの部屋を作成しました。各種設定は以下のボタンから行ってください`, components: [row] });
            // 作成者にはDMで通知
            interaction.reply({ content: `裏通話を作成しました: ${voiceChannel}`, flags: discord_js_1.MessageFlags.Ephemeral });
            logger.info(`Hidden VC created for user ${interaction.user.tag} in guild ${channel.guild.id}`);
            return;
        }
        // すでに裏通話が存在する場合
        if (hiddenChannelManager.exists(channel.guild.id, interaction.user.id)) {
            logger.warn(`Hidden VC already exists for user ${interaction.user.tag}`);
            interaction.reply({ content: `裏通話はすでに存在します`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
    }
    // 失敗時のメッセージ
    logger.error("Failed to create hidden VC");
    interaction.reply({ content: `裏通話の作成に失敗しました`, flags: discord_js_1.MessageFlags.Ephemeral });
}
// 「裏通話を削除」ボタンの処理
async function handleHiddenVCDeleteButton(interaction) {
    logger.info(`hidden_vc_delete button pressed by ${interaction.user.tag}`);
    // テキストチャンネル内でのみ動作
    const channel = interaction.channel;
    if (channel && channel.type == discord_js_1.ChannelType.GuildText) {
        // 裏通話が存在しない場合
        if (!hiddenChannelManager.exists(channel.guild.id, interaction.user.id)) {
            logger.warn(`No hidden VC exists for user ${interaction.user.tag}`);
            interaction.reply({ content: `裏通話は存在しません`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
        // ボイスチャンネルを削除
        const voiceChannel = await hiddenChannelManager.deleteHiddenVoiceChannel(channel.guild.id, interaction.user.id);
        // 削除成功時
        if (!voiceChannel) {
            logger.info(`Hidden VC deleted for user ${interaction.user.tag}`);
            interaction.reply({ content: `裏通話を削除しました`, flags: discord_js_1.MessageFlags.Ephemeral });
            return;
        }
    }
    // 失敗時のメッセージ
    logger.error("Failed to delete hidden VC");
    interaction.reply({ content: `裏通話の削除に失敗しました`, flags: discord_js_1.MessageFlags.Ephemeral });
}
// 「ユーザ招待」ボタンの処理
async function handleHiddenVCInviteButton(interaction) {
    logger.info(`hidden_vc_invite button pressed by ${interaction.user.tag}`);
    // チャンネルのオーナーのみが招待可能
    if (!interaction.guildId || !interaction.channelId) {
        interaction.reply({ content: `ギルドまたはチャンネル情報が見つかりません`, flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    const channelOwner = hiddenChannelManager.getChannelOwner(interaction.guildId, interaction.channelId);
    console.log(channelOwner);
    if (interaction.user.id != channelOwner) {
        logger.warn(`User ${interaction.user.tag} is not the owner of the channel`);
        interaction.reply({ content: `あなたはこのチャンネルのオーナーではありません`, flags: discord_js_1.MessageFlags.Ephemeral });
        return;
    }
    // サーバー内でのみ実行可能
    const guild = interaction.guild;
    if (!guild) {
        logger.warn("Guild not found for invite");
        await interaction.reply('このコマンドはサーバー内で実行してください');
        return;
    }
    // ボイスチャンネル内でのみ実行可能
    const channel = interaction.channel;
    if (channel?.type !== discord_js_1.ChannelType.GuildVoice) {
        logger.warn("Invite attempted outside of voice channel");
        await interaction.reply('このコマンドはボイスチャンネル内で実行してください');
        return;
    }
    // ユーザ選択メニューを作成
    const userSelectMenu = new discord_js_1.UserSelectMenuBuilder()
        .setCustomId('user_select')
        .setPlaceholder('招待するユーザを選択してください');
    // 選択メニューを送信
    interaction.reply({
        content: '招待するユーザを選択してください',
        components: [new discord_js_1.ActionRowBuilder().addComponents(userSelectMenu)],
        flags: discord_js_1.MessageFlags.Ephemeral
    });
    logger.info("User select menu sent for invite.");
}
// ユーザ選択メニューの処理を関数化
async function handleUserSelectMenu(interaction, client) {
    const selectedUser = interaction.values[0]; // 選択されたユーザのID
    const channel = interaction.channel;
    if (channel && channel.type == discord_js_1.ChannelType.GuildVoice) {
        await channel.permissionOverwrites.edit(selectedUser, {
            ViewChannel: true, // チャンネルの表示を許可
            Connect: true // チャンネルへの接続を許可
        });
        // 招待処理をここに追加
        await interaction.reply({ content: `<@${selectedUser}>さんを招待しました`, flags: discord_js_1.MessageFlags.Ephemeral });
        client.users.fetch(selectedUser).then(user => {
            user.send(`あなたは${channel}に招待されました。`);
            logger.info(`DM sent to user ${selectedUser} for channel invite.`);
        }).catch(err => {
            logger.error(`Failed to send DM to user ${selectedUser}:`, err);
        });
        logger.info(`User ${selectedUser} invited to channel ${channel.id}`);
    }
}
// --- interactionCreateイベント ---
// すべてのインタラクション（コマンドやボタン）をここで受け取り、上で定義した関数に振り分けます
client.on("interactionCreate", async (interaction) => {
    try {
        // スラッシュコマンドの場合
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ping') {
                handlePingCommand(interaction);
            }
            if (interaction.commandName === 'set_hidden_vc_panel') {
                handleSetHiddenVCPanelCommand(interaction);
            }
        }
        // ボタンが押された場合
        if (interaction.isButton()) {
            if (interaction.customId === 'hidden_vc_create') {
                handleHiddenVCCreateButton(interaction);
            }
            else if (interaction.customId === 'hidden_vc_delete') {
                handleHiddenVCDeleteButton(interaction);
            }
            else if (interaction.customId === 'hidden_vc_invite') {
                handleHiddenVCInviteButton(interaction);
            }
        }
        if (interaction.isUserSelectMenu()) {
            if (interaction.customId === 'user_select') {
                await handleUserSelectMenu(interaction, client);
            }
        }
    }
    catch (error) {
        logger.error("interactionCreate event error:", error);
    }
});
client.on("voiceStateUpdate", async (oldState, newState) => {
    // ボイスチャンネルから退出した場合
    if (oldState.channelId) {
        //チャンネルの人数を取得
        const channel = client.channels.cache.get(oldState.channelId);
        if (channel && channel.type === discord_js_1.ChannelType.GuildVoice) {
            const voiceChannel = channel;
            const members = voiceChannel.members;
            // チャンネルに誰もいない場合、チャンネルを削除
            const owner = hiddenChannelManager.getChannelOwner(voiceChannel.guild.id, voiceChannel.id);
            if (members.size === 0 && hiddenChannelManager.getJoined(voiceChannel.id) && owner) {
                if (owner) {
                    await hiddenChannelManager.deleteHiddenVoiceChannel(voiceChannel.guild.id, owner);
                    logger.info(`Deleted empty channel ${channel.name} with ID ${channel.id}`);
                }
            }
        }
    }
    // ボイスチャンネルに参加もしくは移動した場合
    if (newState.channelId) {
        if (hiddenChannelManager.existsChannel(newState.guild.id, newState.channelId)) {
            // チャンネルに参加した場合
            logger.info(`User ${newState.member?.user.username} joined channel ${newState.channelId}`);
            hiddenChannelManager.setJoined(newState.channelId);
        }
    }
});
// Botにログイン（トークンは.envから取得）
client.login(process.env.DISCORD_TOKEN).then(() => {
    logger.info("Logged in!"); // ログイン成功時のログ
}).catch((err) => {
    logger.error("Error logging in:", err); // ログイン失敗時のエラー
});
// 毎分実行
node_cron_1.default.schedule('* * * * *', () => {
    hiddenChannelManager.getChannelArray().map(async (channel) => {
        const voiceChannel = client.channels.cache.get(channel);
        if (voiceChannel && voiceChannel.type === discord_js_1.ChannelType.GuildVoice) {
            const members = voiceChannel.members;
            //チャンネルに誰もいないかつ作成されてから3分経過しているチャンネルか判定
            const createdAt = voiceChannel.createdAt;
            const now = new Date();
            const diff = Math.abs(now.getTime() - createdAt.getTime());
            const diffMinutes = Math.floor(diff / (1000 * 60));
            if (members.size === 0 && diffMinutes > 3) {
                // チャンネルを削除
                const owner = hiddenChannelManager.getChannelOwner(voiceChannel.guild.id, voiceChannel.id);
                if (owner) {
                    await hiddenChannelManager.deleteHiddenVoiceChannel(voiceChannel.guild.id, owner);
                    logger.info(`Deleted empty channel ${voiceChannel.name} with ID ${voiceChannel.id}`);
                }
            }
        }
    });
});
