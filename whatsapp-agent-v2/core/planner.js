// core/planner.js
// Chain of Thought Planning — bot berpikir step-by-step sebelum eksekusi
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PLANNER_SYSTEM = `Kamu adalah planner strategis. Analisis permintaan user dan buat rencana eksekusi.

Respons WAJIB dalam JSON:
{
  "complexity": "simple|medium|complex",
  "intent": "deskripsi singkat apa yang user mau",
  "requires_research": true/false,
  "requires_skill": true/false,
  "requires_coding": true/false,
  "requires_cs": true/false,
  "requires_debate": true/false,
  "steps": ["langkah 1", "langkah 2", ...],
  "potential_issues": ["isu 1", ...],
  "needs_clarification": false,
  "clarification_question": null
}

Gunakan "requires_debate: true" hanya untuk tugas kompleks seperti analisis mendalam, strategi bisnis, atau keputusan penting.
Gunakan "requires_research: true" untuk pertanyaan faktual, berita terkini, atau data spesifik.
Gunakan "requires_coding: true" hanya jika user minta buat/ubah skill bot.`;

/**
 * Buat rencana eksekusi berdasarkan pesan user
 * @param {string} userMessage
 * @param {string[]} availableSkills
 * @returns {object} plan
 */
async function plan(userMessage, availableSkills = []) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    system: PLANNER_SYSTEM,
    messages: [{
      role: 'user',
      content: `Pesan user: "${userMessage}"\n\nSkill tersedia: ${availableSkills.join(', ') || 'tidak ada'}\n\nBuat rencana eksekusi.`
    }]
  });

  try {
    const raw = response.content[0].text.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(raw);
    console.log(`🧠 [PLANNER] Intent: ${parsed.intent} | Complexity: ${parsed.complexity}`);
    return parsed;
  } catch {
    // Fallback plan kalau parse gagal
    return {
      complexity: 'simple',
      intent: userMessage,
      requires_research: false,
      requires_skill: false,
      requires_coding: false,
      requires_cs: false,
      requires_debate: false,
      steps: ['Jawab langsung'],
      potential_issues: [],
      needs_clarification: false
    };
  }
}

module.exports = { plan };
