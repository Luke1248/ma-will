# Realpolitik

An original seven-power game of negotiation and simultaneous movement, built as an
installable iOS web app (PWA). Secret orders, supports, convoys, retreats, builds,
non-binding diplomacy. Any mix of human and AI players on one device.

Not affiliated with any published board game. Map, names and code are original.

## Play

Deployed by GitHub Pages at `https://<user>.github.io/<repo>/realpolitik/` once this is
on `main`. Open it in Safari on the iPhone, then Share → **Add to Home Screen**.
It runs full-screen and works offline (engine opponents need no network).

Local: `cd realpolitik && python3 -m http.server 8000`, open `http://localhost:8000`.

## The game

Spring and Fall movement, retreats, then winter builds/disbands. Powers have editable
names, colours and emblems (emoji or uploaded image). Choose the map at setup:

- **The Ring**: a ring continent around an Inner Sea, with an Outer Ocean (the two do
  not connect). 71 provinces, 35 supply centres, 18 to win. Seven rotationally
  identical sectors, so every power starts equal.
- **Indochina 1965**: mainland Southeast Asia in the Vietnam War era. 83 provinces,
  34 supply centres, 18 to win. Powers: North Vietnam, South Vietnam, United States
  (Da Nang, Cam Ranh Bay, Subic Bay), Laos, Cambodia, Thailand, China. Provinces are
  real places at their real coordinates, but borders are Voronoi cells, so coastlines
  are stylised, and the open sea is compressed so Subic Bay sits at the eastern edge.
  Starts are historical and **not balanced**: in 28 Normal-engine self-play games the
  wins were United States 8, China 8, North Vietnam 4, Cambodia 4, South Vietnam 1,
  Thailand 1, Laos 0 (2 unfinished). Take Laos or Thailand if you want it hard.

Simplifications versus the genre's usual rules: provinces have a single coast, and an
army ordered to a non-adjacent coast is convoyed automatically if fleets order it.

## Opponents

Each power is set independently at game setup.

| Mode | What it does | Needs |
| --- | --- | --- |
| Human | Pass-and-play with a hand-over screen hiding orders and messages | nothing |
| Engine (Easy / Normal / Hard) | Tactical search: candidate order sets scored by adjudicating against sampled plans of all other powers, refined by rounds of best response. Scripted diplomacy: formal peace/alliance pacts, grudges, stop-the-leader, occasional betrayal | nothing, offline |
| LLM | Free-text negotiation with memory, secret stances that steer the tactical engine, and the model's final pick (with overrides) among the engine's best order sets | a model endpoint |

Measured: one Hard engine against six Easy engines won 10 of 14 games (chance is 2).
`node tests/strength.mjs` reproduces it. There is no measurement against strong human
players; treat the engine as a competent tactician, not an expert-level one.

## Models

**AI models** on the home screen holds profiles (endpoint + key + model). Different
powers can use different profiles.

- **Anthropic**: native Messages API. Default `claude-opus-5-5`.
- **OpenAI-compatible**: OpenAI, OpenRouter, Groq, Together, Gemini's compat endpoint,
  or any custom URL. OpenRouter/Groq/Together serve open-weight models.
- **Local** (Ollama, LM Studio, llama.cpp, vLLM): two browser constraints apply.
  1. The installed app is served over HTTPS, and browsers block calls from an HTTPS
     page to `http://` addresses. Put the model server behind HTTPS, e.g.
     `tailscale serve --bg 11434` on the machine running Ollama, then use
     `https://<machine>.<tailnet>.ts.net/v1` as the base URL.
  2. Allow the app's origin in CORS, e.g. `OLLAMA_ORIGINS=https://<user>.github.io ollama serve`.
  When the page itself is served from `http://localhost`, `http://localhost:11434/v1` works directly.

Keys are stored in this device's `localStorage` and sent only to the endpoint in the
profile. That is acceptable for a personal app; do not host a copy for other people.

Cost: per LLM power per movement season, one call per negotiation round, one per reply
to a human message, and one for the final orders (optional). Six LLM powers at one
round is about 12 calls a season.

## Limits

- No online multiplayer; humans share one device.
- Engine powers do not read free text, only formal proposals. The chat says so.
- A web app, not an App Store binary. Wrapping it for TestFlight needs a Mac and Xcode.

## Development

No build step, no dependencies.

```
node tests/rules.test.mjs     # adjudicator and turn cycle
node tests/sim.mjs 3 hard     # engine self-play to completion (add `vietnam` for the other map)
node tests/strength.mjs 14    # Hard vs six Easy
```

`js/map.js` geometry · `js/rules.js` adjudication · `js/ai.js` engine ·
`js/llm.js` providers · `js/game.js` diplomacy and turn flow · `js/ui.js` interface.
