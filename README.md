# Jerry Cusick website

Concept site for Jerry Cusick, Colorado mortgage loan officer. Work happens on `preview`; `main` is what the public link serves. The prototype banner and `noindex` stay on until Jerry and IMB compliance approve.

## What is here

- `index.html` and `img/`: the site, including the payment and income estimate calculator.
- `admin/`: Jerry's private traffic page (password protected, counts only).
- `api/lead.js`: receives a form or calculator lead and forwards it to the CRM webhook. Nothing is stored or logged.
- `api/track.js`: anonymous counters (visit, calculator start, calculator hand-off).
- `api/stats.js`: numbers for the admin page.

## Settings (Vercel project, Environment Variables)

Values live only in Vercel. Never commit them.

| Name | What it does |
| --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Added automatically when an Upstash Redis store is connected to the project from Vercel Storage. Holds the daily counters. |
| `ADMIN_PASSWORD` | Password for `/admin/`. |
| `GHL_WEBHOOK_URL` | Inbound webhook URL from a GoHighLevel workflow. Every lead is posted here as JSON. |

Until these are set the site still works: the form tells visitors to call or text Jerry instead of pretending it sent, and the admin page says it is not connected.

## Lead fields sent to the webhook

`full_name`, `first_name`, `last_name`, `phone` (+1XXXXXXXXXX), `journey_stage`, `best_time`, `calculator_summary`, `lead_source` (`Website form` or `Website calculator`), `consent_to_contact`, `consent_text`, `page`, `submitted_at`.
