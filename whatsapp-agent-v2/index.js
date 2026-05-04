// index.js
require('dotenv').config();

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const memory = require('./core/memory');
const manager = require('./agents/manager');

const logger = pino({ level: 'silent' });

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    logger,
    browser: ['WhatsApp AI Agent v2', 'Chrome', '2.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan QR ini dengan WhatsApp:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') console.log('\n✅ WhatsApp connected!\n');
    if (connection === 'close') {
      const reconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('⚠️  Disconnected. Reconnect:', reconnect);
      if (reconnect) setTimeout(connect, 3000);
      else console.log('❌ Logged out. Hapus folder /auth dan restart.');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) return;

      const userId = msg.key.remoteJid;
      if (userId === 'status@broadcast') return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption || '';

      if (!text.trim()) return;

      const shortId = userId.replace('@s.whatsapp.net', '');
      console.log(`\n📨 [${shortId}]: ${text}`);

      await sock.sendPresenceUpdate('composing', userId);

      try {
        const reply = await manager.handle(userId, text);
        await sock.sendMessage(userId, { text: reply }, { quoted: msg });
        console.log(`✅ [${shortId}] Reply sent (${reply.length} chars)`);
      } catch (err) {
        console.error('❌ Error:', err.message);
        await sock.sendMessage(userId, { text: 'Aduh, ada yang error 😅 Coba lagi ya!' });
      }

      await sock.sendPresenceUpdate('available', userId);
    }
  });
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   WhatsApp AI Agent v2.0             ║');
  console.log('║   Multi-Agent • Memory • Self-Eval   ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  await memory.connect();
  await connect();
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
