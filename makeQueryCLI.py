import requests
import sys
import re


def sanitize_query(query: str) -> tuple[bool, str]:
    """
    Sanitize the GraphQL query to prevent malicious operations.
    Returns (is_valid, error_message)
    """
    if not query or not query.strip():
        return False, "Query cannot be empty"
    
    # Remove leading/trailing whitespace
    query = query.strip()
    
    # Check for mutations (if we only want queries)
    if re.search(r'\bmutation\b', query, re.IGNORECASE):
        return False, "Mutations are not allowed"
    
    # Check for subscriptions (if we only want queries)
    if re.search(r'\bsubscription\b', query, re.IGNORECASE):
        return False, "Subscriptions are not allowed"
    
    # Check for comments that might hide malicious code
    # GraphQL comments are # ... but we'll be more strict
    if '#' in query:
        return False, "Comments are not allowed"
    
    # Check for multiple operations (prevent batch attacks)
    query_count = len(re.findall(r'\bquery\b', query, re.IGNORECASE))
    if query_count > 1:
        return False, "Only single queries are allowed"
    
    # Check for dangerous keywords that might indicate injection attempts
    dangerous_keywords = [
        'exec', 'eval', 'system', 'import', '__import__',
        'os.', 'subprocess', 'shell', 'cmd', 'command'
    ]
    query_lower = query.lower()
    for keyword in dangerous_keywords:
        if keyword in query_lower:
            return False, f"Dangerous keyword detected: {keyword}"
    
    # Check for suspicious patterns (SQL injection patterns adapted for GraphQL)
    suspicious_patterns = [
        r';\s*(drop|delete|insert|update|alter|create|truncate)',
        r'union\s+.*\s+select',
        r'exec\s*\(',
        r'eval\s*\(',
    ]
    for pattern in suspicious_patterns:
        if re.search(pattern, query, re.IGNORECASE):
            return False, f"Suspicious pattern detected: {pattern}"
    
    # Limit query length to prevent DoS
    if len(query) > 10000:
        return False, "Query is too long (max 10000 characters)"
    
    # Ensure it starts with 'query' keyword
    if not re.match(r'^\s*query\s+', query, re.IGNORECASE):
        return False, "Query must start with 'query' keyword"
    
    # Check for balanced braces and parentheses
    if query.count('{') != query.count('}'):
        return False, "Unbalanced braces in query"
    if query.count('(') != query.count(')'):
        return False, "Unbalanced parentheses in query"
    
    return True, ""


def main():
    if len(sys.argv) < 2:
        print("Usage: python makeQueryCLI.py '<query>'")
        print("Example: python makeQueryCLI.py 'query { courses { id name } }'")
        sys.exit(1)
    
    query = sys.argv[1]
    
    # Sanitize the query
    is_valid, error_message = sanitize_query(query)
    if not is_valid:
        print(f"Error: Query validation failed - {error_message}")
        sys.exit(1)
    
    try:
        response = requests.post('http://localhost:8765/execute-query', json={
            'query': query,
            'variables': {},
            'endpoint': 'https://usflearn.instructure.com/api/graphql'
        })
        print(response.json())
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()

