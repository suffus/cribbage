# CribbageX Competitive Analysis

**Prepared:** 12 September 2026  
**Scope:** Desktop, mobile, and browser cribbage products that compete for the same “play a real game of cribbage against a computer, and maybe later against people” job.  
**Sources:** Official product sites and store listings (Cribbage Pro, Cribbage JD, Cribbage Classic, World of Card Games, CardGames.io, Steam), plus 2026 review and ranking roundups. Figures are as published in August–September 2026.

---

## 1. Market positioning map

### 1.1 How this market is structured

Digital cribbage is a **small, mature niche** inside casual card games. Demand is steady (family players, retirees, ACC tournament players, and people who learned the game at a kitchen table), but there is already a clear incumbent stack:

| Layer | Who owns it | What players come for |
| --- | --- | --- |
| Cross-platform “official” destination | **Cribbage Pro** (Fuller Systems) | Ranked play, ACC-sanctioned seasons, friends across devices |
| Mobile-first casual | **Cribbage JD** (JD Software) | Large cards, offline play, stats, achievements |
| Browser / learn-the-game | **Cribbage Classic** | Instant play, tutorial, discard analysis, muggins |
| Casual multiplayer lobby | **World of Card Games**, **CardGames.io** | No-install games with friends or strangers |
| Emerging desktop | **Cribbage!** on Steam (Citradox, Q3 2026) | 2–4 player, team cribbage, ranked + private rooms |

CribbageX today sits **below all of these layers**: a v0.2 web prototype that can complete a two-player game against one computer opponent. It is not yet a budget alternative (there is no paid market to undercut) and not yet a niche specialist. It is an **early-stage solo implementation that still lacks several table-stakes capabilities**.

The most realistic near-term fit is **not** “beat Cribbage Pro at multiplayer.” It is **become the best modern, trustworthy practice / learning client in the browser**, then grow into lightweight multiplayer. That is the gap Cribbage Classic occupies with a dated UX, and the gap Cribbage Pro / Cribbage JD leave open because of ads, IAP, and persistent “rigged shuffle” complaints.

### 1.2 Closest comparable products

Four products are the right comparison set. A fifth (Steam’s *Cribbage!*) is a watch item, not a live competitor.

1. **[Cribbage Pro](https://www.cribbagepro.net/)** — category leader. iOS, Android, Windows, Mac, Kindle. Cross-platform multiplayer, ranked matchmaking, and (from Competitive Cribbage 2026–27 Season 1) an **American Cribbage Congress–sanctioned** season. ~1M+ Play Store installs, ~4.5★ / 54k–62k reviews. Free with ads; ~$4.99 to remove ads / unlock the full “Online” SKU.
2. **[Cribbage JD](https://cardsjd.com/cribbage/)** — most popular mobile-first alternative. iOS, Android, Windows Store, and browser. Offline + online, four AI difficulties, large “grandpa-friendly” cards, deep lifetime stats. 100k+ Play installs, ~4.6★ / 20k+ reviews. Free with ads and IAP (also on Google Play Pass).
3. **[Cribbage Classic](https://cribbageclassic.com/)** — closest *product-type* peer to CribbageX: free browser (also iOS / Microsoft Store) solo cribbage with teaching tools. Three published AI strategies, tutorial, discard analyzer, suboptimal-play critique, optional manual scoring and muggins. No real multiplayer.
4. **[World of Card Games — Cribbage](https://worldofcardgames.com/cribbage)** — closest *distribution* peer for “open a URL and play.” Browser tables, bots, private friend tables, optional ranked Elo. No signup to start. Site-reported ~114k cribbage games played (updated August 2026). Free, ad-supported.

**Watch item:** *[Cribbage!](https://store.steampowered.com/app/4984120/Cribbage/)* (Citradox) on Steam, listed for Q3 2026, free-to-play, Windows / macOS / Linux, 2–4 players including partner teams. If it ships, it becomes the first serious desktop-native 4-player option.

### 1.3 Comparison table

| | **CribbageX** | **Cribbage Pro** | **Cribbage JD** | **Cribbage Classic** | **World of Card Games** |
| --- | --- | --- | --- | --- | --- |
| **Core features** | 2-player vs one AI; cut for deal; auto-score show/crib/peg; visual pegboard; 5 card-back skins; “Auto Select” discard helper; toast event messages. Web only. No accounts, no stats, no tutorial, no multiplayer. | 2-player vs 3 AI levels (Standard→Brutal); cross-platform online + ranked matchmaking; best-of series; daily scrimmage; ACC-sanctioned seasons; hints; manual count + muggins; stats + Top 50; avatars; boards/cards/themes; auto-play / auto-cut. | 2-player vs 4 AI levels (Easy→Crazy Ninja); online + offline; auto-score with breakdown; lifetime stats (hand / crib / peg averages); achievements; large cards; ranked online; chat canned phrases. No muggins. | 2-player vs 3 published AI strategies; in-game tutorial; hints; suboptimal-discard warnings; discard analyzer (min/avg/max EV); post-game error summary; stats by difficulty; optional manual count + muggins. No multiplayer. | 2-player vs bot or human; public + private tables; optional ranked Elo; no-signup instant play; auto-score; site-wide stats. No teaching tools, no variants, dated UI. |
| **Audience / pricing** | Intended: all ages and skill levels. Actual: local/dev users of a prototype. No pricing (not shipped). | Broad casual + serious ACC players. Free + ads; ~$4.99 ad-free / full version. | Casual / family / older mobile users. Free + ads + IAP; Play Pass. | Learners and practice players. Free in browser; free/ad-supported apps. | Casual browser players who already use the site for other card games. Free, ads, optional account for ranks/stats. |
| **Strengths** | Honest local engine (no ads, no IAP, no account); real pegboard UX; expected-value discard math already in the engine (`getBestHand`); cut-for-deal and full show sequence implemented; easy to iterate as a web app. | Network effects; ACC legitimacy; every platform; deepest multiplayer; daily habits (scrimmage, seasons); trusted enough that ACC routes IRP through it. | Highest mobile usability (large cards); strong solo loop (stats + achievements + difficulties); offline; 100k+ install social proof. | Best teaching product in the category; transparent AI write-up; discard analyzer is unique and loved by serious learners; zero-friction browser play. | Zero install; friend tables in 30 seconds; ranked option without an app; rides a larger card-game audience. |
| **Weaknesses** | Missing difficulty levels, tutorial, scoring breakdown UX, pegging hints, persistence, sound, accessibility polish, mobile layout, and any multiplayer. Single AI strength. Looks like a prototype, not a product. | Ads in free SKU; “rigged shuffle / monster hands” complaint is the #1 review theme even after published fairness audits; XP gate before ranked; mobile-first UI on desktop. | Persistent fairness / non-random-deal controversy on Reddit and stores; IAP/ads; weaker desktop story; no muggins / manual count for purists. | Dated UI; no multiplayer; no modern account/sync; some players still distrust Pro-level AI; Microsoft Store rating historically weak. | Dated look; ads; cribbage is a side mode (player pool thinner than Spades/Hearts); almost no teaching or variant depth. |

### 1.4 Where CribbageX stands today

**CribbageX is a feature-incomplete web prototype, not yet a positioned product.**

- It is **not** a budget alternative. Incumbents are already free (ad-supported). Price is not the wedge.
- It is **not** yet a niche specialist. Specialists already exist: Cribbage Pro owns sanctioned competition; Cribbage Classic owns teaching; Cribbage JD owns casual mobile.
- It **does** have a real rules engine, a pegboard, cut-for-deal, auto-scoring, and a discard optimizer. That is a solid *kernel*, not a market offer.
- Against the four comparables, CribbageX is **behind on every table-stakes surface** (onboarding, difficulty, stats, polish, distribution) and **ahead of none** except “no ads / no account / local-first,” which only matters once the game is pleasant to play.

**Recommended positioning to test (not current reality):**

> “The ad-free cribbage practice table: a modern browser game that teaches the real rules, shows its math, and never stacks the deck — then lets you invite a friend.”

That positioning attacks three documented frustrations at once: ads, shuffle distrust, and the gap between “I know the rules” and “I know how to discard.” It also avoids a frontal war with Cribbage Pro’s ACC network.

---

## 2. Roadmap feature generation

### 2.1 Table-stakes features we lack

These are capabilities **every serious competitor already ships** (or that Cribbage Classic proves players expect even in a free browser game). Until these exist, CribbageX will lose first-session comparisons.

| Gap | Who already has it | Why it is table stakes |
| --- | --- | --- |
| **Onboarding / rules tutorial** | Cribbage Classic (best), CardGames.io (rules page), Cribbage Pro / JD (hints + large cards) | “Users of all ages and talents” includes first-time players. Without a tutorial, the game is unreadable to anyone who did not already grow up with a board. |
| **Multiple AI difficulties** | Pro (3), JD (4), Classic (Easy / Standard / Pro, published strategies) | A single AI strength cannot serve beginners and regulars. Classic’s Easy = random; Pro = full EV. That ladder is now expected. |
| **Score explanation, not just a number** | JD (breakdown), Classic (click-to-count), Pro (manual + auto) | Players need to see *why* a hand is 12. CribbageX shows totals; it does not teach the 15s / pairs / runs / flush / nobs. |
| **Hints during discard *and* pegging** | Pro, Classic, JD (to varying degrees) | CribbageX’s “Auto Select” only covers discard. Pegging is where new players lose. |
| **Session + lifetime stats** | All four comparables | Wins, skunks, avg hand / crib / peg. This is the retention loop for a solo card game. |
| **New-game / rematch / quit that feels finished** | All shipped products | Post-game screen (final pegs, skunk, hand totals, play again) is missing as a designed moment. |
| **Sound + dealer / turn indicators** | Pro (explicit), JD, Classic | Audio and “whose crib?” clarity are what make a digital board feel like a table. |
| **Responsive / large-card mobile layout** | JD (signature), Pro, Classic apps | “All ages” fails if cards are 150px desktop-only. JD’s whole brand is “Grandpa can see the cards.” |
| **Fair-shuffle credibility** | Pro publishes audits; Classic states “cards are random at every difficulty” | Store reviews for Pro *and* JD are dominated by “the computer is dealt monsters.” A newcomer that cannot *show* fairness will inherit the same distrust. |
| **Play with a friend (even a room code)** | Pro, JD, WoCG, CardGames.io | Your own future-multiplayer note. The market already treats this as baseline, not a differentiator. |

### 2.2 Differentiator features competitors are missing

These are openings — things incumbents do poorly, do not do, or have trained players to dislike.

1. **Published, inspectable fairness.** Pro has to *defend* randomness in every store reply. JD is widely accused of juiced deals. Classic is better but does not make fairness a brand. CribbageX can: seed display, hand-history export, published expected-score distributions, optional “show remaining deck after the game.” Trust is an unowned brand in this category.
2. **Coach-grade analysis (leapfrog Classic).** Classic has the discard analyzer and post-game “you left 10.1 points on the table.” Nobody has a *modern* version: EV heatmaps, “this discard protects the crib vs. poisons it,” pegging-tree explorer, spaced-repetition of the hands you misplayed. That is a specialist wedge for “all talents.”
3. **Ad-free, no-account, no-IAP default.** Every popular product is monetized with ads or coins. A clean local-first web app is a real contrast for older players and for classrooms / clubs.
4. **Transparent AI, not a black box.** Classic already documents Easy / Standard / Pro strategy in plain language. Almost nobody else does. Ship named AIs (“Kitchen Table,” “Club Regular,” “Match Player”) with the exact heuristic written in Settings. Players who distrust “Brutal” will trust an AI they can read.
5. **Rule variants as first-class settings.** 61-point / 121-point games, 3- and 4-player (including partnership), captain / loser-crib house rules, stinkhole, muggins on/off. CardzMania is the only browser product known for configurable rules; Steam’s *Cribbage!* will add 4-player if it ships. Variants are how a late entrant serves kitchen-table groups that Pro ignores (Pro is 2-player 121).
6. **Accessibility as a product, not a theme.** JD won mobile on large cards. The rest of the category is weak on: high-contrast decks, color-blind suits, screen-reader announcements of the count, reduced-motion pegging, keyboard-only play. This matches “all ages” better than another avatar pack.
7. **Club / kitchen-table multiplayer, not ACC seasons.** Do not try to become the next sanctioned rating system. Ship: private room codes, pass-and-play on one device, later optional accounts. Let Pro keep the tournament grind.
8. **Open or exportable practice tools.** A “quiz this 6-card hand” mode and a shareable analyzer URL would travel in cribbage Facebook groups and Reddit in a way another themed board will not.

### 2.3 Prioritized roadmap matrix

#### Short-term — quick wins / catch-up (1–2 cycles)

Goal: a first-time player can finish a game, understand the score, and want a rematch. Reach **parity with a thin Cribbage Classic**.

| Priority | Feature | Competitor proof | Why now |
| --- | --- | --- | --- |
| P0 | **Post-game recap** — final scores, skunk/double-skunk, hand / crib / peg totals, Play Again | Classic, Pro, JD | Turns a prototype into a session. |
| P0 | **Scoring breakdown on the show** — 15s, pairs, runs, flush, nobs listed under each hand | JD, Classic | Teaches the game; you already compute `scoreHand`. |
| P0 | **2–3 AI difficulties** — Easy (weaker / noisier), Standard (current), Strong (full EV you already have) | All three solo apps | Unlocks the “all talents” claim without new systems. |
| P1 | **First-game tutorial overlay** — discard, pegging to 31, show, crib, skunk | Classic | Required for new players; keep it skippable. |
| P1 | **Pegging hint + discard hint** — extend Auto Select; explain *why* in one sentence | Pro, Classic | Auto Select is a hidden power-user control; surface it as Coach. |
| P1 | **Whose crib / whose turn / count-to-31 chrome** | Pro “clear dealer indicator” | Reduces the #1 confusion in digital cribbage. |
| P1 | **Local stats** (localStorage) — W/L, skunks, avg hand/crib/peg | Classic, JD | Retention with no backend. |
| P2 | **Sound toggle** (deal, peg, 15, 31) and a high-contrast / large-card layout | JD, Pro | Cheap perceived quality; required for older players. |
| P2 | **Fairness note in Settings** — “same shuffle at every difficulty; only the AI strategy changes” | Classic’s published copy; Pro’s audit posture | Start the trust story before anyone asks. |

#### Medium-term — competitive parity / enhancements (next product chapter)

Goal: win the **practice / learning** comparison against Cribbage Classic and become a credible *solo* alternative to JD.

| Priority | Feature | Competitor proof | Why this phase |
| --- | --- | --- | --- |
| P0 | **Manual count + muggins** | Pro, Classic | Purists and clubs will not take a digital board seriously without it. |
| P0 | **Discard analyzer** (offline tool: pick 6 cards, see EV of every pair) | Classic’s signature feature | This is the feature learners tell other learners about. You already have the EV math. |
| P1 | **Post-game coach** — “N suboptimal discards, X expected points left behind” | Classic | Retention *and* a reason to return that is not a leaderboard. |
| P1 | **Named, documented AIs** with the strategy printed in-app | Classic (unique); Pro/JD are opaque | Trust + teaching in one move. |
| P1 | **61-point games, optional game-to-N** | Common kitchen-table request; missing from most apps | Faster sessions; better for teaching. |
| P1 | **Responsive mobile web / PWA** | JD, Pro, Classic apps | Distribution without store tax; matches how Classic grew. |
| P2 | **Themes that are readable, not just decorative** — boards, decks, plus color-blind suits | Pro/JD cosmetics; nobody owns accessibility | Differentiation without a live-ops cosmetics shop. |
| P2 | **Hand history + rematch from a seed** | Almost nobody | Supports fairness claims and “show me that deal again.” |
| P2 | **Pass-and-play (hot-seat)** on one device | Rare in this category | Family table without a server. |

#### Long-term — strategic differentiators / innovation

Goal: occupy a **durable niche** Pro will not abandon ACC for, and JD will not rebuild around.

| Priority | Feature | Why it leapfrogs |
| --- | --- | --- |
| D1 | **Private multiplayer: room codes, then optional accounts** | Matches the original “maybe later” vision without pretending to be ACC. WoCG and CardGames.io prove room codes are enough for friends. |
| D1 | **Public fairness pack** — shuffle algorithm write-up, optional third-party audit, remaining-deck reveal, exportable logs | Direct answer to the category’s #1 complaint. Becomes marketing, not just engineering. |
| D2 | **3- and 4-player + partnership cribbage** | Steam *Cribbage!* is the only upcoming product advertising this. Kitchen tables are often four people. Pro and JD are 2-player products. |
| D2 | **Coach platform** — saved mistake library, daily “one hard discard,” shareable analyzer links | Turns CribbageX from a game into the place people *get better*. Classic sketched this; a modern UX can own it. |
| D3 | **Club / classroom mode** — projector-friendly board, teacher-controlled pace, no chat toxicity | Schools, senior centers, ACC grassroots clubs. Zero incumbents design for this. |
| D3 | **Watch Steam *Cribbage!*** (Q3 2026)** | If it ships a good 4-player desktop client, do not fight it on Steam cosmetics. Stay web/practice/club. If it slips or ships thin, 4-player web becomes more valuable. |

---

## 3. Implications for a roadmap discussion

### Do not try to win

- **Sanctioned competition.** Cribbage Pro + ACC (2026–27 Season 1) closed that door. Building matchmaking, IRP, and season ops is a company, not a catch-up feature.
- **A cosmetics / coin economy.** JD and Pro already trained players to resent it.
- **“Users of all ages” as a feature list.** That audience is served by *difficulty + tutorial + large cards + no ads*, not by claiming universality.

### Do try to win

1. **Session quality** (short-term): a finished, explained, rematchable solo game.
2. **Trust + teaching** (medium-term): Classic’s analyzer and published AI, with a modern UI and a fairness brand Pro/JD cannot credibly reset.
3. **Kitchen-table multiplayer** (long-term): room codes, pass-and-play, then 3/4-player — not a global rating ladder.

### Suggested north-star metric

Until multiplayer exists, measure **completed games per new visitor** and **share of games played on Easy vs Strong**. If Easy is unused, the tutorial failed. If nobody finishes, the UX failed. Those two numbers tell you whether CribbageX is becoming a product or remaining a kernel.

### One-line summary for the next planning meeting

CribbageX is a **solid rules engine with a prototype shell**, facing a market that already has a tournament incumbent (Pro), a mobile casual incumbent (JD), and a teaching incumbent (Classic). The open seat is **ad-free, fair, coach-quality practice in the browser**, with friend play added only after the solo game can teach and retain.

---

## Appendix: source notes

- Cribbage Pro features, platforms, and monetization: [cribbagepro.net](https://www.cribbagepro.net/), Mac App Store listing (~$4.99, 4.4★), Google Play (~4.5★, 1M+ installs, updated Aug 2026).
- ACC sanction of Cribbage Pro Competitive Matchmaking, 2026–27 Season 1: [Cribbage Pro blog](https://blog.cribbagepro.net/2026/07/competitive-cribbage-2026-27-season-1.html) and [cribbage.org](https://www.cribbage.org/internet/cribbagepro_info.php).
- Cribbage JD features and reach: [cardsjd.com/cribbage](https://cardsjd.com/cribbage/), Google Play (100k+ installs, ~4.6★), store copy on difficulties and stats.
- Cribbage Classic teaching features and AI documentation: [cribbageclassic.com](https://cribbageclassic.com/) (live product, September 2026).
- World of Card Games volume and modes: [worldofcardgames.com/cribbage](https://worldofcardgames.com/cribbage) (stats updated August 2026).
- CardGames.io browser lobby / private tables: [cardgames.io/cribbage](https://cardgames.io/cribbage/).
- Steam watch item: [Cribbage! (app 4984120)](https://store.steampowered.com/app/4984120/Cribbage/), Q3 2026, F2P, 2–4 player.
- Category roundup used for landscape check: [Rare Pike, “5 Best Sites to Play Cribbage Online Free in 2026”](https://rarepike.com/best-sites-to-play-cribbage-online/).
- CribbageX capabilities inferred from this repo (v0.2.0): `src/Cribbage.tsx`, `src/app/game.ts`, `src/app/gamePlayer.ts`.
