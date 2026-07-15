#!/usr/bin/env python3
"""Génère les clés VAPID Web Push et les écrit dans backend/.env."""
from pathlib import Path

from py_vapid import Vapid


def main():
    env_path = Path(__file__).resolve().parents[1] / ".env"
    vapid = Vapid()
    vapid.generate_keys()

    import base64

    raw_pub = vapid.public_key
    if isinstance(raw_pub, str):
        public_b64 = raw_pub
    else:
        public_b64 = base64.urlsafe_b64encode(raw_pub).decode("utf-8").rstrip("=")

    private_pem = vapid.private_pem().decode("utf-8")
    private_one_line = private_pem.replace("\n", "\\n")

    lines = []
    if env_path.exists():
        lines = env_path.read_text(encoding="utf-8").splitlines()
        lines = [ln for ln in lines if not ln.startswith("VAPID_")]

    lines.extend([
        "",
        "# Web Push (notifications hors plateforme)",
        f"VAPID_PUBLIC_KEY={public_b64}",
        f"VAPID_PRIVATE_KEY={private_one_line}",
        "VAPID_CLAIMS_EMAIL=mailto:admin@seth.com",
    ])

    env_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    print(f"Clés VAPID écrites dans {env_path}")
    print("Redémarrez le backend Flask après cette opération.")


if __name__ == "__main__":
    main()
