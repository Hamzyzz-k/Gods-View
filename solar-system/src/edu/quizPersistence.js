import { getSupabase, getSession } from "../auth/supabaseClient.js";

// ---------- recording quiz attempts ----------
// Kept separate from edu/quiz.js so the quiz itself doesn't grow a dependency
// on the backend. Every function here is a no-op when Supabase isn't
// configured or nobody is signed in, which is what lets the quiz keep working
// exactly as it always did on an open deployment.
//
// Answers are written AS THEY HAPPEN rather than batched at the end. The quiz
// is an endless deck with no natural finish — a student stops by closing the
// modal, or by closing the tab, and the second case never runs any "finish"
// code at all. Writing per answer means their work is already recorded either
// way; batching would silently lose every session that didn't end tidily.
//
// Nothing here ever blocks the UI. A failed write is logged and swallowed:
// losing a row of analytics is not a reason to interrupt someone mid-question.

let attemptId = null;
let pending = Promise.resolve(); // serialises writes so answers land in order

async function activeUserId() {
  try {
    const session = await getSession();
    return session?.user?.id ?? null;
  } catch {
    return null; // not configured — the common case on an open deployment
  }
}

// Opens a new attempt. Safe to call when one is already open (reopening the
// quiz modal): the previous attempt is finalised first so a session is never
// left dangling with no score.
export async function startAttempt() {
  const userId = await activeUserId();
  if (!userId) return;

  if (attemptId) await finishAttempt();

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("quiz_attempts")
      .insert({ user_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    attemptId = data.id;
  } catch (err) {
    console.warn("Could not start a quiz attempt:", err.message);
    attemptId = null;
  }
}

// One answered question. `question` and the answer strings are stored as text
// rather than as an index into QUIZ_QUESTIONS on purpose: the question list is
// edited over time, and an index would silently start pointing at a different
// question, quietly corrupting past results. Storing the text keeps old
// attempts meaningful no matter how the deck changes.
export function recordAnswer({ question, chosen, correct, isCorrect }) {
  if (!attemptId) return;
  const id = attemptId;

  pending = pending.then(async () => {
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from("quiz_answers").insert({
        attempt_id: id,
        question_text: question,
        chosen_answer: chosen,
        correct_answer: correct,
        is_correct: isCorrect,
      });
      if (error) throw error;
    } catch (err) {
      console.warn("Could not record a quiz answer:", err.message);
    }
  });
}

// Closes the attempt with a final score.
export async function finishAttempt(score) {
  if (!attemptId) return;
  const id = attemptId;
  attemptId = null; // cleared first, so a late answer can't reopen a closed attempt

  await pending; // let any in-flight answer writes land before the totals
  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from("quiz_attempts")
      .update({
        completed_at: new Date().toISOString(),
        score: score?.correct ?? 0,
        total_questions: score?.total ?? 0,
      })
      .eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("Could not finalise the quiz attempt:", err.message);
  }
}

// A tab closed mid-quiz never runs finishAttempt(), so the attempt row would
// keep completed_at null forever. sendBeacon isn't usable here (it can't carry
// the auth header Supabase needs), so this is a best-effort update on the way
// out — 'visibilitychange' rather than 'unload' because mobile browsers often
// never fire unload at all.
export function initQuizPersistence(getScore) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && attemptId) finishAttempt(getScore?.());
  });
}
