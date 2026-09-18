# Hoe een agent deze MCP-server gebruikt

**Verbinding:** stdio, via `dist/index.js`, gestart met env vars
`CANVAS_BASE_URL` en `CANVAS_ACCESS_TOKEN`. Portflow heeft geen aparte
secrets nodig — dat loopt via LTI 1.3 OIDC in dezelfde sessie.

**Gebruik:** de agent roept een tool aan met parameters zoals `course_id`,
`assignment_id` of `student_id`, zoals elke andere MCP-tool.

## Canvas (read-only)
Cursusinfo, planning en voortgang: `canvas_list_courses`,
`canvas_get_assignment_details`, `canvas_list_submissions`,
`canvas_get_upcoming_deadlines`, `canvas_get_week_overview`,
`canvas_get_deadline_burndown`, e.a. (zie `docs/mcp-tools.md`).

## Portflow (lezen + schrijven)
- `portflow_list_goals` / `portflow_get_snapshot` / `portflow_list_snapshots` — lezen
- `portflow_add_evidence` / `portflow_update_collection` — bewijs koppelen aan een leerdoel
- `portflow_submit_snapshot` — snapshot indienen

## Typische flow
1. Canvas-tools gebruiken om opdracht/inleverdata op te halen
2. `portflow_list_goals` om het juiste leerdoel te vinden
3. `portflow_add_evidence` om het bewijsstuk te koppelen
4. Optioneel `portflow_submit_snapshot` om in te dienen
