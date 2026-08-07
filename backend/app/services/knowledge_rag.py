from __future__ import annotations

import html
import io
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text

from app.core.database import engine


class KnowledgeIndexError(ValueError):
    """Raised when a source file cannot become searchable RAG evidence."""


@dataclass(frozen=True, slots=True)
class ExtractedPage:
    page: int | None
    text: str


def _clean_text(value: str) -> str:
    value = html.unescape(value).replace("\x00", " ")
    value = re.sub(r"[ \t\r\f\v]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def _xml_text(raw: bytes) -> str:
    value = raw.decode("utf-8", errors="ignore")
    value = re.sub(r"<[^>]+>", " ", value)
    return _clean_text(value)


def extract_document(filename: str, content: bytes) -> list[ExtractedPage]:
    """Extract readable pages locally; no source text is sent to a parser service."""
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(content), strict=False)
            pages = [
                ExtractedPage(index + 1, _clean_text(page.extract_text() or ""))
                for index, page in enumerate(reader.pages)
            ]
        except Exception as exc:  # encrypted/scanned PDFs need an OCR-capable source
            raise KnowledgeIndexError(f"PDF 본문을 추출하지 못했습니다 ({type(exc).__name__}). 텍스트 선택이 가능한 PDF인지 확인해 주세요.") from exc
    elif suffix in {".txt", ".md"}:
        pages = [ExtractedPage(1, _clean_text(content.decode("utf-8", errors="ignore")))]
    elif suffix in {".html", ".htm"}:
        raw = content.decode("utf-8", errors="ignore")
        pages = [ExtractedPage(1, _clean_text(re.sub(r"<[^>]+>", " ", raw)))]
    elif suffix == ".docx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                pages = [ExtractedPage(None, _xml_text(archive.read("word/document.xml")))]
        except Exception as exc:
            raise KnowledgeIndexError("DOCX 본문을 추출하지 못했습니다.") from exc
    elif suffix == ".hwpx":
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                names = sorted(name for name in archive.namelist() if name.startswith("Contents/section") and name.endswith(".xml"))
                pages = [ExtractedPage(index + 1, _xml_text(archive.read(name))) for index, name in enumerate(names)]
        except Exception as exc:
            raise KnowledgeIndexError("HWPX 본문을 추출하지 못했습니다.") from exc
    elif suffix == ".hwp":
        raise KnowledgeIndexError("HWP 파일은 현재 본문 추출을 지원하지 않습니다. HWPX 또는 PDF로 변환해 업로드해 주세요.")
    else:
        raise KnowledgeIndexError("지원하지 않는 기준서 형식입니다.")

    readable = [page for page in pages if page.text]
    if not readable:
        raise KnowledgeIndexError("추출 가능한 본문이 없습니다. 스캔 PDF는 OCR 처리 후 업로드해 주세요.")
    return readable


def chunk_document(pages: list[ExtractedPage], *, size: int = 1_100, overlap: int = 160) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    for page in pages:
        text_value = page.text
        start = 0
        while start < len(text_value):
            end = min(len(text_value), start + size)
            if end < len(text_value):
                boundary = max(text_value.rfind("\n", start, end), text_value.rfind(". ", start, end))
                if boundary > start + size // 2:
                    end = boundary + 1
            chunk = _clean_text(text_value[start:end])
            if chunk:
                chunks.append({"content": chunk, "page": page.page, "locator": f"p.{page.page}" if page.page else "본문"})
            if end >= len(text_value):
                break
            start = max(end - overlap, start + 1)
    if not chunks:
        raise KnowledgeIndexError("검색 가능한 본문 청크를 만들지 못했습니다.")
    return chunks


def _embedding_client(provider: str, api_key: str):
    from openai import OpenAI

    if provider.lower() == "nvidia":
        return OpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=api_key, max_retries=0, timeout=25.0)
    return OpenAI(api_key=api_key, max_retries=0, timeout=25.0)


def _effective_embedding_model(provider: str, requested: str | None) -> str:
    if provider.lower() == "nvidia" and (not requested or requested.startswith("text-embedding-")):
        return "nvidia/nv-embed-v1"
    return requested or "text-embedding-3-large"


def embed_texts(texts: list[str], *, provider: str, api_key: str, embedding_model: str | None) -> tuple[str, list[list[float]]]:
    if not texts:
        return _effective_embedding_model(provider, embedding_model), []
    model = _effective_embedding_model(provider, embedding_model)
    client = _embedding_client(provider, api_key)
    embeddings: list[list[float]] = []
    try:
        for start in range(0, len(texts), 32):
            response = client.embeddings.create(model=model, input=texts[start : start + 32], encoding_format="float")
            embeddings.extend([list(item.embedding) for item in response.data])
    except Exception as exc:
        raise KnowledgeIndexError("기준서 임베딩 생성에 실패했습니다. AI 연결 및 임베딩 모델을 확인해 주세요.") from exc
    if len(embeddings) != len(texts):
        raise KnowledgeIndexError("임베딩 결과 개수가 본문 청크 수와 일치하지 않습니다.")
    return model, embeddings


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(format(float(value), ".8g") for value in vector) + "]"


def index_document(
    *, candidate_id: str, company_id: UUID, filename: str, content: bytes,
    content_hash: str, provider: str, api_key: str, embedding_model: str | None,
) -> dict[str, Any]:
    pages = extract_document(filename, content)
    chunks = chunk_document(pages)
    model, embeddings = embed_texts(
        [chunk["content"] for chunk in chunks], provider=provider,
        api_key=api_key, embedding_model=embedding_model,
    )
    document_id = uuid4()
    with engine.begin() as connection:
        existing = connection.execute(text("select id from knowledge.document where candidate_id = :candidate_id"), {"candidate_id": candidate_id}).scalar_one_or_none()
        if existing:
            connection.execute(text("delete from knowledge.document where id = :id"), {"id": existing})
        connection.execute(text("""
            insert into knowledge.document (id, candidate_id, company_id, title, content_hash, approval_status, embedding_model, page_count, indexed_at)
            values (:id, :candidate_id, :company_id, :title, :content_hash, 'APPROVED', :embedding_model, :page_count, :indexed_at)
        """), {"id": document_id, "candidate_id": candidate_id, "company_id": company_id, "title": filename, "content_hash": content_hash, "embedding_model": model, "page_count": len(pages), "indexed_at": datetime.now(timezone.utc)})
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            connection.execute(text("""
                insert into knowledge.chunk (id, document_id, content, page_number, locator, embedding)
                values (:id, :document_id, :content, :page_number, :locator, cast(:embedding as extensions.vector))
            """), {"id": uuid4(), "document_id": document_id, "content": chunk["content"], "page_number": chunk["page"], "locator": chunk["locator"], "embedding": _vector_literal(embedding)})
    return {"documentId": str(document_id), "chunkCount": len(chunks), "pageCount": len(pages), "embeddingModel": model}


def retrieve_reference_context(
    *, company_id: UUID, query: str, provider: str, api_key: str,
    embedding_model: str | None, limit: int = 4,
) -> list[dict[str, str]]:
    model, vectors = embed_texts([query], provider=provider, api_key=api_key, embedding_model=embedding_model)
    if not vectors:
        return []
    with engine.connect() as connection:
        rows = connection.execute(text("""
            select c.id, d.candidate_id, d.title, c.locator, c.page_number, c.content,
                   1 - (c.embedding <=> cast(:embedding as extensions.vector)) as similarity
            from knowledge.chunk c
            join knowledge.document d on d.id = c.document_id
            where d.company_id = :company_id
              and d.approval_status = 'APPROVED'
              and d.embedding_model = :embedding_model
            order by c.embedding <=> cast(:embedding as extensions.vector)
            limit :limit
        """), {"company_id": company_id, "embedding_model": model, "embedding": _vector_literal(vectors[0]), "limit": limit}).mappings().all()
    return [
        {
            "id": str(row["id"]), "candidateId": str(row["candidate_id"]),
            "title": str(row["title"]), "type": "RAG_CHUNK",
            "locator": str(row["locator"] or f"p.{row['page_number']}"),
            "excerpt": str(row["content"]), "similarity": f"{float(row['similarity']):.3f}",
        }
        for row in rows
    ]
