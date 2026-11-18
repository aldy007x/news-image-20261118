# news-image-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/aldy007x/news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/aldy007x/news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**The World Today — Wednesday 18 November 2026 in one picture.** A program that draws a
newspaper front page summing up the day's world news, entirely in code: its own software
rasteriser, a hand-built stroke font, flat-colour scenes per story, and its own PNG encoder.
No network, no clock, no randomness — two runs write the same bytes.

The front page for 18 November 2026 (v2 — the whole day, updated to the evening):

- **Lead** — Ukraine's record drone storm: 1,441 drones over 22 regions, a second straight
  daily record, and the Crimean Bridge hit again — its 227-metre road arch in the Kerch
  Strait, rail stopped, the Azov shipping channel blocked. Zelenskyy calls it a seven-stage
  operation won with Ukrainian weapons; Russia pounds Kyiv's bridges in reply.
- **Middle East** — US jets strike an IRGC missile site on Qeshm Island after IRGC drones
  target the US radar at Bahrain's Sheikh Isa base — the third such raid in five days, all
  intercepted; Bahrain and Kuwait turn back fresh waves, three US carrier groups in region.
- **Asia** — the Quad's first leaders' meeting in two years, in Manila: maritime patrol
  flights, undersea cables and AI agreed; Trump signs a Thailand trade deal and meets
  Marcos. On Thursday, Trump, Xi and Putin meet in Shenzhen at APEC.
- **Markets** — Wednesday's close: S&P 500 7,340.53 −1.03% · Nasdaq 24,328.38 −0.74% ·
  FTSE 100 10,689.87 −1.76% · DAX 26,045.37 −2.08% · CAC 40 8,216.78 −1.62% · Nikkei 225
  59,024.28 +0.28% · Hang Seng 23,297.16 −0.90% · Brent $91.55 −1.71% · Gold $3,775 −2.31% ·
  VIX 25.46 +11.13%.
- **In brief** — Peltola wins Alaska's Senate seat, Democrats reach 56 (AP) · Israel's
  president taps Eisenkot to form a government, passing over Netanyahu; Kahana is speaker
  66–52 · Ebola in DR Congo more than doubles: 11,000 cases, 5,400 dead (UN) · the US loses
  its measles-free status after 26 years: 5,400 cases, 10 deaths (CDC) · 19 dead as a
  Russian military plane crashes in Siberia · Zverev beats Shelton to reach the ATP Finals
  semi-finals, Fils wins his first Finals match.
- **Weather** — Cyclone Akvan turns severe in the Bay of Bengal: IMD red warning, landfall
  due Friday noon on the Andhra coast · Category 5 Cyclone Xavier hits the Northern Cook
  Islands · a 6.0 quake rocks Papua New Guinea · COP31 runs on in Antalya.
- **Ticker** — the World Court rules Thursday on the Myanmar genocide case · Australia,
  Canada, Italy and the UK urge Israel to open every Gaza crossing · France sees a fourth
  weekend of living-cost protests.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` — a 1024×1024 PNG, well under the 1 MiB gate.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
