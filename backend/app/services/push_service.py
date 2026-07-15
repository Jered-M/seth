"""Notifications push navigateur (Web Push / VAPID)."""
import json
import logging
import os

from app.database import db
from app.models.security_models import PushSubscription

log = logging.getLogger("seth.push")


class PushService:
    @staticmethod
    def get_vapid_public_key() -> str:
        return (os.getenv("VAPID_PUBLIC_KEY") or "").strip()

    @staticmethod
    def _vapid_claims() -> dict:
        email = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@seth.com")
        if not email.startswith("mailto:"):
            email = f"mailto:{email}"
        return {"sub": email}

    @staticmethod
    def _private_key() -> str | None:
        key = (os.getenv("VAPID_PRIVATE_KEY") or "").strip().strip('"').strip("'")
        if not key:
            return None
        return key.replace("\\n", "\n")

    @staticmethod
    def is_configured() -> bool:
        return bool(PushService.get_vapid_public_key() and PushService._private_key())

    @staticmethod
    def upsert_subscription(user_id: str, data: dict, user_agent: str | None = None) -> PushSubscription:
        endpoint = data.get("endpoint")
        keys = data.get("keys") or {}
        p256dh = keys.get("p256dh")
        auth = keys.get("auth")
        if not endpoint or not p256dh or not auth:
            raise ValueError("Subscription push invalide")

        row = PushSubscription.query.filter_by(endpoint=endpoint).first()
        if row:
            row.user_id = user_id
            row.p256dh = p256dh
            row.auth = auth
            row.user_agent = (user_agent or "")[:255] or row.user_agent
        else:
            row = PushSubscription(
                user_id=user_id,
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
                user_agent=(user_agent or "")[:255] if user_agent else None,
            )
            db.session.add(row)
        db.session.commit()
        return row

    @staticmethod
    def remove_subscription(user_id: str, endpoint: str | None = None) -> int:
        query = PushSubscription.query.filter_by(user_id=user_id)
        if endpoint:
            query = query.filter_by(endpoint=endpoint)
        count = query.count()
        query.delete(synchronize_session=False)
        db.session.commit()
        return count

    @staticmethod
    def send_to_user(
        user_id: str,
        title: str,
        body: str,
        data: dict | None = None,
    ):
        if not PushService.is_configured():
            return

        subs = PushSubscription.query.filter_by(user_id=user_id).all()
        if not subs:
            return

        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            log.warning("pywebpush non installé — push désactivé")
            return

        payload = json.dumps(
            {
                "title": title,
                "body": body,
                "tag": (data or {}).get("notification_id") or (data or {}).get("type") or "seth-notif",
                **(data or {}),
            },
            ensure_ascii=False,
        )
        private_key = PushService._private_key()
        claims = PushService._vapid_claims()
        stale_endpoints: list[str] = []

        for sub in subs:
            subscription_info = {
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            }
            try:
                webpush(
                    subscription_info=subscription_info,
                    data=payload,
                    vapid_private_key=private_key,
                    vapid_claims=claims,
                )
            except WebPushException as exc:
                status = getattr(exc.response, "status_code", None) if exc.response else None
                if status in {404, 410}:
                    stale_endpoints.append(sub.endpoint)
                else:
                    log.warning("Push échoué user=%s status=%s", user_id, status)
            except Exception as exc:
                log.warning("Push échoué user=%s: %s", user_id, exc)

        for endpoint in stale_endpoints:
            PushSubscription.query.filter_by(endpoint=endpoint).delete(synchronize_session=False)
        if stale_endpoints:
            db.session.commit()
