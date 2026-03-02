"""
Synthetic CRM data seeder.

Inserts realistic CRM records into Qdrant (semantic memory) and PostgreSQL
(episodic + procedural memory) so the orchestrator has rich context to answer
chat questions about customers, deals, contacts and support.

Run inside the crm-orchestrator container:
    docker exec crm-orchestrator python3 /app/seed_data.py
"""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone

import httpx
import google.genai as genai
from google.genai import types as gtypes
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

# ── Config ───────────────────────────────────────────────────────────────────

BACKEND_URL   = "http://crm-backend:8080"
QDRANT_HOST   = "crm-qdrant"
QDRANT_PORT   = 6333
COLLECTION    = "crm_semantic"
EMBED_MODEL   = "models/gemini-embedding-001"
EMBED_DIMS    = 768           # matches existing Qdrant collection
SYSTEM_SESSION = "00000000-0000-0000-0000-000000000000"

genai_client = genai.Client()
qdrant       = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)

# ── Synthetic CRM dataset ─────────────────────────────────────────────────────

CONTACTS = [
    {
        "id": "c-001",
        "name": "Sarah Johnson",
        "title": "VP of Engineering",
        "company": "TechNova Inc.",
        "email": "sarah.j@technova.io",
        "phone": "+1-415-555-0101",
        "status": "customer",
        "last_contact": "2026-02-15",
        "notes": "Sarah is the primary technical decision-maker at TechNova. She champions our AI infrastructure product. Prefers async Slack communication. Very responsive during US Pacific mornings.",
    },
    {
        "id": "c-002",
        "name": "Marcus Reid",
        "title": "Chief Procurement Officer",
        "company": "GlobalRetail Corp.",
        "email": "m.reid@globalretail.com",
        "phone": "+1-212-555-0202",
        "status": "prospect",
        "last_contact": "2026-02-20",
        "notes": "Marcus controls the procurement budget at GlobalRetail. He's evaluating 3 vendors including us. Key concerns: GDPR compliance and on-premise deployment option. Decision expected Q1 2026.",
    },
    {
        "id": "c-003",
        "name": "Priya Sharma",
        "title": "Head of Customer Success",
        "company": "FinEdge Solutions",
        "email": "priya@finedge.co",
        "phone": "+44-20-555-0303",
        "status": "customer",
        "last_contact": "2026-01-30",
        "notes": "Priya manages 12 enterprise accounts at FinEdge. Loves product demos and has referred 2 new customers. Renewal due in June 2026. Interested in advanced analytics add-on.",
    },
    {
        "id": "c-004",
        "name": "Daniel Kim",
        "title": "CEO",
        "company": "StartSmart AI",
        "email": "daniel@startsmart.ai",
        "phone": "+1-650-555-0404",
        "status": "lead",
        "last_contact": "2026-02-24",
        "notes": "Daniel is the founder and CEO of StartSmart AI, a 30-person Series A startup. They're building AI agents and need a CRM that integrates with LLMs. Budget: $50K/year. Very technical background.",
    },
    {
        "id": "c-005",
        "name": "Elena Vasquez",
        "title": "Director of Sales Operations",
        "company": "MedCore Systems",
        "email": "evasquez@medcore.com",
        "phone": "+1-312-555-0505",
        "status": "churned",
        "last_contact": "2025-11-10",
        "notes": "Elena's team churned after 18 months due to lack of HIPAA compliance certification. She indicated they'd revisit in Q3 2026 if we achieve SOC2 + HIPAA. Relationship is warm.",
    },
]

DEALS = [
    {
        "id": "d-001",
        "name": "TechNova Enterprise Expansion",
        "company": "TechNova Inc.",
        "contact": "Sarah Johnson",
        "stage": "Negotiation",
        "value": 180000,
        "currency": "USD",
        "probability": 80,
        "close_date": "2026-03-31",
        "owner": "Alice Torres",
        "notes": "Expanding from Starter to Enterprise plan. Adding 50 more seats. Custom SLA negotiation in progress. Legal review started. Waiting on redlines from TechNova's legal team.",
    },
    {
        "id": "d-002",
        "name": "GlobalRetail CRM Pilot",
        "company": "GlobalRetail Corp.",
        "contact": "Marcus Reid",
        "stage": "Proposal Sent",
        "value": 240000,
        "currency": "USD",
        "probability": 45,
        "close_date": "2026-04-15",
        "owner": "Bob Chen",
        "notes": "Annual contract for 200 seats. Sent proposal on Feb 18. Competitors: Salesforce and HubSpot. Our differentiator is AI-native architecture. Pending security questionnaire response.",
    },
    {
        "id": "d-003",
        "name": "FinEdge Analytics Upsell",
        "company": "FinEdge Solutions",
        "contact": "Priya Sharma",
        "stage": "Discovery",
        "value": 36000,
        "currency": "USD",
        "probability": 70,
        "close_date": "2026-05-30",
        "owner": "Alice Torres",
        "notes": "Upsell opportunity for the Advanced Analytics module. Priya requested a custom demo showing revenue attribution reports. Demo scheduled for March 5.",
    },
    {
        "id": "d-004",
        "name": "StartSmart AI Starter",
        "company": "StartSmart AI",
        "contact": "Daniel Kim",
        "stage": "Qualification",
        "value": 18000,
        "currency": "USD",
        "probability": 60,
        "close_date": "2026-03-15",
        "owner": "Bob Chen",
        "notes": "Small startup deal but high strategic value — Daniel is a KOL in the AI space. Evaluating Starter plan. Needs API-first access and Slack integration. Trial started Feb 22.",
    },
]

SUPPORT_TICKETS = [
    {
        "id": "t-001",
        "company": "TechNova Inc.",
        "contact": "Sarah Johnson",
        "subject": "API rate limits causing workflow failures",
        "status": "Resolved",
        "priority": "High",
        "opened": "2026-02-10",
        "resolved": "2026-02-12",
        "resolution": "Increased rate limits to 10K req/min for Enterprise plan. Updated their API key. Root cause: spike in ML training pipeline calls.",
    },
    {
        "id": "t-002",
        "company": "FinEdge Solutions",
        "contact": "Priya Sharma",
        "subject": "SSO integration broken after IdP migration",
        "status": "In Progress",
        "priority": "Critical",
        "opened": "2026-02-25",
        "resolved": None,
        "resolution": "Engineering team investigating SAML assertion format change. ETA: 48 hours.",
    },
    {
        "id": "t-003",
        "company": "StartSmart AI",
        "contact": "Daniel Kim",
        "subject": "Webhook delivery failures to custom endpoint",
        "status": "Open",
        "priority": "Medium",
        "opened": "2026-02-26",
        "resolved": None,
        "resolution": "Pending review. Likely TLS certificate issue on their side.",
    },
]

ACCOUNTS = [
    {
        "id": "a-001",
        "name": "TechNova Inc.",
        "industry": "SaaS / AI Infrastructure",
        "employees": 320,
        "arr": 180000,
        "plan": "Enterprise",
        "since": "2024-08-01",
        "health_score": 92,
        "nps": 9,
        "summary": "TechNova is our strongest enterprise customer. Paying $180K ARR on Enterprise plan. High NPS (9/10), zero churn risk. Power user of AI workflow automation features. 3 open support tickets in past 6 months, all resolved quickly. Strong champion in Sarah Johnson.",
    },
    {
        "id": "a-002",
        "name": "FinEdge Solutions",
        "industry": "FinTech",
        "employees": 85,
        "arr": 48000,
        "plan": "Professional",
        "since": "2024-03-15",
        "health_score": 74,
        "nps": 7,
        "summary": "FinEdge Solutions on Professional plan. Moderate health score (74) due to ongoing SSO issue. Renewal in June 2026. Upsell opportunity for Analytics module worth $36K. Priya is a strong advocate. Risk: SSO issue must be resolved quickly.",
    },
    {
        "id": "a-003",
        "name": "StartSmart AI",
        "industry": "AI / Startup",
        "employees": 30,
        "arr": 0,
        "plan": "Trial",
        "since": "2026-02-22",
        "health_score": 65,
        "nps": None,
        "summary": "StartSmart AI in active trial since Feb 22. Startup with $50K budget. High engagement with API documentation. CEO Daniel Kim is hands-on and technical. Webhook issue may affect conversion. Target close: March 15.",
    },
]

KNOWLEDGE_BASE = [
    {
        "id": "kb-001",
        "title": "Enterprise Plan Features",
        "content": "The Enterprise plan includes: unlimited seats, custom SLAs (99.99% uptime), dedicated support engineer, SAML SSO, advanced analytics, API rate limit of 10K req/min, custom data residency (US/EU/APAC), RBAC with 50+ permission levels, audit logs (7-year retention), and white-glove onboarding. Pricing starts at $150K/year. Volume discounts available for 500+ seats.",
    },
    {
        "id": "kb-002",
        "title": "Compliance & Security Certifications",
        "content": "Current certifications: SOC2 Type II (renewed Jan 2026), ISO 27001, GDPR compliant, CCPA compliant. In progress: HIPAA (expected Q3 2026), FedRAMP Moderate (2027 target). Data is encrypted at rest (AES-256) and in transit (TLS 1.3). Penetration testing done quarterly by Bishop Fox.",
    },
    {
        "id": "kb-003",
        "title": "Pricing Tiers Overview",
        "content": "Starter: $1,500/month (up to 10 seats, basic CRM, email integration). Professional: $4,000/month (up to 50 seats, API access, SSO, webhooks, standard analytics). Enterprise: Custom pricing from $12,500/month (unlimited seats, custom SLAs, advanced AI features, dedicated CSM, custom integrations). Annual commitment required for >10% discount.",
    },
    {
        "id": "kb-004",
        "title": "Integration Ecosystem",
        "content": "Native integrations: Salesforce, HubSpot, Slack, Microsoft Teams, Gmail, Outlook, Zoom, Stripe, QuickBooks, Jira, GitHub, Zendesk. API-first with REST and GraphQL. Webhooks support real-time event streaming. SDK available in Python, JavaScript/TypeScript, Go, Ruby. Zapier and Make (Integromat) supported for no-code workflows.",
    },
    {
        "id": "kb-005",
        "title": "Churn Prevention Playbook",
        "content": "Key churn signals: health score below 60, NPS below 6, support tickets > 5/month, DAU drop > 30%, payment failure. Actions: (1) Trigger CSM outreach within 24h, (2) Schedule executive sponsor call, (3) Offer feature training session, (4) Consider temporary plan credit (up to 20%), (5) Escalate to VP of Customer Success if health score < 40 for 2+ weeks.",
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def embed(text: str) -> list[float]:
    """Generate 768-dim embedding using Gemini."""
    result = genai_client.models.embed_content(
        model=EMBED_MODEL,
        contents=text,
        config=gtypes.EmbedContentConfig(output_dimensionality=EMBED_DIMS),
    )
    return list(result.embeddings[0].values)


def upsert_qdrant(point_id: str, vector: list[float], payload: dict) -> None:
    """Insert a single point into Qdrant."""
    qdrant.upsert(
        collection_name=COLLECTION,
        points=[PointStruct(id=point_id, vector=vector, payload=payload)],
    )


async def record_episode(entity_id: str, entity_type: str, event_type: str, summary: str) -> None:
    """POST to /api/v1/memory/episodic."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{BACKEND_URL}/api/v1/memory/episodic", json={
            "entityId": entity_id,
            "entityType": entity_type,
            "eventType": event_type,
            "summary": summary,
            "agentId": "seed-script",
            "metadata": {"seeded": True, "timestamp": datetime.now(timezone.utc).isoformat()},
        })
        if resp.status_code not in (200, 201):
            print(f"  ⚠ episodic POST failed: {resp.status_code} — {resp.text[:120]}")


async def create_procedure(name: str, description: str, trigger_intent: str, steps: list[dict]) -> None:
    """POST to /api/v1/memory/procedural."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"{BACKEND_URL}/api/v1/memory/procedural", json={
            "name": name,
            "description": description,
            "triggerConditions": [{"intent": trigger_intent}],
            "steps": steps,
            "agentScope": ["crm-orchestrator"],
            "createdBy": "seed-script",
            "metadata": {"seeded": True},
        })
        if resp.status_code not in (200, 201):
            print(f"  ⚠ procedural POST failed: {resp.status_code} — {resp.text[:120]}")


# ── Main seeder ───────────────────────────────────────────────────────────────

async def seed() -> None:
    print("🌱 CRM Synthetic Data Seeder\n")
    total = 0

    # ── 1. Contacts ────────────────────────────────────────────────────────────
    print("📇 Seeding contacts...")
    for c in CONTACTS:
        text = (
            f"Contact: {c['name']}, {c['title']} at {c['company']}. "
            f"Email: {c['email']}. Phone: {c['phone']}. Status: {c['status']}. "
            f"Last contacted: {c['last_contact']}. Notes: {c['notes']}"
        )
        vector = embed(text)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"contact-{c['id']}"))
        upsert_qdrant(point_id, vector, {
            "entity_id": c["id"],
            "entity_type": "contact",
            "source_agent": "seed-script",
            "content_type": "contact_profile",
            "content": text,
            "name": c["name"],
            "company": c["company"],
            "status": c["status"],
        })
        await record_episode(c["id"], "contact", "CONTACT_CREATED",
            f"Contact {c['name']} ({c['title']}) at {c['company']} — status: {c['status']}")
        print(f"  ✓ {c['name']} @ {c['company']}")
        total += 1

    # ── 2. Deals ───────────────────────────────────────────────────────────────
    print("\n💰 Seeding deals...")
    for d in DEALS:
        text = (
            f"Deal: {d['name']}. Company: {d['company']}. Contact: {d['contact']}. "
            f"Stage: {d['stage']}. Value: ${d['value']:,} {d['currency']}. "
            f"Probability: {d['probability']}%. Expected close: {d['close_date']}. "
            f"Owner: {d['owner']}. Notes: {d['notes']}"
        )
        vector = embed(text)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"deal-{d['id']}"))
        upsert_qdrant(point_id, vector, {
            "entity_id": d["id"],
            "entity_type": "deal",
            "source_agent": "seed-script",
            "content_type": "deal_record",
            "content": text,
            "name": d["name"],
            "company": d["company"],
            "stage": d["stage"],
            "value": d["value"],
        })
        await record_episode(d["id"], "deal", "DEAL_UPDATED",
            f"Deal '{d['name']}' — {d['stage']}, ${d['value']:,}, close: {d['close_date']}")
        print(f"  ✓ {d['name']} — {d['stage']} (${d['value']:,})")
        total += 1

    # ── 3. Support tickets ────────────────────────────────────────────────────
    print("\n🎫 Seeding support tickets...")
    for t in SUPPORT_TICKETS:
        text = (
            f"Support ticket {t['id']} for {t['company']} (contact: {t['contact']}). "
            f"Subject: {t['subject']}. Status: {t['status']}. Priority: {t['priority']}. "
            f"Opened: {t['opened']}. "
            f"{'Resolved: ' + t['resolved'] + '. ' if t['resolved'] else ''}"
            f"Notes: {t['resolution']}"
        )
        vector = embed(text)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ticket-{t['id']}"))
        upsert_qdrant(point_id, vector, {
            "entity_id": t["id"],
            "entity_type": "support_ticket",
            "source_agent": "seed-script",
            "content_type": "support_record",
            "content": text,
            "company": t["company"],
            "status": t["status"],
            "priority": t["priority"],
        })
        await record_episode(t["id"], "support_ticket", "TICKET_EVENT",
            f"Ticket '{t['subject']}' for {t['company']} — {t['status']} ({t['priority']})")
        print(f"  ✓ [{t['priority']}] {t['subject'][:50]} — {t['status']}")
        total += 1

    # ── 4. Accounts ───────────────────────────────────────────────────────────
    print("\n🏢 Seeding accounts...")
    for a in ACCOUNTS:
        text = (
            f"Account: {a['name']}. Industry: {a['industry']}. Employees: {a['employees']}. "
            f"ARR: ${a['arr']:,}. Plan: {a['plan']}. Customer since: {a['since']}. "
            f"Health score: {a['health_score']}. NPS: {a.get('nps', 'N/A')}. "
            f"Summary: {a['summary']}"
        )
        vector = embed(text)
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"account-{a['id']}"))
        upsert_qdrant(point_id, vector, {
            "entity_id": a["id"],
            "entity_type": "account",
            "source_agent": "seed-script",
            "content_type": "account_summary",
            "content": text,
            "name": a["name"],
            "plan": a["plan"],
            "arr": a["arr"],
            "health_score": a["health_score"],
        })
        await record_episode(a["id"], "account", "ACCOUNT_REVIEWED",
            f"Account {a['name']} — {a['plan']}, ARR ${a['arr']:,}, health {a['health_score']}")
        print(f"  ✓ {a['name']} — {a['plan']} plan (health: {a['health_score']})")
        total += 1

    # ── 5. Knowledge base ─────────────────────────────────────────────────────
    print("\n📚 Seeding knowledge base...")
    for kb in KNOWLEDGE_BASE:
        vector = embed(kb["content"])
        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"kb-{kb['id']}"))
        upsert_qdrant(point_id, vector, {
            "entity_id": kb["id"],
            "entity_type": "knowledge_base",
            "source_agent": "seed-script",
            "content_type": "knowledge_article",
            "content": kb["content"],
            "title": kb["title"],
        })
        print(f"  ✓ {kb['title']}")
        total += 1

    # ── 6. Procedural memory ──────────────────────────────────────────────────
    print("\n📋 Seeding procedures...")
    await create_procedure(
        name="customer_lookup",
        description="Look up a customer by name, company, or email and return their profile, deals and health",
        trigger_intent="customer_lookup",
        steps=[
            {"step": 1, "action": "search_semantic_memory", "params": {"entity_type": "contact"}},
            {"step": 2, "action": "fetch_account_summary", "params": {"entity_type": "account"}},
            {"step": 3, "action": "list_open_deals", "params": {"entity_type": "deal"}},
            {"step": 4, "action": "check_support_tickets", "params": {"entity_type": "support_ticket"}},
            {"step": 5, "action": "return_consolidated_profile"},
        ],
    )
    await create_procedure(
        name="deal_pipeline_review",
        description="Summarise the current deal pipeline: stages, values, probabilities and next actions",
        trigger_intent="pipeline_review",
        steps=[
            {"step": 1, "action": "list_all_deals", "params": {"entity_type": "deal"}},
            {"step": 2, "action": "group_by_stage"},
            {"step": 3, "action": "calculate_weighted_pipeline"},
            {"step": 4, "action": "highlight_at_risk_deals"},
            {"step": 5, "action": "suggest_next_actions"},
        ],
    )
    await create_procedure(
        name="churn_risk_assessment",
        description="Identify accounts at risk of churn based on health score, NPS and support volume",
        trigger_intent="churn_risk",
        steps=[
            {"step": 1, "action": "list_all_accounts"},
            {"step": 2, "action": "filter_low_health_scores", "params": {"threshold": 70}},
            {"step": 3, "action": "check_recent_tickets"},
            {"step": 4, "action": "apply_churn_prevention_playbook"},
        ],
    )
    print("  ✓ customer_lookup, deal_pipeline_review, churn_risk_assessment")

    # ── Done ──────────────────────────────────────────────────────────────────
    # Verify count in Qdrant
    info = qdrant.get_collection(COLLECTION)
    print(f"\n✅ Seeding complete! Inserted {total} records.")
    print(f"   Qdrant collection '{COLLECTION}': {info.points_count} total points")
    print("\nYou can now ask the CRM agent about:")
    print("  • Customers: Sarah Johnson, Marcus Reid, Priya Sharma, Daniel Kim, Elena Vasquez")
    print("  • Companies: TechNova, GlobalRetail, FinEdge Solutions, StartSmart AI, MedCore")
    print("  • Deals: TechNova expansion, GlobalRetail pilot, FinEdge upsell, StartSmart trial")
    print("  • Support: ticket status, SSO issue at FinEdge, API rate limits at TechNova")
    print("  • Knowledge: pricing, compliance certs, integrations, churn playbook")


if __name__ == "__main__":
    asyncio.run(seed())
