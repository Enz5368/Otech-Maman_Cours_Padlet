from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from ..dependencies import CurrentUser, DbDep
from ..models import Activity, ClassGroup, CourseSequence, Lesson, Level, Resource, Student

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def search(q: str = Query(min_length=1, max_length=200), *, user: CurrentUser, db: DbDep) -> list[dict]:
    pattern = f"%{q.strip()}%"
    configs = (
        ("level", Level, Level.name, Level.description),
        ("sequence", CourseSequence, CourseSequence.name, CourseSequence.description),
        ("lesson", Lesson, Lesson.name, Lesson.description),
        ("activity", Activity, Activity.name, Activity.description),
        ("resource", Resource, Resource.name, Resource.description),
        ("class_group", ClassGroup, ClassGroup.name, ClassGroup.description),
        ("student", Student, Student.display_name, Student.display_name),
    )
    results: list[dict] = []
    for entity_type, model, title_column, body_column in configs:
        rows = db.scalars(
            select(model)
            .where(model.user_id == user.id, or_(title_column.ilike(pattern), body_column.ilike(pattern)))
            .limit(30)
        ).all()
        results.extend(
            {
                "type": entity_type,
                "id": str(row.id),
                "title": str(getattr(row, title_column.key)),
                "description": str(getattr(row, body_column.key) or ""),
            }
            for row in rows
        )
    return results[:100]
