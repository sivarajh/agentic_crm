"""Unit tests for the orchestrator router."""
import pytest
from orchestrator.router import AgentRouter


@pytest.mark.asyncio
async def test_router_routes_memory_search():
    router = AgentRouter()
    result = await router.route("search customer history")
    assert result.primary_agent == "crm-memory-agent"
    assert result.skill_id == "semantic_search"


@pytest.mark.asyncio
async def test_router_routes_context():
    router = AgentRouter()
    result = await router.route("recall the session context for this user")
    assert result.primary_agent == "crm-context-agent"
    assert result.skill_id == "build_context"


@pytest.mark.asyncio
async def test_router_routes_memory_write():
    router = AgentRouter()
    result = await router.route("save this note about the customer")
    assert result.primary_agent == "crm-memory-agent"
    assert result.skill_id == "memory_write"


@pytest.mark.asyncio
async def test_router_default_fallback():
    router = AgentRouter()
    result = await router.route("xyz unrecognized intent")
    # Should not raise; returns a default route
    assert result.primary_agent is not None
    assert result.confidence < 0.5
