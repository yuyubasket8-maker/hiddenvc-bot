"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv_1 = __importDefault(require("dotenv"));
const log4js_1 = __importDefault(require("log4js"));
dotenv_1.default.config();
log4js_1.default.configure({
    appenders: { out: { type: "stdout" } },
    categories: { default: { appenders: ["out"], level: "info" } }
});
const logger = log4js_1.default.getLogger();
// スラッシュコマンドの定義
const commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName('set_hidden_vc_panel')
        .setDescription('裏通話の管理パネルを設定します')
        .setDefaultMemberPermissions(8n), // 管理者権限を持つユーザーのみ実行可能
].map(command => command.toJSON());
// コマンドをDiscordに登録
const rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
async function main() {
    try {
        logger.info(commands);
        await rest.put(discord_js_1.Routes.applicationCommands(process.env.BOT_CLIENT_ID), { body: commands });
        logger.info("スラッシュコマンドを登録しました");
    }
    catch (error) {
        logger.error("コマンド登録エラー:", error);
    }
}
main();
