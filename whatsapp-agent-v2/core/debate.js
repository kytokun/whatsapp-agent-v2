// core/debate.js
// Agent Debate System — beberapa agent saling review & kritik sebelum output final
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_ROUNDS = parseInt(process.env.MAX_DEBATE_ROUNDS) || 3;

/**
 * Jalankan debate antara dua perspektif agent
 * Digunakan untuk tugas kompleks yang butuh validasi silang
 *
 * @param {string} task — pertanyaan/tugas
 * @param {string} systemA — soul agent pertama
 * @param {string} systemB — soul agent kedua (reviewer/devil's advocate)
 * @returns {string} — output final setelah debate
 */
async function debate(task, systemA, systemB) {
  const history = [];
  let lastOutput = '';

  console.log(`⚔️  [DEBATE] Mulai debate: ${MAX_ROUNDS} rounds`);

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const isFirstRound = round === 0;

    // Agent A: produce atau revise
    const promptA = isFirstRound
      ? task
      : `TUGAS ASLI: ${task}\n\nKRITIK DARI REVIEWER:\n${history[history.length - 1]}\n\nRevisi output berdasarkan kritik tersebut. Pertahankan poin yang valid, perbaiki yang lemah.`;

    const responseA = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemA,
      messages: [{ role: 'user', content: promptA }]
    });
    lastOutput = responseA.content[0].text;
    history.push(`[Agent A - Round ${round + 1}]:\n${lastOutput}`);
    console.log(`💬 [DEBATE] Agent A round ${round + 1} selesai`);

    // Round terakhir: tidak perlu Agent B lagi
    if (round === MAX_ROUNDS - 1) break;

    // Agent B: critique
    const responseB = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemB,
      messages: [{
        role: 'user',
        content: `TUGAS ASLI: ${task}\n\nOUTPUT YANG DIEVALUASI:\n${lastOutput}\n\nBerikan kritik konstruktif. Apa yang kurang? Apa yang bisa diperbaiki? Apa yang sudah bagus?`
      }]
    });
    const critique = responseB.content[0].text;
    history.push(`[Agent B - Critique ${round + 1}]:\n${critique}`);
    console.log(`🔍 [DEBATE] Agent B critique round ${round + 1} selesai`);
  }

  return lastOutput;
}

/**
 * Debate singkat: satu agent produce, satu langsung approve/reject
 * Lebih cepat dari full debate, cocok untuk tugas medium
 */
async function quickReview(task, output, reviewerSystem) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: reviewerSystem,
    messages: [{
      role: 'user',
      content: `TUGAS: ${task}\n\nOUTPUT:\n${output}\n\nApakah output ini sudah baik dan akurat? Kalau tidak, berikan versi yang diperbaiki. Kalau sudah, cukup balas "APPROVED: " diikuti output aslinya.`
    }]
  });

  const result = response.content[0].text;
  if (result.startsWith('APPROVED:')) {
    return { approved: true, output };
  }
  return { approved: false, output: result };
}

module.exports = { debate, quickReview };
