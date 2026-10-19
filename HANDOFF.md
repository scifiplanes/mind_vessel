# MIND//VESSEL — handoff

An indirect-control roguelike prototype. The player never moves the character (the *vessel*). They shape its **Mind**: an ordered list of **Thoughts**, each an ordered list of **verbs** with optional conditions. Several times a second the vessel reads its Mind from the top and does the first verb that can act. Every body in the world — vessel, people, animals, plants — runs the same system.

- **The game:** `mind-vessel.html` — one self-contained file (≈300 KB, HTML + CSS + JS, no build step, no dependencies beyond the VT323 Google Font with monospace fallbacks). Open it in a browser.
- **Published copy:** https://claude.ai/artifact/5M2WiXPQhsZxRjYPu3dJTB
- **Tests:** `tests/` — headless suites in jsdom (see *Testing*).

---

## 1. Design pillars (agreed with the designer)

1. **Indirect control only.** The player edits the Mind; the vessel acts. "Tinker while watching" must be preserved: editing never pauses or slows time.
2. **One system for every body.** Vessel, people (civilization members, settlers), creatures (animals, plants) all use `think()` over a Mind of Thoughts.
3. **Thoughts die with the vessel.** Each vessel wakes with its own Library and Mind, generated from its class, culture and species. Nothing carries over except what is left in the world.
4. **The world persists across a campaign** (a run of runs): tiles, objects, items, structures, populations, civilizations. **Knowledge does not:** each vessel has its own fog of war and region-map knowledge. Map-sharing verbs (Ask the Way, Read the Dead, Survey Lines) are the deliberate exception.
5. **No magic knowledge.** Region events reach the vessel only through the world: people gossiping, terminals/feeds, remains. Toasts were removed for this reason. The log keeps every event as a *debug* channel.
6. **Simple mode is the default UI:** as non-verbal as possible, focused on Mind management, everything else contextual. Allowed words: Thought names, site names, in-world (diegetic) text. Not allowed: standing UI text (labels, reason strings, status lines, log). Detailed mode keeps the full text UI one key away (U).
7. **Diegetic over UI.** Site state, news, events, hostility etc. are shown in the world (floating text, speech, ambient tint/particles, duct markers), not as UI labels.

---

## 2. Running and controls

Open `mind-vessel.html`. First run shows a short intro and two coach marks (stored in `localStorage`).

Keys: `Space` pause · `S` speed ×1/×2/×4 · `M` region map · `L` Library · `B` vessel sheet · `G` log (Detailed) · `R` world overlay · `V` dice rolls · `D` dither · `F9` or `` ` `` debug panel · `U` Simple/Detailed · `N` ×2 abandon vessel · `T` theme · `H` help · `Esc` close.

`localStorage` keys: `mindvessel.v2` (deepest tier reached), `mindvessel.coached2`, `mindvessel.uimode` (`simple`|`detailed`), `mindvessel.debug` (dither and log settings), `mindvessel.autorestart`.

**The campaign lives in memory only.** Reloading the page starts a new region. Persisting the campaign across reloads (serialising `RG` and every visited site's `s.dun`) is a known open task.

---

## 3. File map

The script is one `<script>` block, organised in banner-commented sections (search for `// ====`):

| Section | Contents |
|---|---|
| utils | RNG (`R`, `RI`, `PICK`, `rngSeed`), `clamp`, `esc`, `$` |
| data: materials | `MATS` (props: hard, sharp, weight, conduct, flex, spirit, …), `DIET` per species/kind, `edible(src,m)` |
| data: character components | `SPECIES`, `CULT`, `CLASS`, `REL`, `SIGN`, `TRAIT`, `PLAYABLE`, **`KIND`** (creature kinds; registered into `SPECIES` and `DIET`) |
| data: thoughts | `TH` (every Thought: `n`, `cat`, `c` cost, `b` broad, `v` verbs `[[VERB,{params,when}]]`, `d`, `hidden`, `origin`), `TH_CATS`, `MEME`, `starterThoughts(comp)` |
| data: recipes | `RECIPES` (gear and tools by material role), `REFINE`, `BUILD` |
| sprites | 10×10 masks per species/kind/object (`SPR`) and palettes |
| world state | globals: `map`, `blk`, `flr`, `stock`, `explored`, `vis`, `objs`, `actors`, `LIGHT/HEAT/ECHO/POWER`, `exits`, `rooms` |
| pathing | BFS/A* helpers, `walk(x,y)` |
| level generation | `genLevel(nb,s)` — a site's dungeon from its seed and biome; `BLOCK` and `FLOOR` tile types with extraction verbs and what they leave behind |
| actors | `makeActor`, `recalc` (stats → derived values), `wants(a,b)` (hostility), `dietOf`, `canEat` |
| verbs | `VERB` object — one function per verb, returning an *intent* `{tile|ent|self, range, act, lab}` or `null`. `NPCV` holds the NPC versions of player-only verbs |
| actions | `act()` executes intents; `extract`, `refine`, `craft`, `build`, `kill`, `breed`, `graze`, `study`, news (`hearNews`, `gossipStep`, `scanFeed`), map sharing (`askWay`, `recallDead`, `surveyLines`), `leaveRemains` |
| THE REGION | `genRegion` (~110 Poisson-scattered sites, non-crossing ducts), `regionStep` (resources, populations, migration, civilizations, cycles, events), `rlog` (region event → debug log + news), `syncSite`, `instantiateSite`, kind mixes (`kindMix`, `pickKindFrom`), `faunaRoom` |
| DUNGEON | `enterSite`, `leaveSite`, `travel`, `newVessel`, per-vessel knowledge (`vmem`, `vesselExplored`, `forgetRegion`) |
| update | `updActor`, `update(dt)` (also `gossipStep`, flora light refresh) |
| fx / render | particles, `ambientFx` (site-state tint and motes), `draw`, `dither(levels)` with configurable Bayer matrix |
| UI | log, autopause, dock/sheet/layouts, Mind and Library (Detailed), cards (`cardLines`, `renderCard`, `suggestFor`), barks (in-world text), duct markers, region map, menu, debug panel, help, dialogs, coach marks |
| Simple mode | glyph set (`GLYPH`, `VERB_G`, `COND_G`), `renderMindSimple`, `renderLibSimple`, `simpleCardLines`, `glyphLegend` |
| loop | `frame()`, startup (`newVessel`, start dialog) |

### Key functions

- `think(a)` — the decision engine; records a per-Thought, per-verb trace in `a.trace` (drives the Mind panel's ▶ ✗ – ⏸ states). `condWhy(a,w)` explains a false condition.
- `previewAt(tid,at)` / `previewText` / `bestSlot(tid)` — run `think()` on a copy of the Mind with a Thought inserted and restore all touched state; used for ★ "acts here", drag previews and "+ add at the best slot".
- `supplyWant(a)` — which materials the Mind wants; `extractIntent` finds the nearest extractable tile; `wantedBy(mats,how)` — which Thoughts would use something (for cards).
- `routePreview()` — which duct each travel Thought would take now (Mind rows, duct markers, map).
- `rlog(msg,siteId)` → `newsAdd()` — every region event becomes news that NPCs and terminals can pass on.
- `bark(target,text,kind)` — floating in-world text; `newsBark` makes it clickable (opens the map).
- `openCard(c)` — contextual inspector card. Kinds: `tile`, `actor`, `obj`, `mat`, `gear`, `stat`, `trait`, `ability`, `thought`. Cards chain with `back`.

---

## 4. Systems summary

**Thoughts and verbs.** ~47 verbs. Categories: Combat, Survival, Stealth, Extraction, Refining, Making, Social, Travel, Broad, Modifier. Broad Thoughts (cost 2) bundle verbs. Conditions: `hpBelow`, `energyBelow`, `energyAbove`, `threat`, `calm`, `outnumbered`, `dark`, `foodLow`. **Attention:** open-ended work drains `a.focus.all` against `patience(a)` (90 s + 12 s per WIS); when spent, work verbs skip and lower Thoughts (often travel) take over.

**Material world.** Walls and floors yield materials via specific verbs and turn into other tiles. Materials refine (heat or live conduit for some), assemble into gear and tools by role, build structures (fire, furnace, lamp, snares, walls).

**Energy.** Every body burns energy; each species or kind feeds its own way (organic, flesh, rot, power, light, echo, heat, mineral, or growth for plants).

**Region.** Sites have type, resources, populations (N grazers, Q hunters, S settlers, F growth), species and kind mixes, civilizations whose ideas are Thoughts (they mutate, spread at contact, schism, merge, war, transcend, fall), and cycles (Dimming/Warming, Slumber/Quickening). Site *phase* (primordial, competitive, colonial, complex, collapse) is shown diegetically (arrival impression plus air tint and particles).

**People.** Civilization members and settlers have full components. They extract, refine, build, tame animals, trade, listen, preach (to each other and to the vessel; preaching can add a Thought to your Library), gossip news (more if they carry social Thoughts), and dig more room around home.

**Creatures** (`KIND`): no culture, class, faith, sign or civilization; Minds of instincts; never transfer Thoughts. Fauna: Ductrat, Rustmite, Glasswing, Seepworm (grazers); Bonehound, Cablesnake (hunters, sturdier, sprint while hunting). Flora (rooted): Moldbloom (faint glow), Glowcap (lights its surroundings), Pipevine (thorns), Lichen. Plants feed from their tile and spread; grazers `GRAZE` them; hunters hunt grazers. Grazers are capped by plants, hunters by grazers (`faunaRoom`); empty hunter niches draw a hunter in from next door. The vessel learns instincts by `STUDY` (watching; WIS check); creature-only Thoughts: Graze, Skitter, Play Dead, Carrion Sense.

**News.** NPC gossip (`gossipStep`): full text if the vessel carries a social Thought (Listen, Barter, Proselytize), otherwise fragments («…war… Silo Hesk…»). Read the Feeds (`SCAN`) reads terminals and powered panels or conduits for region-wide news (cooldowns). Heard news marks sites on the map and makes them pulse.

**Campaign.** A dying or abandoned vessel leaves its remains (with its map knowledge), all gear, its full pack, and a Thought Shard. The next vessel wakes at the campaign start with fresh fog of war. Map sharing: Ask the Way (`ASK`), Read the Dead (`RECALL`), Survey Lines (`SURVEY`). Revealed tiles are stored as `explored[i]===2` ("told") and drawn darker until seen.

---

## 5. UI architecture

**Layouts** (`layoutFor()`, switches live on resize):
- `side` (≥1100 px wide and ≥1.45 aspect): Mind as a column right of the world; Library slides over the world as a drawer.
- `bottom` (narrower desktop): dock under the world. Detailed: three panes (Mind | selected Thought detail | Library). Simple: two panes (Mind | Library).
- `phone` (≤860 px): world on top, sheet below with peek/half/full heights.

**Modes:** `SIMPLE` (default) and Detailed; `setSimple(on)`; CSS class `#app.simple`.
- Simple: glyph rows (category band, state, glyph, name; blocked rows show a condition glyph; travel rows show "→ Site"), attention bar, verb strip on select, tap again for the Thought card; flat Library (★ "acts here" first, pulsing); compact icon cards with ▾ for full detail; ＋ opens the Library; tapping the vessel gives bars, equipment, pack and ▤ for the full sheet; glyph legend in help.
- Detailed: numbered rows with reason text, tabs (Mind, Library, Vessel, Log), status line, log channels.

**Glyphs:** 7×7 pixel masks in `GLYPH`, rendered as URL-encoded SVG masks (`.ico`, coloured by `currentColor`). Redrawing one is editing seven strings.

**Other UI:** in-world barks; duct markers (shown only when travel is in play); region map overlay (click the header site name, M, or a news bark); ☰ menu; debug panel (dither on/off, levels, Bayer 2/4/8 or none, strength, monochrome; region-event logging; log filters); auto-restart checkbox on the death screen.

---

## 6. Testing

```
cd tests
npm install          # jsdom 24.1.3
./run-all.sh         # all suites, PASS/FAIL counts
node t21.js          # one suite
node extract.js && node play.js 6 5   # older stub-DOM gameplay harness: 6 vessels × 5 minutes
```

`dom.js` loads the HTML into jsdom with a stub canvas, fake `matchMedia` and fixed element sizes, and exposes internals as `g.*` (see the long `.replace("newVessel();updFk();uiTick();", …)` at the top). Options: `{w,h,narrow,simple,file}`. Suites default to Detailed mode unless `simple:true`. Many suites fake `performance.now` so real-time features (toasts, barks, cooldowns) advance with game time.

| Suite | Covers |
|---|---|
| t1, t4, t5 | Detailed UI: dock, drawer, cards, menu, phone sheet, edge cases (death, travel, vanishing targets), three layouts and live resize |
| t6 | duct markers and travel routes in the Mind |
| t8 | news: NPC gossip (full vs fragments), feeds, map links, log autoscroll |
| t11 | stat, trait and ability cards |
| t12 | auto-restart |
| t13, t17 | creatures: food web per site type, study, grazing, glow, thorns, kind migration |
| t18, t19 | campaign persistence, per-vessel knowledge, remains, map-sharing verbs |
| t20 | debug panel, click-to-close cards |
| t21–t25 | Simple mode: rows, verb strips, Library, cards, equipping per layout, gap fixes, vessel card, site-state impression |

Some numbers in the suites are statistical (ecosystem counts, gossip rates). Rerun before treating a single failure as a regression.

**Not verified headlessly:** real rendering. Glyph legibility at 14 px, tints and particle strength, card placement near screen edges, touch gestures on a real phone.

---

## 7. Known issues and open tasks

- **Campaign persistence across reloads** (serialise `RG`, civilizations with `Map`/`Set` fields, `s.dun` typed arrays) is not implemented.
- **People die off at some civilized sites** (predates creatures; seen e.g. 3 → 0 at a Foundry in three minutes).
- **Hunter coverage** varies a lot between generated regions; a minimum hunter level in `regionStep` would flatten it.
- **Told tiles count as explored**, so exploring Thoughts won't go into told areas. This is an intended trade-off, but worth playtesting.
- **Earlier balance notes:** Shepherd and Merchant idle in many sites; Stalker and Coward spend a lot of time hiding; exploring a site takes 3–5 minutes; tunnelling has no cap for the vessel (NPC settlements cap at 24 walls per site).
- **Simple mode on phones:** the collapsed sheet still shows a one-line text summary. Simple mode has no log view by design.
- **Glyphs** need a visual pass in a real browser.

## 8. Working conventions used so far

- Edit `mind-vessel.html` directly; it is the single source of truth. Back it up before large patches.
- After any change: `node --check` on the extracted script (`node extract.js && node --check game.js`), then the relevant suites.
- Measure gameplay changes headlessly (rates per minute, populations over time) before and after, and report the numbers.
- Before shipping a visual change, prefer in-world representation; in Simple mode avoid adding UI words.
