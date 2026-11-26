#!/usr/bin/env python3
"""Create N load-test students through the public API and enroll them in real classes.

Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. python3 -I seed_users.py BASE_URL POOL.json OUT.json [N]

Accounts: loadtest001@loadtest.local ... (password LOADTEST_PASSWORD, default Loadtest@123).
Existing accounts are logged in instead of re-registered, so the script is re-runnable.
Only ever run against the isolated tutor_db_loadtest stack.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PASSWORD = os.environ.get("LOADTEST_PASSWORD", "Loadtest@123")


def call(base, method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw or b"null")
        except ValueError:
            return e.code, raw.decode(errors="replace")[:300]


def find(obj, *keys):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in keys and isinstance(v, str) and v:
                return v
            r = find(v, *keys)
            if r:
                return r
    return None


def ensure_student(base, i):
    email = f"loadtest{i:03d}@loadtest.local"
    status, body = call(base, "POST", "/api/users/register",
                        {"email": email, "password": PASSWORD, "fullName": f"Load Test {i:03d}"})
    if status not in (200, 201):
        status, body = call(base, "POST", "/api/users/login", {"email": email, "password": PASSWORD})
        if status != 200:
            return {"i": i, "email": email, "error": f"{status} {str(body)[:200]}"}
    return {"i": i, "email": email, "userId": find(body, "userId", "id"),
            "studentCode": find(body, "studentCode")}


def main(base, pool_path, out_path, n):
    pool = json.load(open(pool_path))
    pairs = pool["classPairs"]
    status, body = call(base, "POST", "/api/users/login",
                        {"email": os.environ["ADMIN_EMAIL"], "password": os.environ["ADMIN_PASSWORD"]})
    admin = find(body, "accessToken", "token")
    if status != 200 or not admin:
        sys.exit(f"admin login failed: {status}")

    with ThreadPoolExecutor(max_workers=16) as ex:
        users = list(ex.map(lambda i: ensure_student(base, i), range(1, n + 1)))
    failed = [u for u in users if "error" in u or not u.get("userId")]
    ok = [u for u in users if u not in failed]

    by_class = {}
    for idx, u in enumerate(ok):
        course, klass = pairs[idx % len(pairs)]
        u["courseId"], u["classId"] = course, klass
        by_class.setdefault((course, klass), []).append(u)
    enroll_errors = []
    for (course, klass), members in by_class.items():
        students = [{"studentId": u["userId"], "studentCode": u.get("studentCode") or "",
                     "studentName": f"Load Test {u['i']:03d}", "studentEmail": u["email"]} for u in members]
        st, resp = call(base, "POST", f"/api/admin/class-sections/{course}/{klass}/students",
                        {"students": students}, admin)
        if st != 200:
            enroll_errors.append(f"{course}/{klass}: {st} {str(resp)[:200]}")

    json.dump([{k: u.get(k) for k in ("email", "userId", "courseId", "classId")} for u in ok],
              open(out_path, "w"), indent=1)
    print(f"students ok={len(ok)} failed={len(failed)} classes={len(by_class)} enroll_errors={len(enroll_errors)}")
    for f in failed[:10]:
        print("  user error:", f)
    for e in enroll_errors[:10]:
        print("  enroll error:", e)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 500)
