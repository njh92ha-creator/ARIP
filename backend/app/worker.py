from celery import Celery

from app.core.config import settings

celery_app = Celery("arip", broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "arip.import.*": {"queue": "journal.ingest"},
        "arip.event.*": {"queue": "event.cluster"},
        "arip.risk.*": {"queue": "risk.rule"},
        "arip.history.*": {"queue": "summary.refresh"},
    },
)

