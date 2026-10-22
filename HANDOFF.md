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

Open `mind-vessel.html`. First run shows a short intro and three coach marks (Mind → Memory ＋ → tap world; stored in `localStorage`).

Keys: `Space` pause · `S` speed ×1/×2/×4 · `M` region map · `L` Memory · `B` vessel sheet · `G` log (Detailed) · `R` world overlay · `V` dice rolls · `D` dither · `F9` or `` ` `` debug panel · `U` Simple/Detailed · `N` ×2 abandon vessel · `T` theme · `H` help · `Esc` close.

`localStorage` keys: `mindvessel.v2` (deepest tier reached), `mindvessel.campaign.v1` (full campaign + living vessel), `mindvessel.coached5` (coach complete; older `coached2`–`coached4` ignored), `mindvessel.uimode` (`simple`|`detailed`), `mindvessel.cardopen` (first world card expanded once in Simple), `mindvessel.debug` (dither and log settings), `mindvessel.autorestart`.

**Campaign persistence:** `saveCampaign` / `loadCampaign` serialise `RG` (sites, civs with Map/Set revived, news), `cyc`, visited `s.dun` TypedArrays, and the living vessel (`vmem`, Mind/Library, followers). Saves debounce ~900 ms after site enter/leave/region ticks, and flush on `beforeunload` / tab hide. Wipe (`W` twice) clears the campaign key. Reloading resumes the same region and vessel.

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

**Thoughts and verbs.** ~64 verbs. Categories: Combat, Survival, Stealth, Extraction, Refining, Making, Social, Travel, Broad, Modifier. Broad Thoughts (cost 2) bundle verbs. Conditions: `hpBelow`, `energyBelow`, `energyAbove`, `threat`, `calm`, `outnumbered`, `dark`, `foodLow`, `hot`, `packFull`, `packLow`, `powered`, `restless`, `followerHurt`, `damp`, `light`, `siteDanger`. Travel `to`: deeper, unknown, plenty, kin, safety, ruins, mark, news, remains, power, crew, rite, **rival**. New primitives: **TEND** (feed dying stations from pack), **DISMANTLE** (tear down own builds), **RECRUIT** (peaceful people as followers, player-only). Map-sharing verbs stay player-only. Cross-register *parasite* Thoughts (Cable Smoke, Scrap Cairn, Hide Jack, Ash Meter, Smoke Token, Lease Hide, plus Ash Fight / Break and Run / Clear Out) seed into the "wrong" register so civs mix techniques; Smokekin / Rivetguild / Leasechoir starters sometimes roll one. **Attention:** open-ended work drains `a.focus.all` against `patience(a)` (90 s + 12 s per WIS); when spent, work verbs skip and lower Thoughts (often travel) take over. `FORAGE`, `EXPLORE`, `HOME`, `WANDER`, `STUDY`, `TEND`, `DISMANTLE`, `RECRUIT` are in `WORK`; map-sharing (`ASK`/`RECALL`/`SURVEY`/`SCAN`) stays free.

**Material world.** Walls and floors yield materials via specific verbs and turn into other tiles. Materials refine (heat or live conduit for some), assemble into gear and tools by role, build structures (fire, furnace, smoke pit, drying rack, bone cairn, workbench, meter post, stamp anvil, breaker, incubator, badge post, coolant tap, lamp, snares, walls, racks, beacons). Register intermediates: fiber, smoked meat, gasket, coolant, badge token. **Station scarcity:** fire/smoke/lamp/beacon burn fuel as before; press goes cold without nearby heat (craft bonus off); meter/badge/incubator need live power (badge can also drink a token/wafer); chill drinks coolant — fails show as slog + card life, and gate SCAN / INCUBATE / Warden clearance.

**Energy.** Every body burns energy; each species or kind feeds its own way (organic, flesh, rot, power, light, echo, heat, mineral, or growth for plants).

**Three Registers of Work.** Soft technique weights on every site (`site.reg` / `SITE_REG`): **Bone** (smoke, hide, grit, rite), **Plate** (scrap, steam, stamp, meter), **Lease** (live lines, badge, wet lab). Not eras — coexisting solutions to the same problems. Early tiers bias Bone sites, mid Plate, deep Lease. `ideaPool`, machines, nodes, encounters, and kind mixes follow register weights via `pickByReg` / `primaryReg`.

**Region.** Sites have type (~34 biomes across the three registers, including Pit/Crypt, Furnace/Shaft, Vault/Atrium), resources, populations (N grazers, Q hunters, S settlers, F growth), species and kind mixes, civilizations whose ideas are Thoughts (they mutate, spread at contact, schism, merge, war, transcend, fall), and cycles (Dimming/Warming, Slumber/Quickening). Site *phase* (primordial, competitive, colonial, complex, collapse) is shown diegetically (arrival impression plus air tint and particles). Site assembly field `A` (0–24) tracks construction depth; persisted in campaign save.

**Ecology systems** (generative rules — not scenario KINDs): `bumpAssembly` / site `A`; `competency` / `hasComp` over spaces `morpho|metabo|grad|auto|assemb|nomos|attento|socio` (derived from role + KIND props); `faunaRoom` caps drinkers from gradients+`A` and police from drinker density; `taxFocus` / `refundFocus` (STUDY wires a transfer); clearance weather as ambient via `ambient`/`absorb` for `nomos`; `assemblyWake` / `assemblySleep` residue LOD (`A≥6`, phases competitive/colonial/complex); `coalesce` / `split` / `splitNear` with **bond space** (`bondSpaceFor` / `domBond` over `auto|grad|metabo|assemb|nomos` — dominant match, flora only on `grad`). Split filters: seal/chill→`auto|grad`, linecut/breaker→`nomos|metabo`, scar/dismantle→`assemb`. **Telegraphing:** `assemblyFeel` on enter + site cards; habit / held-as / residue on actor cards + `aname`; near-miss `telegraphBonds` (“lean toward one mouth…”); slog when `A` first crosses wake depth. Roles `plant|forager|predator` remain soft population buckets. Tests: `tests/t7-ecology.js`.

**People.** Civilization members and settlers have full components. They extract, refine, build, tame animals, trade, listen, preach (to each other and to the vessel; preaching can add a Thought to your Library), gossip news (more if they carry social Thoughts), and dig more room around home.

**Creatures** (`KIND`): no culture, class, faith, sign or civilization; Minds of instincts; never transfer Thoughts. Core fauna plus register-native kinds (Bone: Tallowrat, Cairnworm, …; Plate: Gasketmite, Valvehound, …; Lease: Badgefly, Tokenwight, …). Flora (rooted): Moldbloom, Glowcap, Pipevine, Lichen, and later register plants. Plants feed from their tile and spread; grazers `GRAZE` them; hunters hunt grazers. Grazers are capped by gradient-bearing growth and site `A`, hunters by grazers (`faunaRoom`, Bone/Lease bias hunters higher); `regionStep` refills empty hunter niches. The vessel learns instincts by `STUDY` (watching; WIS check; also `taxFocus` from the creature); creature-only Thoughts: Graze, Skitter, Play Dead, Carrion Sense.

**News.** NPC gossip (`gossipStep`): full text if the vessel carries a social Thought (Listen, Barter, Proselytize), otherwise fragments («…war… Silo Hesk…»). Read the Feeds (`SCAN`) reads terminals and powered panels or conduits for region-wide news (cooldowns). Heard news marks sites on the map and makes them pulse. Big events (`announce`) can mention register bits (`{bit}` / `{reg}`: smoke / stamp / badge).

**Campaign.** A dying or abandoned vessel leaves its remains (with its map knowledge), all gear, its full pack, and a Thought Shard. The next vessel wakes at the campaign start with fresh fog of war. Map sharing: Ask the Way (`ASK`), Read the Dead (`RECALL`), Survey Lines (`SURVEY`). Revealed tiles are stored as `explored[i]===2` ("told") and drawn darker until seen.

---

## 5. UI architecture

**Layouts** (`layoutFor()`, switches live on resize):
- `side` (≥1100 px wide and ≥1.45 aspect): Mind as a column right of the world; Library slides over the world as a drawer.
- `bottom` (narrower desktop): dock under the world. Detailed: three panes (Mind | selected Thought detail | Library). Simple: two panes (Mind | Library).
- `phone` (≤860 px): world on top, sheet below with peek/half/full heights.

**Modes:** `SIMPLE` (default) and Detailed; `setSimple(on)`; CSS class `#app.simple`.
- Simple: glyph rows (band, state, glyph, name; early-game block icons only — else shared warn; travel "→ Site" only when that Thought is selected or running); attention bar; verb strip on select; ▾ cue + tap again for Thought card; dockbar ＋ always opens Memory; flat Memory (pulse = acts here); compact cards (first world card auto-expands once); peek strip = glyph + attention only; slim ☰ (More… for the rest); map = route/civ only; Help = short glyph legend. Coach: Mind → ＋ Memory → tap world.
- Detailed: numbered rows with reason text, tabs (Mind, Memory, Vessel, Log), status line, log channels, full Help.

**Glyphs:** 7×7 pixel masks in `GLYPH`, rendered as URL-encoded SVG masks (`.ico`, coloured by `currentColor`). Redrawing one is editing seven strings.

**Other UI:** in-world barks; duct markers (shown only when travel is in play); region map overlay (click the header site name, M, or a news bark); ☰ menu; debug panel (dither on/off, levels, Bayer 2/4/8 or none, strength, monochrome; **normal lighting** experiment; region-event logging; log filters); auto-restart checkbox on the death screen.

**Normal lighting (experiment):** Off by default (`DBG.normals` in F9). Uses a JS port of [Sprite Fusion Sprite Normals](https://github.com/Hugo-Dz/spritefusion-sprite-normals) in `vendor/spritefusion-sprite-normals/` (MIT; same EDT silhouette + Oklab detail pipeline as the Rust/WASM tool). Bakes normals for the level canvas, actor sprites, and objects; a CPU N·L pass replaces the classic `lightCv` holes while normals are on. Fog-of-war and dither still apply. Needs HTTP (or equivalent) so `import()` can load the vendor module — `file://` will show a load error in the debug status line. Offline embedding of baked maps into the single HTML is deferred.

---

## 6. Testing

```
npm install
npm test                 # all suites (tests/t*.js + server/relay/net tests)
node tests/t0-harness.js # one suite
npm run extract && node --check sim/game.js
```

[`tests/harness/dom.js`](tests/harness/dom.js) loads the HTML into jsdom with a stub canvas, fake `matchMedia` and fixed element sizes, patches boot (no rAF / startup dialog), and exposes internals as `g` / `window.__MV_G`. Options: `{w,h,simple,file}`.

| Suite | Covers |
|---|---|
| t0-harness | load game, `update`, campaign blob |
| t1-multisite | multi-vessel / multi-site / despawn / respawn / Mind edit |
| t5-rules | identity, votes, PvP/remains, party, signals, ban |
| t6-ux | Join menu / net client hooks / solo intact |
| t7-ecology | assembly `A`, competency, caps, taxFocus, clearance ambient, wake/sleep, coalesce |
| server/worldFile.test | world file + import + idle pause |
| server/host.test | hello / mind.set / maxPlayers / site isolation |
| relay/relay.test | join codes, password, multiplex |
| net/protocol.test | encode/decode |

**Not verified headlessly:** real rendering; full two-browser relay playtest (manual: see §8).

---

## 7. Content pass (data + copy)

Shipped in-repo max content expansion, then a full follow-up (A–F slices), then **depth + interoperability** (pass 1), then **pass 2** (phase / trauma / crew / cycle / pilgrimage), then **pass 3** (attention / seal / rite / mark / clearance / told fog), then **pass 4** (residue ↔ Mind ↔ campaign):

### Pass 1
- **Diegetic pools:** `NEWS_SAY` (~12 templates/kind + `ductbreak`/`bloom`/`clearance`/`parasite`/`heresy`), `PH_LINE`/`PH_BARK`, `BARK`, `GARBLE`, `NPC_SAY`, `SITE_BIT` (incl. Hearth/Flue/Quench/Stampyard/Gasket/Busgate), expanded `SYL`.
- **Thoughts:** sparse condition packs; Broads retuned again (Shepherd/Merchant/Stalker/Coward use alone/hasFollower/restless/news); depth travel (`coldroad`, `remnantroad`, `crewroad`, `lonewatch`); `FAM_OF` + `REG_SEED` wired.
- **Verbs / mats:** `SIGNAL`, `MEND`, `SIFT`, `BRAND`, `DIG` alias; mats `ashmeal`, `stampdie`, `clearance`, `marrow`; conditions `alone`, `hasFollower`, `cold` used more widely.
- **Interop — scarcity ↔ travel:** `stationHungry` / `noteStationNeed`; dark/cold stations shorten site dwell and bias `to:power|news|remains`; `hearNews` longer pulse + `newsHot`.
- **Interop — parasite civ lifecycle:** `PARA_SET` / `parasiteLoad` / `seedParasite`; schism/mutate/merge bias; preach of a parasite announces; `NEWS_KIND.parasite`.
- **Interop — ecology ↔ settlement + cycle weather:** hide/smoke yards starve without grazers; plate yards without mineral; lease without power; `s.reg` soft-tilts with dimming/quickening.
- **Interop — STUDY heresy / brand gossip / remains scar:** studied instincts can seed local civ memes (`heresy` news); branded followers gossip; `leaveRemains` scars the site and starves player-built stations (world residue, not knowledge).
- **Identity / biomes:** traits `Ash-Sworn`, `Stamp-Hand`, `Lease-Bound`; signs `Cairn`, `Press`, `Bus`; biomes Hearth, Flue, Quench, Stampyard, Gasket, Busgate; signature fauna minds on register keystones.

### Pass 2 (A–G)
- **E — Region trauma conditions:** `atWar`, `scarred`, `blooming`, `isolated` in `condWhy`; travel/`siteDanger` feel war, scar, bloom, cut ducts.
- **A — Phase ↔ Mind:** `collapse` / `colonial` / `complex` conditions; dwell shortens in collapse, lengthens in complex; patience and WORK focus drain tilt by phase; Thoughts `phaserun`, `phasebuild`.
- **G — Shepherd / Merchant:** bloom-gated `DRIVE`/`TRAVEL`; colonial-gated `TRADE`/`LAY`; `LISTEN` reaches farther on `newsHot`; `DRIVE` range up during bloom.
- **B — Crew residue:** branded followers at death bump `s.S` / `s.crew` and may seed civ memes; `NEWS_KIND.crew`; travel `to:crew` + Thought `crewmark`.
- **C — Cycle ↔ bodies:** `dimming` / `quickening` conditions; `patience` shrinks in dim/quick; breed cooldowns and hunter floor scale with cycle; STUDY heresy rarer in slumber; Thoughts `dimwork`, `quickbrood`.
- **D — Multi-site pilgrimage:** refine recipes smoked+wafer→token, marrow+metal→stampdie, coolant+gasket→clearance; `pilgrimNeedReg()` biases `plenty`/`power` travel; Thoughts `smokepilgrim`, `stamppilgrim`.
- **F — Civ end scars:** fall tilts `s.reg` + `fallSeed` for next founding; transcend sets `clearT` (warden bias) + lease tilt + clearance news; player yards on leave soft-tilt `s.reg` / `arts`.
- **Campaign:** site fields `scar`, `crew`, `bloomT`, `fallSeed`, `fallReg`, `clearT`, `newsHot` persist. Keys unchanged (see §2).

### Pass 3 (attention / seal / rite / mark / clearance / told fog)
- **D — Attention ↔ ecology/stations:** WORK drain reduced for `DRIVE`/`GRAZE`/`STUDY` in bloom or `herdNear`; `TEND`/`MEND` while `stationNeed`; `DISMANTLE`/`REPO`/`SALVAGE` in collapse/scar; `INSCRIBE` on rite sites. Successful tend/mend refunds focus. Conditions `stationNeed`, `herdNear`. Shepherd/Merchant retuned to tend stations; new Thoughts `stationtend`, `herdwork`.
- **B — Seal ↔ isolation:** sealing a duct cuts that neighbour in `sealTo` (`openNb` / `isIsolated`); unseal announces `ductmend`. Migration, settle, and civ contact use open ducts. Coward/Stalker leave when isolated; Thoughts `sealwar`, `ductmend`. Trait `Seal-Mind`, sign `Seal`.
- **E — Scar ↔ fauna ↔ settlers:** high `scar` suppresses N/Q then ages into bloom; settler die-off slower with `crew`, faster with scar. Collapse PH lines mention vessel residue. Thought `scarroad`. Campaign: `scarAge`, `rite`, `sealTo`.
- **C — Beacon/SIGNAL ↔ news/pilgrimage:** `SIGNAL` raises `newsHot`; under heat/clearance announces `markpulse`. Dead beacon clears `marked` (`markdead`). Travel `to:mark` and pilgrim plenty/power prefer lit marks. Thoughts `markpulse`, `pilgrimmark`.
- **A — Inscription ↔ arts/rite travel:** `doInscribe` / reading monuments bump `rite`/`arts`, soft-tilt `s.reg`, may seed civ memes (`rite` news). Travel `to:rite`. Thought `riteline`. Trait `Rite-Hand`, sign `Rite`. Dense rites can seed parasites on founding.
- **F — Clearance ↔ wardens:** `hasClearance` / `softClear` (Clear-Mark lasts longer); strip/breaker under `clearT` announce `linecut` and worsen Lease tilt. Thought `clearhold`. Sign `Line`. Condition `clearWeather`.
- **G — Told fog:** `unexploredFor` — after dwell, or with Thoughts `trustmap` / `walkblind`, told tiles (`explored===2`) are explore targets again; fresh `newsHot` still blocks early. ASK radius shortened; SURVEY paints ducts/works, not the whole site.
- **H — Content:** eleven condition-dense Thoughts; news kinds `rite`, `ductmend`, `markdead`, `markpulse`, `linecut`; traits/signs above; COND_G glyphs for new predicates; seeds updated.

### Pass 4 (residue ↔ Mind ↔ campaign)
- **H — Attention / explore:** vessel TUNNEL capped (`s.dug` ≥ 36); told tiles reopen after ~55% dwell (sooner with `trustmap`/`walkblind`); WORK drain up for TUNNEL/EXTRACT/DIG, down for LISTEN on `newsHot`; Stalker/Coward hide only when `alone`, restless → unknown/news/rival.
- **E — Crew residue:** branded followers while alive drip `s.crew` / `s.S`; Shepherd brands/preaches on `crewNear`; Thought `leavecrew`.
- **A — Phase ladder:** conditions `primordial` / `competitive`; `siteDwell` shorter early; patience tilts; Thoughts `firstfire`, `contest`; `phasebuild`/`phaserun` retuned across the ladder.
- **B — Cycle pair:** condition `warming` (`cycleMul>1.25`); patience / SCAN yield in warming; `dimwork`/`quickbrood` retuned; Thought `warmwork`.
- **C — Grudge:** condition `grudgeNear`; travel `to:rival`; kin soft-penalizes mild grudge (hard skip only if >2); PREACH can target mild-grudge civs and softens on success / announces `grudge` on fail; Thought `coldkin`.
- **D — Shard / remains:** shard pickup bumps `arts`/`rite`/`newsHot` + register tilt + `shard` news; RECALL pulses `newsHot`/`crew`; scarred sites widen NPC LOOT and seed `loot`/`salvage` into minds; Thought `shardroad`.
- **F — Body predicates:** Thoughts `litfight`, `hungerpack`, `dampcure`, `powerhold`; Merchant forages on `foodLow`.
- **G — Pilgrimage close:** condition `pilgrimPack`; cross-register refine → mark + `pilgrim` news; patience/travel bias with goods; Pilgrim/Merchant Broads + Thought `goodsroad`.
- **Content:** eleven Thoughts; news `grudge` / `shard` / `pilgrim`; COND_G for new preds; seeds updated. Campaign keys unchanged.

## 8. Multiplayer (self-hosted)

Valheim-style: browser **clients**, Node **host** (listen = dedicated), optional **join-code relay** (host dials outbound). **Worldwide invites** use a Cloudflare quick tunnel (`scripts/tunnel.js`) so friends join from the public internet without port-forwarding.

```
# Always-on cloud (recommended for friends): see HOW TO DEPLOY.txt
fly deploy               # after one-time fly auth / volume setup

# Host on your Mac: double-click “MIND VESSEL Host.app”
# Lobby → Copy worldwide invite. Quit the app to stop.

npm start                # terminal alternative (Cloudflare tunnel)
MIND_VESSEL_NO_TUNNEL=1 npm start   # LAN / local only
npm test
```

Friends: open the **worldwide invite** (Fly URL or tunnel link). Short join codes are same-machine only.
Local host: Node.js LTS once; may download `cloudflared` into `tools/bin/`.
Cloud: [`Dockerfile`](Dockerfile) + [`fly.toml`](fly.toml) — persistent world on `/data`.

| Piece | Path |
|---|---|
| Sim MP APIs | `MpWorld` in `mind-vessel.html` (`ensureMP`, `enterSiteFor`, `updateAll`, …) |
| Protocol | [`net/protocol.js`](net/protocol.js) |
| Host | [`server/host.js`](server/host.js) + [`server/hostCore.js`](server/hostCore.js) |
| Tunnel | [`scripts/tunnel.js`](scripts/tunnel.js) + [`scripts/start.js`](scripts/start.js) |
| World files | [`server/worldFile.js`](server/worldFile.js) (`ver: 2` + `players[]`) |
| Relay | [`relay/server.js`](relay/server.js) |
| Client UI | ☰ Join / vote / signal; Mind edits → `mind.set` when connected |

**Rules (locked):** multi-site vessels; reconnect by token (+ optional name/password); disconnect despawns vessel+followers; PvP world flag (default off); remains owner-locked 600s when PvP off; pause/speed by vote (host override); fog personal; party map via password-party or meet+crew; diegetic signals; kick+ban; solo `localStorage` unchanged; `--import-campaign` promotes a solo blob.

**Tests:** `tests/t0-harness.js` … `t6-ux.js`, `server/*.test.js`, `relay/relay.test.js`, `net/protocol.test.js`. Harness: [`tests/harness/dom.js`](tests/harness/dom.js).

## 9. Known issues and open tasks

- **Normal lighting** is experimental (F9 → Normal maps). Level bake can hitch on site enter; CPU N·L is heavier than the classic veil. Replace the JS port with an upstream WASM build when a Rust toolchain is available if bit-identical output matters.
- **Campaign save size:** many visited dungeons can approach `localStorage` quotas; if save fails, check the console warn. Consider pruning never-revisited duns later.
- **People die-off** at mid-avail civ sites is softened (lower settler decay when `S` is 2–8); still worth watching Foundries over long runs.
- **Hunter floor** in `regionStep` refills empty niches more aggressively on Bone/Lease sites; coverage still varies by region seed.
- **Told tiles** reopen for explore after ~55% site dwell (sooner with `trustmap`/`walkblind`); still blocked briefly under fresh `newsHot`. Worth playtesting.
- **Earlier balance notes (Pass 4 retuned):** Shepherd/Merchant should idle less; Stalker/Coward hide only when alone; vessel TUNNEL caps at 36 digs/site (NPC settlements still 24). Explore time was 3–5 minutes — re-check after told-fog change.
- **Simple mode on phones:** peek strip is glyph + attention only (no prose status line). Simple mode has no log view by design.
- **Glyphs** need a visual pass in a real browser.

## 10. Working conventions used so far

- Edit `mind-vessel.html` directly; it is the single source of truth. Back it up before large patches.
- After any change: `npm run extract && node --check sim/game.js`, then `npm test`.
- Measure gameplay changes headlessly (rates per minute, populations over time) before and after, and report the numbers.
- Before shipping a visual change, prefer in-world representation; in Simple mode avoid adding UI words.
