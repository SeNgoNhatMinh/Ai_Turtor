#!/usr/bin/env python3
"""Rewrite n8n workflow JSON so every cloud chat-model node uses local Ollama.

Usage: python3 -I n8n_use_ollama.py IN.json OUT.json [model]

Node name, position and connections are kept, so the agent/parser wiring is
unchanged; only the model node's type, parameters and credential change.
"""
import json
import sys

CLOUD_CHAT_TYPES = {
    "@n8n/n8n-nodes-langchain.lmChatGroq",
    "@n8n/n8n-nodes-langchain.lmChatOpenAi",
    "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
    "@n8n/n8n-nodes-langchain.lmChatGoogleGemini",
    "@n8n/n8n-nodes-langchain.lmChatAnthropic",
    "@n8n/n8n-nodes-langchain.lmChatMistralCloud",
    "@n8n/n8n-nodes-langchain.lmChatDeepSeek",
}
OLLAMA_CREDENTIAL = {"id": "ollamaLocalOffline", "name": "Ollama local (offline)"}


def patch(workflow, model):
    changed = []
    for node in workflow.get("nodes", []):
        if node.get("type") in CLOUD_CHAT_TYPES:
            changed.append(f"{node['name']}: {node['type']} -> lmChatOllama/{model}")
            node["type"] = "@n8n/n8n-nodes-langchain.lmChatOllama"
            node["typeVersion"] = 1
            node["parameters"] = {"model": model, "options": {"temperature": 0.1}}
            node["credentials"] = {"ollamaApi": OLLAMA_CREDENTIAL}
    return changed


def main():
    src, dst = sys.argv[1], sys.argv[2]
    model = sys.argv[3] if len(sys.argv) > 3 else "gemma3:12b"
    data = json.load(open(src, encoding="utf-8"))
    workflows = data if isinstance(data, list) else [data]
    for wf in workflows:
        for line in patch(wf, model):
            print(f"[{wf.get('name')}] {line}")
    json.dump(data, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
