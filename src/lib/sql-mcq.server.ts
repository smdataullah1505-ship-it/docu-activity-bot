import { callAiGateway } from "./ai-gateway.server";

const QUESTION_TYPES = `1. "What does this query do?" — show a SQL query, ask what it returns or which operation it performs; 4 option descriptions.
2. "Which query is correct?" — describe a scenario, present 4 SQL queries, one correctly solves it.
3. "What is the output?" — show a small table with sample data plus a query; 4 possible outputs (rows, values or counts).
4. "Which query will cause an error?" — present 4 queries, one is invalid/malformed.
5. "Order of execution" — which clause executes first / correct execution order; 4 options.
6. "Which query is most efficient?" — 3-4 queries with the same result, pick the most performant.
7. "What's wrong with this query?" — a query with a logical or syntactical error; 4 options.
8. "True or False" — a SQL statement with options A) True B) False C) Depends on database D) Both.
9. "What does this clause do?" — highlight a clause (e.g. HAVING COUNT(*) > 5) and ask what it does.`;

const DIFFICULTY_GUIDE: Record<"easy" | "medium" | "hard", string> = {
  easy: "Basic recall, simple SELECT queries, simple WHERE conditions, single-table queries, basic filtering and sorting.",
  medium:
    "Multiple tables, JOINs, GROUP BY, HAVING, subqueries, aggregations (COUNT/SUM/AVG), DISTINCT, ORDER BY with multiple columns; requires analysis of query logic.",
  hard: "Complex subqueries, CTEs, window functions (ROW_NUMBER, RANK, LAG/LEAD), advanced functions, performance optimisation, multi-JOIN and recursive queries.",
};

export type SqlQuestion = {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
  questionType?: string;
};

function parseQuestions(text: string): SqlQuestion[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch {
        /* ignore */
      }
    }
  }
  if (!parsed) throw new Error("AI returned invalid JSON");
  const arr = Array.isArray(parsed)
    ? parsed
    : (((parsed as Record<string, unknown>).questions as unknown[]) ?? []);
  return (arr as SqlQuestion[]).filter(
    (q) =>
      q &&
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4,
  );
}

export async function generateSqlBatch(
  key: string,
  topic: string,
  level: "easy" | "medium" | "hard",
  count: number,
  userApiKey?: string,
): Promise<SqlQuestion[]> {
  if (count <= 0) return [];
  const { text } = await callAiGateway({
    lovableApiKey: key,
    userApiKey,
    system:
      "You are an SQL interview coach. You write query-based multiple choice questions. Respond with VALID JSON ONLY — no markdown fences around the JSON, no commentary.",
    prompt: `Generate ${count} ${level.toUpperCase()} SQL MCQ questions related to the topic "${topic}".

Every question must be a multiple choice question with exactly 4 options. NO fill-in-the-blanks, NO open-ended questions.
Mix these 9 question types randomly across the set:
${QUESTION_TYPES}

Each question MUST include an actual SQL query, a concrete scenario with sample data, or a sample output. Do NOT give purely theoretical questions.
Difficulty: ${level} — ${DIFFICULTY_GUIDE[level]}
These are general SQL interview-style questions. DO NOT copy queries, examples or text from any lecture document — the topic is only a theme.
Show queries, tables and outputs inside \`\`\`sql code fences within the question text.

Return JSON of this exact shape:
{"questions":[{"questionType":"one of the 9 type names","question":"question text including the SQL query/table/output","options":["option A text","option B text","option C text","option D text"],"correct":"the exact text of the correct option","explanation":"2-4 sentences explaining why the answer is correct and why the others are not"}]}`,
  });
  return parseQuestions(text).slice(0, count);
}
