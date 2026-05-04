// core/memory.js
const { MongoClient } = require('mongodb');

class Memory {
  constructor() {
    this.client = new MongoClient(process.env.MONGO_URI);
    this.db = null;
  }

  async connect() {
    await this.client.connect();
    this.db = this.client.db(process.env.MONGO_DB_NAME || 'whatsapp_agent_v2');
    await this._ensureIndexes();
    console.log('✅ Memory connected');
  }

  async _ensureIndexes() {
    await this.db.collection('conversations').createIndex({ userId: 1, timestamp: -1 });
    await this.db.collection('facts').createIndex({ userId: 1, key: 1 }, { unique: true });
    await this.db.collection('cache').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await this.db.collection('eval_log').createIndex({ timestamp: -1 });
    await this.db.collection('skill_stats').createIndex({ skillName: 1 });
  }

  // ── User ──────────────────────────────────────────────────
  async getUser(userId) {
    let user = await this.db.collection('users').findOne({ userId });
    if (!user) {
      user = { userId, name: null, preferences: {}, totalMessages: 0, createdAt: new Date(), lastSeen: new Date() };
      await this.db.collection('users').insertOne(user);
    }
    return user;
  }

  async updateUser(userId, data) {
    await this.db.collection('users').updateOne({ userId }, { $set: { ...data, lastSeen: new Date() } }, { upsert: true });
  }

  // ── Conversation ──────────────────────────────────────────
  async getHistory(userId, limit = 20) {
    const msgs = await this.db.collection('conversations')
      .find({ userId }).sort({ timestamp: -1 }).limit(limit).toArray();
    return msgs.reverse();
  }

  async saveMessage(userId, role, content) {
    await this.db.collection('conversations').insertOne({ userId, role, content, timestamp: new Date() });
    await this.db.collection('users').updateOne({ userId }, { $inc: { totalMessages: 1 }, $set: { lastSeen: new Date() } }, { upsert: true });
  }

  // ── Facts ─────────────────────────────────────────────────
  async rememberFact(userId, key, value) {
    await this.db.collection('facts').updateOne({ userId, key }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
  }

  async getFacts(userId) {
    const facts = await this.db.collection('facts').find({ userId }).toArray();
    return facts.reduce((acc, f) => ({ ...acc, [f.key]: f.value }), {});
  }

  // ── Cache ─────────────────────────────────────────────────
  async cacheSet(key, value, ttlSeconds = 300) {
    await this.db.collection('cache').updateOne(
      { key },
      { $set: { value, expiresAt: new Date(Date.now() + ttlSeconds * 1000) } },
      { upsert: true }
    );
  }

  async cacheGet(key) {
    const doc = await this.db.collection('cache').findOne({ key, expiresAt: { $gt: new Date() } });
    return doc?.value || null;
  }

  // ── Eval Log ──────────────────────────────────────────────
  async logEval(data) {
    await this.db.collection('eval_log').insertOne({ ...data, timestamp: new Date() });
  }

  // ── Skill Stats ───────────────────────────────────────────
  async logSkillRun(skillName, success, durationMs) {
    await this.db.collection('skill_stats').updateOne(
      { skillName },
      {
        $inc: { runs: 1, errors: success ? 0 : 1 },
        $set: { lastRun: new Date(), lastDuration: durationMs }
      },
      { upsert: true }
    );
  }

  // ── Stats ─────────────────────────────────────────────────
  async getStats() {
    const [users, messages, facts, skills] = await Promise.all([
      this.db.collection('users').countDocuments(),
      this.db.collection('conversations').countDocuments(),
      this.db.collection('facts').countDocuments(),
      this.db.collection('skill_stats').find().toArray()
    ]);
    return { users, messages, facts, skillStats: skills };
  }
}

module.exports = new Memory();
