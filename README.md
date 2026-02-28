# Stealth Presenter Coach (MVP)

A real-time public speaking coaching web app MVP.



<p align="center" width="100%">
<video src="https://github.com/user-attachments/assets/634a8ee7-fa6f-459e-a887-d7102cf0058f" width="80%" controls></video>
</p>



## Stack

- `client/`: React + Vite + TypeScript
- `server/`: Node.js + Express + TypeScript
- Monorepo using npm workspaces

## Run

```bash
npm install
npm run dev
```

- Client: `http://localhost:5173`
- Server: `http://localhost:3001`

## Routes

- `/session` - teleprompter + live metrics
- `/report` - post-session report

## Works without transcription

- Volume analysis (RMS/dB)
- Pause/silence detection
- Heuristic `Tempo Index`
- Coaching hints: `QUIET`, `LOUD`, `LONG_PAUSE`, `NO_PAUSE_TOO_LONG`, baseline `FAST/SLOW` (via tempo index)
- Report with audio metrics and mock summary

## Requires SpeechRecognition

- WPM (words per minute)
- Filler word counting and filler hints
- Full transcript in the report
- More precise structure analysis from text

## Calibration

The `Calibrate 3s` button samples RMS for 3 seconds and updates thresholds:

- `quietRms = baseline * 0.65`
- `loudRms = baseline * 2.2`

## LLM integration

The server uses an `LLMProvider` interface:

- Default: `MockProvider`
- `RealProvider` is prepared for real provider integration (`server/src/providers/realProvider.ts`)

Switch via environment variables:

```bash
LLM_PROVIDER=real
LLM_API_KEY=...
```

## API

`POST /analyze`

```json
{
  "transcript": "...",
  "metrics": {
    "avgWpm": 130,
    "avgTempoIndex": 145,
    "pauseCount": 8,
    "avgPauseMs": 690,
    "avgDb": -21
  },
  "events": [{ "type": "pause_start", "t": 1200 }]
}
```

Response:

```json
{
  "summary": "...",
  "fillerStats": { "um": 3 },
  "trainingPlan": ["..."]
}
```
