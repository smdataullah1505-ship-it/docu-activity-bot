const QUIZ_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type QuizActivityType = "mcqs" | "fillBlanks";

export type StoredQuizItem = {
  question?: string;
  options?: string[];
  correct?: string;
  sentence?: string;
  answer?: string;
  explanation?: string;
  [key: string]: unknown;
};

export type StoredQuestions = {
  activityType: QuizActivityType;
  items: StoredQuizItem[];
};

export type ScoreDetail = {
  index: number;
  answer: string;
  expected: string;
  correct: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeMcqs(value: unknown): StoredQuizItem[] {
  const root = asRecord(value);
  const source = root?.mcqs ?? value;
  const mode = asRecord(source);
  const groups = mode
    ? [mode.easy, mode.medium, mode.hard]
    : [source];
  const items: StoredQuizItem[] = [];

  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const candidate of group) {
      const question = asRecord(candidate);
      if (!question) continue;
      const prompt = asString(question.question);
      const correct = asString(question.correct);
      const options = Array.isArray(question.options)
        ? question.options.filter((option): option is string => typeof option === "string")
        : [];
      if (!prompt || !correct || options.length !== 4 || !options.includes(correct)) continue;
      items.push({
        question: prompt,
        options,
        correct,
        explanation: asString(question.explanation) ?? "",
        reference: asString(question.reference) ?? "",
        questionType: asString(question.questionType) ?? "",
      });
    }
  }

  return items;
}

function normalizeFillBlanks(value: unknown): StoredQuizItem[] {
  const root = asRecord(value);
  const source = root?.fillBlanks ?? value;
  if (!Array.isArray(source)) return [];

  return source.flatMap((candidate) => {
    const question = asRecord(candidate);
    if (!question) return [];
    const sentence = asString(question.sentence);
    const answer = asString(question.answer);
    if (!sentence || !answer) return [];
    return [{
      sentence,
      answer,
      explanation: asString(question.explanation) ?? "",
    }];
  });
}

export function normalizeQuizQuestions(
  activityType: QuizActivityType,
  generatedJson: unknown,
): StoredQuestions {
  const items = activityType === "mcqs"
    ? normalizeMcqs(generatedJson)
    : normalizeFillBlanks(generatedJson);
  return { activityType, items };
}

export function stripAnswers(questions: StoredQuestions): StoredQuestions {
  return {
    activityType: questions.activityType,
    items: questions.items.map((item) => {
      const publicItem: StoredQuizItem = {};
      if (item.question !== undefined) publicItem.question = item.question;
      if (item.options !== undefined) publicItem.options = item.options;
      if (item.sentence !== undefined) publicItem.sentence = item.sentence;
      if (item.reference !== undefined) publicItem.reference = item.reference;
      if (item.questionType !== undefined) publicItem.questionType = item.questionType;
      return publicItem;
    }),
  };
}

export function scoreAnswers(
  questions: StoredQuestions,
  answers: string[],
): { score: number; total: number; details: ScoreDetail[] } {
  const details = questions.items.map((item, index) => {
    const expected = questions.activityType === "mcqs" ? item.correct : item.answer;
    const answer = answers[index] ?? "";
    const normalizedAnswer = answer.trim().toLocaleLowerCase();
    const normalizedExpected = typeof expected === "string" ? expected.trim().toLocaleLowerCase() : "";
    return {
      index,
      answer,
      expected: typeof expected === "string" ? expected : "",
      correct: normalizedAnswer.length > 0 && normalizedAnswer === normalizedExpected,
    };
  });

  return {
    score: details.filter((detail) => detail.correct).length,
    total: details.length,
    details,
  };
}

export function makeQuizCode(): string {
  const values = new Uint32Array(6);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, (value) => QUIZ_CODE_ALPHABET[value % QUIZ_CODE_ALPHABET.length]).join("");
}