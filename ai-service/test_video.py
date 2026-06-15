import cv2
import os

def test_video_open():
    video_path = 'F:/04-CODE/webkeshe/backend/uploads/1781140553834_b8a897b3d36e89423fe92f411e5df1fb.mp4'
    
    print(f"Testing path: {video_path}")
    print(f"Path exists: {os.path.exists(video_path)}")
    
    # Method 1: Direct OpenCV
    cap1 = cv2.VideoCapture(video_path)
    print(f"Method 1 - Direct OpenCV: {cap1.isOpened()}")
    if cap1.isOpened():
        fps = cap1.get(cv2.CAP_PROP_FPS)
        frame_count = cap1.get(cv2.CAP_PROP_FRAME_COUNT)
        print(f"  FPS: {fps}")
        print(f"  Frame count: {frame_count}")
        
        ret, frame = cap1.read()
        print(f"  First frame read: {ret}")
        if ret:
            print(f"  Frame shape: {frame.shape}")
        
        cap1.release()
    
    # Method 2: Using CAP_FFMPEG
    cap2 = cv2.VideoCapture()
    cap2.open(video_path, cv2.CAP_FFMPEG)
    print(f"Method 2 - CAP_FFMPEG: {cap2.isOpened()}")
    if cap2.isOpened():
        fps = cap2.get(cv2.CAP_PROP_FPS)
        frame_count = cap2.get(cv2.CAP_PROP_FRAME_COUNT)
        print(f"  FPS: {fps}")
        print(f"  Frame count: {frame_count}")
        
        ret, frame = cap2.read()
        print(f"  First frame read: {ret}")
        if ret:
            print(f"  Frame shape: {frame.shape}")
        
        cap2.release()
    
    # Method 3: Using numpy to load
    cap3 = cv2.VideoCapture()
    try:
        cap3.open(video_path.encode('utf-8'), cv2.CAP_FFMPEG)
        print(f"Method 3 - UTF-8 encoded with CAP_FFMPEG: {cap3.isOpened()}")
        if cap3.isOpened():
            fps = cap3.get(cv2.CAP_PROP_FPS)
            print(f"  FPS: {fps}")
            cap3.release()
    except Exception as e:
        print(f"Method 3 failed: {e}")

if __name__ == "__main__":
    test_video_open()