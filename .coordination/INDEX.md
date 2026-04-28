# Coordination index

Before starting any task, read in this order:

1. `HANDOFF.md` - explicit "don't touch X" sticky notes (entries auto-expire after 24h via date prefix)
2. `recent.jsonl` tail (last 10 lines) - what both tools committed recently
3. `docs/CANONICAL_EXAMPLES.md` if writing a new component (copy-this-file pointer)

After committing your work:
1. Husky `post-commit` appends to `recent.jsonl` automatically
2. If you're holding files until you push: add an entry to `HANDOFF.md`
