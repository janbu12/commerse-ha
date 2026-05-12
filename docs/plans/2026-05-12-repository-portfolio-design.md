# Repository Portfolio Design

**Goal:** Turn this workspace into a clean portfolio repository with focused commits, clear ignore rules, and a README that explains the HA backend and observability stack.

**Approach:** Keep the application and infrastructure code as the baseline, then separate repository hygiene and documentation into their own commits. Reference the existing screenshots in `docs/` so reviewers can understand the architecture, Prometheus targets, and Grafana dashboard without running the stack first.

**Commit Shape:**
- `chore: initialize repository hygiene` for `.gitignore`, `.dockerignore`, and Git setup.
- `docs: add portfolio project overview` for the README rewrite.
- `docs: add repository planning notes` for this design and implementation plan.
- `chore: add application and infrastructure baseline` for the source, infra, tests, and docs assets.

**Success Criteria:**
- Runtime/generated files such as `node_modules/`, `dist/`, `.env`, logs, and coverage are not tracked.
- README shows what the project is, how the HA stack works, how to run it, how to test it, and where to inspect Grafana/Prometheus/Loki.
- README embeds useful images from `docs/`.
- Fresh verification commands run before the final report.
