# PC2MQTT

[![License: ISC](https://img.shields.io/github/license/nana4rider/pc2mqtt)](LICENSE)
![GitHub Actions Test](https://github.com/nana4rider/pc2mqtt/actions/workflows/test.yml/badge.svg)
![GitHub Actions Release](https://github.com/nana4rider/pc2mqtt/actions/workflows/release.yml/badge.svg)

## 概要

パソコンを[Home Assistant](https://www.home-assistant.io/)のスイッチデバイスとして自動検出させるためのアプリケーションです。

完全に動作するためには、下記を確認する必要があります。

- PCにpingが飛ばせること
- Wake-on-LANでPCが起動すること
- 指定した秘密鍵を使いPCにsshでログインすることができ、かつサスペンドコマンドを実行できること

## 使い方

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
          "privateKeyPath": "/path/to/id_rsa"
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
export MQTT_BROKER=mqtt://localhost
npm install
npm run build
npm start
```

### Docker

```sh
docker run -d \
  --name pc2mqtt \
  -e MQTT_BROKER=mqtt://localhost \
  --restart always \
  --net=host \
  nana4rider/pc2mqtt:latest
```

> [!TIP]  
> その他、必要な環境変数については[こちら](src/env.ts)をご確認ください。
>
> WoLパケットをブロードキャストに送信する都合上、[ `host` ネットワーク・モード](https://docs.docker.jp/network/host.html)の利用が必須になります。
