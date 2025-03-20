# Discord Pong

Discord のアクティビティ上で Pong を遊ぶためのプロジェクトです。

## 使い方

1. [Discord Developer Portal](https://discord.com/developers/applications) で Bot を作成し、トークンを取得します。
2. このリポジトリをクローンします。
3. `.env` ファイルを作成し、以下の内容を記述します。

```.env
VITE_DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
ALLOWED_HOST=
```

4. `npm install` を client ディレクトリと server ディレクトリで実行します。
5. `npm run dev` を実行します。
6. Discord からアプリケーションにアクセスします。
