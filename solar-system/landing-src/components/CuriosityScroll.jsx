import { useEffect, useMemo, useRef } from "react";

import "./CuriosityScroll.css";

// ---------- scroll-revealed curiosity questions ----------
// The landing page's edutainment spine: a run of questions worth being
// curious about, each one holding its answer until you scroll it into view.
// The reveal IS the content — you get a beat to guess before the number
// lands, which is the difference between reading a fact and wanting one.
//
// Driven by IntersectionObserver rather than a scroll listener: the browser
// does the work off the main thread, there's no per-frame handler competing
// with the WebGL scene already running underneath this page, and it needs no
// cleanup beyond disconnecting the observer. Animation is transform/opacity
// only, so it stays on the compositor.
//
// Every item is revealed once and stays revealed — re-hiding things as they
// scroll back off screen reads as broken, not clever.
//
// The pool is deliberately larger than what gets shown: SHOWN_COUNT of these
// are picked at random per page load, so a second visit asks different
// questions instead of replaying the same four. Figures are real and
// checkable, the same bar the rest of the project's data sets.
const POOL = [
  {
    question: "How far is Earth from the Sun, really?",
    answer:
      "Shrink the Sun to a basketball and Earth becomes a 2 mm grain of sand — 26 metres away. Neptune sits most of a kilometre off. Every diagram of the solar system you have ever seen is lying to you about distance.",
    stat: "26 m",
    statLabel: "to a 2 mm Earth",
  },
  {
    question: "How long is one lap around the Milky Way?",
    answer:
      "About 225 million years at 230 km/s. The Sun has managed roughly 20 laps in its lifetime. Last time it was here, dinosaurs had not turned up yet.",
    stat: "225M yrs",
    statLabel: "one galactic year",
  },
  {
    question: "Andromeda is falling toward us. What happens when it arrives?",
    answer:
      "In about 4.5 billion years the two galaxies pass straight through each other. Almost nothing collides — stars are so far apart that they simply drift past, and the two spirals settle into one.",
    stat: "110 km/s",
    statLabel: "closing speed",
  },
  {
    question: "How is the universe wider than light has had time to cross?",
    answer:
      "It is 13.8 billion years old and 93 billion light-years across, because space itself expanded while that light was still travelling. What emitted the oldest light we can see has been carried far beyond where it sat when it let go of it.",
    stat: "93 Bn ly",
    statLabel: "across, at 13.8 Bn years old",
  },
  {
    question: "A black hole with 4 million times the Sun's mass — how big is it?",
    answer:
      "Sagittarius A*, at the centre of our galaxy, has an event horizon about 24 million km across. That fits inside Mercury's orbit. Black holes are not enormous, they are dense — the mass is crushed into a space smaller than a planet's yearly path.",
    stat: "24M km",
    statLabel: "across, at 4 million suns",
  },
  {
    question: "What is the furthest thing you can see with no telescope at all?",
    answer:
      "Andromeda, 2.5 million light-years away, visible from a dark sky as a faint smudge. The light landing on your retina left before our species existed.",
    stat: "2.5M ly",
    statLabel: "naked-eye limit",
  },
  {
    question: "How empty can space actually get?",
    answer:
      "The Bootes Void runs about 330 million light-years across and is nearly empty. Put the Milky Way at its centre and we would not have discovered other galaxies existed until the 1960s — nothing would have been close enough to see.",
    stat: "330M ly",
    statLabel: "of almost nothing",
  },
  {
    question: "On which planet does a single day outlast the whole year?",
    answer:
      "Venus. It turns once every 243 Earth days but orbits the Sun every 225, so its day is longer than its year. It also spins backwards — the Sun there rises in the west.",
    stat: "243 days",
    statLabel: "one Venusian day",
  },
  {
    question: "Something is dragging our entire galaxy across space. What?",
    answer:
      "The Great Attractor, hauling the Milky Way and thousands of neighbouring galaxies toward it at roughly 600 km/s. We can barely see it — it sits behind the crowded plane of our own galaxy, hidden by the dust and stars in the way.",
    stat: "600 km/s",
    statLabel: "and we cannot stop",
  },
  {
    question: "What is the oldest thing anyone has ever seen?",
    answer:
      "The cosmic microwave background — light set free 380,000 years after the Big Bang, when the universe first cooled enough to turn transparent. Before that instant it was opaque, so nothing older survives to be seen.",
    stat: "380,000 yrs",
    statLabel: "after the Big Bang",
  },
];

const SHOWN_COUNT = 4;

export default function CuriosityScroll() {
  const rootRef = useRef(null);

  // Picked once per mount, not per render — without useMemo every re-render
  // would reshuffle the list mid-scroll and swap questions out from under
  // whoever is reading them.
  const items = useMemo(() => {
    const pool = [...POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, SHOWN_COUNT);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const els = Array.from(root.querySelectorAll(".cs-item"));

    // No IntersectionObserver (or the user prefers reduced motion) — show
    // everything immediately rather than leaving the content invisible. The
    // information is the point; the animation is a bonus.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("cs-item--in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("cs-item--in");
          io.unobserve(entry.target); // reveal once, then stop watching
        });
      },
      // Fires a little before the item reaches the middle of the pane, so the
      // reveal is already underway by the time it is properly in view.
      { threshold: 0.35, rootMargin: "0px 0px -10% 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <section className="cs" ref={rootRef}>
      <p className="cs-eyebrow">Curious about space?</p>
      <h2 className="cs-title">Four questions worth scrolling for</h2>

      <div className="cs-list">
        {items.map((item, i) => (
          <article className="cs-item" key={item.question} style={{ "--cs-i": i }}>
            <div className="cs-item__stat" aria-hidden="true">
              <span className="cs-item__statValue">{item.stat}</span>
              <span className="cs-item__statLabel">{item.statLabel}</span>
            </div>
            <div className="cs-item__body">
              <h3 className="cs-item__q">{item.question}</h3>
              <p className="cs-item__a">{item.answer}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
