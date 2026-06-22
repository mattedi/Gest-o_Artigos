import os
import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Date, DateTime, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://scitrack:scitrack@127.0.0.1:5433/scitrack",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(260), nullable=False)
    student: Mapped[str] = mapped_column(String(160), nullable=False)
    course: Mapped[str] = mapped_column(String(160), default="")
    level: Mapped[str] = mapped_column(String(80), default="")
    area: Mapped[str] = mapped_column(String(160), default="")
    type: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(80), default="Projetado")
    next_action: Mapped[str] = mapped_column(String(260), default="")
    deadline: Mapped[date] = mapped_column(Date, nullable=False)
    venue: Mapped[str] = mapped_column(String(220), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    last_update: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class History(Base):
    __tablename__ = "article_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    article_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    event: Mapped[str] = mapped_column(String(80), nullable=False)
    previous_status: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    new_status: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ArticleIn(BaseModel):
    id: Optional[str] = None
    title: str = Field(min_length=1)
    student: str = Field(min_length=1)
    course: str = ""
    level: str = ""
    area: str = ""
    type: str = "Artigo"
    status: str = "Projetado"
    nextAction: str = ""
    deadline: date
    venue: str = ""
    notes: str = ""
    lastUpdate: Optional[date] = None


class ArticleOut(ArticleIn):
    id: str
    lastUpdate: date


app = FastAPI(title="SciTrack Alunos API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def to_out(article: Article) -> ArticleOut:
    return ArticleOut(
        id=article.id,
        title=article.title,
        student=article.student,
        course=article.course,
        level=article.level,
        area=article.area,
        type=article.type,
        status=article.status,
        nextAction=article.next_action,
        deadline=article.deadline,
        venue=article.venue,
        notes=article.notes,
        lastUpdate=article.last_update,
    )


def apply_payload(article: Article, payload: ArticleIn) -> None:
    article.title = payload.title.strip()
    article.student = payload.student.strip()
    article.course = payload.course.strip()
    article.level = payload.level.strip()
    article.area = payload.area.strip()
    article.type = payload.type.strip()
    article.status = payload.status.strip()
    article.next_action = payload.nextAction.strip()
    article.deadline = payload.deadline
    article.venue = payload.venue.strip()
    article.notes = payload.notes.strip()
    article.last_update = payload.lastUpdate or date.today()


def log_history(session: Session, article_id: str, event: str, previous: Optional[str], new: Optional[str], comment: str = "") -> None:
    session.add(
        History(
            id=str(uuid.uuid4()),
            article_id=article_id,
            event=event,
            previous_status=previous,
            new_status=new,
            comment=comment,
        )
    )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/articles", response_model=list[ArticleOut])
def list_articles() -> list[ArticleOut]:
    with SessionLocal() as session:
        rows = session.scalars(select(Article).order_by(Article.updated_at.desc())).all()
        return [to_out(article) for article in rows]


@app.post("/api/articles", response_model=ArticleOut)
def create_article(payload: ArticleIn) -> ArticleOut:
    article = Article(
        id=payload.id or str(uuid.uuid4()),
        title="",
        student="",
        deadline=payload.deadline,
        last_update=payload.lastUpdate or date.today(),
    )
    apply_payload(article, payload)
    with SessionLocal() as session:
        session.add(article)
        log_history(session, article.id, "created", None, article.status)
        session.commit()
        return to_out(article)


@app.put("/api/articles/{article_id}", response_model=ArticleOut)
def update_article(article_id: str, payload: ArticleIn) -> ArticleOut:
    with SessionLocal() as session:
        article = session.get(Article, article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        previous = article.status
        apply_payload(article, payload)
        if previous != article.status:
            log_history(session, article.id, "status_changed", previous, article.status)
        else:
            log_history(session, article.id, "updated", previous, article.status)
        session.commit()
        return to_out(article)


@app.patch("/api/articles/{article_id}/status", response_model=ArticleOut)
def update_article_status(article_id: str, payload: dict[str, str]) -> ArticleOut:
    status = payload.get("status", "").strip()
    if not status:
        raise HTTPException(status_code=400, detail="Missing status")
    with SessionLocal() as session:
        article = session.get(Article, article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        previous = article.status
        article.status = status
        article.last_update = date.today()
        log_history(session, article.id, "status_changed", previous, status)
        session.commit()
        return to_out(article)


@app.patch("/api/articles/{article_id}/touch", response_model=ArticleOut)
def touch_article(article_id: str) -> ArticleOut:
    with SessionLocal() as session:
        article = session.get(Article, article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        article.last_update = date.today()
        log_history(session, article.id, "touched", article.status, article.status)
        session.commit()
        return to_out(article)


@app.delete("/api/articles/{article_id}")
def delete_article(article_id: str) -> dict[str, str]:
    with SessionLocal() as session:
        article = session.get(Article, article_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        session.delete(article)
        log_history(session, article_id, "deleted", article.status, None)
        session.commit()
        return {"status": "deleted"}
