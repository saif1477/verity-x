#!/usr/bin/env python3
"""Deterministic idempotent seed helper for VERITY-X.
Calls the /api/seed endpoint when BASE_URL is set, otherwise prints instructions.
For local Docker/FastAPI deployments this mirrors the Node seed pipeline.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request

SEED = 142001
WATERMARK = (
    "Synthetic demonstration data. This application does not use or represent "
    "official government records."
)


def main() -> int:
    base = os.environ.get("BASE_URL") or os.environ.get("VERITY_API_URL") or ""
    force = "--force" in sys.argv or os.environ.get("FORCE_SEED") == "1"

    print("VERITY-X seed_demo.py")
    print(f"  seed={SEED} deterministic=True")
    print(f"  {WATERMARK}")

    if not base:
        # Prefer in-process Node seed via supabase when running in this monorepo
        print("No BASE_URL set — attempting local Node seed module…")
        code = os.system(
            "node scripts/seed_node.mjs" + (" --force" if force else "")
        )
        return 0 if code == 0 else 1

    url = base.rstrip("/") + "/api/seed"
    body = json.dumps({"force": force, "extra_projects": 80}).encode()
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read().decode())
        print(json.dumps(data, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
