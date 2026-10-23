module.exports = { motion: false, minutes: 20, slides: [
  { layout: "title", title: "Observability overhaul", subtitle: "From dashboards nobody opened to alerts people trust", footer: "SRE guild · 2026-10-14" },
  { layout: "section", kicker: "PART ONE", title: "Where the pages came from" },
  { layout: "image-caption", src: "../charts/heatmap.svg", alt: "Heatmap of support tickets by weekday and hour", caption: "Tickets by weekday and hour, last 90 days. Weekday afternoons carry the load; weekends stay under ten per slot." },
  { layout: "bigNumber", figure: "42", unit: "%", label: "of pages in Q2 were for alerts that auto-resolved within five minutes", context: "1,920 pages reviewed. Source: on-call tooling export, 2026-07." },
  { layout: "card-row", kicker: "THE FIX", title: "Three rules for every alert", cards: [
    { heading: "A runbook or it doesn't page", body: "Every paging alert links to a runbook with a first command to run." },
    { heading: "Symptoms, not causes", body: "Page on user-visible latency and errors. Causes go to a ticket queue." },
    { heading: "Owned by a route", body: "Each alert names the team that owns the route, not the service." } ] },
  { layout: "bullets", title: "What we'll watch next quarter", items: ["Pages per on-call week, target ≤ 3", "Time from page to runbook opened", "Alerts deleted vs alerts added", "Error budget burn by route, weekly"] },
]};
