import requests

query = input("Enter your query: ")

try:
    response = requests.post('http://localhost:8765/execute-query', json={
        'query': query,
        'variables': {},
        'endpoint': 'https://usflearn.instructure.com/api/graphql'
    })
    print(response.json())
except Exception as e:
    print(f"Error: {e}")