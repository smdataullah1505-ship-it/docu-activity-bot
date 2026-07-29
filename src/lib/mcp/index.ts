import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getProfile from "./tools/get-profile";
import listQuizzes from "./tools/list-quizzes";
import getQuiz from "./tools/get-quiz";
import listQuizAttempts from "./tools/list-quiz-attempts";
import listSavedActivities from "./tools/list-saved-activities";
import listDocuments from "./tools/list-documents";

// The OAuth issuer must be the direct Supabase host; the project ref is the only
// value that survives publish unchanged and is inlined by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lecture-lab-ai-mcp",
  title: "Lecture Lab AI",
  version: "0.1.0",
  instructions:
    "Tools for Lecture Lab AI, a classroom activity and quiz generator. Read the signed-in user's profile, uploaded lecture materials, generated activities, quizzes and student quiz attempts. Use get_profile to learn whether the user is a teacher or a student, list_quizzes plus get_quiz to inspect quizzes and their questions, and list_quiz_attempts for per-quiz results and integrity events.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfile, listDocuments, listSavedActivities, listQuizzes, getQuiz, listQuizAttempts],
});
