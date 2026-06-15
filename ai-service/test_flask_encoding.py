import sys
import json

print(f"Python version: {sys.version}")
print(f"Default encoding: {sys.getdefaultencoding()}")

# Simulate what happens when Flask receives the request
test_body = '{"videoPath":"F:/04-项目代码/webkeshe/backend/uploads/1781140553834_b8a897b3d36e89423fe92f411e5df1fb.mp4"}'

print(f"\nOriginal body: {test_body}")
print(f"Body type: {type(test_body)}")

# Parse the JSON
data = json.loads(test_body)
video_path = data.get('videoPath')
print(f"\nParsed videoPath: {video_path}")
print(f"Path type: {type(video_path)}")

# Test encoding
video_path_bytes = video_path.encode('utf-8')
print(f"\nUTF-8 bytes: {video_path_bytes}")
print(f"Decoded back: {video_path_bytes.decode('utf-8')}")

# Test if path exists
import os
print(f"\nPath exists: {os.path.exists(video_path)}")

# Test OpenCV
import cv2
cap = cv2.VideoCapture(video_path)
print(f"OpenCV can open: {cap.isOpened()}")
if cap.isOpened():
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"FPS: {fps}")
    cap.release()