const bedrock = require('bedrock-protocol');
const express = require('express');
const fs = require('fs');

// Settings load karna
const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));

// Railway ko 24/7 active rakhne ke liye chhota web server
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bedrock Bot 24/7 Zinda Hai!'));
app.listen(PORT, () => console.log(`Web server port ${PORT} par chal raha hai`));

let client;
let pos = { x: 0, y: 70, z: 0 };
let yaw = 0;
let runtimeEntityId = null;

function startBot() {
  console.log(`Connecting to ${settings.server.ip}:${settings.server.port}...`);

  client = bedrock.createClient({
    host: settings.server.ip,
    port: settings.server.port,
    username: settings.bot.username,
    offline: settings.server.offline
  });

  client.on('start_game', (packet) => {
    runtimeEntityId = packet.runtime_entity_id;
    pos = packet.player_position;
    console.log(`${settings.bot.username} server mein join ho gaya!`);
  });

  // Server se bot ki exact location update lena
  client.on('move_player', (packet) => {
    if (packet.runtime_id === runtimeEntityId) {
      pos = packet.position;
    }
  });

  // Ghoomne-phirne aur haath hilane (mining animation) ka loop
  const actionLoop = setInterval(() => {
    if (!runtimeEntityId) return;

    // 1. Ghoomna aur charo taraf dekhna (Anti-AFK)
    if (settings.features.antiAfkWalk) {
      yaw = (yaw + 45) % 360;
      pos.x += (Math.random() - 0.5) * 1.5;
      pos.z += (Math.random() - 0.5) * 1.5;

      client.queue('move_player', {
        runtime_id: runtimeEntityId,
        position: pos,
        pitch: 0,
        yaw: yaw,
        head_yaw: yaw,
        mode: 'normal',
        on_ground: true,
        ridden_runtime_id: 0,
        teleport: { cause: 'unknown', source_entity_type: 0 },
        tick: BigInt(Date.now())
      });
    }

    // 2. Haath hilana (Mining / Block todne jaisa action)
    if (settings.features.swingArmMiningAnim) {
      client.queue('animate', {
        action_id: 'swing_arm',
        runtime_entity_id: runtimeEntityId
      });
    }
  }, settings.features.walkIntervalSeconds * 1000);

  // Agar bot mar jaye toh turant Respawn hona
  client.on('death_info', () => {
    if (settings.features.autoRespawn) {
      console.log('Bot mar gaya, respawn ho raha hai...');
      client.queue('respawn', {
        position: { x: 0, y: 0, z: 0 },
        state: 0,
        runtime_entity_id: runtimeEntityId
      });
    }
  });

  // Disconnect hone par wapas join karna
  client.on('close', () => {
    console.log('Server se disconnect ho gaya.');
    clearInterval(actionLoop);
    runtimeEntityId = null;
    if (settings.bot.autoReconnect) {
      setTimeout(startBot, settings.bot.reconnectDelaySeconds * 1000);
    }
  });

  client.on('error', (err) => {
    console.log('Error aaya:', err.message);
  });
}

startBot();

