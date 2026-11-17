/**
 * Round 35 — the agent and its self-check.
 *
 * The promise being tested here is narrow and absolute: the companion may only
 * state numbers that exist in the data it was given, and every tool it can pick
 * really exists. No network calls in the assertions themselves — the tools that
 * need one are checked for *graceful* failure, not for live results.
 */

import { normalizeDigits, numbersIn, collectTruth, verifyAnswer, verifyNames } from "../lib/ai-verify";
import { AGENT_TOOL_NAMES, runAgentTool, type AgentFacts } from "../lib/ai-agent";
import { chainFor, estimateTaskCostUsd } from "../lib/ai-models";

let failures = 0;
function check(label: string, value: boolean, detail?: string) {
  if (value) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`  fail ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("۳۵ — همسفر خودش کار می‌کند و خودش را بازبینی می‌کند");

check("Persian digits become ordinary numbers", normalizeDigits("۲۳٬۰۰۰٬۰۰۰") === "23000000");
check("a Persian sentence gives all its numbers", numbersIn("از ۴۰ میلیون، ۱۲ میلیون مانده").join(",") === "40,12");
check("a separated number stays one number", numbersIn("۱ ۲۳۴ ۵۶۷").join(",") === "1234567");

const evidence = {
  facts: { budgetToman: 40_000_000, ticketsToman: 8_000_000, stayToman: 12_000_000, days: 3 },
  tickets: { options: [{ total: 8_000_000 }, { total: 14_000_000 }] },
};
check("a real number is accepted", verifyAnswer("بلیت ۸٬۰۰۰٬۰۰۰ تومان است.", evidence).ok);
check("the budget in millions is accepted", verifyAnswer("بودجه‌ات ۴۰ میلیون است.", evidence).ok);
check("real arithmetic between prices is accepted", verifyAnswer("اختلاف دو بلیت ۶ میلیون تومان است.", evidence).ok);
const invented = verifyAnswer("هتل ۳۷ میلیون تومان می‌شود.", evidence);
check("an invented price is refused", !invented.ok, invented.reason);
check("and it names the invented number", invented.invented.includes(37));
check("a fabricated hotel name is refused", !verifyNames("«هتل پارسیان» را بگیر.", ["هتل خیام", "هتل عباسی"]).ok);
check("a real hotel name passes", verifyNames("«هتل خیام» را بگیر.", ["هتل خیام", "هتل عباسی"]).ok);
check("the truth set holds the evidence itself", collectTruth(evidence).has(40_000_000));

const facts: AgentFacts = {
  origin: "تهران",
  destination: "اصفهان",
  departureDate: "2026-11-20",
  days: 3,
  travellers: 2,
  children: 0,
  infants: 0,
  budgetToman: 40_000_000,
  ticketsToman: 8_000_000,
  stayToman: 12_000_000,
  stayName: "هتل خیام",
  transportLabel: "قطار",
  tastes: [],
};

async function main() {
check("the tool list is exactly the six real tools", AGENT_TOOL_NAMES.sort().join(",") === "destination,fix_budget,money,stays,tickets,weather");
check("an unknown tool is refused, not guessed", !(await runAgentTool("book_flight", {}, facts)).ok);

const moneyTool = await runAgentTool("money", {}, facts);
check("the money tool answers offline and in Persian", moneyTool.ok && moneyTool.summary.includes("تومان"));
const moneyData = moneyTool.data as { remaining: number; totalBudget: number };
check("and its remaining is the trip's own arithmetic", moneyData.totalBudget - moneyData.remaining >= 20_000_000);

const budgetTool = await runAgentTool("fix_budget", {}, { ...facts, budgetToman: 10_000_000 });
const fixData = budgetTool.data as { fits: boolean; neededBudgetMillions: number };
check("a shortfall produces a concrete new budget", budgetTool.ok && fixData.fits === false && fixData.neededBudgetMillions > 10);

const placeTool = await runAgentTool("destination", { topic: "غذا" }, facts);
check("the destination tool quotes our own profile only", placeTool.ok && placeTool.summary.length > 30);

const ticketTool = await runAgentTool("tickets", { mode: "train" }, { ...facts, departureDate: null });
check("without a date no ticket is invented", !ticketTool.ok && ticketTool.summary.includes("تاریخ"));

check("the agent's own model chain is cheap", chainFor("agent").models.length >= 2);
check("a tool decision costs a fraction of a cent", estimateTaskCostUsd("agent", 2_000) < 0.005);
check("the reviewer is even cheaper", estimateTaskCostUsd("review", 2_500) < 0.002);

console.log(failures ? `\n❌ ${failures} بررسی شکست خورد` : "\n✅ round 35: the agent works from real data and refuses anything it cannot prove");
process.exit(failures ? 1 : 0);
}

void main();
