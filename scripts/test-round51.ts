/**
 * Round 51 — «which model, why, and at what price».
 *
 * The owner's standing request: every part of the site must be able to say which
 * model answers it, why that one, and what it costs. That is only true if the
 * code itself enforces it — so these assertions fail the build when a route
 * forgets its task, when a chain points at a model we cannot price, or when a
 * vision task is handed a model that cannot see.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AI_MODELS, TASK_CHAINS, chainFor, estimateTaskCostUsd, modelTable, type AiTask } from "../lib/ai-models";

/* 1. Every enabled model has a real, non-zero price and a context window. */
for (const [id, spec] of Object.entries(AI_MODELS)) {
  assert.equal(spec.id, id);
  assert.ok(spec.inputPerMillion > 0, `${id} must have a known input price`);
  assert.ok(spec.outputPerMillion > 0, `${id} must have a known output price`);
  assert.ok(spec.contextTokens >= 32_000, `${id} context looks wrong`);
  assert.ok(spec.label && spec.goodAt, `${id} needs a human label and a reason`);
}

/* 2. Every chain is real: priced models only, and the second is a fallback, not a copy. */
for (const [task, chain] of Object.entries(TASK_CHAINS) as [AiTask, { models: string[] }][]) {
  assert.ok(chain.models.length >= 2, `${task} needs a fallback model`);
  assert.notEqual(chain.models[0], chain.models[1], `${task} fallback must differ from the first`);
  for (const id of chain.models) assert.ok(AI_MODELS[id], `${task} points at unpriced model ${id}`);
  const ceiling = chainFor(task).maxTokens;
  assert.ok(ceiling >= 100 && ceiling <= 1_000, `${task} token ceiling ${ceiling} is not a real ceiling`);
}

/* 3. A photo can only be given to a model that has eyes. */
for (const id of chainFor("vision").models) assert.equal(AI_MODELS[id].vision, true, `${id} cannot read a photo`);
assert.ok(chainFor("vision").models.every((id) => AI_MODELS[id].vision));

/* 4. The money estimate is monotonic and never zero. */
const cheap = estimateTaskCostUsd("review", 400);
const dear = estimateTaskCostUsd("plan", 12_000);
assert.ok(cheap > 0 && dear > cheap, "a bigger job must estimate higher");
assert.ok(dear < 0.02, "one plan must stay under two cents");

/* 5. Every route that talks to a model must name its task. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".ts")) out.push(path);
  }
  return out;
}
const files = [...walk("app/api"), ...walk("lib")];
const callers = files.filter((file) => /askJson\(|askText\(/.test(readFileSync(file, "utf8")) && !file.endsWith("ai-openrouter.ts"));
assert.ok(callers.length >= 14, `expected the AI surface to be a known size, saw ${callers.length}`);
const missing = callers.filter((file) => {
  const source = readFileSync(file, "utf8");
  return !/task:\s*"/.test(source) && !/chainFor\(/.test(source);
});
assert.deepEqual(missing, [], `these files call a model without naming the task: ${missing.join(", ")}`);

/* 6. The table the UI and the defence script both read stays in step with the chains. */
const table = modelTable();
assert.equal(table.length, Object.keys(TASK_CHAINS).length);
for (const row of table) assert.equal(row.model, TASK_CHAINS[row.task].models[0]);

/* 7. The provider crawler must stay model-free — this is the promise, not a habit. */
const crawlers = ["lib/transport-search.ts", "lib/alibaba-ground.ts", "lib/alibaba-flights.ts", "lib/safar724-bus.ts", "lib/alibaba-accommodation.ts"];
for (const file of crawlers) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /openrouter|askJson|OPENROUTER/i, `${file} must not involve a language model`);
}

console.log("✅ round 51: every AI route names its task, every chain is priced, and the crawler stays model-free");
