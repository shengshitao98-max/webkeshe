import cv2
import os
import numpy as np

TEMP_DIR = os.path.join(os.path.dirname(__file__), 'tmp')
os.makedirs(TEMP_DIR, exist_ok=True)

def _open_video_with_chinese_path(video_path):
    try:
        video_path = os.path.abspath(video_path)
        cap = cv2.VideoCapture()
        cap.open(video_path, cv2.CAP_FFMPEG)
        if cap.isOpened():
            return cap
        
        cap.release()
        cap = cv2.VideoCapture(video_path)
        if cap.isOpened():
            return cap
        
        cap.release()
        return None
    except Exception as e:
        print(f'Error opening video: {str(e)}')
        return None

def extract_keyframes(video_path, interval=1):
    try:
        print(f'Extracting keyframes from: {video_path}, interval: {interval}s')
        
        cap = _open_video_with_chinese_path(video_path)
        if not cap:
            print(f'Cannot open video file: {video_path}')
            return []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"FPS: {fps}")
        
        frame_interval = int(fps * interval)
        print(f"Frame interval: {frame_interval}")
        
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Total frames: {frame_count}")
        
        keyframes = []
        frame_number = 0
        
        while frame_number < frame_count:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = cap.read()
            
            if ret:
                keyframe_path = os.path.join(TEMP_DIR, f'frame_{frame_number}.jpg')
                success, encoded = cv2.imencode('.jpg', frame)
                if success:
                    with open(keyframe_path, 'wb') as f:
                        f.write(encoded.tobytes())
                    keyframes.append(keyframe_path)
                    print(f'Extracted keyframe: {keyframe_path}')
            else:
                print(f'Failed to read frame {frame_number}')
            
            frame_number += frame_interval
        
        cap.release()
        print(f'Extracted {len(keyframes)} keyframes')
        return keyframes
    
    except Exception as e:
        print('Error extracting keyframes: ' + str(e))
        import traceback
        print('Traceback: ' + traceback.format_exc())
        return []

if __name__ == "__main__":
    video_path = 'F:/04-CODE/webkeshe/backend/uploads/1781140553834_b8a897b3d36e89423fe92f411e5df1fb.mp4'
    print(f"Testing keyframe extraction from: {video_path}")
    print(f"Path exists: {os.path.exists(video_path)}")
    
    keyframes = extract_keyframes(video_path, 5)
    print(f"Result: {len(keyframes)} keyframes extracted")