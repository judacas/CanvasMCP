# Building Production MCP Servers with FastMCP, Python, and Docker: A Complete Guide

**Last Updated:** November 22, 2025  
**Target Audience:** Hackathon developers, full-stack engineers building agentic AI systems  
**Time to Implementation:** 2-6 hours (from zero to production-ready MCP)

---

## Table of Contents

1. [Introduction & Mental Models](#1-introduction--mental-models)
2. [MCP vs REST API: Design Philosophy](#2-mcp-vs-rest-api-design-philosophy)
3. [Environment Setup](#3-environment-setup)
4. [Building Your First FastMCP Server (Bare-Metal)](#4-building-your-first-fastmcp-server-bare-metal)
5. [Secrets & Per-User Configuration](#5-secrets--per-user-configuration)
6. [Dockerizing Your MCP Server](#6-dockerizing-your-mcp-server)
7. [Docker Hub Publishing & Distribution](#7-docker-hub-publishing--distribution)
8. [GraphQL Integration Patterns](#8-graphql-integration-patterns)
9. [MCP Client Configuration](#9-mcp-client-configuration)
10. [Testing & Debugging](#10-testing--debugging)
11. [Production Best Practices](#11-production-best-practices)
12. [Quick Start Checklist](#12-quick-start-checklist)
13. [Design Checklist](#13-design-checklist)

---

## 1. Introduction & Mental Models

### What is MCP?

The **Model Context Protocol (MCP)** is an open standard (released by Anthropic in November 2024, with major updates in June and November 2025) that enables AI assistants to securely connect to external data sources and tools. Think of it as **USB-C for AI applications** — a universal, standardized protocol for connecting LLMs to the systems where data and capabilities live.

### Key Concepts

**Three-Layer Architecture:**

```
┌─────────────────────┐
│   MCP Host          │  (Claude Desktop, Cursor, VS Code, OpenAI clients)
│   (LLM Application) │
└──────────┬──────────┘
           │ JSON-RPC over stdio/HTTP
┌──────────▼──────────┐
│   MCP Client        │  (Connector inside host, manages protocol)
│   (in Host)         │
└──────────┬──────────┘
           │ MCP Protocol
┌──────────▼──────────┐
│   MCP Server        │  ← YOU BUILD THIS
│   (Tools, Resources,│
│    Prompts)         │
└──────────┬──────────┘
           │ Internal calls
┌──────────▼──────────┐
│   External APIs     │  (GraphQL, REST, databases, etc.)
│   (GraphQL, etc.)   │
└─────────────────────┘
```

**Mental Model Shift:**

- **Traditional API:** Built for human developers to integrate into applications
- **MCP Server:** Built for AI agents to discover, understand, and orchestrate autonomously

Think of your MCP server as a **specialized librarian for an AI agent** — it doesn't just execute requests, it helps the agent understand what's possible and how to accomplish complex goals through tool composition.

### Why FastMCP?

**FastMCP** (created by Jeremiah Lowin) is the most Pythonic and developer-friendly framework for building MCP servers. As of November 2025:

- **Automatic schema generation** from Python type hints
- **Sync and async tool support** out of the box
- **Zero boilerplate** — decorators handle MCP protocol details
- **Production-ready** with proper error handling and logging
- **Active ecosystem** with 270+ servers in the Docker MCP Registry

**Current Spec Version:** MCP 2025-06-18 (next major release: November 25, 2025)

---

## 2. MCP vs REST API: Design Philosophy

### Fundamental Differences

| Aspect | REST API | MCP Server |
|--------|----------|------------|
| **Consumer** | Human developers writing code | AI agents planning autonomously |
| **Discovery** | Documentation (OpenAPI/Swagger) | Live schema introspection via protocol |
| **Design Goal** | Resource-oriented CRUD | Action-oriented tools for agent composition |
| **Granularity** | Endpoints may bundle multiple operations | Small, single-purpose tools |
| **Schema** | Optional, human-readable docs | Mandatory, machine-readable, strongly typed |
| **Error Handling** | HTTP status codes, human messages | Structured errors AI can reason about |
| **Orchestration** | Client app chains calls | Agent plans multi-step workflows |
| **Auth Model** | API keys, OAuth per service | Per-user credentials via client configuration |

### Design Pattern Comparison

**Example: E-commerce Order System**

**❌ REST API Approach:**
```python
# Traditional REST endpoints
POST   /api/orders              # Create order
GET    /api/orders/{id}         # Get order
PUT    /api/orders/{id}         # Update order
DELETE /api/orders/{id}         # Cancel order
POST   /api/orders/{id}/ship    # Ship order
GET    /api/orders/{id}/status  # Get status
POST   /api/payments            # Process payment
```

**✅ MCP Server Approach:**
```python
# Agent-friendly tools (small, composable, explicit)
@mcp.tool()
def search_products(query: str, category: str = None) -> list[Product]:
    """Find products matching search criteria"""
    
@mcp.tool()
def check_inventory(product_id: str) -> InventoryStatus:
    """Check if product is in stock"""
    
@mcp.tool()
def calculate_shipping(zip_code: str, items: list[str]) -> ShippingQuote:
    """Get shipping cost estimate"""
    
@mcp.tool()
def create_order(items: list[OrderItem], shipping_address: Address) -> OrderConfirmation:
    """Create new order (does not charge payment)"""
    
@mcp.tool()
def process_payment(order_id: str, payment_method: PaymentMethod) -> PaymentResult:
    """Charge payment for existing order"""
```

**Why This Works Better for Agents:**

1. **Agent can explore options**: "Should I order this?" → check_inventory first
2. **Composable workflows**: Agent chains search → check_inventory → calculate_shipping → create_order → process_payment
3. **Clear failure points**: Each tool can fail independently with structured errors
4. **Explicit intent**: `create_order` doesn't secretly charge payment (agent controls flow)

### Critical Design Principles for MCPs

#### 1. **Tool Granularity: Atomic Operations**

**❌ Bad: Multi-purpose "do-everything" tools**
```python
@mcp.tool()
def manage_order(
    action: str,  # "create" | "update" | "cancel" | "ship"
    order_id: str = None,
    order_data: dict = None,
) -> dict:
    """Manage orders (create, update, cancel, ship)"""
    # Agent must guess which fields to provide for which action
```

**✅ Good: Single-purpose, predictable tools**
```python
@mcp.tool()
def create_order(items: list[OrderItem], address: Address) -> OrderConfirmation:
    """Create a new order. Does not process payment."""

@mcp.tool()
def cancel_order(order_id: str, reason: str) -> CancellationConfirmation:
    """Cancel an existing order. Refunds are processed separately."""
```

#### 2. **Strong, Explicit Type Schemas**

**❌ Bad: Weak types, ambiguous structures**
```python
@mcp.tool()
def process_data(data: dict, options: dict = None) -> dict:
    """Process some data with optional configuration"""
```

**✅ Good: Pydantic models, explicit enums**
```python
from pydantic import BaseModel, Field
from enum import Enum

class OrderPriority(str, Enum):
    STANDARD = "standard"
    EXPRESS = "express"
    OVERNIGHT = "overnight"

class OrderItem(BaseModel):
    product_id: str = Field(..., description="Unique product identifier")
    quantity: int = Field(..., gt=0, description="Number of items")
    
class OrderResult(BaseModel):
    order_id: str
    estimated_delivery: str  # ISO 8601 date
    total_cost: float
    
@mcp.tool()
def create_order(
    items: list[OrderItem],
    priority: OrderPriority = OrderPriority.STANDARD
) -> OrderResult:
    """Create order with explicit priority level"""
```

#### 3. **Idempotence & Retry-Friendliness**

Agents may retry operations due to uncertainty or errors. Design accordingly:

```python
@mcp.tool()
def create_order(
    idempotency_key: str,  # Client-provided unique key
    items: list[OrderItem]
) -> OrderResult:
    """
    Create order. Safe to retry with same idempotency_key.
    Returns existing order if already created.
    """
    existing = db.get_order_by_idempotency_key(idempotency_key)
    if existing:
        return OrderResult.from_db(existing)
    
    return db.create_order(idempotency_key, items)
```

#### 4. **Structured, Agent-Parseable Errors**

**❌ Bad: Human-oriented error messages**
```python
raise Exception("Order failed: database timeout, please try again later")
```

**✅ Good: Structured errors with error codes**
```python
from fastmcp import ToolError

raise ToolError(
    error_code="DATABASE_TIMEOUT",
    message="Order creation failed due to database timeout",
    retryable=True,
    retry_after_seconds=30,
    details={"operation": "create_order", "order_id": order_id}
)
```

#### 5. **Resources vs Tools**

**Tools:** Perform actions (mutations, queries with side effects)  
**Resources:** Provide read-only access to data (static or dynamic)

```python
# Tool: performs action
@mcp.tool()
def send_email(to: str, subject: str, body: str) -> EmailResult:
    """Send an email (action with side effect)"""

# Resource: provides data
@mcp.resource("email://templates/{template_id}")
def get_email_template(template_id: str) -> str:
    """Get email template content (read-only)"""
```

**Rule of Thumb:** If it changes state → Tool. If it's just data → Resource.

---

## 3. Environment Setup

### Prerequisites

- **Python 3.10+** (3.11 or 3.12 recommended)
- **Docker** 24.0+ with Docker Desktop (for MCP Toolkit integration)
- **pip** or **poetry** for package management

### Install FastMCP

```bash
# Create project directory
mkdir my-mcp-server
cd my-mcp-server

# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install FastMCP and common dependencies
pip install fastmcp httpx pydantic python-dotenv

# Optional: Install uvicorn for HTTP transport
pip install "fastmcp[http]"
```

### Project Structure (Recommended)

```
my-mcp-server/
├── app/
│   ├── __init__.py
│   ├── mcp_server.py        # Main MCP server code
│   ├── graphql_client.py    # GraphQL integration logic
│   ├── models.py            # Pydantic models
│   └── config.py            # Configuration management
├── tests/
│   ├── __init__.py
│   └── test_tools.py
├── .env.example             # Template for environment variables
├── .env                     # Actual secrets (gitignored)
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml           # or requirements.txt
├── README.md
└── .gitignore
```

---

## 4. Building Your First FastMCP Server (Bare-Metal)

### Minimal Example

**`app/mcp_server.py`:**

```python
from fastmcp import FastMCP

# Create server instance
mcp = FastMCP("Demo MCP Server")

@mcp.tool()
def add_numbers(a: int, b: int) -> int:
    """Add two numbers together"""
    return a + b

@mcp.tool()
def greet_user(name: str, formal: bool = False) -> str:
    """Generate a greeting message"""
    if formal:
        return f"Good day, {name}."
    return f"Hey {name}!"

if __name__ == "__main__":
    # Run the server
    mcp.run()
```

**Run it:**

```bash
# Method 1: Using FastMCP CLI (recommended)
fastmcp run app/mcp_server.py

# Method 2: Direct Python execution
python app/mcp_server.py

# Method 3: Using uvicorn for HTTP transport
fastmcp run app/mcp_server.py --transport http --port 8080
```

### Realistic Example with External API

**`app/config.py`:**

```python
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Server configuration loaded from environment variables"""
    
    # API credentials (per-user, provided by MCP client)
    api_key: str
    api_base_url: str = "https://api.example.com"
    
    # Server configuration
    server_name: str = "My MCP Server"
    log_level: str = "INFO"
    timeout: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

def get_settings() -> Settings:
    """Get validated settings (fails fast if API_KEY missing)"""
    return Settings()
```

**`app/graphql_client.py`:**

```python
import httpx
from typing import Any
from app.config import get_settings

class GraphQLClient:
    """Wrapper for GraphQL API calls with authentication"""
    
    def __init__(self):
        self.settings = get_settings()
        self.base_url = f"{self.settings.api_base_url}/graphql"
        
    async def query(self, query: str, variables: dict[str, Any] = None) -> dict:
        """Execute GraphQL query with authentication"""
        headers = {
            "Authorization": f"Bearer {self.settings.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        async with httpx.AsyncClient(timeout=self.settings.timeout) as client:
            response = await client.post(
                self.base_url,
                json=payload,
                headers=headers
            )
            response.raise_for_status()
            
            result = response.json()
            
            # Handle GraphQL errors
            if "errors" in result:
                error_messages = [e.get("message", str(e)) for e in result["errors"]]
                raise Exception(f"GraphQL errors: {', '.join(error_messages)}")
            
            return result.get("data", {})
```

**`app/models.py`:**

```python
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum

class TrialStatus(str, Enum):
    RECRUITING = "recruiting"
    ACTIVE = "active"
    COMPLETED = "completed"
    SUSPENDED = "suspended"

class ClinicalTrial(BaseModel):
    """Clinical trial information"""
    trial_id: str = Field(..., description="Unique trial identifier")
    title: str
    status: TrialStatus
    phase: Optional[str] = None
    enrollment: Optional[int] = Field(None, description="Number of participants")
    
class TrialSearchResult(BaseModel):
    """Results from trial search"""
    trials: list[ClinicalTrial]
    total_count: int
    has_more: bool
```

**`app/mcp_server.py` (complete):**

```python
from fastmcp import FastMCP
from fastmcp import ToolError
import logging
from typing import Optional

from app.config import get_settings
from app.graphql_client import GraphQLClient
from app.models import TrialSearchResult, ClinicalTrial, TrialStatus

# Initialize logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create server instance
settings = get_settings()
mcp = FastMCP(
    name=settings.server_name,
    logger=logger
)

# Initialize GraphQL client
graphql_client = GraphQLClient()

@mcp.tool()
async def search_clinical_trials(
    condition: str,
    status: Optional[TrialStatus] = None,
    max_results: int = 10
) -> TrialSearchResult:
    """
    Search for clinical trials by condition and optional status filter.
    
    Args:
        condition: Medical condition to search for (e.g., "diabetes", "cancer")
        status: Filter by trial status (optional)
        max_results: Maximum number of results to return (1-100)
        
    Returns:
        Search results with matching clinical trials
        
    Raises:
        ToolError: If API call fails or parameters are invalid
    """
    if max_results < 1 or max_results > 100:
        raise ToolError(
            "max_results must be between 1 and 100",
            error_code="INVALID_PARAMETER"
        )
    
    # Construct GraphQL query
    query = """
    query SearchTrials($condition: String!, $status: TrialStatus, $limit: Int!) {
        clinicalTrials(condition: $condition, status: $status, limit: $limit) {
            trials {
                trialId
                title
                status
                phase
                enrollment
            }
            totalCount
            hasMore
        }
    }
    """
    
    variables = {
        "condition": condition,
        "status": status.value if status else None,
        "limit": max_results
    }
    
    try:
        result = await graphql_client.query(query, variables)
        
        # Map GraphQL result to Pydantic model
        trials_data = result.get("clinicalTrials", {})
        trials = [
            ClinicalTrial(
                trial_id=t["trialId"],
                title=t["title"],
                status=TrialStatus(t["status"]),
                phase=t.get("phase"),
                enrollment=t.get("enrollment")
            )
            for t in trials_data.get("trials", [])
        ]
        
        return TrialSearchResult(
            trials=trials,
            total_count=trials_data.get("totalCount", 0),
            has_more=trials_data.get("hasMore", False)
        )
        
    except httpx.HTTPError as e:
        logger.error(f"API request failed: {e}")
        raise ToolError(
            f"Failed to search trials: {str(e)}",
            error_code="API_ERROR",
            retryable=True
        )
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise ToolError(
            f"Unexpected error during search: {str(e)}",
            error_code="INTERNAL_ERROR"
        )

@mcp.tool()
async def get_trial_details(trial_id: str) -> ClinicalTrial:
    """
    Get detailed information about a specific clinical trial.
    
    Args:
        trial_id: Unique trial identifier
        
    Returns:
        Detailed trial information
    """
    query = """
    query GetTrial($trialId: ID!) {
        clinicalTrial(trialId: $trialId) {
            trialId
            title
            status
            phase
            enrollment
        }
    }
    """
    
    try:
        result = await graphql_client.query(query, {"trialId": trial_id})
        trial_data = result.get("clinicalTrial")
        
        if not trial_data:
            raise ToolError(
                f"Trial not found: {trial_id}",
                error_code="NOT_FOUND"
            )
        
        return ClinicalTrial(
            trial_id=trial_data["trialId"],
            title=trial_data["title"],
            status=TrialStatus(trial_data["status"]),
            phase=trial_data.get("phase"),
            enrollment=trial_data.get("enrollment")
        )
        
    except ToolError:
        raise
    except Exception as e:
        logger.error(f"Failed to get trial details: {e}")
        raise ToolError(
            f"Failed to retrieve trial: {str(e)}",
            error_code="API_ERROR",
            retryable=True
        )

if __name__ == "__main__":
    # Validate configuration on startup
    logger.info(f"Starting {settings.server_name}")
    logger.info(f"API endpoint: {settings.api_base_url}")
    
    # Run the server
    mcp.run()
```

**`.env.example`:**

```bash
# Copy this to .env and fill in your values
API_KEY=your-api-key-here
API_BASE_URL=https://api.example.com
SERVER_NAME=Clinical Trials MCP
LOG_LEVEL=INFO
TIMEOUT=30
```

**Run the server:**

```bash
# Copy template and add your API key
cp .env.example .env
# Edit .env with your actual API_KEY

# Run the server
fastmcp run app/mcp_server.py
```

---

## 5. Secrets & Per-User Configuration

### The MCP Security Model

**Critical Principle:** MCP servers are **multi-tenant by design**. The same server image runs for multiple users, each with their own credentials.

```
User A (API_KEY_A) ──┐
                     ├──> Same MCP Server Image
User B (API_KEY_B) ──┤    (Different runtime configs)
                     │
User C (API_KEY_C) ──┘
```

### Three Types of Secrets

| Type | When Set | Example | How Handled |
|------|----------|---------|-------------|
| **Build-time** | During Docker image build | Public API endpoints, package versions | Baked into image |
| **Deploy-time** | When deploying to infrastructure | Database URLs, service credentials | Set by DevOps/CI/CD |
| **Runtime (per-user)** | When user launches MCP | User's personal API keys | **This is what we focus on** |

**For MCP servers:** Almost all secrets are **runtime secrets** configured by each user in their MCP client.

### How Per-User Secrets Flow

```
1. User configures MCP client (Claude Desktop, Cursor, etc.)
   ↓
   {
     "mcpServers": {
       "my-server": {
         "command": "docker",
         "args": ["run", "-i", "--rm", "my-mcp-server"],
         "env": {
           "API_KEY": "user-personal-key-xyz"  ← User's secret
         }
       }
     }
   }

2. MCP client launches container with user's env vars
   ↓
   docker run -i --rm -e API_KEY=user-personal-key-xyz my-mcp-server

3. MCP server reads API_KEY from environment
   ↓
   import os
   api_key = os.getenv("API_KEY")
   # Use this key for all API calls
```

### Code Pattern: Reading Runtime Secrets

**Using `pydantic-settings` (Recommended):**

```python
# app/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Configuration loaded from environment variables.
    MCP client injects these at runtime.
    """
    
    # Required secrets (will raise ValidationError if missing)
    api_key: str  # Set by MCP client via env var API_KEY
    
    # Optional configuration
    api_base_url: str = "https://api.example.com"
    timeout: int = 30
    log_level: str = "INFO"
    
    # Optional secrets (for multi-service integrations)
    database_url: Optional[str] = None
    redis_url: Optional[str] = None
    
    class Config:
        env_file = ".env"  # For local development only
        env_file_encoding = "utf-8"
        # Use case-insensitive env var matching
        case_sensitive = False

def get_settings() -> Settings:
    """
    Load and validate settings.
    Fails fast at startup if required secrets missing.
    """
    return Settings()

# Usage in your MCP server
settings = get_settings()  # Raises ValidationError if API_KEY not set
```

**Using `os.getenv` (Simple approach):**

```python
import os

class Config:
    def __init__(self):
        # Required secret - fail fast if missing
        self.api_key = os.environ["API_KEY"]  # Raises KeyError if not set
        
        # Optional with defaults
        self.api_base_url = os.getenv("API_BASE_URL", "https://api.example.com")
        self.timeout = int(os.getenv("TIMEOUT", "30"))
        
    def validate(self):
        """Additional validation"""
        if not self.api_key.startswith("sk-"):
            raise ValueError("API_KEY must start with 'sk-'")

config = Config()
config.validate()
```

### Security Best Practices

#### 1. **Never Log Secrets**

```python
# ❌ BAD: Exposes secrets in logs
logger.info(f"Using API key: {api_key}")
logger.debug(f"Config: {settings.dict()}")  # May include secrets

# ✅ GOOD: Mask secrets in logs
logger.info(f"Using API key: {api_key[:8]}...")

# Safe config logging (exclude secrets)
safe_config = settings.dict(exclude={"api_key", "database_url"})
logger.info(f"Config: {safe_config}")
```

#### 2. **Never Include Secrets in Error Messages**

```python
# ❌ BAD: Leaks API key in error
raise Exception(f"Authentication failed with key {api_key}")

# ✅ GOOD: Generic error, log details separately
logger.error(f"Auth failed for key {api_key[:8]}...")
raise ToolError("Authentication failed", error_code="AUTH_ERROR")
```

#### 3. **Validate Secrets at Startup**

```python
def validate_api_key(api_key: str) -> None:
    """Validate API key format before making requests"""
    if not api_key:
        raise ValueError("API_KEY environment variable is required")
    
    if len(api_key) < 20:
        raise ValueError("API_KEY appears to be invalid (too short)")
    
    # Add format checks specific to your API
    if not api_key.startswith(("sk-", "key-")):
        raise ValueError("API_KEY format is invalid")

# Call at startup
settings = get_settings()
validate_api_key(settings.api_key)
```

#### 4. **Use Separate Keys per Environment**

```python
class Settings(BaseSettings):
    environment: str = "production"  # Set via ENV environment variable
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    def validate_environment(self):
        """Enforce stricter validation in production"""
        if self.is_production:
            if "test" in self.api_key.lower():
                raise ValueError("Test API keys not allowed in production")
```

### Development vs Production Secrets

**Local Development (`.env` file):**

```bash
# .env (gitignored)
API_KEY=sk-test-local-dev-key
API_BASE_URL=http://localhost:4000/graphql
LOG_LEVEL=DEBUG
```

**Production (MCP Client Configuration):**

User configures in their MCP client:

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "myorg/clinical-trials-mcp:latest"],
      "env": {
        "API_KEY": "sk-prod-user-real-key-abc123",
        "API_BASE_URL": "https://api.production.com/graphql"
      }
    }
  }
}
```

### Docker Hub & Secrets

**Key Point:** When you publish to Docker Hub, **only the image is stored**, not secrets.

```bash
# Building image - NO secrets included
docker build -t myorg/my-mcp-server:latest .

# Pushing to Docker Hub - NO secrets in image
docker push myorg/my-mcp-server:latest

# User runs with THEIR secrets
docker run -i --rm \
  -e API_KEY=user-personal-key \
  myorg/my-mcp-server:latest
```

**Your image should document required environment variables:**

**`README.md` (published to Docker Hub):**

```markdown
# Clinical Trials MCP Server

## Required Configuration

Set these environment variables when running the container:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `API_KEY` | Yes | Your personal API key | `sk-...` |
| `API_BASE_URL` | No | GraphQL endpoint (default: https://api.example.com) | `https://api.example.com` |
| `TIMEOUT` | No | Request timeout in seconds (default: 30) | `60` |

## Usage

```bash
docker run -i --rm \
  -e API_KEY=your-api-key \
  myorg/clinical-trials-mcp:latest
```
```

---

## 6. Dockerizing Your MCP Server

### Why Docker for MCP?

1. **Isolation:** Each MCP server runs in its own container (security)
2. **Consistency:** Same environment across development and production
3. **Zero-dependency setup:** Users don't need Python, dependencies, or complex setup
4. **Docker MCP Toolkit:** Docker Desktop provides native MCP integration (270+ servers in catalog)
5. **Distribution:** Publish once to Docker Hub, anyone can use it

### Basic Dockerfile

**`Dockerfile`:**

```dockerfile
# Use official Python slim image for smaller size
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files first (better caching)
COPY pyproject.toml ./
# Or: COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -e .
# Or: RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Create non-root user for security
RUN useradd -m -u 1000 mcpuser && \
    chown -R mcpuser:mcpuser /app
USER mcpuser

# Expose port (only needed for HTTP transport)
# EXPOSE 8080

# Set environment variables (defaults, will be overridden)
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO

# Health check (optional, for HTTP transport)
# HEALTHCHECK --interval=30s --timeout=3s \
#   CMD curl -f http://localhost:8080/health || exit 1

# Run the MCP server
# Default to stdio transport (for Claude Desktop, Cursor, etc.)
CMD ["fastmcp", "run", "app/mcp_server.py"]

# For HTTP transport, use:
# CMD ["fastmcp", "run", "app/mcp_server.py", "--transport", "http", "--port", "8080"]
```

### Production-Ready Dockerfile

**`Dockerfile.production`:**

```dockerfile
# Multi-stage build for smaller final image
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in a virtual environment
COPY pyproject.toml ./
RUN pip install --no-cache-dir build && \
    pip wheel --no-cache-dir --wheel-dir /build/wheels -e .

# Final stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder
COPY --from=builder /build/wheels /tmp/wheels

# Install Python packages from wheels
RUN pip install --no-cache-dir /tmp/wheels/* && \
    rm -rf /tmp/wheels

# Copy application code
COPY app/ ./app/

# Create non-root user
RUN useradd -m -u 1000 mcpuser && \
    chown -R mcpuser:mcpuser /app
USER mcpuser

# Labels for Docker Hub (important for discoverability)
LABEL org.opencontainers.image.title="Clinical Trials MCP Server"
LABEL org.opencontainers.image.description="MCP server for searching clinical trials via GraphQL"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.authors="your-name@example.com"
LABEL org.opencontainers.image.source="https://github.com/yourorg/clinical-trials-mcp"
LABEL org.opencontainers.image.licenses="MIT"

ENV PYTHONUNBUFFERED=1

CMD ["fastmcp", "run", "app/mcp_server.py"]
```

### `pyproject.toml` (for proper package management)

```toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "clinical-trials-mcp"
version = "1.0.0"
description = "MCP server for clinical trials search"
requires-python = ">=3.10"
dependencies = [
    "fastmcp>=0.5.0",
    "httpx>=0.26.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "black>=23.0.0",
    "ruff>=0.1.0",
]

[tool.setuptools.packages.find]
where = ["."]
include = ["app*"]

[tool.black]
line-length = 100

[tool.ruff]
line-length = 100
```

### Or `requirements.txt`

```txt
fastmcp>=0.5.0
httpx>=0.26.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
python-dotenv>=1.0.0
```

### Docker Compose for Local Development

**`docker-compose.yml`:**

```yaml
version: '3.8'

services:
  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: clinical-trials-mcp
    environment:
      # Load from .env file
      - API_KEY=${API_KEY}
      - API_BASE_URL=${API_BASE_URL:-https://api.example.com}
      - LOG_LEVEL=${LOG_LEVEL:-INFO}
      - TIMEOUT=${TIMEOUT:-30}
    # For stdio transport (default)
    stdin_open: true
    tty: true
    # For HTTP transport (uncomment and adjust CMD in Dockerfile)
    # ports:
    #   - "8080:8080"
    restart: unless-stopped
    
  # Optional: Mock GraphQL API for local testing
  mock-api:
    image: graphql-mock-server:latest  # Use a GraphQL mock server
    ports:
      - "4000:4000"
    environment:
      - GRAPHQL_SCHEMA_FILE=/schema.graphql
    volumes:
      - ./schema.graphql:/schema.graphql
```

### Build and Run Locally

```bash
# Build the image
docker build -t clinical-trials-mcp:latest .

# Run with stdio transport (for MCP clients)
docker run -i --rm \
  -e API_KEY=your-api-key \
  clinical-trials-mcp:latest

# Run with HTTP transport (for testing with curl)
docker run -d --rm \
  -p 8080:8080 \
  -e API_KEY=your-api-key \
  clinical-trials-mcp:latest \
  fastmcp run app/mcp_server.py --transport http --port 8080

# Test HTTP endpoint
curl http://localhost:8080/mcp/tools

# Using docker-compose
docker-compose up -d
docker-compose logs -f mcp-server
```

### `.dockerignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
*.egg-info/
dist/
build/

# Environment and secrets
.env
.env.*
!.env.example

# Development
.git/
.gitignore
.vscode/
.idea/
*.md
!README.md
tests/
*.pytest_cache/

# Docker
Dockerfile*
docker-compose*.yml
.dockerignore
```

---

## 7. Docker Hub Publishing & Distribution

### Preparation Checklist

- [ ] Server works locally (bare-metal)
- [ ] Server works in Docker container locally
- [ ] Secrets are runtime-configurable (not baked into image)
- [ ] README.md documents required environment variables
- [ ] Dockerfile uses non-root user
- [ ] Image size is reasonable (<500MB ideally)

### Publishing to Docker Hub

**1. Create Docker Hub Account & Repository**

```bash
# Sign up at https://hub.docker.com
# Create repository: yourorg/clinical-trials-mcp
```

**2. Tag Your Image**

```bash
# Build with proper tag
docker build -t yourorg/clinical-trials-mcp:1.0.0 .

# Also tag as 'latest'
docker tag yourorg/clinical-trials-mcp:1.0.0 yourorg/clinical-trials-mcp:latest
```

**3. Login and Push**

```bash
# Login to Docker Hub
docker login

# Push specific version
docker push yourorg/clinical-trials-mcp:1.0.0

# Push latest
docker push yourorg/clinical-trials-mcp:latest
```

**4. Update Docker Hub Repository Settings**

In Docker Hub web interface:

- **Overview:** Paste your README.md (instructions for users)
- **Description:** Short summary (shows in search results)
- **Tags:** Ensure 1.0.0 and latest are visible
- **Collaborators:** Add team members if needed

### Docker Hub README Template

**`README.md` (for Docker Hub):**

```markdown
# Clinical Trials MCP Server

MCP server for searching and retrieving clinical trial information via GraphQL.

## Quick Start

### With Docker (Recommended)

```bash
docker run -i --rm \
  -e API_KEY=your-api-key \
  yourorg/clinical-trials-mcp:latest
```

### Configuration

| Environment Variable | Required | Default | Description |
|---------------------|----------|---------|-------------|
| `API_KEY` | **Yes** | - | Your personal API key for the Clinical Trials API |
| `API_BASE_URL` | No | `https://api.example.com` | GraphQL API endpoint |
| `TIMEOUT` | No | `30` | Request timeout in seconds |
| `LOG_LEVEL` | No | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |

### MCP Client Configuration

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "yourorg/clinical-trials-mcp:latest"
      ],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### Cursor

Edit MCP settings in Cursor:

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "yourorg/clinical-trials-mcp:latest"],
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

#### VS Code (with MCP extension)

Add to your workspace settings or global MCP config:

```json
{
  "mcp.servers": {
    "clinical-trials": {
      "transport": "docker",
      "image": "yourorg/clinical-trials-mcp:latest",
      "env": {
        "API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### `search_clinical_trials`

Search for clinical trials by condition.

**Parameters:**
- `condition` (string, required): Medical condition to search
- `status` (enum, optional): Filter by trial status
- `max_results` (int, optional): Maximum results (1-100, default: 10)

**Example:**
```
Find recruiting trials for diabetes
```

### `get_trial_details`

Get detailed information about a specific trial.

**Parameters:**
- `trial_id` (string, required): Unique trial identifier

## Source Code

- GitHub: https://github.com/yourorg/clinical-trials-mcp
- Issues: https://github.com/yourorg/clinical-trials-mcp/issues

## License

MIT License - see LICENSE file for details
```

### Versioning Strategy

Use semantic versioning: `MAJOR.MINOR.PATCH`

```bash
# Breaking changes (API changes, removed tools)
docker tag yourorg/clinical-trials-mcp:2.0.0

# New features (new tools, backward compatible)
docker tag yourorg/clinical-trials-mcp:1.1.0

# Bug fixes (no API changes)
docker tag yourorg/clinical-trials-mcp:1.0.1

# Always update 'latest' for stable releases
docker tag yourorg/clinical-trials-mcp:1.1.0 yourorg/clinical-trials-mcp:latest
docker push yourorg/clinical-trials-mcp:latest
```

### Automated Publishing with GitHub Actions

**`.github/workflows/docker-publish.yml`:**

```yaml
name: Build and Push Docker Image

on:
  push:
    tags:
      - 'v*.*.*'  # Trigger on version tags like v1.0.0
  workflow_dispatch:  # Manual trigger

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            yourorg/clinical-trials-mcp:${{ steps.version.outputs.VERSION }}
            yourorg/clinical-trials-mcp:latest
          cache-from: type=registry,ref=yourorg/clinical-trials-mcp:buildcache
          cache-to: type=registry,ref=yourorg/clinical-trials-mcp:buildcache,mode=max
```

**Usage:**

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions automatically builds and pushes to Docker Hub
```

### Docker MCP Toolkit Integration

As of November 2025, Docker Desktop includes **MCP Toolkit** — a native way to discover and configure MCP servers.

**How it works:**

1. User opens Docker Desktop → MCP Toolkit
2. Browses catalog of 270+ MCP servers (including yours if listed)
3. One-click install with OAuth/secret configuration via UI
4. MCP Toolkit acts as gateway, manages authentication
5. User's AI clients connect to the toolkit, not individual containers

**To list your server in the catalog:**

1. Submit PR to: https://github.com/docker/mcp-registry
2. Provide metadata file (JSON) with:
   - Server name, description, icon
   - Required environment variables
   - Publisher information
   - Links to documentation

**Example metadata submission:**

**`registry-submission.json`:**

```json
{
  "name": "clinical-trials",
  "displayName": "Clinical Trials Search",
  "description": "Search and retrieve clinical trial information",
  "publisher": {
    "name": "Your Organization",
    "url": "https://yourorg.com",
    "verified": false
  },
  "image": "yourorg/clinical-trials-mcp:latest",
  "category": "healthcare",
  "tags": ["medical", "research", "healthcare", "graphql"],
  "configuration": {
    "env": [
      {
        "name": "API_KEY",
        "description": "Your Clinical Trials API key",
        "required": true,
        "secret": true,
        "placeholder": "sk-..."
      },
      {
        "name": "API_BASE_URL",
        "description": "GraphQL API endpoint",
        "required": false,
        "default": "https://api.example.com"
      }
    ]
  },
  "links": {
    "documentation": "https://github.com/yourorg/clinical-trials-mcp#readme",
    "source": "https://github.com/yourorg/clinical-trials-mcp",
    "issues": "https://github.com/yourorg/clinical-trials-mcp/issues"
  }
}
```

---

## 8. GraphQL Integration Patterns

### Architectural Options

When your MCP server needs to call a GraphQL API, you have three main design patterns:

#### Option A: Generic GraphQL Query Tool (Flexible but Risky)

**Concept:** Expose a single tool that accepts raw GraphQL queries.

**Pros:**
- Maximum flexibility
- No code changes for new queries
- Agent can construct any query

**Cons:**
- Security risk (arbitrary queries, potential DOS)
- Hard for agents to use correctly (must know GraphQL syntax)
- No validation until runtime
- No clear "tool purpose" for agent to understand

**Code Example:**

```python
@mcp.tool()
async def execute_graphql_query(
    query: str,
    variables: dict[str, Any] = None
) -> dict:
    """
    Execute arbitrary GraphQL query against the API.
    
    WARNING: Use with caution. Agent must construct valid GraphQL syntax.
    """
    return await graphql_client.query(query, variables)
```

**Use Case:** Internal tools, trusted agents only, development/debugging.

**❌ Not recommended for hackathons or production MCPs.**

---

#### Option B: Specific High-Level Tools (Recommended for Hackathons)

**Concept:** Each tool corresponds to a specific, well-defined operation (wraps a fixed GraphQL query).

**Pros:**
- Clear purpose and documentation for agents
- Strong input validation via Pydantic models
- Security: only pre-approved queries execute
- Easy to test and maintain
- Agent-friendly: clear tool names and parameters

**Cons:**
- Requires code changes for new operations
- More boilerplate (one tool per operation)

**Code Example:**

```python
from pydantic import BaseModel, Field
from typing import Optional

class ClinicalTrial(BaseModel):
    trial_id: str
    title: str
    status: str
    phase: Optional[str] = None

@mcp.tool()
async def search_trials_by_condition(
    condition: str,
    max_results: int = 10
) -> list[ClinicalTrial]:
    """
    Search clinical trials for a specific medical condition.
    Returns list of matching trials with basic information.
    """
    # Fixed GraphQL query (secure, validated)
    query = """
    query SearchTrials($condition: String!, $limit: Int!) {
        clinicalTrials(condition: $condition, limit: $limit) {
            trials {
                trialId
                title
                status
                phase
            }
        }
    }
    """
    
    result = await graphql_client.query(query, {
        "condition": condition,
        "limit": max_results
    })
    
    # Parse and validate response
    trials = []
    for trial_data in result.get("clinicalTrials", {}).get("trials", []):
        trials.append(ClinicalTrial(
            trial_id=trial_data["trialId"],
            title=trial_data["title"],
            status=trial_data["status"],
            phase=trial_data.get("phase")
        ))
    
    return trials

@mcp.tool()
async def get_trial_eligibility(
    trial_id: str
) -> dict[str, Any]:
    """
    Get detailed eligibility criteria for a specific trial.
    Returns structured eligibility requirements.
    """
    query = """
    query GetEligibility($trialId: ID!) {
        clinicalTrial(trialId: $trialId) {
            eligibility {
                criteria
                gender
                minimumAge
                maximumAge
                healthyVolunteers
            }
        }
    }
    """
    
    result = await graphql_client.query(query, {"trialId": trial_id})
    return result.get("clinicalTrial", {}).get("eligibility", {})

@mcp.tool()
async def get_trial_locations(
    trial_id: str,
    country: Optional[str] = None
) -> list[dict]:
    """
    Get locations/facilities where trial is being conducted.
    Optionally filter by country.
    """
    query = """
    query GetLocations($trialId: ID!, $country: String) {
        clinicalTrial(trialId: $trialId) {
            locations(country: $country) {
                facility
                city
                state
                country
                zipCode
                contactName
                contactPhone
            }
        }
    }
    """
    
    result = await graphql_client.query(query, {
        "trialId": trial_id,
        "country": country
    })
    
    return result.get("clinicalTrial", {}).get("locations", [])
```

**✅ Recommended for hackathons:** Fast to build, secure, agent-friendly.

---

#### Option C: Thin REST Wrapper (Not Recommended for Hackathons)

**Concept:** Build a REST API around your GraphQL API, then have MCP call the REST layer.

**Pros:**
- Separates concerns (MCP layer, REST layer, GraphQL layer)
- REST layer can be reused by other clients

**Cons:**
- Extra complexity and latency
- Requires deploying/maintaining two services
- Doesn't leverage MCP's strengths (agent-friendly tool discovery)

**When to use:** Large organizations with existing REST infrastructure, not hackathons.

---

### Recommended Pattern for Hackathons: Option B

**Why Option B is best for 6-hour projects:**

1. **Fast to implement:** Copy-paste tool pattern for each operation
2. **Secure by default:** No arbitrary query execution
3. **Agent-friendly:** Clear tool names, strong types, good docs
4. **Easy to test:** Each tool is independent, testable unit
5. **Maintainable:** Add new tools without touching existing ones

**Implementation Template:**

```python
# app/graphql_operations.py
"""
GraphQL query templates and operation wrappers.
Each function returns a (query, variables) tuple.
"""

def search_trials_query(condition: str, limit: int):
    """Generate query for searching trials"""
    query = """
    query SearchTrials($condition: String!, $limit: Int!) {
        clinicalTrials(condition: $condition, limit: $limit) {
            trials { trialId title status phase }
        }
    }
    """
    return query, {"condition": condition, "limit": limit}

def get_trial_details_query(trial_id: str):
    """Generate query for trial details"""
    query = """
    query GetTrial($trialId: ID!) {
        clinicalTrial(trialId: $trialId) {
            trialId
            title
            status
            phase
            enrollment
            description
            eligibility { criteria gender minimumAge maximumAge }
            locations { facility city state country }
        }
    }
    """
    return query, {"trialId": trial_id}

# app/mcp_server.py
from app.graphql_operations import search_trials_query, get_trial_details_query

@mcp.tool()
async def search_trials(condition: str, max_results: int = 10) -> list[ClinicalTrial]:
    """Search for clinical trials by medical condition"""
    query, variables = search_trials_query(condition, max_results)
    result = await graphql_client.query(query, variables)
    
    # Parse and return structured data
    return [
        ClinicalTrial(**trial)
        for trial in result["clinicalTrials"]["trials"]
    ]

@mcp.tool()
async def get_trial_details(trial_id: str) -> TrialDetails:
    """Get comprehensive details for a specific trial"""
    query, variables = get_trial_details_query(trial_id)
    result = await graphql_client.query(query, variables)
    
    return TrialDetails(**result["clinicalTrial"])
```

---

### GraphQL Client Implementation

**Full-featured `app/graphql_client.py`:**

```python
import httpx
import logging
from typing import Any, Optional
from app.config import get_settings

logger = logging.getLogger(__name__)

class GraphQLError(Exception):
    """GraphQL-specific error"""
    def __init__(self, message: str, errors: list = None):
        super().__init__(message)
        self.errors = errors or []

class GraphQLClient:
    """
    Production-ready GraphQL client with:
    - Authentication via Bearer token
    - Error handling and retries
    - Request/response logging
    - Timeout configuration
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.base_url = f"{self.settings.api_base_url}/graphql"
        self.timeout = httpx.Timeout(self.settings.timeout, connect=5.0)
        
        logger.info(f"GraphQL client initialized: {self.base_url}")
    
    async def query(
        self,
        query: str,
        variables: Optional[dict[str, Any]] = None,
        operation_name: Optional[str] = None
    ) -> dict:
        """
        Execute GraphQL query with authentication.
        
        Args:
            query: GraphQL query string
            variables: Query variables
            operation_name: Optional operation name for logging
            
        Returns:
            GraphQL response data
            
        Raises:
            GraphQLError: If GraphQL returns errors
            httpx.HTTPError: If HTTP request fails
        """
        headers = {
            "Authorization": f"Bearer {self.settings.api_key}",
            "Content-Type": "application/json",
            "User-Agent": f"MCP-Client/{self.settings.server_name}"
        }
        
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        if operation_name:
            payload["operationName"] = operation_name
        
        logger.debug(f"GraphQL request: {operation_name or 'unnamed'}")
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(
                    self.base_url,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                
                result = response.json()
                
                # Handle GraphQL errors (HTTP 200 but with errors field)
                if "errors" in result:
                    error_messages = [
                        e.get("message", str(e))
                        for e in result["errors"]
                    ]
                    logger.error(f"GraphQL errors: {error_messages}")
                    raise GraphQLError(
                        f"GraphQL query failed: {', '.join(error_messages)}",
                        errors=result["errors"]
                    )
                
                logger.debug(f"GraphQL response received successfully")
                return result.get("data", {})
                
            except httpx.HTTPStatusError as e:
                logger.error(f"HTTP error: {e.response.status_code} - {e.response.text}")
                raise
            except httpx.TimeoutException as e:
                logger.error(f"Request timeout: {e}")
                raise
            except Exception as e:
                logger.error(f"Unexpected error in GraphQL request: {e}")
                raise
    
    async def introspect_schema(self) -> dict:
        """
        Introspect GraphQL schema (useful for debugging/docs).
        Returns full schema information.
        """
        introspection_query = """
        query IntrospectionQuery {
            __schema {
                queryType { name }
                mutationType { name }
                types {
                    name
                    kind
                    description
                    fields {
                        name
                        description
                        args {
                            name
                            description
                            type { name kind }
                        }
                        type { name kind }
                    }
                }
            }
        }
        """
        
        return await self.query(introspection_query, operation_name="IntrospectionQuery")
```

---

### Error Handling Best Practices

```python
from fastmcp import ToolError

@mcp.tool()
async def search_trials(condition: str) -> list[ClinicalTrial]:
    """Search clinical trials with robust error handling"""
    try:
        query, variables = search_trials_query(condition, 10)
        result = await graphql_client.query(query, variables)
        
        trials = []
        for trial_data in result.get("clinicalTrials", {}).get("trials", []):
            try:
                trials.append(ClinicalTrial(**trial_data))
            except Exception as e:
                # Log but don't fail entire request for one bad record
                logger.warning(f"Failed to parse trial: {e}")
                continue
        
        return trials
        
    except GraphQLError as e:
        # GraphQL-specific errors (business logic errors)
        raise ToolError(
            f"Search failed: {e}",
            error_code="GRAPHQL_ERROR",
            retryable=False  # Don't retry business logic errors
        )
    
    except httpx.TimeoutException:
        # Network timeout (retryable)
        raise ToolError(
            "Request timed out. Please try again.",
            error_code="TIMEOUT",
            retryable=True,
            retry_after_seconds=5
        )
    
    except httpx.HTTPStatusError as e:
        # HTTP errors (4xx/5xx)
        if e.response.status_code == 401:
            raise ToolError(
                "Authentication failed. Check your API_KEY.",
                error_code="AUTH_ERROR",
                retryable=False
            )
        elif e.response.status_code >= 500:
            raise ToolError(
                "Server error. Please try again later.",
                error_code="SERVER_ERROR",
                retryable=True
            )
        else:
            raise ToolError(
                f"HTTP error {e.response.status_code}",
                error_code="HTTP_ERROR",
                retryable=False
            )
    
    except Exception as e:
        # Unexpected errors
        logger.exception("Unexpected error in search_trials")
        raise ToolError(
            "An unexpected error occurred",
            error_code="INTERNAL_ERROR",
            retryable=False
        )
```

---

## 9. MCP Client Configuration

### Overview

Users configure your MCP server in their **MCP client** (Claude Desktop, Cursor, VS Code, OpenAI clients, etc.). Each client has slightly different configuration formats, but the concepts are the same.

### Claude Desktop Configuration

**Location:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

**Format:**

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "yourorg/clinical-trials-mcp:latest"
      ],
      "env": {
        "API_KEY": "sk-your-actual-api-key-here",
        "API_BASE_URL": "https://api.example.com",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

**Multiple servers:**

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "yourorg/clinical-trials-mcp:latest"],
      "env": {
        "API_KEY": "sk-clinical-key"
      }
    },
    "github": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "mcp/github:latest"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_github_token"
      }
    },
    "local-files": {
      "command": "python",
      "args": ["-m", "mcp_server_files", "/Users/you/Documents"]
    }
  }
}
```

### Cursor Configuration

**Location:** Settings → MCP Servers → Add Server

**Configuration UI:** Cursor provides a GUI, but underlying config is JSON:

```json
{
  "mcpServers": {
    "clinical-trials": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "yourorg/clinical-trials-mcp:latest"],
      "env": {
        "API_KEY": "${CLINICAL_TRIALS_API_KEY}"
      }
    }
  }
}
```

**Note:** Cursor supports environment variable interpolation from your shell.

### VS Code with MCP Extension

**Requires:** VS Code extension for MCP (search "Model Context Protocol" in Extensions)

**Configuration:** `.vscode/mcp.json` or User/Workspace settings

```json
{
  "mcp.servers": {
    "clinical-trials": {
      "transport": "docker",
      "image": "yourorg/clinical-trials-mcp:latest",
      "env": {
        "API_KEY": "sk-your-key"
      }
    }
  }
}
```

### OpenAI Desktop / API

**Configuration varies by client.** Generally similar pattern:

```json
{
  "tools": {
    "mcp": {
      "servers": {
        "clinical-trials": {
          "endpoint": "docker://yourorg/clinical-trials-mcp:latest",
          "env": {
            "API_KEY": "sk-your-key"
          }
        }
      }
    }
  }
}
```

### Docker Desktop MCP Toolkit

**Modern approach (as of November 2025):**

1. Open Docker Desktop
2. Navigate to **MCP Toolkit** section
3. Browse **MCP Catalog** (270+ servers)
4. Click **Install** on your server
5. Configure secrets in UI (OAuth flow or manual entry)
6. Toolkit manages container lifecycle and authentication

**Benefits:**
- One-click installation
- Centralized secret management
- OAuth integration for supported services
- Automatic updates
- Gateway mode (one connection for multiple MCPs)

**Your image must be in Docker Hub and listed in the catalog for this to work.**

---

## 10. Testing & Debugging

### Local Testing (Bare-Metal)

**Manual testing with FastMCP client:**

```python
# test_local.py
import asyncio
from fastmcp import Client
from app.mcp_server import mcp

async def test_search():
    """Test the search_clinical_trials tool locally"""
    async with Client(mcp) as client:
        # List available tools
        tools = await client.list_tools()
        print("Available tools:", [t.name for t in tools])
        
        # Call a tool
        result = await client.call_tool(
            "search_clinical_trials",
            {
                "condition": "diabetes",
                "max_results": 5
            }
        )
        print("Search results:", result)

if __name__ == "__main__":
    asyncio.run(test_search())
```

**Run:**

```bash
# Set environment variables for testing
export API_KEY=sk-test-key
python test_local.py
```

### Unit Testing with pytest

**`tests/test_tools.py`:**

```python
import pytest
from unittest.mock import AsyncMock, patch
from app.mcp_server import search_clinical_trials
from app.models import TrialSearchResult, ClinicalTrial, TrialStatus

@pytest.mark.asyncio
async def test_search_clinical_trials_success():
    """Test successful trial search"""
    
    # Mock GraphQL client response
    mock_response = {
        "clinicalTrials": {
            "trials": [
                {
                    "trialId": "NCT12345678",
                    "title": "Diabetes Trial",
                    "status": "recruiting",
                    "phase": "Phase 3",
                    "enrollment": 100
                }
            ],
            "totalCount": 1,
            "hasMore": False
        }
    }
    
    with patch("app.mcp_server.graphql_client") as mock_client:
        mock_client.query = AsyncMock(return_value=mock_response)
        
        result = await search_clinical_trials(
            condition="diabetes",
            max_results=10
        )
        
        assert isinstance(result, TrialSearchResult)
        assert len(result.trials) == 1
        assert result.trials[0].trial_id == "NCT12345678"
        assert result.trials[0].status == TrialStatus.RECRUITING

@pytest.mark.asyncio
async def test_search_clinical_trials_invalid_max_results():
    """Test validation of max_results parameter"""
    from fastmcp import ToolError
    
    with pytest.raises(ToolError) as exc_info:
        await search_clinical_trials(
            condition="diabetes",
            max_results=200  # Invalid: exceeds max of 100
        )
    
    assert "max_results must be between" in str(exc_info.value)
    assert exc_info.value.error_code == "INVALID_PARAMETER"
```

**Run tests:**

```bash
pytest tests/ -v
```

### Docker Testing

**Build and test in container:**

```bash
# Build image
docker build -t clinical-trials-mcp:test .

# Run with test API key
docker run -i --rm \
  -e API_KEY=sk-test-key \
  -e LOG_LEVEL=DEBUG \
  clinical-trials-mcp:test

# Test with manual input (stdin)
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | \
  docker run -i --rm -e API_KEY=sk-test clinical-trials-mcp:test
```

### Integration Testing with Real Client

**Test with Claude Desktop:**

1. Add to `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "test-server": {
         "command": "docker",
         "args": ["run", "-i", "--rm", "clinical-trials-mcp:test"],
         "env": {
           "API_KEY": "sk-test-key",
           "LOG_LEVEL": "DEBUG"
         }
       }
     }
   }
   ```

2. Restart Claude Desktop

3. Test queries in Claude:
   ```
   Can you search for clinical trials related to diabetes?
   ```

4. Check Claude's developer console for MCP communication logs

### Debugging Tips

**Enable verbose logging:**

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# FastMCP-specific logging
logging.getLogger("fastmcp").setLevel(logging.DEBUG)
logging.getLogger("httpx").setLevel(logging.DEBUG)
```

**Inspect MCP protocol messages:**

```bash
# Run with protocol tracing
fastmcp run app/mcp_server.py --log-level DEBUG

# In Docker
docker run -i --rm \
  -e LOG_LEVEL=DEBUG \
  clinical-trials-mcp:latest 2>&1 | tee mcp.log
```

**Common issues:**

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Connection refused" | Server not running | Check `docker ps`, ensure server started |
| "Authentication failed" | Invalid API_KEY | Verify env var set correctly |
| "Tool not found" | Tool name mismatch | Check tool decorator name vs client call |
| "Timeout" | Long-running query | Increase `TIMEOUT` env var |
| "Invalid JSON" | Malformed response | Check GraphQL response parsing |

---

## 11. Production Best Practices

### Security Checklist

- [ ] **No secrets in code:** All credentials from environment variables
- [ ] **No secrets in logs:** Mask API keys in log output
- [ ] **No secrets in errors:** Generic error messages to users
- [ ] **Input validation:** Validate all tool parameters
- [ ] **Rate limiting:** Implement request throttling if needed
- [ ] **HTTPS only:** Use secure connections for external APIs
- [ ] **Non-root user:** Docker container runs as non-root user
- [ ] **Minimal image:** Use slim base images, remove dev dependencies

### Performance Optimization

**Async operations:**

```python
@mcp.tool()
async def batch_search(conditions: list[str]) -> dict[str, list[ClinicalTrial]]:
    """Search multiple conditions concurrently"""
    import asyncio
    
    # Execute searches in parallel
    tasks = [
        search_clinical_trials(condition, max_results=5)
        for condition in conditions
    ]
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return {
        condition: result if not isinstance(result, Exception) else []
        for condition, result in zip(conditions, results)
    }
```

**Connection pooling:**

```python
class GraphQLClient:
    def __init__(self):
        self.settings = get_settings()
        # Reuse client with connection pooling
        self._client = httpx.AsyncClient(
            timeout=self.settings.timeout,
            limits=httpx.Limits(max_connections=10)
        )
    
    async def close(self):
        await self._client.aclose()
```

**Caching (if appropriate):**

```python
from functools import lru_cache
import time

class CachedGraphQLClient:
    def __init__(self):
        self._cache = {}
        self._cache_ttl = 300  # 5 minutes
    
    async def query_with_cache(self, query: str, variables: dict) -> dict:
        """Cache GraphQL responses for idempotent queries"""
        cache_key = f"{query}:{hash(frozenset(variables.items()))}"
        
        if cache_key in self._cache:
            cached_result, timestamp = self._cache[cache_key]
            if time.time() - timestamp < self._cache_ttl:
                return cached_result
        
        result = await self.query(query, variables)
        self._cache[cache_key] = (result, time.time())
        return result
```

### Monitoring & Observability

**Structured logging:**

```python
import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def log_tool_call(self, tool_name: str, params: dict, duration: float, success: bool):
        """Log tool execution with structured data"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": "tool_call",
            "tool": tool_name,
            "params": {k: v for k, v in params.items() if k != "api_key"},
            "duration_ms": duration * 1000,
            "success": success
        }
        
        if success:
            self.logger.info(json.dumps(log_entry))
        else:
            self.logger.error(json.dumps(log_entry))

# Usage
logger = StructuredLogger("mcp_server")

@mcp.tool()
async def search_trials(condition: str) -> list[ClinicalTrial]:
    import time
    start = time.time()
    
    try:
        result = await _do_search(condition)
        logger.log_tool_call("search_trials", {"condition": condition}, time.time() - start, True)
        return result
    except Exception as e:
        logger.log_tool_call("search_trials", {"condition": condition}, time.time() - start, False)
        raise
```

**Health checks (for HTTP transport):**

```python
from fastmcp import FastMCP

mcp = FastMCP("Clinical Trials MCP")

@mcp.resource("health://status")
def health_check() -> dict:
    """Health check endpoint for monitoring"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }
```

### Resource Limits

**In Dockerfile:**

```dockerfile
# Limit memory and CPU
# (Applied via Docker run or docker-compose)

# Example docker-compose.yml
services:
  mcp-server:
    image: yourorg/clinical-trials-mcp:latest
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Documentation

**Essential docs for your MCP:**

1. **README.md** (Docker Hub, GitHub)
   - Quick start
   - Required environment variables
   - Available tools with examples
   - Troubleshooting

2. **CHANGELOG.md**
   - Version history
   - Breaking changes
   - New features

3. **CONTRIBUTING.md**
   - How to report issues
   - Development setup
   - Pull request process

4. **API Reference** (auto-generated from docstrings)
   - Tool descriptions
   - Parameter types
   - Return types
   - Example calls

**Tool documentation template:**

```python
@mcp.tool()
async def search_clinical_trials(
    condition: str,
    status: Optional[TrialStatus] = None,
    max_results: int = 10
) -> TrialSearchResult:
    """
    Search for clinical trials by medical condition.
    
    This tool queries the Clinical Trials API to find relevant trials
    matching the specified condition. Results can be filtered by trial
    status and limited to a maximum number of results.
    
    Args:
        condition: Medical condition or disease to search for.
                   Examples: "diabetes", "breast cancer", "COVID-19"
        status: Optional filter for trial status. Options:
                - RECRUITING: Currently accepting participants
                - ACTIVE: In progress but not recruiting
                - COMPLETED: Trial has finished
                - SUSPENDED: Temporarily paused
        max_results: Maximum number of trials to return (1-100).
                     Default: 10. Higher values may increase response time.
    
    Returns:
        TrialSearchResult containing:
        - trials: List of matching clinical trials with basic info
        - total_count: Total number of matching trials in database
        - has_more: Whether there are additional results beyond max_results
    
    Raises:
        ToolError: If API request fails or parameters are invalid
        
    Examples:
        Search for recruiting diabetes trials:
        >>> result = await search_clinical_trials(
        ...     condition="diabetes",
        ...     status=TrialStatus.RECRUITING,
        ...     max_results=20
        ... )
        
        Broad search for cancer trials:
        >>> result = await search_clinical_trials(condition="cancer")
    
    Notes:
        - Search is case-insensitive
        - Partial matches are included (e.g., "diabetes" matches "Type 2 Diabetes")
        - Results are sorted by relevance
    """
```

---

## 12. Quick Start Checklist

Use this checklist to go from zero to running MCP in 2-6 hours.

### Phase 1: Local Development (30-60 min)

- [ ] **Setup environment**
  - [ ] Python 3.10+ installed
  - [ ] Virtual environment created
  - [ ] FastMCP and dependencies installed: `pip install fastmcp httpx pydantic pydantic-settings`

- [ ] **Create minimal server**
  - [ ] Created `app/mcp_server.py` with FastMCP instance
  - [ ] Added at least 2 tools with proper type hints
  - [ ] Added docstrings to all tools
  - [ ] Tools return structured data (Pydantic models)

- [ ] **Configuration management**
  - [ ] Created `app/config.py` with Settings class
  - [ ] Reads `API_KEY` from environment variable
  - [ ] Created `.env.example` template
  - [ ] Added `.env` to `.gitignore`

- [ ] **Test locally**
  - [ ] Server runs with `fastmcp run app/mcp_server.py`
  - [ ] Set `API_KEY` environment variable
  - [ ] Tested tools manually (if possible)

### Phase 2: GraphQL Integration (60-90 min)

- [ ] **GraphQL client**
  - [ ] Created `app/graphql_client.py`
  - [ ] Implements authentication with Bearer token
  - [ ] Error handling for GraphQL errors and HTTP errors
  - [ ] Timeout configuration

- [ ] **Specific tools for GraphQL operations**
  - [ ] Each tool wraps a specific GraphQL query/mutation
  - [ ] Strong input validation (Pydantic models)
  - [ ] Output mapping to structured types
  - [ ] Error handling with ToolError

- [ ] **Testing**
  - [ ] Tested each tool with real API (if available)
  - [ ] Or created mock responses for testing
  - [ ] Validated error handling (timeouts, auth failures, etc.)

### Phase 3: Dockerization (30-45 min)

- [ ] **Dockerfile**
  - [ ] Created `Dockerfile`
  - [ ] Uses Python 3.11-slim base image
  - [ ] Copies dependencies and installs
  - [ ] Copies application code
  - [ ] Runs as non-root user
  - [ ] CMD runs FastMCP server

- [ ] **Build and test**
  - [ ] Built image: `docker build -t my-mcp:test .`
  - [ ] Ran container: `docker run -i --rm -e API_KEY=test my-mcp:test`
  - [ ] Confirmed server starts without errors

- [ ] **Docker Compose (optional for local dev)**
  - [ ] Created `docker-compose.yml`
  - [ ] Configured environment variables
  - [ ] Tested with `docker-compose up`

### Phase 4: Documentation (15-30 min)

- [ ] **README.md**
  - [ ] Quick start instructions
  - [ ] Required environment variables table
  - [ ] Example MCP client configurations (Claude, Cursor)
  - [ ] Available tools list with descriptions

- [ ] **.dockerignore**
  - [ ] Excludes `.git`, `.env`, `venv/`, test files

- [ ] **.gitignore**
  - [ ] Python bytecode, `venv/`, `.env`, `__pycache__/`

### Phase 5: Publishing (30-45 min)

- [ ] **Docker Hub**
  - [ ] Created Docker Hub account and repository
  - [ ] Tagged image: `docker tag my-mcp:test yourorg/my-mcp:1.0.0`
  - [ ] Pushed to Hub: `docker push yourorg/my-mcp:1.0.0`
  - [ ] Also pushed `:latest` tag

- [ ] **Docker Hub README**
  - [ ] Pasted comprehensive usage instructions
  - [ ] Included client configuration examples
  - [ ] Documented all environment variables

- [ ] **GitHub repository (optional but recommended)**
  - [ ] Pushed code to GitHub
  - [ ] Added repository link to Docker Hub

### Phase 6: Client Configuration (15-30 min)

- [ ] **Test with real MCP client**
  - [ ] Configured Claude Desktop / Cursor / VS Code
  - [ ] Added server to MCP client config
  - [ ] Set environment variables (API_KEY, etc.)
  - [ ] Restarted client
  - [ ] Tested queries that use your tools
  - [ ] Verified responses are correct

---

## 13. Design Checklist

Use this to validate your MCP design is agent-friendly and production-ready.

### Agent-Friendly Design

- [ ] **Tool Granularity**
  - [ ] Each tool has single, clear purpose
  - [ ] Tool names are descriptive and action-oriented
  - [ ] No "god tools" that do everything

- [ ] **Type Safety**
  - [ ] All parameters have explicit types (Pydantic models preferred)
  - [ ] Enums used for constrained values
  - [ ] Return types are structured (not raw dicts)
  - [ ] No `Any` types except where truly necessary

- [ ] **Documentation**
  - [ ] Every tool has detailed docstring
  - [ ] Parameters documented with examples
  - [ ] Return values documented
  - [ ] Possible errors documented

- [ ] **Error Handling**
  - [ ] All errors use ToolError with error_code
  - [ ] Retryable errors marked as such
  - [ ] Error messages are helpful but don't leak secrets
  - [ ] Unexpected errors caught and logged

### GraphQL Integration

- [ ] **Specific Tools Pattern**
  - [ ] Each tool corresponds to specific operation
  - [ ] Fixed GraphQL queries (not arbitrary)
  - [ ] Input validation before calling GraphQL

- [ ] **Security**
  - [ ] No arbitrary query execution (unless explicitly designed for it)
  - [ ] API key from environment variable only
  - [ ] No secrets logged or exposed in errors

- [ ] **Error Mapping**
  - [ ] GraphQL errors converted to ToolError
  - [ ] HTTP errors handled separately
  - [ ] Timeout errors marked as retryable

### Docker & Deployment

- [ ] **Image Quality**
  - [ ] Uses slim/alpine base image
  - [ ] Multi-stage build (if complex dependencies)
  - [ ] Non-root user
  - [ ] .dockerignore configured

- [ ] **Configuration**
  - [ ] All secrets via environment variables
  - [ ] Defaults provided for optional config
  - [ ] Fails fast if required vars missing
  - [ ] No hardcoded URLs or keys

- [ ] **Documentation**
  - [ ] README documents all env vars
  - [ ] MCP client config examples provided
  - [ ] Troubleshooting section included

- [ ] **Testing**
  - [ ] Tested bare-metal (Python directly)
  - [ ] Tested in Docker locally
  - [ ] Tested with real MCP client
  - [ ] Tested error cases

### Production Readiness

- [ ] **Observability**
  - [ ] Structured logging configured
  - [ ] Tool calls logged with timing
  - [ ] Errors logged with context
  - [ ] Secrets masked in logs

- [ ] **Performance**
  - [ ] Async tools for I/O operations
  - [ ] Connection pooling for HTTP
  - [ ] Reasonable timeouts configured
  - [ ] Resource limits considered

- [ ] **Security**
  - [ ] No secrets in code or logs
  - [ ] HTTPS for external APIs
  - [ ] Input validation on all parameters
  - [ ] Rate limiting (if needed)

- [ ] **Maintainability**
  - [ ] Code organized into modules
  - [ ] Clear separation of concerns
  - [ ] Version pinned dependencies
  - [ ] Changelog maintained

---

## Conclusion

You now have a complete guide to building production-ready MCP servers with FastMCP, Python, and Docker. Key takeaways:

**Design Philosophy:**
- **MCP ≠ REST API:** Design for autonomous agents, not human developers
- **Small, composable tools** beat large multi-purpose endpoints
- **Strong types and clear docs** help agents succeed

**Security Model:**
- **Per-user secrets** via runtime environment variables
- **Never bake secrets** into Docker images
- **Fail fast** if required configuration is missing

**GraphQL Pattern:**
- **Specific high-level tools** (Option B) is best for hackathons
- **Wrap fixed queries** instead of exposing arbitrary query execution
- **Map GraphQL responses** to strongly-typed Pydantic models

**Distribution:**
- **Docker Hub** for easy distribution
- **MCP Toolkit** for one-click installation (if listed in catalog)
- **Clear documentation** of required environment variables

**Timeline:**
- **2 hours:** Minimal working MCP (bare-metal + Docker)
- **4 hours:** With GraphQL integration and testing
- **6 hours:** Production-ready with docs and published to Docker Hub

**Remember:** The goal is to build a **specialized librarian for AI agents** — helping them discover, understand, and orchestrate tools to accomplish complex user goals. Make your MCP predictable, well-documented, and composable.

Good luck with your hackathon! 🚀