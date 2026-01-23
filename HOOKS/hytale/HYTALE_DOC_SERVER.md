# Hytale Server Manual

This guide covers the setup, configuration, and operation of dedicated Hytale servers. It consolidates information from the official Hytale Server Manual and community guides.

**Intended Audience:** Server administrators and players hosting dedicated servers.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Server Installation](#2-server-installation)
3. [Running the Server](#3-running-the-server)
4. [Authentication](#4-authentication)
5. [Network & Firewall Configuration](#5-network--firewall-configuration)
6. [Configuration & Optimization](#6-configuration--optimization)
7. [File Structure](#7-file-structure)
8. [Multiserver Architecture](#8-multiserver-architecture)
9. [Future Features](#9-future-features)

---

## 1. Prerequisites

### System Requirements

The Hytale server supports both **x64** and **arm64** architectures.

- **OS:** Windows, Linux, or macOS.
- **RAM:** Minimum 4GB (Recommended: 8GB+ depending on player count and view distance).
- **Storage:** At least 10GB recommended for server files and world saves.
- **CPU:** Requirements scale with player count and entity density (NPCs, mobs).

### Java Installation

**Java 25** is required. The server will not run on older versions.

- **Recommendation:** [Adoptium (Eclipse Temurin)](https://adoptium.net/)
- **Verify Installation:**
  ```bash
  java --version
  ```
  _Expected output:_
  ```text
  openjdk 25.0.1 2025-10-21 LTS
  OpenJDK Runtime Environment Temurin-25.0.1+8 ...
  ```

---

## 2. Server Installation

There are two methods to obtain server files.

### Method A: Hytale Downloader CLI (Recommended)

Best for production servers and easy updates.

1.  Download the **Hytale Downloader** (available for Linux & Windows).
2.  Run the downloader to fetch the server jar and assets.

    ```bash
    # Download latest release
    ./hytale-downloader

    # Or download to a specific path
    ./hytale-downloader -download-path game.zip
    ```

    _Note: The downloader uses OAuth2 authentication. Follow the prompts to authenticate via your browser._

### Method B: Manual Copy

Best for quick local testing.

1.  Locate your Hytale client installation:
    - **Windows:** `%appdata%\Hytale\install\release\package\game\latest`
    - **Linux:** `$XDG_DATA_HOME/Hytale/install/release/package/game/latest`
    - **macOS:** `~/Application Support/Hytale/install/release/package/game/latest`
2.  Copy the `Server` folder and `Assets.zip` file to your dedicated server directory.

---

## 3. Running the Server

### Basic Launch Command

```bash
java -XX:AOTCache=HytaleServer.aot -jar HytaleServer.jar --assets Assets.zip
```

### Useful Arguments

| Option                     | Description                                           |
| :------------------------- | :---------------------------------------------------- |
| `--assets <Path>`          | Path to assets file (default: `..\HytaleAssets`)      |
| `--bind <IP:Port>`         | Address to listen on (default: `0.0.0.0:5520`)        |
| `--auth-mode <mode>`       | `authenticated` (default) or `offline`                |
| `--disable-sentry`         | Disable crash reporting (Recommended for dev/testing) |
| `--backup`                 | Enable automatic backups                              |
| `--backup-frequency <min>` | Backup interval in minutes (default: 30)              |

To see all arguments:

```bash
java -jar HytaleServer.jar --help
```

---

## 4. Authentication

On the first launch, you must authenticate your server to enable API communication and player connections.

1.  Start the server. Watch the console for the device authorization prompt:
    ```text
    > /auth login device
    ===================================================================
    DEVICE AUTHORIZATION
    ===================================================================
    Visit: https://accounts.hytale.com/device
    Enter code: ABCD-1234
    ```
2.  Visit the URL and enter the code.
3.  Once authenticated, the console will confirm:
    ```text
    > Authentication successful! Mode: OAUTH_DEVICE
    ```

_Note: There is a limit of 100 servers per Hytale game license._

---

## 5. Network & Firewall Configuration

Hytale uses the **QUIC protocol over UDP**. It does **not** use TCP for gameplay connections.

- **Default Port:** `5520` (UDP)

### Firewall Rules

#### Linux (UFW)

```bash
sudo ufw allow 5520/udp
sudo ufw reload
```

#### Linux (iptables)

```bash
sudo iptables -A INPUT -p udp --dport 5520 -j ACCEPT
```

#### Windows (PowerShell)

```powershell
New-NetFirewallRule -DisplayName "Hytale Server" -Direction Inbound -Protocol UDP -LocalPort 5520 -Action Allow
```

### Port Forwarding

If hosting behind a router (NAT), forward **UDP port 5520** to your server's local IP. TCP forwarding is not required.

---

## 6. Configuration & Optimization

### Memory (RAM)

Use Java's standard `-Xmx` and `-Xms` flags to control heap size.

- Example (Allocating 8GB):
  ```bash
  java -Xmx8G -Xms8G -XX:AOTCache=HytaleServer.aot -jar HytaleServer.jar --assets Assets.zip
  ```

### Ahead-Of-Time (AOT) Cache

The server includes a pre-trained AOT cache (`HytaleServer.aot`) to improve startup time.

- **Always enable it:** `-XX:AOTCache=HytaleServer.aot`

### View Distance

View distance significantly impacts RAM usage.

- **Recommendation:** Limit to **12 chunks** (384 blocks).
- _Comparison:_ Hytale's 12 chunks are roughly equivalent to Minecraft's 24 chunks in terms of loaded area.

### Recommended Plugins

- **Nitrado:PerformanceSaver:** Dynamically limits view distance based on resource usage.
- **Nitrado:WebServer:** Base plugin for web apps/APIs.
- **ApexHosting:PrometheusExporter:** Exposes metrics for monitoring.

---

## 7. File Structure

| Path               | Description                       |
| :----------------- | :-------------------------------- |
| `.cache/`          | Cache for optimized files         |
| `logs/`            | Server log files                  |
| `mods/`            | Installed mods (`.jar` or `.zip`) |
| `universe/`        | World and player save data        |
| `bans.json`        | Banned players list               |
| `config.json`      | Main server configuration         |
| `permissions.json` | Permission configuration          |
| `whitelist.json`   | Whitelisted players               |

### Configuration Files (JSON)

Configuration files (`config.json`, `permissions.json`, `whitelist.json`, etc.) are read on server startup and written to when in-game actions occur (for example, assigning permissions via commands). Manual changes while the server is running are likely to be overwritten.

#### `config.json` (Server Root)

Global server configuration stored at the server root. This controls server-wide behavior (not per-world rules).

Common keys:

| Key                       | Type    | Notes                                                                                          |
| :------------------------ | :------ | :--------------------------------------------------------------------------------------------- |
| `ServerName`              | string  | Public server name shown to players.                                                           |
| `MOTD`                    | string  | Message of the day displayed under the name.                                                   |
| `Password`                | string  | Empty (`""`) means public; non-empty means private.                                            |
| `MaxPlayers`              | integer | Maximum concurrent players (scales RAM/CPU needs).                                             |
| `MaxViewRadius`           | integer | View distance in chunks. This is the main RAM driver. Recommended: 12 (standard) to 16 (high). |
| `LocalCompressionEnabled` | boolean | Compression can reduce bandwidth but increases CPU slightly.                                   |
| `Version`                 | integer | Config version. Do not change this manually.                                                   |
| `Defaults.World`          | string  | Default world name; created at launch if missing under `universe/`.                            |
| `Defaults.GameMode`       | string  | Common values: `ADVENTURE` or `CREATIVE`.                                                      |
| `ConnectionTimeouts`      | object  | Timeout tuning; leave `{}` to use engine defaults.                                             |
| `RateLimit`               | object  | Packet spam protection; leave `{}` unless you know what you’re doing.                          |
| `PlayerStorage.Type`      | string  | Player save backend; typically `Hytale`.                                                       |
| `DisplayTmpTagsInStrings` | boolean | Dev-facing option; keep `false` for production.                                                |

#### `permissions.json` (Server Root)

Permission configuration stored at the server root. This is typically managed via in-game/server console commands rather than manual editing.

Minimal example (permanent OP via UUID):

```json
{
  "users": {
    "YOUR_UUID_HERE": {
      "groups": ["OP"]
    }
  },
  "groups": {
    "Default": [],
    "OP": ["*"]
  }
}
```

#### `whitelist.json` (Server Root)

Whitelist data stored at the server root. Use this to restrict access to a defined set of players.

Example format (UUID list):

```json
[
  "550e8400-e29b-41d4-a716-446655440000",
  "123e4567-e89b-12d3-a456-426614174000",
  "abcdef12-3456-7890-abcd-ef1234567890"
]
```

#### `bans.json` (Server Root)

Ban list stored at the server root.

### Universe Structure

The `universe/worlds/` directory contains all playable worlds. Each world has its own `config.json`.

#### World Config (`universe/worlds/<world>/config.json`) — Full Example

```json
{
  "Version": 4,
  "UUID": {
    "$binary": "j2x/idwTQpen24CDfH1+OQ==",
    "$type": "04"
  },
  "Seed": 1767292261384,
  "WorldGen": {
    "Type": "Hytale",
    "Name": "Default"
  },
  "WorldMap": {
    "Type": "WorldGen"
  },
  "ChunkStorage": {
    "Type": "Hytale"
  },
  "ChunkConfig": {},
  "IsTicking": true,
  "IsBlockTicking": true,
  "IsPvpEnabled": false,
  "IsFallDamageEnabled": true,
  "IsGameTimePaused": false,
  "GameTime": "0001-01-01T08:26:59.761606129Z",
  "RequiredPlugins": {},
  "IsSpawningNPC": true,
  "IsSpawnMarkersEnabled": true,
  "IsAllNPCFrozen": false,
  "GameplayConfig": "Default",
  "IsCompassUpdating": true,
  "IsSavingPlayers": true,
  "IsSavingChunks": true,
  "IsUnloadingChunks": true,
  "IsObjectiveMarkersEnabled": true,
  "DeleteOnUniverseStart": false,
  "DeleteOnRemove": false,
  "ResourceStorage": {
    "Type": "Hytale"
  },
  "Plugin": {}
}
```

Each world runs on its own main thread and off-loads parallel work into a shared thread pool.

---

## 8. Multiserver Architecture

Hytale supports native server-to-server transfers without needing a reverse proxy (like BungeeCord).

### Features

- **Player Referral:** Transfer a player to another server.
  ```java
  PlayerRef.referToServer(host, port, data);
  ```
- **Connection Redirect:** Reject a handshake and redirect the client to another server (e.g., for load balancing).
- **Disconnect Fallback:** (Coming Soon) Automatically reconnect players to a lobby/fallback server if the current server crashes.

### Building a Proxy

You can build custom proxies using **Netty QUIC**. Protocol definitions are available in `com.hypixel.hytale.protocol.packets` within the server jar.

---

## 9. Future Features

- **Server Discovery:** A built-in catalogue for players to browse servers. Requires adherence to operator guidelines.
- **Parties:** Native party system allowing groups to move between servers together.
- **Integrated Payments:** Built-in gateway for server monetization.
- **SRV Records:** Support for DNS SRV records (e.g., `play.example.com`) is currently **under evaluation** and not yet supported.
- **First-Party API:** Authenticated HTTP endpoints for player lookups, telemetry, and payments.

---

_Last Updated: 2026-01-23_
