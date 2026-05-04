// skills/cek_cuaca.js
module.exports = {
  name: 'cek_cuaca',
  description: 'Cek cuaca saat ini di kota tertentu',
  input_schema: {
    type: 'object',
    properties: { kota: { type: 'string', description: 'Nama kota' } },
    required: ['kota']
  },
  handler: async ({ kota }) => {
    try {
      const res = await fetch(`https://wttr.in/${encodeURIComponent(kota)}?format=%C+%t+%h+%w&lang=id`);
      const data = await res.text();
      if (!data || data.includes('Unknown')) return `Kota "${kota}" tidak ditemukan.`;
      return `Cuaca di ${kota}: ${data.trim()}`;
    } catch (err) {
      return `Gagal cek cuaca: ${err.message}`;
    }
  }
};
