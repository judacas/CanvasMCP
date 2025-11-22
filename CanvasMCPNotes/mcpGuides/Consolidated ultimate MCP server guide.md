this is a consolidation of all of the other guides such as:
- [[Canvas-GraphQL-CSRF-Token-Solution]]
- [[Building a FastMCP Server with Python & Docker for Modern MCP Clients.pdf]]
- [[fastmcp-docker-guide]]
- [[MCP-Server-FastMCP-Docker-Guide.pdf]]

**Purpose:**  
This is a _single, consolidated_ guide for an LLM agent (and you) to scaffold a **FastMCP** server that:

- Exposes **2+ tools** over MCP
    
- Wraps an **external API** (REST or GraphQL) using a **per-user API key**
    
- Runs **bare-metal**, **in Docker**, and can be **published to Docker Hub**
    
- Follows **MCP & agent-first best practices** so you only need ~5 hours to implement real logic
    

It merges and de-duplicates the uploaded guides into one opinionated playbook.

---

## 0. How an LLM Should Use This Guide

When a user asks you (the LLM) to “scaffold an MCP server”:

1. **Ask for these inputs (once):**
    
    - Project name (e.g. `canvas_mcp`, `clearmatch_mcp`)
        
    - Domain description (e.g. “Canvas LMS GraphQL”, “Clinical trials GraphQL API”)
        
    - External API base URL(s) (e.g. `https://example.com/graphql`)
        
    - Secret names they will set as env vars (e.g. `CANVAS_API_KEY`, `GRAPHQL_ENDPOINT`)
        
    - Names + short descriptions of **2–5 tools** they want (e.g. `get_course`, `list_assignments`, etc.)
        
2. **Then follow this order:**
    
    1. Generate **project structure** and `requirements.txt`
        
    2. Generate `app/config.py` for settings & env vars
        
    3. Generate `app/utils/external_api.py` (GraphQL/REST client)
        
    4. Generate `app/tools/<domain>_tools.py` with 2–5 tools
        
    5. Generate `app/server.py` wiring everything together
        
    6. Generate `.env.example`, `Dockerfile`, and basic `README.md`
        
    7. Provide **exact commands** to run bare-metal and via Docker
        
3. **Don’t over-engineer:**
    
    - Keep functions **small**, **typed**, and **stateless**
        
    - Focus on **clear schemas** and **error messages**; leave complex business logic as TODOs
        
    - Use **env vars** for all secrets (never hard-code)
        

---

## 1. MCP Mental Model (Very Short)

- **MCP Host:** Claude Desktop, Cursor, OpenAI, Docker MCP Toolkit
    
- **MCP Server (You):** Exposes **tools**, **resources**, and **prompts** via JSON-RPC
    
- **Consumer:** An **LLM agent**, not a human developer
    

Key differences vs REST:

|Aspect|REST API|MCP Server|
|---|---|---|
|Consumer|Human-written code|LLM agent planning workflows|
|Design|Resource-oriented endpoints|Small, action-oriented tools|
|Discovery|Docs / OpenAPI|Runtime tool schema & descriptions|
|State|Stateless|Long-lived connection, context-aware|
|Errors|HTTP status + text|Structured, agent-parseable errors|

Think of your MCP server as a **thin, typed adapter** between the agent and your external API(s).

---

## 2. Project Structure (Canonical Layout)

Use this as the default layout in every scaffold.

```text
my_mcp_server/
├── app/
│   ├── __init__.py
│   ├── config.py            # Settings & env vars
│   ├── server.py            # FastMCP server definition
│   ├── tools/
│   │   ├── __init__.py
│   │   └── domain_tools.py  # Your tools live here
│   └── utils/
│       ├── __init__.py
│       └── external_api.py  # GraphQL/REST client wrapper
├── tests/
│   ├── __init__.py
│   └── test_tools.py        # Optional for hackathon
├── .env.example             # Template for required env vars
├── .gitignore
├── requirements.txt
├── Dockerfile
└── README.md
```

### Suggested `requirements.txt`

```txt
fastmcp>=0.5.0
httpx>=0.25.0
pydantic>=2.0.0
python-dotenv>=1.0.0
```

---

## 3. Config & Secrets (Per-User API Keys)

### 3.1 `app/config.py`

Use Pydantic `BaseSettings` so env vars are validated at startup.

```python
# app/config.py
from pydantic import BaseSettings, Field, validator
from typing import Optional

class Settings(BaseSettings):
    """
    MCP server configuration.
    All secrets are loaded from environment variables.
    """

    # High-level metadata
    SERVER_NAME: str = Field(default="My MCP Server")
    SERVER_VERSION: str = Field(default="0.1.0")
    LOG_LEVEL: str = Field(default="INFO")
    PORT: int = Field(default=8000, description="HTTP port for MCP (if using HTTP)")

    # External API (adapt names for your domain)
    EXTERNAL_API_URL: str = Field(
        ...,
        description="Base URL for external API (e.g. GraphQL endpoint)",
    )
    API_KEY: str = Field(
        ...,
        description="Per-user API key or token (set by MCP client at runtime)",
    )

    # Optional auth extras
    OAUTH_TOKEN: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True

    @validator("EXTERNAL_API_URL")
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("EXTERNAL_API_URL must start with http:// or https://")
        return v.rstrip("/")

settings = Settings()
```

### 3.2 `.env.example`

This is a **template only**; the real `.env` is never committed.

```bash
# .env.example
# Copy to .env and fill values for local dev only.

EXTERNAL_API_URL=https://api.example.com/graphql
API_KEY=your_api_key_here

# Optional
LOG_LEVEL=INFO
PORT=8000
```

### 3.3 Secret Rules (LLM & Human)

- **ALWAYS**:
    
    - Read secrets from env vars (`os.getenv` or `BaseSettings`)
        
    - Document required vars in `.env.example` + README
        
    - Validate at startup; exit with clear error if missing
        
- **NEVER**:
    
    - Hard-code API keys
        
    - Bake secrets into Docker images
        
    - Log full secrets (mask them if needed)
        

---

## 4. External API Client (GraphQL/REST Wrapper)

Keep external calls in a small utility module so tools stay clean.

### 4.1 `app/utils/external_api.py`

Async example using `httpx` and a GraphQL endpoint.

```python
# app/utils/external_api.py
from typing import Any, Dict, Optional
import httpx
from app.config import settings

class ExternalAPIClient:
    """Thin wrapper around an external GraphQL/REST API."""
    def __init__(self):
        self.base_url = settings.EXTERNAL_API_URL
        self.api_key = settings.API_KEY
        self.timeout = 30  # seconds

    async def graphql(self, query: str, variables: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(self.base_url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        if "errors" in data:
            # Keep it structured; the tool will translate to a ToolError
            raise RuntimeError(f"GraphQL errors: {data['errors']}")
        return data.get("data", {})

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            return resp.json()
```

For a **Canvas**-style GraphQL API, this class can call `settings.EXTERNAL_API_URL` pointed at the Canvas GraphQL endpoint; all logic stays the same.

---

## 5. Tools: Design + Code

### 5.1 Design Principles (Short)

From the combined docs:

- **Small & composable:** each tool does _one clear thing_ (e.g. “get course info”, not “manage everything”)
    
- **Rich, structured outputs:** return full structured JSON, not vague summaries
    
- **Strong typing:** use `pydantic` models, enums, field constraints
    
- **Idempotent where possible:** safe to retry the same call
    
- **Explicit errors:** use structured error codes and messages that tell the agent how to fix input
    

### 5.2 Example Pydantic Models

```python
# app/tools/domain_models.py (optional)
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional, List

class CourseLevel(str, Enum):
    UNDERGRAD = "undergrad"
    GRAD = "grad"
    OTHER = "other"

class Course(BaseModel):
    id: str = Field(..., description="Unique course identifier")
    name: str
    code: Optional[str] = Field(None, description="Human-friendly code, e.g. COP 4365")
    level: Optional[CourseLevel] = None

class CourseList(BaseModel):
    courses: List[Course]
    total: int
```

### 5.3 `app/tools/domain_tools.py`

Example with **two tools**: one GraphQL-backed, one simple utility.

```python
# app/tools/domain_tools.py
from fastmcp import FastMCP, ToolError
from pydantic import BaseModel, Field
from typing import List
from app.utils.external_api import ExternalAPIClient

api_client = ExternalAPIClient()

class CourseByIdInput(BaseModel):
    course_id: str = Field(..., description="Course ID to look up")

class CourseOutput(BaseModel):
    id: str
    name: str
    description: str | None = None
    start_date: str | None = Field(
        default=None, description="ISO 8601 date, if available"
    )

class EchoInput(BaseModel):
    message: str = Field(..., description="Message to echo back")

class EchoOutput(BaseModel):
    echoed: str

def register_domain_tools(mcp: FastMCP) -> None:
    """Register all domain-specific tools on the given FastMCP instance."""

    @mcp.tool(name="get_course_info", description="Fetch course details by ID.")
    async def get_course_info(input: CourseByIdInput) -> CourseOutput:
        """
        Get details for a single course from the external GraphQL API.
        """
        query = """
        query GetCourse($id: ID!) {
          course(id: $id) {
            id
            name
            description
            startDate
          }
        }
        """
        vars = {"id": input.course_id}

        try:
            data = await api_client.graphql(query, vars)
        except Exception as e:
            # Agent-friendly error
            raise ToolError(
                message=f"Failed to fetch course: {e}",
                error_code="API_ERROR",
                retryable=True,
            )

        course = data.get("course")
        if not course:
            raise ToolError(
                message=f"No course found with id={input.course_id}",
                error_code="NOT_FOUND",
                retryable=False,
            )

        return CourseOutput(
            id=course["id"],
            name=course["name"],
            description=course.get("description"),
            start_date=course.get("startDate"),
        )

    @mcp.tool(name="echo", description="Simple echo tool for debugging.")
    def echo(input: EchoInput) -> EchoOutput:
        """
        Return the provided message, useful for connectivity tests.
        """
        return EchoOutput(echoed=f"You said: {input.message}")
```

> **LLM note:** When adapting this, only change:
> 
> - Names (`Course`, `get_course_info`, etc.)
>     
> - GraphQL query
>     
> - Pydantic model fields  
>     Keep the **pattern** intact.
>     

---

## 6. Server Wiring (`app/server.py`)

Single place where config, tools, and clients come together.

```python
# app/server.py
import sys
import logging
from fastmcp import FastMCP
from app.config import settings
from app.tools.domain_tools import register_domain_tools

# Logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Create MCP server instance
mcp = FastMCP(
    name=settings.SERVER_NAME,
    logger=logger,
    mask_error_details=True,  # hide internal tracebacks from the agent in prod
)

# Register tools
register_domain_tools(mcp)

# Simple resources for health & metadata
@mcp.resource("health://status")
def health_status() -> dict:
    """Basic health check for the MCP server."""
    return {
        "status": "ok",
        "version": settings.SERVER_VERSION,
        "external_api": settings.EXTERNAL_API_URL,
    }

@mcp.resource("config://server-info")
def server_info() -> dict:
    """Server metadata and capabilities."""
    return {
        "name": settings.SERVER_NAME,
        "version": settings.SERVER_VERSION,
        "description": "Example MCP server wrapping an external API.",
    }

if __name__ == "__main__":
    if not settings.API_KEY:
        logger.error("API_KEY environment variable is required.")
        sys.exit(1)

    logger.info(f"Starting {settings.SERVER_NAME} v{settings.SERVER_VERSION}")
    logger.info(f"External API: {settings.EXTERNAL_API_URL}")
    logger.info(f"Listening on port {settings.PORT}")

    # Default: stdio; to force HTTP, see Section 7
    mcp.run()
```

---

## 7. Running Bare-Metal

### 7.1 Install & Run

```bash
# 1. Create venv
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install deps
pip install -r requirements.txt

# 3. Create local .env (for dev only)
cp .env.example .env
# edit .env and set EXTERNAL_API_URL + API_KEY

# 4. Run server (stdio)
python -m app.server
# or
python app/server.py
```

### 7.2 HTTP Transport (optional dev mode)

You can also run via the FastMCP CLI using HTTP:

```bash
fastmcp run app/server.py --transport http --port 8000
```

The MCP endpoint will then be at:

- `http://localhost:8000/mcp`
    

This is convenient for manual testing or remote MCP clients.

---

## 8. Dockerizing the MCP Server

### 8.1 Dockerfile (Opinionated Minimal)

Based on the docs, but generalized:

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app

# Expose HTTP port (if using HTTP transport)
EXPOSE 8000

ENV PYTHONUNBUFFERED=1

# Default command: run via FastMCP CLI using HTTP
CMD ["fastmcp", "run", "app/server.py", "--transport", "http", "--port", "8000"]
```

### 8.2 Build & Run Locally

```bash
# Build
docker build -t my-mcp-server:latest .

# Run with per-user secrets
docker run -d \
  -p 8000:8000 \
  -e EXTERNAL_API_URL="https://api.example.com/graphql" \
  -e API_KEY="sk-...user-specific-token..." \
  --name my_mcp_server \
  my-mcp-server:latest
```

- Each user supplies their **own** `API_KEY` as an env var at runtime.
    
- The image itself contains **no secrets**.
    

---

## 9. Publishing to Docker Hub (Quick Path)

1. **Tag image:**
    
    ```bash
    docker tag my-mcp-server:latest your_dockerhub_username/my-mcp-server:0.1.0
    docker tag my-mcp-server:latest your_dockerhub_username/my-mcp-server:latest
    ```
    
2. **Login & push:**
    
    ```bash
    docker login
    docker push your_dockerhub_username/my-mcp-server:0.1.0
    docker push your_dockerhub_username/my-mcp-server:latest
    ```
    
3. **Runtime configuration (MCP clients):**
    
    - Claude Desktop / Cursor / OpenAI MCP configs typically run the container like:
        
        ```json
        {
          "command": "docker",
          "args": [
            "run", "-i", "--rm",
            "-e", "EXTERNAL_API_URL=https://api.example.com/graphql",
            "-e", "API_KEY=${user_api_key}",
            "your_dockerhub_username/my-mcp-server:latest"
          ]
        }
        ```
        
    - The **client** handles the per-user secret and injects it as `API_KEY` into the container environment.
        

---

## 10. MCP vs REST API Best-Practice Summary

From the combined design sections:

**Do:**

- Design **agent-oriented tools**, not 1:1 REST endpoint wrappers
    
- Use **Pydantic models** and enums for input/output
    
- Keep tools **small & idempotent**
    
- Return **all relevant fields** so the agent can decide what matters
    
- Use **clear error codes**: `INVALID_PARAMETER`, `NOT_FOUND`, `API_ERROR`, etc.
    

**Avoid:**

- “God” tools with `action: str` controlling behavior
    
- Generic `dict`/`Any` parameters with no schema
    
- Hiding side-effects (e.g. creating & charging an order in one call)
    
- Doing heavy summarization instead of returning raw structured data
    

---

## 11. Hackathon Quick Checklist (LLM + Human)

### 11.1 Scaffolding Checklist (LLM-First)

When asked to scaffold an MCP:

-  Ask user: project name, domain, external API URL, env var names, list of tools
    
-  Generate project tree and `requirements.txt`
    
-  Create `app/config.py` with `Settings(BaseSettings)`
    
-  Create `app/utils/external_api.py` (GraphQL/REST client)
    
-  Create `app/tools/domain_tools.py` with **at least 2 tools**
    
-  Create `app/server.py` registering tools + health resources
    
-  Create `.env.example`, `Dockerfile`, minimal `README.md`
    
-  Output exact run commands:
    
    - `pip install -r requirements.txt`
        
    - `python app/server.py`
        
    - `docker build ...` / `docker run ...`
        

### 11.2 Human Implementation Checklist (5-Hour MVP)

-  Fill in real GraphQL/REST queries in `external_api.py`
    
-  Adjust Pydantic models to match real API responses
    
-  Add any extra tools you need (copy the existing pattern)
    
-  Test tools locally (e.g. with a small script or MCP client)
    
-  Build Docker image and run it with your own `API_KEY`
    
-  (Optional) Push to Docker Hub and wire it into Claude/Cursor/OpenAI
    

---

If you’d like, next step I can do is: **“Given my domain is X and my external API is Y, scaffold the exact files for me based on this guide.”**