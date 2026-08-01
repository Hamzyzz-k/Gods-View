# Lessons

Running list of mistakes and the rules that prevent repeating them.

## Don't probe side-effectful modules with cache-busting query strings

**Mistake:** While debugging the module split I imported modules as
`import('/src/x.js?v=' + Date.now())` to bypass the browser's module cache.
A query string makes the browser treat it as a *different* module, so it gets
evaluated a second time. For modules with side effects that meant:

- `createPlanet()` ran twice, inflating `scene.children` from the correct 24
  to 44 — and I reported 44 as a verification result in a commit message.
- `orbitBtn` got two click listeners, so one toggle cancelled the other and I
  briefly believed I had broken the orbit-lines button.

**Rule:** To re-test after an edit, do a full page navigate instead. Only use
`?v=` on modules that are provably pure. When a verification number looks
surprising, check whether the measurement is polluted before concluding the
code is wrong.

## Verify a "known" third-party API shape before writing against it

**Mistake:** Nearly wrote the Gemini integration from memory using
`generateContent` + `generationConfig.responseSchema`. Checking live docs
showed the Interactions API (`/v1beta/interactions`, `response_format`,
`output_text`) went GA in June 2026 and is the recommended path;
`generateContent` is now legacy.

**Rule:** For any external API, confirm the current wire format from docs
before coding, and say plainly when docs are ambiguous rather than guessing.
Where the docs genuinely disagree (here: `response_format` shown as an object
on one page and an array on another), write the parser defensively to accept
both shapes instead of betting on one.

## Never commit secrets, even transiently

**Mistake (avoided):** The original `script.js` carried a live ElevenLabs key
and a real NASA key. Committing the file verbatim as a "baseline" would have
put both in git history permanently, where deleting them later does nothing.

**Rule:** Blank secrets *before* the first commit that touches them, and check
staged content (`git grep --cached`) rather than the working tree. Tell the
user that any key already exposed in plaintext must be regenerated — removing
it from code does not un-leak it.

## Exported `let` is read-only to importers — this bit twice

**Mistake:** In one big file, any function could assign to any top-level
`let`. After the split, an importer assigning to an imported binding throws
`TypeError: Assignment to constant variable`. It happened twice:

- `orbitLinesVisible`, written by both the scene registry and desktop
  controls — caught before shipping.
- `alignTween`, cleared by the frame loop with `alignTween = null`. Because
  the loop runs every frame and the assignment always threw, the tween never
  cleared and the error repeated indefinitely — the user saw it ~5000 times
  after clicking "Align Planets".

**Rule:** When splitting a file, any variable that is *written* from more
than one module must move to `AppState`. Only single-writer values may stay
as exported `let` bindings. After any such split, grep for assignments to
imported names before declaring it done.

## Verify a test's own logic before trusting a failure

Twice a check reported a problem that did not exist: `includes('...')`
matched a string inside a *comment*, and `clickableMeshes.includes(x)` was
checking a value the module never re-exported (so `undefined`). Before
reporting or "fixing" a failure, confirm the assertion itself is measuring
what it claims to.
