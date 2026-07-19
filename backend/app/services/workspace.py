from __future__ import annotations

import copy
import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import Settings
from ..models import (
    Activity,
    ClassGroup,
    CourseSequence,
    Lesson,
    Level,
    Presentation,
    Resource,
    Slide,
    SlideElement,
    Student,
    User,
    UserWorkspace,
)
from .storage import store_data_url


def stable_id(user_id: uuid.UUID, kind: str, legacy_id: str) -> uuid.UUID:
    return uuid.uuid5(user_id, f"{kind}:{legacy_id}")


def workspace_counts(content: dict[str, Any]) -> dict[str, int]:
    counts = {
        "levels": 0,
        "sequences": 0,
        "lessons": 0,
        "activities": 0,
        "slides": 0,
        "resources": 0,
        "students": 0,
        "files": 0,
    }
    classes = content.get("classes") or []
    counts["levels"] = len(classes)
    for level in classes:
        counts["sequences"] += len(level.get("sequences") or [])
        for sequence in level.get("sequences") or []:
            counts["lessons"] += len(sequence.get("lessons") or [])
            for lesson in sequence.get("lessons") or []:
                counts["activities"] += len(lesson.get("activities") or [])
                for activity in lesson.get("activities") or []:
                    counts["slides"] += len(activity.get("slides") or [])
                    counts["resources"] += len(activity.get("resources") or [])
    counts["resources"] += len(content.get("resources") or [])
    for group in content.get("studentClasses") or []:
        counts["students"] += len(group.get("students") or [])
    return counts


def extract_embedded_files(
    db: Session, settings: Settings, user: User, content: dict[str, Any]
) -> tuple[dict[str, Any], int]:
    migrated = copy.deepcopy(content)
    files_count = 0

    def visit(value: Any) -> Any:
        nonlocal files_count
        if isinstance(value, dict):
            output: dict[str, Any] = {}
            element_kind = str(value.get("kind") or value.get("type") or "").lower()
            for key, item in value.items():
                is_file_slot = key == "url" or (key == "value" and element_kind not in {"", "text"})
                if is_file_slot and isinstance(item, str) and item.startswith("data:"):
                    record = store_data_url(db, settings, user, item)
                    if record:
                        files_count += 1
                        output[key] = f"/api/v1/files/{record.id}/content"
                        continue
                output[key] = visit(item)
            return output
        if isinstance(value, list):
            return [visit(item) for item in value]
        return value

    return visit(migrated), files_count


def _replace_normalized_data(db: Session, user_id: uuid.UUID, content: dict[str, Any]) -> None:
    # Les suppressions sont limitées au propriétaire authentifié et ordonnées selon les clés étrangères.
    for model in (
        SlideElement,
        Slide,
        Presentation,
        Resource,
        Activity,
        Lesson,
        CourseSequence,
        Student,
        ClassGroup,
        Level,
    ):
        db.execute(delete(model).where(model.user_id == user_id))

    for level_index, source_level in enumerate(content.get("classes") or []):
        level_legacy = str(source_level.get("id") or f"level-{level_index}")
        level_id = stable_id(user_id, "level", level_legacy)
        db.add(
            Level(
                id=level_id,
                user_id=user_id,
                legacy_id=level_legacy,
                name=str(source_level.get("title") or "Sans titre"),
                description=str(source_level.get("description") or ""),
                category=str(source_level.get("category") or ""),
                position=int(source_level.get("order") or level_index),
                hidden=source_level.get("isVisible") is False,
            )
        )
        for sequence_index, source_sequence in enumerate(source_level.get("sequences") or []):
            sequence_legacy = str(source_sequence.get("id") or f"{level_legacy}-sequence-{sequence_index}")
            sequence_id = stable_id(user_id, "sequence", sequence_legacy)
            db.add(
                CourseSequence(
                    id=sequence_id,
                    user_id=user_id,
                    level_id=level_id,
                    legacy_id=sequence_legacy,
                    name=str(source_sequence.get("title") or "Sans titre"),
                    description=str(source_sequence.get("description") or ""),
                    final_task=str(source_sequence.get("finalTask") or ""),
                    position=int(source_sequence.get("order") or sequence_index),
                    hidden=source_sequence.get("isVisible") is False,
                    archived=bool(source_sequence.get("archived", False)),
                )
            )
            for lesson_index, source_lesson in enumerate(source_sequence.get("lessons") or []):
                lesson_legacy = str(source_lesson.get("id") or f"{sequence_legacy}-lesson-{lesson_index}")
                lesson_id = stable_id(user_id, "lesson", lesson_legacy)
                db.add(
                    Lesson(
                        id=lesson_id,
                        user_id=user_id,
                        sequence_id=sequence_id,
                        legacy_id=lesson_legacy,
                        name=str(source_lesson.get("title") or "Sans titre"),
                        description=str(source_lesson.get("description") or ""),
                        position=int(source_lesson.get("order") or lesson_index),
                        hidden=source_lesson.get("isVisible") is False,
                    )
                )
                for activity_index, source_activity in enumerate(source_lesson.get("activities") or []):
                    activity_legacy = str(
                        source_activity.get("id") or f"{lesson_legacy}-activity-{activity_index}"
                    )
                    activity_id = stable_id(user_id, "activity", activity_legacy)
                    db.add(
                        Activity(
                            id=activity_id,
                            user_id=user_id,
                            lesson_id=lesson_id,
                            legacy_id=activity_legacy,
                            name=str(source_activity.get("title") or "Sans titre"),
                            description=str(source_activity.get("description") or ""),
                            objective=str(source_activity.get("objective") or ""),
                            instruction=str(source_activity.get("instruction") or ""),
                            estimated_duration=str(source_activity.get("estimatedDuration") or ""),
                            modality=str(source_activity.get("modality") or ""),
                            level_label=str(source_activity.get("level") or ""),
                            position=int(source_activity.get("order") or activity_index),
                            hidden=source_activity.get("isVisible") is False,
                            archived=bool(source_activity.get("archived", False)),
                        )
                    )
                    presentation_id = stable_id(user_id, "presentation", activity_legacy)
                    db.add(
                        Presentation(
                            id=presentation_id,
                            user_id=user_id,
                            activity_id=activity_id,
                            name=str(source_activity.get("title") or "Sans titre"),
                            private_notes=str(source_activity.get("privateNotes") or ""),
                            theme=source_activity.get("theme") or {},
                            position=activity_index,
                        )
                    )
                    for slide_index, source_slide in enumerate(source_activity.get("slides") or []):
                        slide_legacy = str(source_slide.get("id") or f"{activity_legacy}-slide-{slide_index}")
                        slide_id = stable_id(user_id, "slide", slide_legacy)
                        db.add(
                            Slide(
                                id=slide_id,
                                user_id=user_id,
                                presentation_id=presentation_id,
                                legacy_id=slide_legacy,
                                position=slide_index,
                                background=source_slide.get("background") or {},
                                transition=source_slide.get("transition") or {},
                                notes=str(source_slide.get("notes") or ""),
                            )
                        )
                        for element_index, source_element in enumerate(source_slide.get("elements") or []):
                            db.add(
                                SlideElement(
                                    id=stable_id(
                                        user_id,
                                        "element",
                                        str(source_element.get("id") or f"{slide_legacy}-{element_index}"),
                                    ),
                                    user_id=user_id,
                                    slide_id=slide_id,
                                    type=str(
                                        source_element.get("kind") or source_element.get("type") or "text"
                                    ),
                                    x=float(source_element.get("x") or 0),
                                    y=float(source_element.get("y") or 0),
                                    width=float(source_element.get("w") or source_element.get("width") or 0),
                                    height=float(
                                        source_element.get("h") or source_element.get("height") or 0
                                    ),
                                    rotation=float(source_element.get("rotation") or 0),
                                    z_index=int(source_element.get("zIndex") or element_index),
                                    locked=bool(source_element.get("locked", False)),
                                    hidden=bool(source_element.get("hidden", False)),
                                    content_json={"value": source_element.get("value", "")},
                                    style_json={"fontSize": source_element.get("fontSize")},
                                    animation_json=source_element.get("animation") or {},
                                )
                            )
                    for resource_index, source_resource in enumerate(source_activity.get("resources") or []):
                        db.add(
                            Resource(
                                id=stable_id(
                                    user_id,
                                    "resource",
                                    str(source_resource.get("id") or f"{activity_legacy}-{resource_index}"),
                                ),
                                user_id=user_id,
                                activity_id=activity_id,
                                name=str(source_resource.get("title") or "Ressource"),
                                description=str(source_resource.get("description") or ""),
                                type=str(source_resource.get("type") or "DOCUMENT"),
                                category=str(source_resource.get("category") or "Documents"),
                                url=str(source_resource.get("url") or ""),
                                position=int(source_resource.get("order") or resource_index),
                                hidden=source_resource.get("isVisible") is False,
                            )
                        )

    for group_index, source_group in enumerate(content.get("studentClasses") or []):
        group_legacy = str(source_group.get("id") or f"group-{group_index}")
        group_id = stable_id(user_id, "class-group", group_legacy)
        db.add(
            ClassGroup(
                id=group_id,
                user_id=user_id,
                legacy_id=group_legacy,
                name=str(source_group.get("title") or "Groupe"),
                school_year=str(source_group.get("schoolYear") or ""),
                description=str(source_group.get("description") or ""),
            )
        )
        for student_index, student_name in enumerate(source_group.get("students") or []):
            display_name = str(student_name)
            db.add(
                Student(
                    id=stable_id(user_id, "student", f"{group_legacy}:{student_index}:{display_name}"),
                    user_id=user_id,
                    class_group_id=group_id,
                    display_name=display_name,
                    active=True,
                )
            )


def save_workspace(
    db: Session,
    settings: Settings,
    user: User,
    content: dict[str, Any],
    *,
    schema_version: int = 2,
    expected_revision: int | None = None,
    extract_files: bool = True,
) -> UserWorkspace:
    workspace = db.scalar(select(UserWorkspace).where(UserWorkspace.user_id == user.id))
    if not workspace:
        workspace = UserWorkspace(user_id=user.id, content={}, schema_version=schema_version, revision=0)
        db.add(workspace)
        db.flush()
    if expected_revision is not None and expected_revision != workspace.revision:
        raise HTTPException(
            status_code=409, detail={"message": "Conflit de version", "revision": workspace.revision}
        )
    normalized_content, files_count = (
        extract_embedded_files(db, settings, user, content) if extract_files else (content, 0)
    )
    workspace.content = normalized_content
    workspace.schema_version = schema_version
    workspace.revision += 1
    _replace_normalized_data(db, user.id, normalized_content)
    db.flush()
    workspace.content.setdefault("serverMetadata", {})["migratedFiles"] = files_count
    return workspace
