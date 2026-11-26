#!/usr/bin/env python3
"""Create N load-test students through the public API and enroll them in real classes.

Usage: ADMIN_EMAIL=.. ADMIN_PASSWORD=.. python3 -I seed_users.py BASE_URL POOL.json OUT.json [N]

Accounts: <EMAIL_PREFIX>001@<EMAIL_DOMAIN> ... (default loadtest001@loadtest.local), name
"<NAME_PREFIX> 001". Password: LOADTEST_PASSWORD (default Loadtest@123) for every account,
or RANDOM_PASSWORDS=1 for a different random password per account (written to OUT.json,
so keep that file private). Existing accounts are logged in instead of re-registered
(with RANDOM_PASSWORDS=1 they are reported as failed, since their password is unknown).
"""
import json
import os
import secrets
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PASSWORD = os.environ.get("LOADTEST_PASSWORD", "Loadtest@123")
RANDOM_PASSWORDS = os.environ.get("RANDOM_PASSWORDS") == "1"
EMAIL_PREFIX = os.environ.get("EMAIL_PREFIX", "loadtest")
EMAIL_DOMAIN = os.environ.get("EMAIL_DOMAIN", "loadtest.local")
NAME_PREFIX = os.environ.get("NAME_PREFIX", "Load Test")
# No look-alike characters (0/O, 1/l/I) so passwords can be typed from a printed list.
ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_password():
    return "".join(secrets.choice(ALPHABET) for _ in range(10))


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
    email = f"{EMAIL_PREFIX}{i:03d}@{EMAIL_DOMAIN}"
    password = new_password() if RANDOM_PASSWORDS else PASSWORD
    status, body = call(base, "POST", "/api/users/register",
                        {"email": email, "password": password, "fullName": f"{NAME_PREFIX} {i:03d}"})
    if status not in (200, 201):
        if RANDOM_PASSWORDS:
            return {"i": i, "email": email, "error": f"register {status} {str(body)[:200]}"}
        status, body = call(base, "POST", "/api/users/login", {"email": email, "password": password})
        if status != 200:
            return {"i": i, "email": email, "error": f"{status} {str(body)[:200]}"}
    return {"i": i, "email": email, "password": password, "userId": find(body, "userId", "id"),
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
                     "studentName": f"{NAME_PREFIX} {u['i']:03d}", "studentEmail": u["email"]} for u in members]
        st, resp = call(base, "POST", f"/api/admin/class-sections/{course}/{klass}/students",
                        {"students": students}, admin)
        if st != 200:
            enroll_errors.append(f"{course}/{klass}: {st} {str(resp)[:200]}")

    keys = ("email", "password", "userId", "courseId", "classId") if RANDOM_PASSWORDS else ("email", "userId", "courseId", "classId")
    with open(os.open(out_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as fh:
        json.dump([{k: u.get(k) for k in keys} for u in ok], fh, ensure_ascii=False, indent=1)
    print(f"students ok={len(ok)} failed={len(failed)} classes={len(by_class)} enroll_errors={len(enroll_errors)}")
    for f in failed[:10]:
        print("  user error:", f)
    for e in enroll_errors[:10]:
        print("  enroll error:", e)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 500)
