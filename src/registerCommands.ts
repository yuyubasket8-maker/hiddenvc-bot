import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const commands = [
  new SlashCommandBuilder()
    .setName("vc")
    .setDescription("裏個室VCを管理します")
    .addSubcommand(sub =>
      sub
        .setName("panel")
        .setDescription("裏個室管理パネルを送信します")
    )
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

async function main() {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID!,
      process.env.GUILD_ID!
    ),
    { body: commands }
  );

  console.log("スラッシュコマンド登録完了");
}

main().catch(console.error);