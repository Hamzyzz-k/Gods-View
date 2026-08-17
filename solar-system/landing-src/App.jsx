import { useCallback, useEffect, useRef, useState } from "react";

import CuriosityScroll from "./components/CuriosityScroll.jsx";
import GravityWell from "./components/GravityWell.jsx";
import Strands from "./components/Strands.jsx";
import AccordionGallery from "./components/AccordionGallery.jsx";
import SplashCursor from "./components/SplashCursor.jsx";
import "./tokens.css";
import "./App.css";

// The five cosmic-scale tiers (must match cosmos/tierData.js's ids exactly —
// this is the literal "link between the layers" the brief asked for: picking
// a panel and dismissing the landing page jumps the app straight there,
// via the gv:enter-app handoff below).
const TIER_ITEMS = [
  { id: "solarSystem", label: "Solar System", image: "https://upload.wikimedia.org/wikipedia/commons/c/cb/Solarsystemscope_texture_2k_sun.jpg" },
  {
    id: "milkyWay",
    label: "Milky Way",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Photo_by_Giles_Laurent.jpg/1280px-036_Milky_Way_during_Perseids_seen_from_Oeschinensee_with_water_reflections_Photo_by_Giles_Laurent.jpg",
  },
  { id: "localGroup", label: "Local Group", image: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Andromeda_galaxy.jpg" },
  { id: "supercluster", label: "Local Supercluster", image: "https://upload.wikimedia.org/wikipedia/commons/6/67/The_Sombrero_Galaxy.jpg" },
  { id: "observableUniverse", label: "Observable Universe", image: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Bullet_cluster.jpg" },
];

export default function App() {
  const [exiting, setExiting] = useState(false);
  // This is now the ACTUAL scroll container (App.css: position:fixed +
  // overflow-y:auto), not just a plain wrapper — a real, bounded scroll
  // pane, not a hack that relied on `body` scrolling. `<html>` (the true
  // scrolling element in standards mode) is never touched, so nothing about
  // this can leak into — or scroll past into — the main app underneath.
  const rootRef = useRef(null);
  const dismissTimeoutRef = useRef(null);

  // Dismisses the landing page and, if a specific tier was picked from the
  // gallery, tells the already-booting vanilla app (src/main.js) to jump
  // straight there — a plain DOM CustomEvent, since this React bundle and
  // the rest of the app are two separate scripts with no shared module
  // state. See src/main.js for the listener.
  const enterApp = useCallback((tierId) => {
    document.dispatchEvent(new CustomEvent("gv:enter-app", { detail: { tier: tierId || null } }));
    setExiting(true);
    dismissTimeoutRef.current = setTimeout(() => {
      if (rootRef.current) rootRef.current.style.display = "none";
      dismissTimeoutRef.current = null;
    }, 900);
  }, []);

  // The reverse handoff: clicking the "God's View" title in the vanilla
  // app (src/main.js) dispatches this — undoes exactly what enterApp()
  // above did, rather than remounting anything (this bundle is never
  // unmounted on dismiss, just hidden). Cancels a still-pending dismiss
  // timeout too, in case this ever fires before that 900ms window elapses.
  useEffect(() => {
    const onShowLanding = () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      if (rootRef.current) rootRef.current.style.display = "";
      setExiting(false);
    };
    document.addEventListener("gv:show-landing", onShowLanding);
    return () => document.removeEventListener("gv:show-landing", onShowLanding);
  }, []);

  return (
    <div ref={rootRef} className={`gv-landing${exiting ? " gv-landing--exit" : ""}`}>
      <SplashCursor RAINBOW_MODE={false} COLOR="#ffd27a" />
      <div className="gv-strands-bg" aria-hidden="true">
        <Strands />
      </div>

      <section className="gv-hero">
        <h1 className="gv-hero-title">God's View</h1>
        <p className="gv-hero-copy">Curious about space? From your backyard to the edge of the observable universe.</p>
        <button type="button" className="gv-cta" onClick={() => enterApp(null)}>
          Begin Exploration
        </button>
        <p className="gv-hero-hint">Scroll to explore</p>
      </section>

      <CuriosityScroll />

      <section className="gv-section gv-gravity-section">
        <h2 className="gv-section-title">This is what gravity actually looks like</h2>
        <p className="gv-section-copy">
          Grab the black hole and move it. The small bodies are on real, numerically-simulated orbits around it —
          genuine inverse-square gravity, not a canned animation — so wherever you drag it, they follow.
        </p>
        <div className="gv-gravity-frame">
          <GravityWell />
        </div>
      </section>

      <section className="gv-section gv-gallery-section">
        <h2 className="gv-section-title">Every scale, one click away</h2>
        <p className="gv-section-copy">Hover to preview, click the open panel to jump straight there.</p>
        <AccordionGallery
          items={TIER_ITEMS}
          defaultIndex={0}
          accentColor="var(--gv-gold)"
          overlayColor="#05060c"
          textColor="#ffffff"
          onSelect={(item) => enterApp(item.id)}
        />
      </section>

      <footer className="gv-footer">
        <button type="button" className="gv-cta gv-cta--footer" onClick={() => enterApp(null)}>
          Enter God's View
        </button>
        <a className="gv-credits-link" href="credits.html" target="_blank" rel="noopener noreferrer">
          Image credits &amp; licenses
        </a>
      </footer>
    </div>
  );
}
