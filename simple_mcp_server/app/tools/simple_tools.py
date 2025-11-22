# app/tools/simple_tools.py
from fastmcp import FastMCP
from pydantic import BaseModel, Field
from typing import List
import datetime

class EchoInput(BaseModel):
    message: str = Field(..., description="Message to echo back")

class EchoOutput(BaseModel):
    echoed: str
    timestamp: str

class AddNumbersInput(BaseModel):
    a: float = Field(..., description="First number")
    b: float = Field(..., description="Second number")

class AddNumbersOutput(BaseModel):
    result: float
    operation: str

class GetRandomFactInput(BaseModel):
    category: str = Field(default="general", description="Category of fact (general, science, history)")

class GetRandomFactOutput(BaseModel):
    fact: str
    category: str

def register_simple_tools(mcp: FastMCP) -> None:
    """Register all simple dummy tools on the given FastMCP instance."""

    @mcp.tool(name="echo", description="Echo back a message with a timestamp.")
    def echo(input: EchoInput) -> EchoOutput:
        """
        Simple echo tool that returns your message with a timestamp.
        """
        timestamp = datetime.datetime.now().isoformat()
        return EchoOutput(
            echoed=f"You said: {input.message}",
            timestamp=timestamp
        )

    @mcp.tool(name="add_numbers", description="Add two numbers together.")
    def add_numbers(input: AddNumbersInput) -> AddNumbersOutput:
        """
        Adds two numbers and returns the result.
        """
        result = input.a + input.b
        return AddNumbersOutput(
            result=result,
            operation=f"{input.a} + {input.b} = {result}"
        )

    @mcp.tool(name="get_random_fact", description="Get a random fun fact.")
    def get_random_fact(input: GetRandomFactInput) -> GetRandomFactOutput:
        """
        Returns a hardcoded fun fact based on the category.
        """
        facts = {
            "general": "Honey never spoils. Archaeologists have found 3000-year-old honey in Egyptian tombs that was still edible!",
            "science": "A single bolt of lightning contains enough energy to toast 100,000 slices of bread.",
            "history": "Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid."
        }
        
        fact = facts.get(input.category, facts["general"])
        
        return GetRandomFactOutput(
            fact=fact,
            category=input.category
        )

