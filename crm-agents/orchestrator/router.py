"""
Agent Router — determines which sub-agent(s) to delegate a task to
based on intent keywords and scoring heuristics.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class RouteDecision:
    primary_agent: str
    skill_id: str
    secondary_agents: list[str]
    mode: str   # sequential | parallel | loop
    confidence: float


# Intent → (agent, skill, mode) mapping rules (priority ordered)
_ROUTING_RULES = [
    # Context-related intents
    (re.compile(r'\b(context|session|recall|background|history)\b', re.I),
     "crm-context-agent", "build_context", "sequential"),

    # Memory search / episodic
    (re.compile(r'\b(search|find|look\s*up|retrieve|remember|past|previous)\b', re.I),
     "crm-memory-agent", "semantic_search", "sequential"),

    # Memory write / consolidate
    (re.compile(r'\b(save|store|remember|record|note|log)\b', re.I),
     "crm-memory-agent", "memory_write", "sequential"),

    # Procedure / workflow lookup
    (re.compile(r'\b(workflow|procedure|process|playbook|step|how\s+to)\b', re.I),
     "crm-memory-agent", "memory_read", "sequential"),

    # Memory consolidation
    (re.compile(r'\b(consolidat|summariz|compress)\b', re.I),
     "crm-memory-agent", "consolidate_memory", "sequential"),

    # Web search — quick lookups, specific factual queries
    (re.compile(
        r'\b(search the web|google|web search|internet|online|'
        r'stock price|weather|'
        r'what is|who is|how does|when did|where is|'
        r'trending|breaking)\b',
        re.I,
    ), "crm-web-search-agent", "web_search", "sequential"),

    # News & deep research — Perplexity-grounded research with citations
    (re.compile(
        r'\b(news|latest|current events|today|recent|'
        r'research|analyze|analyse|deep dive|comprehensive|in.?depth|'
        r'developments|market analysis|trends|'
        r'report|findings|study|survey|statistics|data on|'
        r'fact.?check|verify|is it true|what happened|'
        r'tell me about|explain|overview of|summary of)\b',
        re.I,
    ), "crm-news-research-agent", "research", "sequential"),
]

_DEFAULT_ROUTE = RouteDecision(
    primary_agent="crm-memory-agent",
    skill_id="semantic_search",
    secondary_agents=["crm-context-agent"],
    mode="sequential",
    confidence=0.3,
)


class AgentRouter:

    async def route(self, intent: str) -> RouteDecision:
        """Determine the best agent route for the given intent string."""
        for pattern, agent, skill, mode in _ROUTING_RULES:
            if pattern.search(intent):
                return RouteDecision(
                    primary_agent=agent,
                    skill_id=skill,
                    secondary_agents=[],
                    mode=mode,
                    confidence=0.85,
                )
        return _DEFAULT_ROUTE
