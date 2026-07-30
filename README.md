# ai-schema-locked-extractor

[![Boring AI](https://img.shields.io/badge/Boring%20AI-Project%201%2F15-111111)](https://github.com/)

> Everyone's LLM demo returns JSON until the day it doesn't — this CLI makes the schema decide.

**Boring AI** — *systems that do the work, not the talking.*

A CLI that turns messy real-world text (receipts, job postings, meeting notes) into JSON that is guaranteed to match a declared Zod schema, or fails loudly with the reason. Uses Ollama constrained decoding (`format` = JSON Schema), validates again in application code, and retries at most twice by feeding the validation error back to the model.

## Quick start

```bash
# 1. Start Ollama (skip if you already have Ollama on :11434)
docker compose up -d
docker compose exec ollama ollama pull qwen2.5:3b
# Or with a host install: ollama pull qwen2.5:3b

# 2. Install & run
pnpm install
cp .env.example .env

# Single file
pnpm extract samples/receipt/01.txt --type receipt

# Reproduce README numbers (30 docs)
pnpm samples
```

Requires Node 24+ and Ollama on `OLLAMA_HOST` (Docker Compose or a local install). No cloud API key needed.

## Demo

*(asciinema / GIF placeholder — record a 20s extract run here)*

## The problem

Unstructured extraction demos look fine in a screenshot. In production, the model invents fields, drops required keys, or returns almost-JSON. Treating structured output as a **data contract** — constrained decode → schema validate → business rules, with a capped repair loop — is what keeps downstream systems from silently accepting garbage.

## Architecture

```
raw text file(s)
      |
      v
[ prompt builder ]---> Zod schema (single source of truth)
      |                        |
      v                        v
[ Ollama /api/chat  format=JSON Schema, temp=0 ]
      |
      v
[ parse ] --fail--> [ repair loop (max 2) ] --exhausted--> reject + reason
      |
      v
[ schema validate: Zod ]
      |
      v
[ business rules: totals, dates, enums ]
      |
      +--> validated JSON (stdout / .json)
      +--> metrics.json (pass rate, attempts, rule failures)
```

## Numbers

Measured on 2026-07-31 with `pnpm samples` against local Ollama `qwen2.5:3b` (30 documents):

| Metric | Value |
|--------|-------|
| Schema pass rate | **100%** (30/30) |
| Business-rule failure rate | **6.7%** (2/30 — intentional edge cases: bad receipt total, due-before-meeting) |
| Avg attempts per success | **1.000** |
| Model | `qwen2.5:3b` |

Reproduce: `pnpm samples` → writes `metrics.json`.

## Document types

| `--type` | Fields (flat / 2-level) | Business rules |
|----------|-------------------------|----------------|
| `receipt` | vendor, date, line_items, tax, total | sum(lines)+tax ≈ total; date not future |
| `job_posting` | title, company, location, employment_type, salary_*, requirements | min ≤ max when both set |
| `meeting_notes` | title, date, attendees, decisions, action_items | ≥1 attendee; due ≥ meeting date |

## CLI

```bash
pnpm extract <file> --type <receipt|job_posting|meeting_notes> [--out out.json] [--metrics metrics.json]
pnpm samples   # batch all samples → metrics.json
```

Failures print which layer failed (`decode` | `schema` | `business_rule`) and the offending field.

## Known failure modes

- Small local models (`3b`) struggle with messy currency phrasing; the repair loop usually recovers schema shape but not always business totals.
- Deeply nested schemas are intentionally avoided — flatten instead of escalating model size.
- Business-rule failures after a schema pass are reported separately and do not consume repair attempts.

## What I'd do next

- Pin a golden expected-JSON set and add a CI smoke against Ollama.
- Wire this extractor into Project 7 (document intake) as the extraction primitive.
- Cloud provider swap via `LLM_PROVIDER` once Project 5's meter exists.

## Series

**Boring AI — Project 1/15**

- Previous: — (first)
- Next: [`ai-triage-router`](https://github.com/) (Project 2)
