from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from ..dependencies import CsrfGuard, CurrentUser, DbDep
from ..models import (
    Activity,
    ClassGroup,
    CourseSequence,
    DrawHistory,
    Lesson,
    Level,
    Presentation,
    Resource,
    Slide,
    SlideElement,
    Student,
    StudentAbsence,
    Timer,
)
from ..schemas import GenericWrite
from ..services.audit import record_audit

router = APIRouter(tags=["pedagogy"])


@dataclass(frozen=True)
class EntityConfig:
    model: type
    writable: frozenset[str]
    parents: dict[str, type]


ENTITIES: dict[str, EntityConfig] = {
    "levels": EntityConfig(Level, frozenset({"name", "description", "category", "position", "hidden"}), {}),
    "sequences": EntityConfig(
        CourseSequence,
        frozenset({"level_id", "name", "description", "final_task", "position", "hidden", "archived"}),
        {"level_id": Level},
    ),
    "lessons": EntityConfig(
        Lesson,
        frozenset({"sequence_id", "name", "description", "position", "hidden"}),
        {"sequence_id": CourseSequence},
    ),
    "activities": EntityConfig(
        Activity,
        frozenset(
            {
                "lesson_id",
                "name",
                "description",
                "objective",
                "instruction",
                "estimated_duration",
                "modality",
                "level_label",
                "position",
                "hidden",
                "archived",
            }
        ),
        {"lesson_id": Lesson},
    ),
    "presentations": EntityConfig(
        Presentation,
        frozenset({"activity_id", "name", "private_notes", "theme", "position"}),
        {"activity_id": Activity},
    ),
    "slides": EntityConfig(
        Slide,
        frozenset({"presentation_id", "position", "background", "transition", "notes"}),
        {"presentation_id": Presentation},
    ),
    "slide-elements": EntityConfig(
        SlideElement,
        frozenset(
            {
                "slide_id",
                "type",
                "x",
                "y",
                "width",
                "height",
                "rotation",
                "z_index",
                "locked",
                "hidden",
                "content_json",
                "style_json",
                "animation_json",
            }
        ),
        {"slide_id": Slide},
    ),
    "resources": EntityConfig(
        Resource,
        frozenset(
            {"activity_id", "name", "description", "type", "category", "url", "file_id", "position", "hidden"}
        ),
        {"activity_id": Activity},
    ),
    "class-groups": EntityConfig(ClassGroup, frozenset({"name", "school_year", "description"}), {}),
    "students": EntityConfig(
        Student,
        frozenset({"class_group_id", "first_name", "last_name", "display_name", "active"}),
        {"class_group_id": ClassGroup},
    ),
    "absences": EntityConfig(
        StudentAbsence, frozenset({"student_id", "absent_on", "reason"}), {"student_id": Student}
    ),
    "draw-history": EntityConfig(
        DrawHistory,
        frozenset({"class_group_id", "student_id", "student_name", "drawn_at"}),
        {"class_group_id": ClassGroup, "student_id": Student},
    ),
    "timers": EntityConfig(Timer, frozenset({"name", "state_json"}), {}),
}


def _config(collection: str) -> EntityConfig:
    config = ENTITIES.get(collection)
    if not config:
        raise HTTPException(status_code=404, detail="Collection inconnue")
    return config


def _serialize(record: Any) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for column in inspect(record).mapper.column_attrs:
        value = getattr(record, column.key)
        output[column.key] = str(value) if isinstance(value, uuid.UUID) else value
    return output


def _owned(db: Session, model: type, user_id: uuid.UUID, item_id: uuid.UUID):
    item = db.scalar(select(model).where(model.id == item_id, model.user_id == user_id))
    if not item:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    return item


def _prepare_data(
    db: Session, config: EntityConfig, user_id: uuid.UUID, raw: dict[str, Any]
) -> dict[str, Any]:
    unknown = set(raw) - config.writable
    if unknown:
        raise HTTPException(status_code=422, detail=f"Champs non autorisés : {', '.join(sorted(unknown))}")
    data = dict(raw)
    for field, parent_model in config.parents.items():
        if field not in data or data[field] in {None, ""}:
            continue
        try:
            parent_id = uuid.UUID(str(data[field]))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"{field} invalide") from exc
        _owned(db, parent_model, user_id, parent_id)
        data[field] = parent_id
    if "file_id" in data and data["file_id"]:
        data["file_id"] = uuid.UUID(str(data["file_id"]))
    return data


def list_entities(
    collection: str, user: CurrentUser, db: DbDep, offset: int = 0, limit: int = 100
) -> list[dict]:
    config = _config(collection)
    records = db.scalars(
        select(config.model)
        .where(config.model.user_id == user.id)
        .order_by(config.model.created_at.desc())
        .offset(max(0, offset))
        .limit(min(max(1, limit), 200))
    ).all()
    return [_serialize(record) for record in records]


def create_entity(
    collection: str, payload: GenericWrite, user: CurrentUser, db: DbDep, _csrf: CsrfGuard
) -> dict:
    config = _config(collection)
    data = _prepare_data(db, config, user.id, payload.data)
    record = config.model(user_id=user.id, **data)
    db.add(record)
    db.flush()
    record_audit(db, f"{collection}.created", user_id=user.id, resource_id=str(record.id))
    db.commit()
    return _serialize(record)


def read_entity(collection: str, item_id: uuid.UUID, user: CurrentUser, db: DbDep) -> dict:
    config = _config(collection)
    return _serialize(_owned(db, config.model, user.id, item_id))


def update_entity(
    collection: str,
    item_id: uuid.UUID,
    payload: GenericWrite,
    user: CurrentUser,
    db: DbDep,
    _csrf: CsrfGuard,
) -> dict:
    config = _config(collection)
    record = _owned(db, config.model, user.id, item_id)
    for key, value in _prepare_data(db, config, user.id, payload.data).items():
        setattr(record, key, value)
    record_audit(db, f"{collection}.updated", user_id=user.id, resource_id=str(record.id))
    db.commit()
    return _serialize(record)


def delete_entity(
    collection: str,
    item_id: uuid.UUID,
    user: CurrentUser,
    db: DbDep,
    _csrf: CsrfGuard,
) -> Response:
    config = _config(collection)
    record = _owned(db, config.model, user.id, item_id)
    db.delete(record)
    record_audit(db, f"{collection}.deleted", user_id=user.id, resource_id=str(item_id))
    db.commit()
    return Response(status_code=204)


def _list_endpoint(collection: str):
    def endpoint(user: CurrentUser, db: DbDep, offset: int = 0, limit: int = 100) -> list[dict]:
        return list_entities(collection, user, db, offset, limit)

    return endpoint


def _create_endpoint(collection: str):
    def endpoint(payload: GenericWrite, user: CurrentUser, db: DbDep, _csrf: CsrfGuard) -> dict:
        return create_entity(collection, payload, user, db, _csrf)

    return endpoint


def _read_endpoint(collection: str):
    def endpoint(item_id: uuid.UUID, user: CurrentUser, db: DbDep) -> dict:
        return read_entity(collection, item_id, user, db)

    return endpoint


def _update_endpoint(collection: str):
    def endpoint(
        item_id: uuid.UUID,
        payload: GenericWrite,
        user: CurrentUser,
        db: DbDep,
        _csrf: CsrfGuard,
    ) -> dict:
        return update_entity(collection, item_id, payload, user, db, _csrf)

    return endpoint


def _delete_endpoint(collection: str):
    def endpoint(
        item_id: uuid.UUID,
        user: CurrentUser,
        db: DbDep,
        _csrf: CsrfGuard,
    ) -> Response:
        return delete_entity(collection, item_id, user, db, _csrf)

    return endpoint


for collection_name in ENTITIES:
    router.add_api_route(
        f"/{collection_name}",
        _list_endpoint(collection_name),
        methods=["GET"],
        name=f"list_{collection_name.replace('-', '_')}",
    )
    router.add_api_route(
        f"/{collection_name}",
        _create_endpoint(collection_name),
        methods=["POST"],
        status_code=status.HTTP_201_CREATED,
        name=f"create_{collection_name.replace('-', '_')}",
    )
    router.add_api_route(
        f"/{collection_name}/{{item_id}}",
        _read_endpoint(collection_name),
        methods=["GET"],
        name=f"read_{collection_name.replace('-', '_')}",
    )
    router.add_api_route(
        f"/{collection_name}/{{item_id}}",
        _update_endpoint(collection_name),
        methods=["PATCH"],
        name=f"update_{collection_name.replace('-', '_')}",
    )
    router.add_api_route(
        f"/{collection_name}/{{item_id}}",
        _delete_endpoint(collection_name),
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        name=f"delete_{collection_name.replace('-', '_')}",
    )
