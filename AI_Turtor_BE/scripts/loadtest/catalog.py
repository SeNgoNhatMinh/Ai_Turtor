#!/usr/bin/env python3
"""Build the endpoint catalog for the chaos test from the Spring controllers.

Usage: python3 -I scripts/loadtest/catalog.py OUT.json

Every @RestController under src/main/java is parsed for class-level
@RequestMapping prefixes and method-level @Get/Post/Put/Patch/Delete/RequestMapping
paths (arrays included). Output: [{"method", "path", "controller"}], deduplicated.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "src" / "main" / "java"
VERBS = {"Get": "GET", "Post": "POST", "Put": "PUT", "Patch": "PATCH", "Delete": "DELETE"}
ANNOT = re.compile(r"@(Get|Post|Put|Patch|Delete|Request)Mapping\s*(\((?:[^()]|\([^()]*\))*\))?", re.S)
STRING = re.compile(r'"((?:[^"\\]|\\.)*)"')
# A path attribute: one string, or an array of strings (paths contain {vars}, so no [^}]*).
PATHS = r'(\{\s*(?:"(?:[^"\\]|\\.)*"\s*,?\s*)*\}|"(?:[^"\\]|\\.)*")'


def paths_in(args):
    if not args:
        return [""]
    inner = args[1:-1]
    # Only the value/path attribute holds paths; drop consumes/produces/params/etc.
    m = re.search(r"(?:^|,)\s*(?:value|path)\s*=\s*" + PATHS, inner) or re.match(r"\s*" + PATHS, inner)
    if not m:
        return [""]
    target = m.group(1)
    return STRING.findall(target) or [""]


def request_methods(args):
    if not args:
        return ["GET", "POST"]
    found = re.findall(r"RequestMethod\.(GET|POST|PUT|PATCH|DELETE)", args)
    return found or ["GET", "POST"]


def main(out):
    endpoints = {}
    for f in sorted(ROOT.rglob("*.java")):
        src = f.read_text(encoding="utf-8", errors="ignore")
        if "@RestController" not in src:
            continue
        cls = src.find(" class ")
        prefixes = [""]
        for m in ANNOT.finditer(src[:cls]):
            if m.group(1) == "Request":
                prefixes = paths_in(m.group(2))
        for m in ANNOT.finditer(src[cls:]):
            kind, args = m.group(1), m.group(2)
            methods = request_methods(args) if kind == "Request" else [VERBS[kind]]
            for prefix in prefixes:
                for p in paths_in(args):
                    path = "/" + "/".join(x for x in (prefix + "/" + p).split("/") if x)
                    path = re.sub(r"\{([A-Za-z0-9_]+)(:[^}]*)?\}", r"{\1}", path)
                    for method in methods:
                        endpoints[(method, path)] = f.stem
    rows = [{"method": m, "path": p, "controller": c} for (m, p), c in sorted(endpoints.items())]
    Path(out).write_text(json.dumps(rows, indent=1), encoding="utf-8")
    print(f"{len(rows)} endpoints -> {out}")


if __name__ == "__main__":
    main(sys.argv[1])
