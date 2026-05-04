// agents/manager.js — ARIA: Full Orchestrator
const Anthropic = require('@anthropic-ai/sdk');
const memory = require('../core/memory');
const skillManager = require('../core/skillManager');
const { plan } = require('../core/planner');
const { evaluate } = require('../core/evaluator');
const souls = require('../prompts/souls');
const { NOVAAgent, BYTEAgent, KAIAAgent } = require('./subagents');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || '').split(',')
  .map(n => `${n.trim()}@s.whatsapp.net`);

class ARIAManager {
  constructor() {
    this.nova = new NOVAAgent();
    this.byte = new BYTEAgent();
    this.kaia = new KAIAAgent();
  }

  // ── Tools untuk ARIA ───────────────────────────────────────
  _tools(isAdmin) {
    const tools = [
      {
        name: 'delegate_research',
        description: 'Delegasi ke NOVA untuk cari informasi, fakta, atau berita terkini. Gunakan "debate_mode: true" untuk analisis mendalam.',
        input_schema: {
          type: 'object',
          properties: {
            task: { type: 'string' },
            debate_mode: { type: 'boolean', description: 'true untuk analisis kompleks yang butuh validasi mendalam' }
          },
          required: ['task']
        }
      },
      {
        name: 'delegate_cs',
        description: 'Delegasi ke KAIA untuk handle komplain atau pertanyaan layanan',
        input_schema: {
          type: 'object',
          properties: { issue: { type: 'string' } },
          required: ['issue']
        }
      },
      {
        name: 'use_skill',
        description: 'Jalankan skill yang sudah ada',
        input_schema: {
          type: 'object',
          properties: {
            skill_name: { type: 'string' },
            input: { type: 'object' }
          },
          required: ['skill_name', 'input']
        }
      },
      {
        name: 'remember_fact',
        description: 'Simpan fakta penting tentang user ke long-term memory',
        input_schema: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: { type: 'string' }
          },
          required: ['key', 'value']
        }
      },
      {
        name: 'list_skills',
        description: 'Tampilkan semua skill yang tersedia',
        input_schema: { type: 'object', properties: {} }
      },
      {
        name: 'reply_direct',
        description: 'Jawab langsung untuk percakapan casual',
        input_schema: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message']
        }
      }
    ];

    if (isAdmin) {
      tools.push(
        {
          name: 'create_skill',
          description: '[ADMIN] Minta BYTE membuat skill baru. BYTE akan menulis, test di sandbox, baru deploy.',
          input_schema: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'Deskripsi lengkap skill yang dibutuhkan' },
              test_input: { type: 'object', description: 'Input contoh untuk test sandbox (opsional)' }
            },
            required: ['description']
          }
        },
        {
          name: 'delete_skill',
          description: '[ADMIN] Hapus skill',
          input_schema: {
            type: 'object',
            properties: { skill_name: { type: 'string' } },
            required: ['skill_name']
          }
        },
        {
          name: 'get_stats',
          description: '[ADMIN] Lihat statistik lengkap bot',
          input_schema: { type: 'object', properties: {} }
        }
      );
    }

    return tools;
  }

  // ── Main Handler ───────────────────────────────────────────
  async handle(userId, userMessage) {
    const isAdmin = ADMIN_NUMBERS.includes(userId);

    // Load semua context paralel
    const [user, history, facts] = await Promise.all([
      memory.getUser(userId),
      memory.getHistory(userId, 10),
      memory.getFacts(userId)
    ]);

    await memory.saveMessage(userId, 'user', userMessage);

    // ── Step 1: Chain of Thought Planning ─────────────────────
    const executionPlan = await plan(userMessage, skillManager.getAll().map(s => s.name));
    console.log(`📋 [ARIA] Plan: ${JSON.stringify(executionPlan.steps)}`);

    // Butuh klarifikasi?
    if (executionPlan.needs_clarification && executionPlan.clarification_question) {
      const reply = executionPlan.clarification_question;
      await memory.saveMessage(userId, 'assistant', reply);
      return reply;
    }

    // ── Step 2: Build system prompt dengan context ─────────────
    const systemPrompt = `${souls.manager}

━━ EXECUTION PLAN ━━
Intent: ${executionPlan.intent}
Complexity: ${executionPlan.complexity}
Steps: ${executionPlan.steps.join(' → ')}

━━ USER CONTEXT ━━
Nama: ${user.name || facts.nama || 'Belum diketahui'}
Total pesan: ${user.totalMessages}
Role: ${isAdmin ? '👑 ADMIN' : 'User'}

━━ FACTS TERSIMPAN ━━
${Object.keys(facts).length > 0 ? JSON.stringify(facts, null, 2) : 'Belum ada'}

━━ SKILLS TERSEDIA ━━
${skillManager.getAll().map(s => `• ${s.name}: ${s.description}`).join('\n') || 'Belum ada'}`;

    // ── Step 3: Agent Loop ─────────────────────────────────────
    let messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: userMessage }
    ];

    const tools = this._tools(isAdmin);
    let finalReply = '';
    let iterations = 0;

    while (iterations < 6) {
      iterations++;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: systemPrompt,
        tools,
        messages
      });

      if (response.stop_reason === 'end_turn') {
        finalReply = response.content.find(b => b.type === 'text')?.text || '';
        break;
      }

      if (response.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];

      for (const block of response.content.filter(b => b.type === 'tool_use')) {
        let result = '';
        try {
          result = await this._handleTool(block, userId, facts, isAdmin, executionPlan);
        } catch (err) {
          result = `Error: ${err.message}`;
          console.error(`❌ Tool error (${block.name}):`, err.message);
        }

        if (block.name === 'reply_direct' && finalReply) break;

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result
        });
      }

      if (finalReply) break;
      messages.push({ role: 'user', content: toolResults });
    }

    // ── Step 4: Self-Evaluate final reply ─────────────────────
    // Hanya untuk tugas medium/complex
    if (finalReply && executionPlan.complexity !== 'simple') {
      const { finalOutput, score, revised } = await evaluate(
        userMessage, finalReply, 'ARIA'
      );
      if (revised) {
        console.log(`✏️  [ARIA] Reply direvisi, score final: ${score}`);
        finalReply = finalOutput;
      }
    }

    await memory.saveMessage(userId, 'assistant', finalReply);
    return finalReply || 'Maaf, ada yang error nih 😅 Coba lagi ya!';
  }

  // ── Tool Handler ───────────────────────────────────────────
  async _handleTool(block, userId, facts, isAdmin, executionPlan) {
    switch (block.name) {

      case 'delegate_research':
        return await this.nova.run(
          block.input.task,
          { useDebate: block.input.debate_mode || executionPlan.requires_debate }
        );

      case 'delegate_cs':
        return await this.kaia.run(block.input.issue, userId, facts);

      case 'use_skill':
        try {
          return await skillManager.run(block.input.skill_name, block.input.input);
        } catch (err) {
          // Auto-debug skill yang error
          console.log(`⚠️  [ARIA] Skill error, auto-debug: ${err.message}`);
          const fixed = await this.byte.debugSkill(block.input.skill_name, err.message);
          if (fixed.success) {
            return await skillManager.run(block.input.skill_name, block.input.input);
          }
          return `Skill error dan gagal diperbaiki: ${err.message}`;
        }

      case 'remember_fact':
        await memory.rememberFact(userId, block.input.key, block.input.value);
        if (['nama', 'name'].includes(block.input.key)) {
          await memory.updateUser(userId, { name: block.input.value });
        }
        return 'Tersimpan ✅';

      case 'list_skills': {
        const skills = skillManager.getAll();
        return skills.length > 0
          ? skills.map(s => `• ${s.name}: ${s.description}`).join('\n')
          : 'Belum ada skill terpasang';
      }

      case 'reply_direct':
        // Set finalReply langsung
        this._pendingDirectReply = block.input.message;
        return 'ok';

      // Admin tools
      case 'create_skill':
        if (!isAdmin) return '🔒 Hanya admin yang bisa buat skill baru';
        const createResult = await this.byte.createSkill(
          block.input.description,
          block.input.test_input || {}
        );
        return createResult.success
          ? `✅ Skill "${createResult.skillName}" berhasil dibuat, ditest di sandbox (output: "${createResult.sandboxOutput}"), dan langsung aktif!`
          : `❌ Gagal: ${createResult.error}`;

      case 'delete_skill':
        if (!isAdmin) return '🔒 Hanya admin yang bisa hapus skill';
        skillManager.delete(block.input.skill_name);
        return `🗑️ Skill "${block.input.skill_name}" dihapus`;

      case 'get_stats':
        if (!isAdmin) return '🔒 Hanya admin';
        const stats = await memory.getStats();
        const skillStats = stats.skillStats.map(s =>
          `  ${s.skillName}: ${s.runs}x run, ${s.errors} error`
        ).join('\n');
        return `📊 Stats:\n• Users: ${stats.users}\n• Pesan: ${stats.messages}\n• Facts: ${stats.facts}\n• Skills:\n${skillStats || '  (belum ada)'}`;

      default:
        return `Tool "${block.name}" tidak dikenal`;
    }
  }
}

module.exports = new ARIAManager();
