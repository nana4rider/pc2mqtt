# PC2MQTT

[![License: ISC](https://img.shields.io/github/license/nana4rider/pc2mqtt)](LICENSE)
![GitHub Actions Test](https://github.com/nana4rider/pc2mqtt/actions/workflows/test.yml/badge.svg)
![GitHub Actions Release](https://github.com/nana4rider/pc2mqtt/actions/workflows/release.yml/badge.svg)

## 概要

PCを[Home Assistant](https://www.home-assistant.io/)のスイッチデバイスとして自動検出させるためのアプリケーションです。

完全に動作するためには、下記の高度な設定が必要になります。

- PCにpingが飛ばせること
- Wake-on-LANでPCが起動すること
- 指定した秘密鍵を使いPCにsshでログインすることができ、かつサスペンドコマンドを実行できること

## 使い方

### Add-ons

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fnana4rider%2Fhome-assistant-addons)

### 設定ファイルの作成

`config.json` に機器情報を設定

```json
{
  "deviceId": "string",
  "entities": [
    {
      "id": "string",
      "name": "name",
      "remote": {
        "ssh": {
          "username": "username",
          "privateKeyPath": "/path/to/id_ed25519"
        },
        "macAddress": "192.168.1.10",
        "ipAddress": "ca:fe:ba:be:de:ad"
      }
    }
  ]
}
```

### Native

```sh
npm install
npm run build
node --env-file=.env dist/index
```

### Docker

```sh
docker run -d \
  --name pc2mqtt \
  --env-file .env \
  --restart always \
  --net=host \
  nana4rider/pc2mqtt:latest
```

> [!TIP]  
> 必要な環境変数については[こちら](src/env.ts)をご確認ください。
>
> WoLパケットをブロードキャストに送信する都合上、 [`host` ネットワーク・モード](https://docs.docker.jp/network/host.html)の利用が必須になります。
