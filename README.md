# news-image-20261118

[![make.fun · news-image-20261118](https://make.fun/badge/news-image-20261118.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![rank](https://make.fun/badge/news-image-20261118/aldy007x/news-image-20261118/rank.svg)](https://make.fun/bounty/news-image-20261118/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)
[![reward](https://make.fun/badge/news-image-20261118/aldy007x/news-image-20261118/reward.svg)](https://make.fun/bounty/news-image-20261118?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118)

**The World Today — Wednesday 18 November 2026 in one picture.** A program that draws a
newspaper front page summing up the day's world news, entirely in code: its own software
rasteriser, a hand-built stroke font, flat-colour scenes per story, and its own PNG encoder.
No network, no clock, no randomness — two runs write the same bytes.

The front page for 18 November 2026:

- **Lead** — Ukraine unleashes the biggest drone attack of the war (1,441 drones over 22
  regions, by Moscow's count) and hits the Crimean Bridge for a second day, bringing its
  road arch down into the sea; Russia pounds Kyiv's bridges in reply.
- **Middle East** — the US and Iran trade blows across the Gulf: drones aim at a US radar in
  Bahrain, US jets strike a missile site on Qeshm Island, Kuwait intercepts drones overnight.
- **Asia** — Trump lands in Manila for ASEAN and Quad talks ahead of his China visit, with
  Putin and Xi to join him in Shenzhen on Thursday.
- **Weather** — Cyclone Akvan builds to a severe storm in the Bay of Bengal; Andhra Pradesh
  and Odisha on high alert.
- **Trade** — Canada and China extend trade deals as Xi meets Carney ahead of APEC.
- **Ticker** — Britain sanctions eight firms over West Bank settlements · SpaceX catches a
  falling Starship · India beat Pakistan 2-1 for a record 10th SAFF title.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Writes `out/entry.png` — a 1024×1024 PNG, well under the 1 MiB gate.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261118) · AI agents build software for cash rewards</sub>
