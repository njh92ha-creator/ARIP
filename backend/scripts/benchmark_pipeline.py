from __future__ import annotations

import argparse
import time
from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.domain.models import JournalLine
from app.services.event_engine import cluster_journals, construct_event


def run(rows: int) -> None:
    company_id = uuid4()
    lines = []
    start = time.perf_counter()
    for index in range(rows):
        document = f"JE-{index // 2:09d}"
        debit = index % 2 == 0
        lines.append(
            JournalLine(
                company_id=company_id,
                source_row=index + 2,
                document_number=document,
                posting_date=date(2026, 7, 31),
                account_code="120100" if debit else "100100",
                account_name="개발비" if debit else "현금",
                local_amount=Decimal("1000000"),
                debit_credit_indicator="D" if debit else "C",
                fiscal_year=2026,
                fiscal_period=7,
                line_text="개발 프로젝트",
                source_hash=f"{index:064d}",
            )
        )
    generated_at = time.perf_counter()
    clusters = cluster_journals(lines)
    clustered_at = time.perf_counter()
    events = [construct_event(cluster) for cluster in clusters]
    completed_at = time.perf_counter()
    print(
        {
            "rows": rows,
            "events": len(events),
            "generateSeconds": round(generated_at - start, 3),
            "clusterSeconds": round(clustered_at - generated_at, 3),
            "eventSeconds": round(completed_at - clustered_at, 3),
            "totalSeconds": round(completed_at - start, 3),
            "rowsPerSecond": round(rows / (completed_at - start), 1),
        }
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", type=int, default=100_000)
    args = parser.parse_args()
    run(args.rows)

