import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = [
    ROOT / "n8n-import" / "AI-tutor-workflow-runtime-fixed.json",
    ROOT / "n8n-import" / "docker-ready" / "AI-tutor-workflow-runtime-fixed.json",
]

WORKER_URL = (
    "={{ (() => { const interaction = String($node['Set - Trace Context'].json.interactionType || '').trim().toUpperCase();"
    " const mode = (interaction === 'UNDERSTANDING_REMEDIATION' || interaction === 'GUIDED_LESSON') ? 'RAG'"
    " : String(($json.mode || ($json.body && $json.body.mode) || 'RAG')).trim().toUpperCase();"
    " const workerPath = mode === 'REFUSE' ? '/api/tutor/workers/refuse'"
    " : (mode === 'CURRICULUM' ? '/api/tutor/workers/curriculum' : '/api/ai/query');"
    " const ctx = $node['Set - Trace Context'].json;"
    " return 'http://ai-tutor-api:8085' + workerPath + '?userId=' + encodeURIComponent(ctx.studentId || '')"
    " + '&userName=' + encodeURIComponent(ctx.studentName || '') + '&userEmail=' + encodeURIComponent(ctx.studentEmail || ''); })() }}"
)

CLASSIFIER_MODE = (
    "={{ ['UNDERSTANDING_REMEDIATION', 'GUIDED_LESSON'].includes(String($node[\"Set - Trace Context\"].json.interactionType || '').trim().toUpperCase())"
    " ? 'RAG' : String($json.mode || $json.body?.mode || '').trim().toUpperCase() }}"
)

REFUSE_EXPR = (
    "={{ ['UNDERSTANDING_REMEDIATION', 'GUIDED_LESSON'].includes(String($node[\"Set - Trace Context\"].json.interactionType || '').trim().toUpperCase())"
    " ? 'OTHER' : ((String($json.mode || $json.body?.mode || '').trim().toUpperCase() === 'REFUSE'"
    " || String($json.subIntent || $json.body?.subIntent || '').trim().toUpperCase() === 'OFF_TOPIC') ? 'REFUSE' : 'OTHER') }}"
)

CURRICULUM_EXPR = (
    "={{ ['UNDERSTANDING_REMEDIATION', 'GUIDED_LESSON'].includes(String($node[\"Set - Trace Context\"].json.interactionType || '').trim().toUpperCase())"
    " ? 'OTHER' : (String($json.mode || $json.body?.mode || '').trim().toUpperCase() === 'CURRICULUM' ? 'CURRICULUM' : 'OTHER') }}"
)


def patch(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    for node in data["nodes"]:
        if node.get("name") == "Course RAG Query":
            node["parameters"]["url"] = WORKER_URL
            body = node["parameters"]["jsonBody"]
            needle = "harnessMode: 'RAG'"
            if needle not in body:
                raise SystemExit(f"harnessMode needle missing in {path}")
            body = body.replace(
                needle,
                "harnessMode: ((['UNDERSTANDING_REMEDIATION','GUIDED_LESSON'].includes(String($node['Set - Trace Context'].json.interactionType || '').trim().toUpperCase())) ? 'RAG' : String(($json.mode || ($json.body && $json.body.mode) || 'RAG')).trim().toUpperCase()), harnessRoutingStrategy: String($json.routingStrategy || 'N8N_HARNESS')",
                1,
            )
            node["parameters"]["jsonBody"] = body
        if node.get("name") == "Respond RAG":
            body = node["parameters"]["responseBody"]
            body = body.replace(
                'mode: "RAG_TUTOR"',
                'mode: $node["Course RAG Query"].json.mode || "RAG"',
            )
            if "routingStrategy:" not in body:
                body = body.replace(
                    "subIntent:",
                    'routingStrategy: $node["Course RAG Query"].json.routingStrategy || null,\n  subIntent:',
                    1,
                )
            node["parameters"]["responseBody"] = body
        if node.get("name") == "Switch2":
            rules = node["parameters"]["rules"]["values"]
            first = rules[0]
            first["conditions"]["conditions"][0]["leftValue"] = REFUSE_EXPR
            first["conditions"]["conditions"][0]["rightValue"] = "REFUSE"
            first["outputKey"] = "REFUSE"
            if not any(rule.get("outputKey") == "CURRICULUM" for rule in rules):
                curriculum = json.loads(json.dumps(rules[1]))
                curriculum["outputKey"] = "CURRICULUM"
                curriculum["conditions"]["conditions"][0]["id"] = "harness-curriculum-route"
                curriculum["conditions"]["conditions"][0]["leftValue"] = CURRICULUM_EXPR
                curriculum["conditions"]["conditions"][0]["rightValue"] = "CURRICULUM"
                rules.insert(1, curriculum)
            for rule in rules:
                if rule.get("outputKey") in {"CODE", "ESCALATE", "RAG"}:
                    rule["conditions"]["conditions"][0]["leftValue"] = CLASSIFIER_MODE

    link = lambda name: [{"node": name, "type": "main", "index": 0}]
    data["connections"]["Switch2"]["main"] = [
        link("Course RAG Query"),
        link("Course RAG Query"),
        link("Code Mentor Query"),
        link("Create Escalation"),
        link("Course RAG Query"),
        link("Course RAG Query"),
    ]
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    keys = [rule.get("outputKey") for rule in next(n for n in data["nodes"] if n["name"] == "Switch2")["parameters"]["rules"]["values"]]
    print(path.name, keys, "outputs", len(data["connections"]["Switch2"]["main"]))


if __name__ == "__main__":
    for workflow in FILES:
        patch(workflow)
