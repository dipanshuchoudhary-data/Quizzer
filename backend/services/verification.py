import hashlib
import re
from typing import Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


VerificationFieldType = Literal["text", "select", "number"]
LEGACY_FIELD_KEYS = {
    "student_name",
    "enrollment_number",
    "course",
    "section",
    "batch",
    "semester",
    "class_name",
    "class_section",
}
_FIELD_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{1,63}$")


DEFAULT_VERIFICATION_SCHEMAS: dict[str, dict[str, Any]] = {
    "college": {
        "context": "college",
        "title": "College Verification",
        "description": "Collect structured academic identifiers before the exam begins.",
        "identity_fields": ["enrollment_number"],
        "fields": [
            {
                "key": "student_name",
                "label": "Student Name",
                "type": "text",
                "required": True,
                "min_length": 2,
                "max_length": 120,
                "placeholder": "Enter your full name",
            },
            {
                "key": "enrollment_number",
                "label": "Enrollment Number",
                "type": "text",
                "required": True,
                "min_length": 4,
                "max_length": 40,
                "pattern": r"^[A-Za-z0-9/_-]+$",
                "uppercase": True,
                "placeholder": "e.g. 22CS104",
            },
            {
                "key": "course",
                "label": "Course",
                "type": "text",
                "required": True,
                "min_length": 2,
                "max_length": 120,
                "placeholder": "e.g. B.Tech CSE",
            },
            {
                "key": "semester",
                "label": "Semester",
                "type": "select",
                "required": True,
                "options": [{"value": str(value), "label": f"Semester {value}"} for value in range(1, 9)],
            },
            {
                "key": "section",
                "label": "Section",
                "type": "text",
                "required": False,
                "max_length": 20,
                "pattern": r"^[A-Za-z0-9 -]{1,20}$",
                "uppercase": True,
                "placeholder": "e.g. A",
            },
            {
                "key": "batch",
                "label": "Batch",
                "type": "text",
                "required": False,
                "max_length": 20,
                "pattern": r"^[A-Za-z0-9/_ -]{1,20}$",
                "uppercase": True,
                "placeholder": "e.g. 2022-26",
            },
        ],
    },
    "school": {
        "context": "school",
        "title": "School Verification",
        "description": "Collect class and roll details relevant to school students.",
        "identity_fields": ["class_name", "class_section", "roll_number"],
        "fields": [
            {
                "key": "student_name",
                "label": "Student Name",
                "type": "text",
                "required": True,
                "min_length": 2,
                "max_length": 120,
                "placeholder": "Enter your full name",
            },
            {
                "key": "class_name",
                "label": "Class",
                "type": "select",
                "required": True,
                "options": [{"value": str(value), "label": f"Class {value}"} for value in range(1, 13)],
            },
            {
                "key": "class_section",
                "label": "Section",
                "type": "text",
                "required": False,
                "max_length": 10,
                "pattern": r"^[A-Za-z0-9 -]{1,10}$",
                "uppercase": True,
                "placeholder": "e.g. B",
            },
            {
                "key": "roll_number",
                "label": "Roll Number",
                "type": "number",
                "required": True,
                "placeholder": "e.g. 17",
            },
        ],
    },
    "coaching": {
        "context": "coaching",
        "title": "Coaching Verification",
        "description": "Capture the minimum reliable identifiers needed for coached or tutor-led exams.",
        "identity_fields": ["batch", "student_code", "student_name"],
        "fields": [
            {
                "key": "student_name",
                "label": "Student Name",
                "type": "text",
                "required": True,
                "min_length": 2,
                "max_length": 120,
                "placeholder": "Enter your full name",
            },
            {
                "key": "batch",
                "label": "Batch",
                "type": "text",
                "required": True,
                "min_length": 2,
                "max_length": 40,
                "pattern": r"^[A-Za-z0-9/_ -]+$",
                "uppercase": True,
                "placeholder": "e.g. JEE-Weekend-A",
            },
            {
                "key": "student_code",
                "label": "Student Code",
                "type": "text",
                "required": False,
                "max_length": 40,
                "pattern": r"^[A-Za-z0-9/_-]+$",
                "uppercase": True,
                "placeholder": "Optional internal student code",
            },
        ],
    },
}


class VerificationFieldOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    value: str
    label: str

    @model_validator(mode="after")
    def _normalize(self):
        self.value = str(self.value).strip()
        self.label = str(self.label).strip()
        if not self.value or not self.label:
            raise ValueError("verification options must include non-empty value and label")
        return self


class VerificationField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    label: str
    type: VerificationFieldType = "text"
    required: bool = False
    placeholder: str | None = None
    help_text: str | None = None
    options: list[VerificationFieldOption] = Field(default_factory=list)
    min_length: int | None = Field(default=None, ge=1, le=255)
    max_length: int | None = Field(default=None, ge=1, le=255)
    pattern: str | None = None
    lowercase: bool = False
    uppercase: bool = False

    @model_validator(mode="after")
    def _validate_field(self):
        self.key = str(self.key).strip()
        self.label = str(self.label).strip()
        if self.placeholder is not None:
            self.placeholder = str(self.placeholder).strip() or None
        if self.help_text is not None:
            self.help_text = str(self.help_text).strip() or None

        if not _FIELD_KEY_RE.fullmatch(self.key):
            raise ValueError("field keys must be snake_case and 2-64 characters long")
        if not self.label:
            raise ValueError("field labels must not be empty")
        if self.lowercase and self.uppercase:
            raise ValueError(f"field '{self.key}' cannot force both lowercase and uppercase")
        if self.min_length and self.max_length and self.min_length > self.max_length:
            raise ValueError(f"field '{self.key}' has min_length greater than max_length")
        if self.type == "select" and len(self.options) == 0:
            raise ValueError(f"field '{self.key}' must define options for select type")
        if self.type != "select" and len(self.options) > 0:
            raise ValueError(f"field '{self.key}' options are only allowed for select type")
        if self.pattern:
            re.compile(self.pattern)
        return self


class VerificationSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: str
    title: str
    description: str | None = None
    identity_fields: list[str] = Field(default_factory=list)
    fields: list[VerificationField]

    @model_validator(mode="after")
    def _validate_schema(self):
        self.context = str(self.context).strip().lower() or "custom"
        self.title = str(self.title).strip()
        if self.description is not None:
            self.description = str(self.description).strip() or None

        if not self.title:
            raise ValueError("verification title must not be empty")
        if len(self.fields) == 0:
            raise ValueError("verification schema must include at least one field")

        keys = [field.key for field in self.fields]
        if len(set(keys)) != len(keys):
            raise ValueError("verification field keys must be unique")

        known = set(keys)
        normalized_identity: list[str] = []
        for raw_key in self.identity_fields:
            key = str(raw_key).strip()
            if not key:
                continue
            if key not in known:
                raise ValueError(f"identity field '{key}' is not defined in the verification schema")
            if key not in normalized_identity:
                normalized_identity.append(key)

        if not normalized_identity:
            normalized_identity = [self.fields[0].key]

        self.identity_fields = normalized_identity
        return self


class VerificationResolution(BaseModel):
    model_config = ConfigDict(extra="forbid")

    context: str
    data: dict[str, str]
    identity_key: str
    display_identifier: str
    legacy_profile: dict[str, str | None]


def default_verification_schema(academic_type: str | None) -> dict[str, Any]:
    context = str(academic_type or "college").strip().lower()
    template = DEFAULT_VERIFICATION_SCHEMAS.get(context) or DEFAULT_VERIFICATION_SCHEMAS["college"]
    return VerificationSchema.model_validate(template).model_dump(mode="python")


def normalize_verification_schema(raw: dict[str, Any] | None, academic_type: str | None) -> dict[str, Any]:
    candidate = raw if isinstance(raw, dict) and raw else default_verification_schema(academic_type)
    try:
        return VerificationSchema.model_validate(candidate).model_dump(mode="python")
    except ValidationError:
        return default_verification_schema(academic_type)


def _normalize_submitted_value(field: VerificationField, raw_value: Any) -> str:
    value = str(raw_value).strip()
    if field.uppercase:
        value = value.upper()
    if field.lowercase:
        value = value.lower()

    if field.type == "number":
        if not re.fullmatch(r"-?\d+", value):
            raise ValueError(f"{field.label} must be a valid number")
        value = str(int(value))

    if field.type == "select":
        allowed = {option.value for option in field.options}
        if value not in allowed:
            raise ValueError(f"{field.label} must be one of the allowed options")

    if field.min_length and len(value) < field.min_length:
        raise ValueError(f"{field.label} must be at least {field.min_length} characters")
    if field.max_length and len(value) > field.max_length:
        raise ValueError(f"{field.label} must be at most {field.max_length} characters")
    if field.pattern and not re.fullmatch(field.pattern, value):
        raise ValueError(f"{field.label} has an invalid format")

    return value


def validate_verification_submission(schema_raw: dict[str, Any], payload_data: Any) -> VerificationResolution:
    try:
        schema = VerificationSchema.model_validate(schema_raw)
    except ValidationError as exc:
        raise HTTPException(status_code=500, detail="Stored verification schema is invalid") from exc

    if not isinstance(payload_data, dict):
        raise HTTPException(status_code=422, detail="verification_data must be an object")

    expected_keys = {field.key for field in schema.fields}
    unexpected_keys = sorted(set(payload_data.keys()) - expected_keys)
    if unexpected_keys:
        raise HTTPException(status_code=422, detail=f"Unknown verification fields: {', '.join(unexpected_keys)}")

    normalized: dict[str, str] = {}
    errors: list[str] = []
    for field in schema.fields:
        raw_value = payload_data.get(field.key)
        if raw_value is None or (isinstance(raw_value, str) and raw_value.strip() == ""):
            if field.required:
                errors.append(f"{field.label} is required")
            continue
        try:
            normalized[field.key] = _normalize_submitted_value(field, raw_value)
        except ValueError as exc:
            errors.append(str(exc))

    if errors:
        raise HTTPException(status_code=422, detail="Invalid verification data: " + "; ".join(errors))

    identity_parts: list[str] = []
    for key in schema.identity_fields:
        value = normalized.get(key)
        if value:
            identity_parts.append(f"{key}={value.lower()}")
    if not identity_parts:
        raise HTTPException(status_code=422, detail="Verification data is missing the configured identity fields")

    identity_source = f"{schema.context}|{'|'.join(identity_parts)}"
    identity_key = hashlib.sha256(identity_source.encode("utf-8")).hexdigest()[:64]
    display_identifier = next((normalized.get(key) for key in schema.identity_fields if normalized.get(key)), "")
    student_name = normalized.get("student_name") or display_identifier

    legacy_profile: dict[str, str | None] = {key: None for key in LEGACY_FIELD_KEYS}
    for key in LEGACY_FIELD_KEYS:
        if key in normalized:
            legacy_profile[key] = normalized[key]

    if not legacy_profile["student_name"]:
        legacy_profile["student_name"] = student_name
    if not legacy_profile["enrollment_number"]:
        legacy_profile["enrollment_number"] = display_identifier or student_name

    return VerificationResolution(
        context=schema.context,
        data=normalized,
        identity_key=identity_key,
        display_identifier=display_identifier or student_name,
        legacy_profile=legacy_profile,
    )
