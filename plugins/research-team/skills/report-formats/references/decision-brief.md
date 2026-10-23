# Decision brief

For a reader who has to choose and wants a recommendation with its reasoning. Lead with the recommendation, then the evidence. A reader who stops after the first paragraph still has the answer.

## Sections

1. **Recommendation.** One paragraph: what to do, the main reason, and the biggest risk.
2. **The decision.** What's being decided, by when, and what's fixed (budget, platform, team size). Take these from the request; don't invent constraints.
3. **Options considered.** One short section per option: what it is, its strengths (give the real reasons a team would pick it), its specific weakness for this decision, and the cost. Cite each fact.
4. **Why this option.** The two or three criteria that decided it, with the evidence for each. Say what would change the recommendation.
5. **Risks and how to check them.** For each risk, the cheap experiment or question that would retire it.
6. **Sources.**

## Example skeleton (Markdown profile)

```markdown
# Should we move the job queue to Redis Streams or keep RabbitMQ?

**Recommendation:** keep RabbitMQ for now, because …; revisit when …

## The decision

## Options considered
### Redis Streams
### RabbitMQ (current)
### Kafka

## Why RabbitMQ

## Risks and how to check them

## Sources
```
