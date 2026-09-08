// 词典完整性检查：确保四个区段（含所有 Object.assign 块）合计无重复键、
// 无重复正则规则、结构可求值。提交前运行：node scripts/check-dictionary.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(path.join(root, "src", "translations.js"), "utf8");

const window = {};
vm.runInNewContext(source, { window });
const dict = window.GitHubCnDictionary;

// 与 dedupe-dictionary.mjs 相同的行级状态机：识别每张表的所有区段
const lines = source.split("\n");
const sections = [];
let current = null;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const objectHead = line.match(/^\s*(?:const (exactTextMap|exactAttributeMap) = \{|Object\.assign\((exactTextMap|exactAttributeMap), \{)\s*$/);
  const arrayHead = line.match(/^\s*const (regexTextRules|regexAttributeRules) = \[\s*$/);
  if (objectHead) {
    current = { kind: "object", map: objectHead[1] || objectHead[2], count: 0 };
    sections.push(current);
    continue;
  }
  if (arrayHead) {
    current = { kind: "array", map: arrayHead[1], count: 0 };
    sections.push(current);
    continue;
  }
  if (!current) continue;
  if (/^\s*(\}|\]);?\s*$/.test(line) || /^\s*\}\);?\s*$/.test(line)) {
    current = null;
    continue;
  }
  if (current.kind === "object" && /^\s*"((?:[^"\\]|\\.)*)":/.test(line)) {
    current.count++;
  }
  if (current.kind === "array" && /^\s*\[/.test(line)) {
    current.count++;
  }
}

let failed = false;
for (const mapName of ["exactTextMap", "exactAttributeMap"]) {
  const sourceCount = sections.filter((s) => s.map === mapName).reduce((sum, s) => sum + s.count, 0);
  const runtimeCount = Object.keys(dict[mapName]).length;
  if (sourceCount !== runtimeCount) {
    failed = true;
    console.error(`✗ ${mapName} 源码条目 ${sourceCount} != 运行时唯一键 ${runtimeCount}，存在重复键`);
  } else {
    console.log(`✓ ${mapName} 无重复键（共 ${runtimeCount} 条）`);
  }
}

for (const ruleName of ["regexTextRules", "regexAttributeRules"]) {
  const rules = dict[ruleName];
  const seen = new Set();
  let hasDup = false;
  for (const [pattern, replacement] of rules) {
    const key = `/${pattern.source}/${pattern.flags} -> ${replacement}`;
    if (seen.has(key)) {
      hasDup = true;
      console.error(`✗ ${ruleName} 重复规则：${key}`);
    }
    seen.add(key);
  }
  if (!hasDup) console.log(`✓ ${ruleName} 无重复规则（共 ${rules.length} 条）`);
  failed ||= hasDup;
}

console.log(`词典规模：${JSON.stringify({
  exactTextMap: Object.keys(dict.exactTextMap).length,
  exactAttributeMap: Object.keys(dict.exactAttributeMap).length,
  regexTextRules: dict.regexTextRules.length,
  regexAttributeRules: dict.regexAttributeRules.length
})}`);

if (failed) process.exit(1);
