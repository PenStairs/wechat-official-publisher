import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WeChatPublisherConfig } from "./types.js";

interface ConfigFile {
  appId?: string;
  appSecret?: string;
  apiBaseUrl?: string;
  tokenCacheFile?: string;
  logFile?: string;
}

export function loadPublisherConfig(): WeChatPublisherConfig {
  const configFile = readConfigFile();
  const configDir = path.join(os.homedir(), ".config", "wechat-official-publisher");
  const cacheDir = path.join(os.homedir(), ".cache", "wechat-official-publisher");

  return {
    appId: process.env.WECHAT_APPID ?? configFile.appId ?? "",
    appSecret: process.env.WECHAT_SECRET ?? configFile.appSecret ?? "",
    apiBaseUrl: stripTrailingSlash(process.env.WECHAT_API_BASE_URL ?? configFile.apiBaseUrl ?? "https://api.weixin.qq.com"),
    tokenCacheFile: expandHome(process.env.WECHAT_TOKEN_CACHE_FILE ?? configFile.tokenCacheFile ?? path.join(cacheDir, "token.json")),
    logFile: expandHome(process.env.WECHAT_PUBLISHER_LOG_FILE ?? configFile.logFile ?? path.join(configDir, "publisher.log"))
  };
}

export function validateWeChatConfig(config: WeChatPublisherConfig): string[] {
  const missing: string[] = [];
  if (!config.appId) {
    missing.push("WECHAT_APPID");
  }
  if (!config.appSecret) {
    missing.push("WECHAT_SECRET");
  }
  return missing;
}

function readConfigFile(): ConfigFile {
  const explicitPath = process.env.WECHAT_PUBLISHER_CONFIG;
  const configPath = explicitPath ? expandHome(explicitPath) : path.join(os.homedir(), ".config", "wechat-official-publisher", "config.json");
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as ConfigFile;
  } catch (error) {
    console.warn(`[wechat-publisher] config file parse failed path="${configPath}", env fallback will be used. error=${String(error)}`);
    return {};
  }
}

function expandHome(filePath: string): string {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
