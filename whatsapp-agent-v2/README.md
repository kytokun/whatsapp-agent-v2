# 🤖 WhatsApp AI Agent v2.0
### Full Agentic System — Setara Hermes / OpenClaw

Multi-Agent • Persistent Memory • Chain of Thought • Agent Debate • Self-Evaluation • Code Sandbox • Self-Upgrading

---

## 🏗️ Arsitektur Lengkap

```
WhatsApp Message
       ↓
┌──────────────────────────────────────────────────────┐
│                   ARIA (Manager)                     │
│                                                      │
│  1. Chain of Thought Planning                        │
│     → Analisis intent, complexity, langkah eksekusi  │
│                                                      │
│  2. Tool Orchestration                               │
│     → Pilih agent/skill yang tepat                   │
│                                                      │
│  3. Self-Evaluation                                  │
│     → REX menilai output, revisi jika perlu          │
└────────┬──────────┬──────────┬───────────────────────┘
         ↓          ↓          ↓
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  NOVA   │ │  BYTE   │ │  KAIA   │
    │Research │ │ Coder   │ │   CS    │
    │+Debate  │ │+Sandbox │ │+Empathy │
    └────┬────┘ └────┬────┘ └─────────┘
         ↓           ↓
    ┌─────────┐ ┌─────────────┐
    │Web Search│ │ Code Sandbox│
    │  (live) │ │ (vm2, safe) │
    └─────────┘ └─────────────┘
         ↓
┌──────────────────────────────────────────────────────┐
│              REX (Self-Evaluator)                    │
│   Score output → Revisi jika < threshold → Deploy    │
└──────────────────────────────────────────────────────┘
         ↓
┌──────────────────────────────────────────────────────┐
│            PERSISTENT MEMORY (MongoDB)               │
│  • User profiles & facts                             │
│  • Full conversation history                         │
│  • Skill run stats & eval logs                       │
│  • Result cache                                      │
└──────────────────────────────────────────────────────┘
```

---

## ✨ Fitur Lengkap

| Fitur | Detail |
|---|---|
| 🧠 **Chain of Thought Planning** | Bot berpikir step-by-step sebelum eksekusi |
| ⚔️ **Agent Debate** | NOVA & REX berdebat untuk hasil lebih akurat |
| 📊 **Self-Evaluation** | REX menilai & merevisi output sebelum dikirim |
| 🔒 **Code Sandbox** | BYTE test kode di vm2 sebelum deploy ke production |
| 💾 **Persistent Memory** | Ingat user, fakta, history meski bot restart |
| 🔧 **Self-Upgrading** | Bot tulis, test, dan load skill baru sendiri |
| 🌐 **Live Web Search** | NOVA bisa cari info terkini dari internet |
| 📈 **Skill Stats** | Monitoring performa setiap skill |
| 👑 **Admin System** | Fitur sensitif hanya untuk admin |

---

## 🗂️ Struktur Project

```
whatsapp-agent-v2/
├── index.js                    # Entry point
├── package.json
├── .env.example
├── Dockerfile
├── docker-compose.yml
│
├── core/
│   ├── memory.js               # Persistent memory (MongoDB)
│   ├── skillManager.js         # Dynamic skill loader + sandbox gate
│   ├── planner.js              # Chain of Thought planner
│   ├── evaluator.js            # Self-evaluation engine (REX)
│   └── debate.js               # Agent debate system
│
├── agents/
│   ├── manager.js              # ARIA — koordinator utama
│   └── subagents.js            # NOVA, BYTE, KAIA
│
├── prompts/
│   └── souls.js                # Kepribadian semua agent
│
├── sandbox/
│   └── runner.js               # Secure code execution (vm2)
│
└── skills/                     # Auto-generated & bundled skills
    ├── cek_cuaca.js
    └── cek_kurs.js
```

---

## 🚀 Quick Start

### 1. Install

```bash
git clone https://github.com/username/whatsapp-agent-v2.git
cd whatsapp-agent-v2
npm install
```

### 2. Setup .env

```bash
cp .env.example .env
nano .env
```

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
ADMIN_NUMBERS=628123456789          # Nomor kamu (tanpa +)
BOT_NAME=ARIA                       # Nama bot
MAX_DEBATE_ROUNDS=3                 # Berapa kali agent berdebat
EVAL_THRESHOLD=0.75                 # Skor minimum sebelum reply dikirim
SANDBOX_TIMEOUT_MS=5000             # Timeout test sandbox
```

### 3. Jalankan

```bash
# Development
node index.js

# Atau dengan Docker
docker-compose up -d
docker logs -f whatsapp-agent-v2   # Scan QR yang muncul
```

---

## 🐳 Deploy Options

### Option A: Docker Compose (Paling Mudah)

```bash
cp .env.example .env && nano .env
docker-compose up -d
docker logs -f whatsapp-agent-v2
```

Akses MongoDB UI (debug mode):
```bash
docker-compose --profile debug up -d
# Buka: http://localhost:8081 (admin/secret123)
```

### Option B: VPS Manual (Ubuntu 22.04)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Clone project
git clone https://github.com/username/whatsapp-agent-v2.git
cd whatsapp-agent-v2
npm install
cp .env.example .env && nano .env

# Jalankan dengan PM2
npm install -g pm2
pm2 start index.js --name aria
pm2 save && pm2 startup
```

### Option C: Railway (Free Cloud)

```bash
npm install -g @railway/cli
railway login
railway init
railway add mongodb
railway up
# Set env vars di Railway dashboard
```

---

## 🎮 Contoh Percakapan

### Memory & Personalisasi
```
Kamu:  "Hei, gw Reza dari Bandung!"
ARIA:  "Haii Reza! 😄 Seneng kenalan!
        Gw ARIA. Ada yang bisa gw bantu?"
        [Memory: nama=Reza, kota=Bandung ✅]

Kamu:  "Lo inget nama gw?"
ARIA:  "Tentu Reza! Kamu dari Bandung kan? 😊"
```

### Chain of Thought + Research
```
Kamu:  "Analisis mendalam kondisi ekonomi Indonesia 2025"
ARIA:  [Planner: complex task, requires_debate=true]
       [NOVA + REX berdebat 3 rounds...]
       [REX evaluasi, score 0.88, approved]
ARIA:  "Berdasarkan data terkini...
        [analisis komprehensif 500+ kata]"
```

### Self-Upgrading dengan Sandbox
```
Admin: "Buat skill cek harga Bitcoin"
ARIA:  [BYTE nulis kode...]
       [Sandbox test: output="BTC: $67,420" ✅]
       [Deploy ke production]
ARIA:  "✅ Skill cek_bitcoin berhasil dibuat,
        ditest di sandbox (output: 'BTC: $67,420'),
        dan langsung aktif!"

Admin: "Cek Bitcoin"
ARIA:  "Bitcoin sekarang: $67,420 (+2.3%) 🚀"
```

### Auto-Debug Skill
```
Kamu:  "Cek cuaca Bandung"
       [Skill error: API timeout]
ARIA:  [BYTE auto-debug...]
       [Sandbox retest: OK ✅]
ARIA:  "Cuaca Bandung: Berawan, 22°C 🌧️"
```

### Admin Stats
```
Admin: "Stats bot"
ARIA:  "📊 Stats:
        • Users: 142
        • Total pesan: 5,337
        • Facts tersimpan: 289
        • Skills:
          cek_cuaca: 89x run, 2 error
          cek_kurs: 45x run, 0 error
          cek_bitcoin: 12x run, 1 error"
```

---

## 🔒 Keamanan

| Layer | Mekanisme |
|---|---|
| Admin Gate | Hanya nomor di ADMIN_NUMBERS bisa create/delete skill |
| Safety Filter | 10+ pattern berbahaya diblokir sebelum masuk sandbox |
| Syntax Check | Kode dicek syntax sebelum dieksekusi |
| vm2 Sandbox | Kode jalan di VM terisolasi, tidak bisa akses fs/process/net |
| Timeout | Eksekusi dibatasi SANDBOX_TIMEOUT_MS (default 5 detik) |
| Auto-rollback | Skill gagal load → file otomatis dihapus |

---

## 📊 Monitoring

```bash
# Logs real-time
pm2 logs aria

# Restart
pm2 restart aria

# MongoDB UI
docker-compose --profile debug up

# Lihat eval log di MongoDB
db.eval_log.find().sort({timestamp:-1}).limit(10)

# Lihat skill stats
db.skill_stats.find()
```

---

## 🔧 Tambah Skill Manual

```javascript
// skills/nama_skill.js
module.exports = {
  name: 'nama_skill',
  description: 'Deskripsi singkat',
  input_schema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: '...' }
    },
    required: ['param']
  },
  handler: async ({ param }) => {
    try {
      // implementasi
      return `Hasil: ${param}`;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  }
};
// Langsung aktif tanpa restart!
```

---

## 📄 License

MIT — bebas digunakan dan dimodifikasi.
