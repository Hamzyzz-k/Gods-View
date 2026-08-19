// ---------- light quiz ----------
// A curated, hand-checked general-astronomy question bank rather than
// auto-generated per-body questions from planetData.js/galaxyData.js — this
// app has 40+ focusable bodies, and auto-generating a question from each
// one's `meta`/`info` risks producing an awkward or subtly wrong question
// for at least a few of them with no way to verify all of them by hand in
// this pass. A smaller, verified set is the honest tradeoff.
export const QUIZ_QUESTIONS = [
  { q: "Which planet has the most confirmed moons in our solar system?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
  { q: "What is the largest planet in the solar system?", options: ["Saturn", "Neptune", "Jupiter", "Uranus"], answer: 2 },
  { q: "Which planet spins almost on its side, tilted about 98 degrees?", options: ["Neptune", "Uranus", "Saturn", "Mars"], answer: 1 },
  { q: "What is Sagittarius A*?", options: ["A star cluster", "A supermassive black hole", "A nebula", "A dwarf planet"], answer: 1 },
  { q: "Roughly how long does light from the Sun take to reach Earth?", options: ["8 seconds", "8 minutes", "8 hours", "8 days"], answer: 1 },
  { q: "Which galaxy is on a slow collision course with the Milky Way?", options: ["Triangulum", "Andromeda", "Sombrero", "Whirlpool"], answer: 1 },
  { q: "What is the nearest large galaxy cluster to our Local Group?", options: ["Virgo Cluster", "Coma Cluster", "Bullet Cluster", "Perseus Cluster"], answer: 0 },
  { q: "What provides some of the strongest observational evidence for dark matter?", options: ["The Cartwheel Galaxy", "The Bullet Cluster", "Sagittarius A*", "The CMB alone"], answer: 1 },
  { q: "What does \"CMB\" stand for?", options: ["Cosmic Matter Belt", "Cosmic Microwave Background", "Celestial Mass Boundary", "Cosmic Mapping Beacon"], answer: 1 },
  { q: "Which planet has the fastest winds measured anywhere in the solar system?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 3 },
  { q: "Which dwarf planet, beyond Neptune, is included in this app's guided tour?", options: ["Ceres", "Eris", "Pluto", "Haumea"], answer: 2 },
  { q: "Roughly how many light-years away is the Andromeda Galaxy?", options: ["250,000", "2.5 million", "25 million", "250 million"], answer: 1 },
  { q: "Which planet's rings are easily visible from Earth with a small telescope?", options: ["Jupiter", "Saturn", "Uranus", "Neptune"], answer: 1 },
  { q: "What galaxy do the Large and Small Magellanic Clouds orbit?", options: ["Andromeda", "The Milky Way", "Triangulum", "Themselves — they orbit each other"], answer: 1 },
  { q: "What shape is the Whirlpool Galaxy?", options: ["Elliptical", "Irregular", "Spiral", "Ring"], answer: 2 },
];

import { startAttempt, recordAnswer, finishAttempt, initQuizPersistence } from "./quizPersistence.js";

let deck = [];
let current = null;
let score = { correct: 0, total: 0 };

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextQuestion() {
  if (deck.length === 0) deck = shuffle(QUIZ_QUESTIONS);
  current = deck.pop();
  return current;
}

const modal = document.getElementById("quizModal");
const body = document.getElementById("quizBody");
const openBtn = document.getElementById("quizBtn");
const closeBtn = document.getElementById("quizClose");
const backdrop = document.getElementById("quizBackdrop");

function renderQuestion() {
  if (!body || !current) return;
  body.innerHTML = `
    <div class="quiz-score">Score: ${score.correct}/${score.total}</div>
    <div class="quiz-question">${current.q}</div>
    <div class="quiz-options">
      ${current.options.map((opt, i) => `<button class="quiz-option" data-i="${i}">${opt}</button>`).join("")}
    </div>
    <div class="quiz-feedback"></div>
  `;
  body.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => onAnswer(Number(btn.dataset.i)));
  });
}

function onAnswer(i) {
  if (!current) return;
  const correct = i === current.answer;
  score.total++;
  if (correct) score.correct++;
  const feedback = body.querySelector(".quiz-feedback");
  const options = body.querySelectorAll(".quiz-option");
  options.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === current.answer) btn.classList.add("quiz-correct");
    else if (idx === i) btn.classList.add("quiz-wrong");
  });
  // Recorded per answer rather than at the end — the quiz has no natural
  // finish, so a student who simply closes the tab would otherwise leave no
  // trace of the questions they did answer. No-op when signed out.
  recordAnswer({
    question: current.q,
    chosen: current.options[i],
    correct: current.options[current.answer],
    isCorrect: correct,
  });

  feedback.textContent = correct ? "Correct!" : `Not quite — the answer was "${current.options[current.answer]}".`;
  feedback.classList.add(correct ? "quiz-feedback-correct" : "quiz-feedback-wrong");
  const nextBtn = document.createElement("button");
  nextBtn.className = "quiz-next-btn";
  nextBtn.textContent = "Next question →";
  nextBtn.addEventListener("click", () => {
    nextQuestion();
    renderQuestion();
  });
  body.appendChild(nextBtn);
}

// One "attempt" is one open-to-close run of the quiz modal. Closing it is the
// only deliberate way a student ends a session, so that is where the score is
// finalised; quizPersistence.js separately catches the tab-closed case.
function closeQuiz() {
  modal?.classList.remove("visible");
  finishAttempt(getQuizScore());
}

export function initQuiz() {
  openBtn?.addEventListener("click", () => {
    // Fresh score per attempt, so a second run isn't recorded as a
    // continuation of the first.
    score = { correct: 0, total: 0 };
    startAttempt();
    nextQuestion();
    renderQuestion();
    modal?.classList.add("visible");
  });
  closeBtn?.addEventListener("click", closeQuiz);
  backdrop?.addEventListener("click", closeQuiz);
  initQuizPersistence(getQuizScore);
}

export function getQuizScore() {
  return { ...score };
}
