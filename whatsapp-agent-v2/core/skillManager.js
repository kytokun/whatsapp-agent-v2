// core/skillManager.js
const fs = require('fs');
const path = require('path');
const { testInSandbox, syntaxCheck, isSafe } = require('../sandbox/runner');
const memory = require('./memory');

class SkillManager {
  constructor() {
    this.skills = {};
    this.skillDefs = [];
    this.skillDir = path.join(__dirname, '../skills');
    if (!fs.existsSync(this.skillDir)) fs.mkdirSync(this.skillDir, { recursive: true });
    this.loadAll();
  }

  loadAll() {
    const files = fs.readdirSync(this.skillDir).filter(f => f.endsWith('.js'));
    for (const f of files) this._load(path.join(this.skillDir, f));
    console.log(`✅ ${this.skillDefs.length} skill(s) loaded`);
  }

  _load(filePath) {
    try {
      delete require.cache[require.resolve(filePath)];
      const skill = require(filePath);
      if (!skill.name || !skill.handler || !skill.description) throw new Error('Format tidak valid');
      this.skills[skill.name] = skill.handler;
      this.skillDefs = this.skillDefs.filter(s => s.name !== skill.name);
      this.skillDefs.push({ name: skill.name, description: skill.description, input_schema: skill.input_schema || { type: 'object', properties: {} } });
      return true;
    } catch (err) {
      console.error(`❌ Gagal load skill: ${err.message}`);
      return false;
    }
  }

  /**
   * Simpan skill baru setelah melewati sandbox test
   */
  async saveAndTest(code, skillName, testInput = {}) {
    // 1. Safety check
    if (!isSafe(code)) return { success: false, stage: 'safety', error: 'Kode berbahaya diblokir' };

    // 2. Syntax check
    const syntax = syntaxCheck(code);
    if (!syntax.valid) return { success: false, stage: 'syntax', error: syntax.error };

    // 3. Sandbox test
    const sandboxResult = await testInSandbox(code, testInput);
    if (!sandboxResult.success) return { success: false, stage: 'sandbox', error: sandboxResult.error };

    // 4. Semua lolos → simpan ke production
    const filePath = path.join(this.skillDir, `${skillName}.js`);
    fs.writeFileSync(filePath, code, 'utf8');
    const loaded = this._load(filePath);
    if (!loaded) {
      fs.unlinkSync(filePath);
      return { success: false, stage: 'load', error: 'Gagal load setelah disimpan' };
    }

    return { success: true, sandboxOutput: sandboxResult.output, durationMs: sandboxResult.durationMs };
  }

  async run(name, input) {
    if (!this.skills[name]) throw new Error(`Skill "${name}" tidak ditemukan`);
    const start = Date.now();
    try {
      const result = await this.skills[name](input);
      await memory.logSkillRun(name, true, Date.now() - start);
      return result;
    } catch (err) {
      await memory.logSkillRun(name, false, Date.now() - start);
      throw err;
    }
  }

  delete(name) {
    const fp = path.join(this.skillDir, `${name}.js`);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    delete this.skills[name];
    this.skillDefs = this.skillDefs.filter(s => s.name !== name);
  }

  getCode(name) {
    const fp = path.join(this.skillDir, `${name}.js`);
    return fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  }

  getAll() { return this.skillDefs; }
  has(name) { return !!this.skills[name]; }
}

module.exports = new SkillManager();
