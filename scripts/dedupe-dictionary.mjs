// 词典去重工具：删除 translations.js 中的重复键与重复正则规则。
// 安全保证：去重前后在隔离环境中求值词典并深度对比，必须完全一致才写出文件。
// 用法：node scripts/dedupe-dictionary.mjs [--write]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src", "translations.js");
const shouldWrite = process.argv.includes("--write");
const source = readFileSync(file, "utf8");

function evaluateDictionary(code) {
  const window = {};
  vm.runInNewContext(code, { window });
  return window.GitHubCnDictionary;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return (
      ka.length === kb.length &&
      ka.every((k) => deepEqual(a[k], b[k]))
    );
  }
  return false;
}

// 数组规则里的完全重复项不影响运行时（引擎按序取首个命中），对比前先归一化去重
function normalizeRules(rules) {
  const seen = [];
  for (const rule of rules) {
    if (!seen.some((s) => deepEqual(s, rule))) seen.push(rule);
  }
  return seen;
}

const before = evaluateDictionary(source);
const lines = source.split("\n");

// 定位四个词典区段的行范围
const sections = [];
let current = null;
lines.forEach((line, i) => {
  const objectHead = line.match(/^\s*(?:const (exactTextMap|exactAttributeMap) = \{|Object\.assign\((exactTextMap|exactAttributeMap), \{)\s*$/);
  const arrayHead = line.match(/^\s*const (regexTextRules|regexAttributeRules) = \[\s*$/);
  if (objectHead) {
    current = { kind: "object", map: objectHead[1] || objectHead[2], start: i, entries: [] };
    sections.push(current);
    return;
  }
  if (arrayHead) {
    current = { kind: "array", map: arrayHead[1], start: i, entries: [] };
    sections.push(current);
    return;
  }
  if (!current) return;
  if (/^\s*(\}|\]);?\s*$/.test(line) || /^\s*\}\);?\s*$/.test(line)) {
    current.end = i;
    current = null;
    return;
  }
  const kv = line.match(/^(\s*)"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"(,?)\s*$/);
  if (current.kind === "object" && kv) {
    current.entries.push({ line: i, indent: kv[1], key: kv[2], value: kv[3], comma: kv[4], raw: line });
  }
  const rule = line.match(/^(\s*)(\[[^\n]+\]),?\s*$/);
  if (current.kind === "array" && rule) {
    current.entries.push({ line: i, key: rule[2], raw: line });
  }
});

const removals = new Set();
const rewrites = new Map();
const conflicts = [];
// 跨区段统一去重：同一张表内，键保留首次出现的位置、写入最终生效的值（后写覆盖），
// 删除其余重复行。运行时语义（键序 + 最终值）完全不变。
const mapFirstLine = new Map();
const mapLastValue = new Map();
for (const section of sections) {
  if (section.kind === "object") {
    for (const entry of section.entries) {
      const mapKey = section.map;
      if (!mapFirstLine.has(`${mapKey}\u0000${entry.key}`)) {
        mapFirstLine.set(`${mapKey}\u0000${entry.key}`, entry.line);
      }
      mapLastValue.set(`${mapKey}\u0000${entry.key}`, entry.value);
    }
  }
}
for (const section of sections) {
  if (section.kind === "object") {
    for (const entry of section.entries) {
      const mapKey = section.map;
      const id = `${mapKey}\u0000${entry.key}`;
      if (entry.line === mapFirstLine.get(id)) {
        const finalValue = mapLastValue.get(id);
        if (entry.value !== finalValue) {
          rewrites.set(entry.line, `${entry.indent}"${entry.key}": "${finalValue}"${entry.comma}`);
          conflicts.push({ key: entry.key, first: entry.value, kept: finalValue });
        }
        continue;
      }
      removals.add(entry.line);
    }
  } else {
    const firstIndex = new Map();
    for (const entry of section.entries) {
      if (!firstIndex.has(entry.key)) {
        firstIndex.set(entry.key, entry.line);
      } else {
        removals.add(entry.line);
      }
    }
  }
}

const cleaned = lines
  .map((line, i) => (rewrites.has(i) ? rewrites.get(i) : line))
  .filter((_, i) => !removals.has(i))
  .join("\n");
const after = evaluateDictionary(cleaned);

console.log(`词典条目扫描：${sections.map((s) => `${s.map}:${s.entries.length}`).join("  ")}`);
console.log(`待删除重复行：${removals.size}`);
if (conflicts.length) {
  console.log("值不同的重复键（保留最后一次出现的值，与运行时语义一致）：");
  for (const c of conflicts) console.log(`  ${JSON.stringify(c.key)}: ${JSON.stringify(c.first)} -> ${JSON.stringify(c.kept)}`);
} else {
  console.log("所有重复键的值均一致，无语义冲突。");
}

if (
  !deepEqual(before.exactTextMap, after.exactTextMap) ||
  !deepEqual(before.exactAttributeMap, after.exactAttributeMap) ||
  !deepEqual(normalizeRules(before.regexTextRules), normalizeRules(after.regexTextRules)) ||
  !deepEqual(normalizeRules(before.regexAttributeRules), normalizeRules(after.regexAttributeRules))
) {
  console.error("校验失败：去重前后词典不一致，拒绝写出。");
  for (const mapName of ["exactTextMap", "exactAttributeMap"]) {
    const a = before[mapName];
    const b = after[mapName];
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    let reported = 0;
    for (const k of ka) {
      if (a[k] !== b[k] && reported < 8) {
        console.error(`  [值差异] ${JSON.stringify(k)}: ${JSON.stringify(a[k])} -> ${JSON.stringify(b[k])}`);
        reported++;
      }
    }
    if (ka.length !== kb.length) {
      console.error(`  [键数差异] ${mapName}: ${ka.length} -> ${kb.length}`);
      for (let i = 0; i < Math.max(ka.length, kb.length) && reported < 16; i++) {
        if (ka[i] !== kb[i]) {
          console.error(`  [键序差异] 位置 ${i}: ${ka[i]} vs ${kb[i]}`);
          reported++;
        }
      }
    }
  }
  for (const arrName of ["regexTextRules", "regexAttributeRules"]) {
    const a = before[arrName];
    const b = after[arrName];
    if (a.length !== b.length || a.some((v, i) => !deepEqual(v, b[i]))) {
      console.error(`  [规则差异] ${arrName}: ${a.length} -> ${b.length}`);
    }
  }
  process.exit(1);
}
if (!shouldWrite) {
  console.log("试运行完成（加 --write 写出文件）。");
  process.exit(0);
}
writeFileSync(file, cleaned);
console.log(`已写出 ${file}（${lines.length} -> ${cleaned.split("\n").length} 行）。`);
