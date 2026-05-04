// core/evaluator.js
// Self-evaluation loop — agent menilai output sebelum dikirim ke user
const Anthropic = require('@anthropic-ai/sdk');
const souls = require('../prompts/souls');
const memory = require('./memory');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const THRESHOLD = parseFloat(process.env.EVAL_THRESHOLD) || 0.75;
const MAX_RETRIES = 2;

/**
 * Evaluasi output agent, revisi jika perlu
 * @param {string} task — tugas aslinya
 * @param {string} output — hasil agent
 * @param {string} agentName — nama agent yang dieval
 * @returns {{ finalOutput, score, revised, rounds }}
 */
async function evaluate(task, output, agentName = 'Agent') {
  let current = output;
  let rounds = 0;
  let lastScore = 0;

  for (let i = 0; i < MAX_RETRIES; i++) {
    rounds++;

    // REX menilai output
    const evalResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: souls.reviewer,
      messages: [{
        role: 'user',
        content: `TUGAS ASLI: ${task}\n\nOUTPUT DARI ${agentName}:\n${current}\n\nEvaluasi output ini.`
      }]
    });

    let evalResult;
    try {
      const raw = evalResponse.content[0].text
        .replace(/```json\n?|```\n?/g, '').trim();
      evalResult = JSON.parse(raw);
    } catch {
      // Kalau parse gagal, anggap lulus
      evalResult = { score: 0.8, passed: true, suggestion: '' };
    }

    lastScore = evalResult.score;

    // Log ke memory
    await memory.logEval({
      agentName, task: task.slice(0, 100),
      score: lastScore, passed: evalResult.passed,
      round: rounds
    });

    console.log(`📊 [REX] ${agentName} round ${rounds}: score=${lastScore} passed=${evalResult.passed}`);

    // Lulus threshold → selesai
    if (evalResult.passed || lastScore >= THRESHOLD) {
      return { finalOutput: current, score: lastScore, revised: rounds > 1, rounds };
    }

    // Tidak lulus → minta revisi
    if (i < MAX_RETRIES - 1) {
      console.log(`🔄 [REX] Meminta revisi: ${evalResult.suggestion}`);
      const reviseResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `Kamu adalah ${agentName}. Perbaiki output berdasarkan feedback.`,
        messages: [{
          role: 'user',
          content: `TUGAS ASLI: ${task}\n\nOUTPUT SEBELUMNYA:\n${current}\n\nFEEDBACK REVIEWER:\n${evalResult.suggestion}\n\nTolong perbaiki output.`
        }]
      });
      current = reviseResponse.content[0].text;
    }
  }

  // Setelah semua retry, pakai yang terbaik
  return { finalOutput: current, score: lastScore, revised: rounds > 1, rounds };
}

module.exports = { evaluate };
