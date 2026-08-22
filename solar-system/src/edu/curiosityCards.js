import { AppState } from "../core/state.js";

// ---------- curiosity cards ----------
// A question, not a fact sheet. Arriving at a new rung of the cosmic ladder
// poses something the scale you're now looking at actually raises — "one lap
// around this galaxy takes how long?" — and waits for you to ask for the
// answer. That gap between question and reveal is the whole point: a number
// you were curious about lands, a number you were handed doesn't.
//
// Every tier holds a POOL of questions and serves a different one each time
// you arrive, working through a shuffled order before reshuffling — so
// coming back to a tier is worth doing, and a second run through the app
// isn't the same script twice. See nextFor() for why it's a shuffled queue
// rather than a plain random pick.
//
// Deliberately quiet: sits out of the way of the 3D view, dismissible, and
// hidden while walking on a surface, where a cosmic-scale question has
// nothing to do with what's on screen.
//
// Numbers here are real and checkable — the same "approximate but sourceable"
// bar every other data file in this app commits to (see data/sizeData.js's
// header). Where a figure is a genuine range in the literature, the range is
// given rather than a false-precision single value.

const CARDS = {
  solarSystem: [
    {
      question: "If the Sun were a basketball, how far away would Earth be?",
      answer:
        "About 26 metres — and Earth itself would be a 2 mm grain of sand. Neptune would be most of a kilometre away. Almost everything in the solar system is empty space, which is why every diagram you have ever seen of it is lying about distance.",
    },
    {
      question: "Sunlight is old by the time it reaches you. How old?",
      answer:
        "8 minutes and 20 seconds. If the Sun went out right now, you would carry on seeing it shine for another eight minutes. Look at Neptune instead and you are seeing light that left the Sun over four hours ago.",
    },
    {
      question: "On which planet is a day longer than a year?",
      answer:
        "Venus. It turns once every 243 Earth days but laps the Sun every 225 — so its day outlasts its year. It also spins backwards, so the Sun there rises in the west.",
    },
    {
      question: "How long would it take to drive to the Sun?",
      answer:
        "At a steady 100 km/h without stopping, about 171 years. The same trip at the speed of the fastest spacecraft ever built, the Parker Solar Probe at its peak, takes under a week.",
    },
    {
      question: "How much of the solar system is just Jupiter?",
      answer:
        "Jupiter is about two and a half times the mass of every other planet combined. But the Sun dwarfs all of it: over 99.8% of the entire solar system's mass is the Sun alone. The planets are rounding errors.",
    },
  ],

  milkyWay: [
    {
      question: "How long does one lap around the galaxy take?",
      answer:
        "Roughly 225-250 million years, moving at about 230 km/s. The Sun has completed around 20 laps since it formed. The last time it was on this side of the galaxy, dinosaurs had not appeared yet.",
    },
    {
      question: "Sagittarius A* has 4 million times the Sun's mass. How big is it?",
      answer:
        "Its event horizon is only about 24 million km across — it would sit comfortably inside Mercury's orbit. Black holes are not big, they are dense. All that mass is crushed into a space smaller than a planet's yearly path.",
    },
    {
      question: "How long would it take to cross the Milky Way at light speed?",
      answer:
        "About 100,000 years, and that is the fastest anything can go. The galaxy is roughly 100,000 light-years wide — the width itself is measured in how long light takes to get across it.",
    },
    {
      question: "Voyager 1 is the furthest thing we have ever sent. How far is the nearest star?",
      answer:
        "Proxima Centauri is 4.24 light-years away. Voyager 1, moving at 17 km/s, would need roughly 75,000 years to cover that distance — and it is not even pointed that way.",
    },
    {
      question: "How many stars are in this galaxy?",
      answer:
        "Somewhere between 100 and 400 billion. Nobody can give a firmer number, because most of them are dim red dwarfs too faint to count directly from inside the galaxy we are trying to measure.",
    },
  ],

  localGroup: [
    {
      question: "Andromeda is falling toward us at 110 km/s. When does it hit?",
      answer:
        "In about 4.5 billion years — and almost nothing will actually collide. Stars are so far apart that the two galaxies will pass through each other, reshaping into one without a single likely stellar impact.",
    },
    {
      question: "What is the furthest thing you can see with your own eyes?",
      answer:
        "Andromeda, 2.5 million light-years away. The light hitting your eye left before our species existed. No telescope needed — just a dark sky and knowing where to look.",
    },
    {
      question: "How big does Andromeda actually appear in our sky?",
      answer:
        "About six times wider than the full Moon. You only ever see its bright core, because the rest is too faint for your eyes — but the galaxy itself sprawls across a huge patch of sky every clear night.",
    },
    {
      question: "How many galaxies are in the Local Group?",
      answer:
        "Over 50, but it is really just two that matter: the Milky Way and Andromeda hold most of the mass. Nearly all the rest are dwarf galaxies orbiting one or the other, like moons around a planet.",
    },
  ],

  supercluster: [
    {
      question: "If nothing can outrun light, why is everything still spreading apart?",
      answer:
        "Because it is not moving through space — space itself is expanding between galaxies. Nothing exceeds light speed locally, yet distant galaxies still recede faster than light can close the gap.",
    },
    {
      question: "Something is pulling our entire galaxy. What?",
      answer:
        "The Great Attractor — a mass concentration dragging the Milky Way and thousands of neighbours toward it at around 600 km/s. We can barely observe it: it sits behind the plane of our own galaxy, hidden by the dust and stars in the way.",
    },
    {
      question: "How large is the supercluster we live in?",
      answer:
        "Laniakea spans about 520 million light-years and contains roughly 100,000 galaxies. Its name is Hawaiian for immeasurable heaven. We only worked out we were inside it in 2014.",
    },
    {
      question: "The Virgo Cluster holds over 1,300 galaxies. How far is it?",
      answer:
        "About 54 million light-years. It is the nearest big cluster, and massive enough that its gravity is slowing our own local expansion — the Local Group is falling toward it rather than drifting away.",
    },
  ],

  observableUniverse: [
    {
      question: "The universe is 13.8 billion years old, so how is it 93 billion light-years across?",
      answer:
        "Because it grew while the light was in transit. The oldest light reaching us set out 13.8 billion years ago, but the matter that emitted it has since been carried far further away by the expansion of space.",
    },
    {
      question: "What is the oldest thing anyone has ever seen?",
      answer:
        "The cosmic microwave background — light released 380,000 years after the Big Bang, when the universe first cooled enough to become transparent. Before that moment the universe was opaque, so there is nothing older left to see.",
    },
    {
      question: "How many galaxies are out there?",
      answer:
        "Current estimates run to around two trillion in the observable universe alone. And observable is the key word: that is only the part whose light has had time to reach us, not the whole thing.",
    },
    {
      question: "How empty can space get?",
      answer:
        "The Bootes Void is roughly 330 million light-years across and nearly empty. If the Milky Way sat at its centre, we would not have discovered other galaxies existed until the 1960s — there would be nothing close enough to see.",
    },
    {
      question: "Is the observable universe the whole universe?",
      answer:
        "Almost certainly not. It is just the region whose light has had time to reach us in 13.8 billion years — a bubble centred on the observer. Everyone, everywhere, sits at the centre of their own. What lies past the edge may be endless.",
    },
  ],
};

// Fisher-Yates. Serving from a shuffled queue rather than picking at random
// each time guarantees you see every question in a tier's pool before any
// repeats — a plain random pick would happily show the same one twice in a
// row and leave others never seen.
function shuffled(n) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const queues = new Map(); // tierId -> remaining shuffled indices

function nextFor(tierId) {
  const pool = CARDS[tierId];
  if (!pool || !pool.length) return null;
  let queue = queues.get(tierId);
  if (!queue || queue.length === 0) {
    queue = shuffled(pool.length);
    queues.set(tierId, queue);
  }
  return pool[queue.pop()];
}

let currentTier = null;

const card = document.getElementById("curiosityCard");
const questionEl = document.getElementById("curiosityQuestion");
const answerEl = document.getElementById("curiosityAnswer");
const revealBtn = document.getElementById("curiosityRevealBtn");
const closeBtn = document.getElementById("curiosityClose");

function hide() {
  card?.classList.remove("visible");
}

function show(tierId) {
  const entry = nextFor(tierId);
  if (!entry || !card) return;
  questionEl.textContent = entry.question;
  answerEl.textContent = entry.answer;
  answerEl.classList.remove("revealed");
  revealBtn.classList.remove("hidden");
  card.classList.add("visible");
}

export function initCuriosityCards() {
  revealBtn?.addEventListener("click", () => {
    answerEl.classList.add("revealed");
    revealBtn.classList.add("hidden");
  });
  closeBtn?.addEventListener("click", hide);
}

// Called once per frame from core/loop.js — the same cheap per-frame sync
// every other UI module here uses (ui/scaleBreadcrumb.js, ui/scaleBar.js),
// rather than hooking tier changes directly, so it stays correct no matter
// how the tier changed (breadcrumb, scroll-scrub, voice command, VR panel).
export function updateCuriosityCards() {
  if (AppState.tier === currentTier) return;
  currentTier = AppState.tier;

  // Surface mode has its own frame of reference — a question about galactic
  // orbits doesn't belong over a view of standing on Mars.
  if (AppState.mode !== "orbital") return hide();

  show(currentTier);
}

// Exported for the verification pass — lets a test confirm the pools really
// do cycle without repeating rather than having to observe it by eye.
export function _poolSize(tierId) {
  return CARDS[tierId]?.length ?? 0;
}
