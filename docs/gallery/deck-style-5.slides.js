module.exports = { motion: false, minutes: 30, slides: [
  { layout: "title", title: "Sustainability roadmap 2027", subtitle: "Compute, carbon and cost in one plan", footer: "Infrastructure · Draft for review" },
  { layout: "image-caption", src: "../charts/sankey.svg", alt: "Sankey diagram of visitors by source and outcome", caption: "Where sessions come from and where they end up. Organic converts best; paid carries the most bounces." },
  { layout: "card-row", kicker: "THREE LEVERS", title: "Where the savings are", cards: [
    { heading: "Right-size", body: "Batch jobs run on 2× the CPU they use. Autoscaling on real load saves 18%." },
    { heading: "Move the clock", body: "Nightly jobs shift to the hours when the grid is cleanest. Same cost, 31% less carbon." },
    { heading: "Retire", body: "Four reporting services nobody opened in 90 days. Off in November." } ] },
  { layout: "bigNumber", figure: "31", unit: "%", label: "less carbon per batch job after moving to low-intensity hours", context: "Measured over 6 weeks on the nightly ETL. Source: provider carbon API." },
  { layout: "image-caption", src: "../charts/dumbbell.svg", alt: "Dumbbell chart of p95 latency before and after the cache", caption: "p95 latency before and after the cache, per service. Every service fell; checkout the most." },
  { layout: "quote", quote: "The cheapest compute is the job you stopped running.", attribution: "— Head of infrastructure, planning offsite" },
]};
