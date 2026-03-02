"""
A2A Protocol data models (v0.3 schema).
"""
from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field
import uuid


class A2ATaskStatus(str, Enum):
    SUBMITTED = "submitted"
    WORKING = "working"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class MessagePart(BaseModel):
    type: str = "text"
    text: str | None = None
    data: Any | None = None
    mime_type: str | None = None


class A2AMessage(BaseModel):
    role: str = "user"   # user | agent | system
    parts: list[MessagePart] = Field(default_factory=list)

    @classmethod
    def text(cls, content: str, role: str = "user") -> "A2AMessage":
        return cls(role=role, parts=[MessagePart(type="text", text=content)])


class A2AArtifact(BaseModel):
    name: str
    mime_type: str = "application/json"
    content: Any = None


class A2ATask(BaseModel):
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    status: A2ATaskStatus = A2ATaskStatus.SUBMITTED
    message: A2AMessage
    artifacts: list[A2AArtifact] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class TaskSendRequest(BaseModel):
    task_id: str | None = None
    session_id: str
    message: A2AMessage
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentSkill(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    input_schema: dict[str, Any] | None = None


class AgentCapabilities(BaseModel):
    streaming: bool = False
    push_notifications: bool = False
    state_transition_history: bool = True
    parallel_task_execution: bool = False


class AgentCard(BaseModel):
    schema_version: str = "0.3"
    name: str
    display_name: str
    description: str
    version: str = "0.1.0"
    url: str
    documentation_url: str | None = None
    capabilities: AgentCapabilities = Field(default_factory=AgentCapabilities)
    authentication: dict[str, Any] = Field(
        default_factory=lambda: {"schemes": ["Bearer"], "required": False}
    )
    default_input_modes: list[str] = Field(
        default_factory=lambda: ["text/plain", "application/json"]
    )
    default_output_modes: list[str] = Field(
        default_factory=lambda: ["text/plain", "application/json"]
    )
    skills: list[AgentSkill] = Field(default_factory=list)
