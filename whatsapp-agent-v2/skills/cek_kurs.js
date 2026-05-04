// skills/cek_kurs.js
module.exports = {
  name: 'cek_kurs',
  description: 'Cek kurs mata uang terhadap Rupiah (IDR)',
  input_schema: {
    type: 'object',
    properties: { mata_uang: { type: 'string', description: 'Kode mata uang: USD, EUR, JPY, SGD, dll' } },
    required: ['mata_uang']
  },
  handler: async ({ mata_uang }) => {
    try {
      const currency = mata_uang.toUpperCase();
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
      const data = await res.json();
      if (data.error) return `Mata uang "${currency}" tidak valid.`;
      const idr = data.rates['IDR'];
      return `1 ${currency} = Rp ${idr.toLocaleString('id-ID')} (Update: ${data.date})`;
    } catch (err) {
      return `Gagal cek kurs: ${err.message}`;
    }
  }
};
