# PC2MQTT

[![License: ISC](https://img.shields.io/github/license/nana4rider/pc2mqtt)](LICENSE)
![GitHub Actions Test](https://github.com/nana4rider/pc2mqtt/actions/workflows/test.yml/badge.svg)
![GitHub Actions Release](https://github.com/nana4rider/pc2mqtt/actions/workflows/release.yml/badge.svg)

## 概要

パソコンを[Home Assistant](https://www.home-assistant.io/)のスイッチデバイスとして自動検出させるためのアプリケーションです。

ping、Wake-on-LAN、sshを使える必要があります。

## Usage

```sh
export MQTT_BROKER="mqtt://localhost"
export MQTT_USERNAME="username"
export MQTT_PASSWORD="password"
node dist/index
```
