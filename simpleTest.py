import requests

response = requests.post('http://localhost:8765/execute-query', json={
    'query': 'query MyQuery { allCourses { name } }',
    'variables': {},
    'endpoint': 'https://usflearn.instructure.com/api/graphql'
})

print(response.json())