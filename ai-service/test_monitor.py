import requests
import json
import time

def test_monitor_api():
    base_url = 'http://localhost:5000/api/monitor'
    
    print("=== Testing Local Monitor API ===")
    
    print("\n1. Testing /api/monitor/sessions endpoint...")
    response = requests.get(f"{base_url}/sessions")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n2. Testing /api/monitor/status endpoint...")
    response = requests.get(f"{base_url}/status")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n3. Testing /api/monitor/templates endpoint...")
    response = requests.get(f"{base_url}/templates")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n4. Testing /api/monitor/suspicious-frames endpoint...")
    response = requests.get(f"{base_url}/suspicious-frames")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n5. Testing /api/monitor/add-template endpoint...")
    template_data = {
        "templateName": "test_template",
        "description": "Test template for suspicious content",
        "features": {
            "edge_mean": 100,
            "brightness": 128,
            "contrast": 50
        }
    }
    response = requests.post(f"{base_url}/add-template", json=template_data)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n6. Testing /api/monitor/templates after adding...")
    response = requests.get(f"{base_url}/templates")
    print(f"   Status: {response.status_code}")
    result = response.json()
    print(f"   Template count: {result['count']}")
    
    print("\n7. Testing /api/monitor/analyze-anomalies endpoint...")
    response = requests.post(f"{base_url}/analyze-anomalies", json={"videoId": "test"})
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    
    print("\n=== All API tests completed ===")

if __name__ == "__main__":
    test_monitor_api()