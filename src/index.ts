import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  GatewayIntentBits,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} from "discord.js";

import "dotenv/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const CATEGORY_ID = "1507380290723512330";

const managedChannels = new Map<string, string>();
const channelActivated = new Set<string>();

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

function findOwnerChannelId(userId: string): string | null {
  for (const [channelId, ownerId] of managedChannels.entries()) {
    if (ownerId === userId) {
      return channelId;
    }
  }

  return null;
}

async function createHiddenVC(guild: any, userId: string) {
  const member = await guild.members.fetch(userId);

  const safeName =
    member.displayName.replace(/[^\p{L}\p{N}_-]/gu, "") || "user";

  const channel = await guild.channels.create({
    name: `${safeName}-channel`,
    type: ChannelType.GuildVoice,
    parent: CATEGORY_ID,
    userLimit: 2,

    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,

        deny: [
          PermissionFlagsBits.ViewChannel
        ]
      },

      {
        id: userId,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.UseVAD,
          PermissionFlagsBits.Stream,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },

      {
        id: client.user!.id,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]
  });

  managedChannels.set(channel.id, userId);

  // 120秒未使用削除
  setTimeout(async () => {

    const target =
      await client.channels
        .fetch(channel.id)
        .catch(() => null);

    if (!target) return;

    if (target.type !== ChannelType.GuildVoice) return;

    if (!managedChannels.has(target.id)) return;

    const humans =
      target.members.filter(
        member => !member.user.bot
      );

    if (humans.size === 0) {

      managedChannels.delete(target.id);

      channelActivated.delete(target.id);

      await target.delete().catch(console.error);

      console.log(
        `120秒経過で空VC削除: ${target.name}`
      );
    }

  }, 120 * 1000);

  console.log(`VC作成成功: ${channel.name}`);

  return channel;
}

client.on(
  "interactionCreate",
  async (interaction) => {

    if (!interaction.guild) {

      if (interaction.isRepliable()) {

        await interaction.reply({
          content:
            "この操作はサーバー内でのみ使えます。",

          flags: MessageFlags.Ephemeral
        });

      }

      return;
    }

    // スラッシュコマンド
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName !== "vc") return;

      const sub =
        interaction.options.getSubcommand();

      if (sub === "panel") {

        const row1 =
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("vc_create_private")
                .setLabel("🔒 裏個室作成")
                .setStyle(ButtonStyle.Success),

              new ButtonBuilder()
                .setCustomId("vc_delete_private")
                .setLabel("🗑 裏個室削除")
                .setStyle(ButtonStyle.Danger)

            );

        const row2 =
          new ActionRowBuilder<ButtonBuilder>()
            .addComponents(

              new ButtonBuilder()
                .setCustomId("vc_invite_private")
                .setLabel("👤 ユーザー招待")
                .setStyle(ButtonStyle.Primary),

              new ButtonBuilder()
                .setCustomId("vc_limit_private")
                .setLabel("👥 入室上限変更")
                .setStyle(ButtonStyle.Secondary)

            );

        await interaction.reply({

          embeds: [
            {
              title: "🔒 裏個室管理パネル",

              description:
                "🔒 裏個室作成\n" +
                "🗑 裏個室削除\n" +
                "👤 ユーザー招待\n" +
                "👥 入室上限変更\n\n" +

                "初期人数上限は2人です。\n" +

                "未使用のまま120秒経過すると削除。\n" +

                "一度入室後、全員退出で即削除。\n" +

                "招待時はVCチャットへ通知します。",

              color: 0x5865F2
            }
          ],

          components: [
            row1,
            row2
          ]

        });

        return;
      }
    }

    // ボタン
    if (interaction.isButton()) {

      // VC作成
      if (
        interaction.customId ===
        "vc_create_private"
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const existing =
          findOwnerChannelId(
            interaction.user.id
          );

        if (existing) {

          await interaction.editReply({
            content:
              "すでにあなたの裏個室があります。"
          });

          return;
        }

        await createHiddenVC(
          interaction.guild,
          interaction.user.id
        );

        await interaction.editReply({
          content:
            "🔒 裏個室VCを作成しました。"
        });

        return;
      }

      // VC削除
      if (
        interaction.customId ===
        "vc_delete_private"
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const channelId =
          findOwnerChannelId(
            interaction.user.id
          );

        if (!channelId) {

          await interaction.editReply({
            content:
              "削除できる裏個室がありません。"
          });

          return;
        }

        const channel =
          await client.channels
            .fetch(channelId)
            .catch(() => null);

        managedChannels.delete(channelId);

        channelActivated.delete(channelId);

        if (
          channel &&
          channel.type === ChannelType.GuildVoice
        ) {

          await channel
            .delete()
            .catch(console.error);

        }

        await interaction.editReply({
          content:
            "🗑 裏個室を削除しました。"
        });

        return;
      }

      // 招待
      if (
        interaction.customId ===
        "vc_invite_private"
      ) {

        const channelId =
          findOwnerChannelId(
            interaction.user.id
          );

        if (!channelId) {

          await interaction.reply({
            content:
              "招待できる裏個室がありません。",

            flags: MessageFlags.Ephemeral
          });

          return;
        }

        const menu =
          new UserSelectMenuBuilder()

            .setCustomId(
              "vc_invite_user_select"
            )

            .setPlaceholder(
              "招待するユーザーを選択"
            )

            .setMinValues(1)

            .setMaxValues(1);

        const row =
          new ActionRowBuilder<UserSelectMenuBuilder>()

            .addComponents(menu);

        await interaction.reply({

          content:
            "招待するユーザーを選択してください。",

          components: [row],

          flags: MessageFlags.Ephemeral
        });

        return;
      }

      // 上限変更
      if (
        interaction.customId ===
        "vc_limit_private"
      ) {

        const modal =
          new ModalBuilder()

            .setCustomId(
              "vc_limit_modal"
            )

            .setTitle(
              "入室上限変更"
            );

        const input =
          new TextInputBuilder()

            .setCustomId(
              "limit_count"
            )

            .setLabel(
              "人数上限"
            )

            .setStyle(
              TextInputStyle.Short
            )

            .setRequired(true)

            .setPlaceholder(
              "例: 2, 3, 5"
            );

        modal.addComponents(

          new ActionRowBuilder<TextInputBuilder>()

            .addComponents(input)

        );

        await interaction.showModal(modal);

        return;
      }
    }

    // ユーザー選択
    if (interaction.isUserSelectMenu()) {

      if (
        interaction.customId ===
        "vc_invite_user_select"
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const channelId =
          findOwnerChannelId(
            interaction.user.id
          );

        if (!channelId) {

          await interaction.editReply({
            content:
              "招待できる裏個室がありません。",

            components: []
          });

          return;
        }

        const targetUserId =
          interaction.values[0];

        const channel =
          await client.channels
            .fetch(channelId)
            .catch(() => null);

        if (
          !channel ||
          channel.type !== ChannelType.GuildVoice
        ) {

          await interaction.editReply({
            content:
              "裏個室が見つかりません。",

            components: []
          });

          return;
        }

        await channel.permissionOverwrites.edit(
          targetUserId,

          {
            ViewChannel: true,
            Connect: true,
            Speak: true,
            UseVAD: true,
            Stream: true,
            SendMessages: true,
            ReadMessageHistory: true
          }
        );

        // VCチャット通知
        await channel.send({

          content:
            `<@${targetUserId}>\n` +
            `このVCに招待されています。`

        });

        await interaction.editReply({

          content:
            `<@${targetUserId}> を招待しました。`,

          components: []

        });

        return;
      }
    }

    // モーダル
    if (interaction.isModalSubmit()) {

      if (
        interaction.customId ===
        "vc_limit_modal"
      ) {

        await interaction.deferReply({
          flags: MessageFlags.Ephemeral
        });

        const channelId =
          findOwnerChannelId(
            interaction.user.id
          );

        if (!channelId) {

          await interaction.editReply({
            content:
              "上限変更できる裏個室がありません。"
          });

          return;
        }

        const rawCount =
          interaction.fields.getTextInputValue(
            "limit_count"
          );

        const count =
          Number(rawCount);

        if (
          !Number.isInteger(count) ||
          count < 1 ||
          count > 99
        ) {

          await interaction.editReply({
            content:
              "人数上限は1〜99で入力してください。"
          });

          return;
        }

        const channel =
          await client.channels
            .fetch(channelId)
            .catch(() => null);

        if (
          !channel ||
          channel.type !== ChannelType.GuildVoice
        ) {

          await interaction.editReply({
            content:
              "裏個室が見つかりません。"
          });

          return;
        }

        await channel.setUserLimit(count);

        await interaction.editReply({
          content:
            `👥 入室上限を ${count} 人に変更しました。`
        });

        return;
      }
    }
  }
);

// VC退出監視
client.on(
  "voiceStateUpdate",
  async (oldState, newState) => {

    // 入室で使用済み化
    if (
      newState.channel &&
      managedChannels.has(newState.channel.id)
    ) {

      channelActivated.add(
        newState.channel.id
      );
    }

    const oldChannel =
      oldState.channel;

    if (!oldChannel) return;

    if (
      oldChannel.type !==
      ChannelType.GuildVoice
    ) return;

    if (
      !managedChannels.has(
        oldChannel.id
      )
    ) return;

    // 退出後1秒待機
    setTimeout(async () => {

      const target =
        await client.channels
          .fetch(oldChannel.id)
          .catch(() => null);

      if (!target) return;

      if (
        target.type !==
        ChannelType.GuildVoice
      ) return;

      if (
        !managedChannels.has(
          target.id
        )
      ) return;

      const humans =
        target.members.filter(
          member => !member.user.bot
        );

      // 使用済み + 無人
      if (
        channelActivated.has(target.id) &&
        humans.size === 0
      ) {

        managedChannels.delete(
          target.id
        );

        channelActivated.delete(
          target.id
        );

        await target
          .delete()
          .catch(console.error);

        console.log(
          `使用済みVC即削除: ${target.name}`
        );
      }

    }, 1000);
  }
);

client.login(process.env.TOKEN);