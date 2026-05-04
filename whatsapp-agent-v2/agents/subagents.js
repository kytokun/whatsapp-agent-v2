// agents/subagents.js
const Anthropic = require('@anthropic-ai/sdk');
const souls = require('../prompts/souls');
const memory = require('../core/memory');
const skillManager = require('../core/skillManager');
const { evaluate } = require('../core/evaluator');
const { debate } = require('../core/debate');
const { testInSandbox, syntaxCheck, isSafe } = require('../sandbox/runner');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────────────────
// NOVA — Research Agent
// ─────────────────────────────────────────────────────────────
class NOVAAgent {
  /**
   * Riset + self-evaluate hasilnya
   * Untuk tugas kompleks, gunakan debate mode
   */
  async run(task, { useDebate = false } = {}) {
    const cacheKey = `nova:${task.slice(0, 80)}`;
    const cached = await memory.cacheGet(cacheKey);
    if (cached) {
      console.log('💾 [NOVA] Cache hit');
      return cached;
    }

    let result;

    if (useDebate) {
      // Debate mode: NOVA produce, reviewer critique, iterasi
      console.log('⚔️  [NOVA] Menggunakan debate mode');
      result = await debate(task, souls.researcher, souls.reviewer);
    } else {
      // Standard mode dengan web search
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1200,
        system: souls.researcher,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: task }]
      });

      result = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
    }

    // Self-evaluate sebelum return
    const { finalOutput, score } = await evaluate(task, result, 'NOVA');
    console.log(`✅ [NOVA] Final score: ${score}`);

    await memory.cacheSet(cacheKey, finalOutput, 300);
    return finalOutput;
  }
}

// ─────────────────────────────────────────────────────────────
// BYTE — Coder Agent dengan Sandbox Testing
// ─────────────────────────────────────────────────────────────
class BYTEAgent {
  FORBIDDEN = ['rm -rf', 'process.exit', 'eval(', 'exec(', 'spawn(', 'require('];

  async createSkill(description, testInput = {}) {
    console.log('🔧 [BYTE] Menulis skill baru...');

    let code = '';
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    while (attempt < MAX_ATTEMPTS) {
      attempt++;

      const messages = attempt === 1
        ? [{ role: 'user', content: `Buat skill untuk: ${description}` }]
        : [{
            role: 'user',
            content: `Buat skill untuk: ${description}\n\nPercobaan sebelumnya gagal dengan error: ${this._lastError}\nPerbaiki dan coba lagi.`
          }];

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: souls.coder,
        messages
      });

      code = response.content[0].text
        .replace(/```javascript\n?|```js\n?|```\n?/g, '').trim();

      console.log(`🔧 [BYTE] Attempt ${attempt}: menguji di sandbox...`);

      // Test di sandbox
      const testResult = await skillManager.saveAndTest(code, this._extractName(code), testInput);

      if (testResult.success) {
        const skillName = this._extractName(code);
        console.log(`✅ [BYTE] Skill "${skillName}" lolos sandbox (${testResult.durationMs}ms)`);
        return { success: true, skillName, sandboxOutput: testResult.sandboxOutput };
      }

      this._lastError = `[${testResult.stage}] ${testResult.error}`;
      console.log(`⚠️  [BYTE] Attempt ${attempt} gagal: ${this._lastError}`);
    }

    return { success: false, error: `Gagal setelah ${MAX_ATTEMPTS} percobaan: ${this._lastError}` };
  }

  async debugSkill(skillName, errorMessage) {
    const code = skillManager.getCode(skillName);
    if (!code) return { success: false, error: `Skill "${skillName}" tidak ditemukan` };

    console.log(`🔍 [BYTE] Debugging skill: ${skillName}`);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: souls.coder,
      messages: [{
        role: 'user',
        content: `Debug skill ini.\nError: ${errorMessage}\n\nKode:\n\`\`\`javascript\n${code}\n\`\`\`\nReturn HANYA kode yang sudah diperbaiki.`
      }]
    });

    const fixedCode = response.content[0].text
      .replace(/```javascript\n?|```js\n?|```\n?/g, '').trim();

    const testResult = await skillManager.saveAndTest(fixedCode, skillName);
    if (testResult.success) {
      return { success: true, message: `Skill "${skillName}" berhasil diperbaiki dan ditest` };
    }
    return { success: false, error: testResult.error };
  }

  _extractName(code) {
    const match = code.match(/name:\s*["']([^"']+)["']/);
    return match ? match[1] : 'unnamed_skill';
  }
}

// ─────────────────────────────────────────────────────────────
// KAIA — Customer Service Agent
// ─────────────────────────────────────────────────────────────
class KAIAAgent {
  async run(issue, userId, userFacts) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: souls.cs,
      messages: [{
        role: 'user',
        content: `Info user: ${JSON.stringify(userFacts)}\n\nMasalah: ${issue}`
      }]
    });
    return response.content[0].text;
  }
}

module.exports = { NOVAAgent, BYTEAgent, KAIAAgent };
