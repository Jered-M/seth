"""Configuration des logs visibles dans le terminal Flask."""
import logging
import os
import sys


def setup_logging() -> None:
    level = logging.DEBUG if os.getenv("SETH_VERBOSE_LOGS", "true").lower() == "true" else logging.INFO
    root = logging.getLogger()
    if root.handlers:
        root.setLevel(level)
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s [%(name)s] %(levelname)s — %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root.addHandler(handler)
    root.setLevel(level)

    logging.getLogger("werkzeug").setLevel(logging.INFO)
