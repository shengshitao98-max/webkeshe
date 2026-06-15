import logging
import os
import cv2
import numpy as np
import tempfile
import json
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from moviepy import VideoFileClip
    MOVIEPY_AVAILABLE = True
    logger.info('moviepy 2.x detected, using direct import')
except ImportError:
    try:
        from moviepy.editor import VideoFileClip
        MOVIEPY_AVAILABLE = True
        logger.info('moviepy 1.x detected, using editor import')
    except ImportError:
        MOVIEPY_AVAILABLE = False
        logger.warning('moviepy not available, audio extraction will be mocked')

TEMP_DIR = os.path.join(os.path.dirname(__file__), '..', 'tmp')
os.makedirs(TEMP_DIR, exist_ok=True)

def ensure_path_exists(path):
    """Ensure directory exists for given file path"""
    dir_path = os.path.dirname(path)
    if dir_path:
        os.makedirs(dir_path, exist_ok=True)
    return path

class VideoProcessor:
    """Video processing utilities using OpenCV and Kimi API"""
    
    def __init__(self):
        self.kimi_api_key = os.getenv('MOONSHOT_API_KEY', 'sk-nljtNtZFb2fLV6owohfycEFu8dF1034vxav4UKtDZCmISxvo')
        
        if OPENAI_AVAILABLE:
            self.kimi_client = OpenAI(
                base_url="https://api.moonshot.cn/v1",
                api_key=self.kimi_api_key,
            )
            logger.info('Kimi API configured for video analysis')
        else:
            self.kimi_client = None
            logger.warning('OpenAI SDK not available, video analysis will be limited')
        
        logger.info('VideoProcessor initialized with OpenCV and Kimi API')
    
    def _open_video_with_chinese_path(self, video_path):
        try:
            import numpy as np
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
            logger.error(f'Error opening video: {str(e)}')
            return None

    def get_metadata(self, video_path):
        try:
            logger.info(f'Extracting metadata from: {video_path}')
            
            if not os.path.exists(video_path):
                logger.error(f'Video file does not exist: {video_path}')
                return None
            
            file_size = os.path.getsize(video_path)
            if file_size == 0:
                logger.error(f'Video file is empty: {video_path}')
                return None
            
            cap = self._open_video_with_chinese_path(video_path)
            if not cap:
                logger.error(f'Cannot open video file: {video_path}')
                return None
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = frame_count / fps if fps > 0 else 0
            
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            cap.release()
            
            metadata = {
                'duration': round(duration, 2),
                'durationFormatted': self._format_duration(duration),
                'width': width,
                'height': height,
                'resolution': f'{width}x{height}',
                'fps': round(fps, 2),
                'frameCount': frame_count,
                'fileSize': os.path.getsize(video_path),
            }
            
            logger.info(f'Extracted metadata: {metadata}')
            return metadata
        
        except Exception as e:
            logger.error('Error extracting metadata: ' + str(e))
            return None
    
    def _format_duration(self, seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        
        if hours > 0:
            return f'{hours:02}:{minutes:02}:{secs:02}'
        else:
            return f'{minutes:02}:{secs:02}'
    
    def extract_keyframes(self, video_path, interval=1):
        try:
            logger.info(f'Extracting keyframes from: {video_path}, interval: {interval}s')
            
            if not os.path.exists(video_path):
                logger.error(f'Video file does not exist: {video_path}')
                return []
            
            file_size = os.path.getsize(video_path)
            if file_size == 0:
                logger.error(f'Video file is empty: {video_path}')
                return []
            
            cap = self._open_video_with_chinese_path(video_path)
            if not cap:
                logger.error(f'Cannot open video file: {video_path}')
                return []
            
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_interval = int(fps * interval)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            
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
                        logger.debug(f'Extracted keyframe: {keyframe_path}')
                
                frame_number += frame_interval
            
            cap.release()
            logger.info(f'Extracted {len(keyframes)} keyframes')
            return keyframes
        
        except Exception as e:
            logger.error('Error extracting keyframes: ' + str(e))
            import traceback
            logger.error('Traceback: ' + traceback.format_exc())
            return []
    
    def extract_audio(self, video_path):
        try:
            logger.info(f'Extracting audio from: {video_path}')
            
            audio_path = os.path.join(TEMP_DIR, 'audio.wav')
            
            if MOVIEPY_AVAILABLE:
                try:
                    video = VideoFileClip(video_path)
                    audio = video.audio
                    if audio:
                        audio.write_audiofile(audio_path, codec='pcm_s16le')
                        video.close()
                        logger.info(f'Audio extracted to: {audio_path}')
                    else:
                        logger.warning('No audio track found in video')
                except Exception as e:
                    logger.warning('Failed to extract audio with moviepy: ' + str(e) + ', using mock')
            else:
                logger.info('moviepy not available, skipping audio extraction')
            
            return audio_path
        
        except Exception as e:
            logger.error('Error extracting audio: ' + str(e))
            return ''
    
    def transcribe_audio(self, audio_path):
        try:
            logger.info(f'Transcribing audio: {audio_path}')
            
            ffmpeg_path = 'F:\\01-开发工具\\ffmpeg-master-latest-win64-gpl-shared\\bin'
            if ffmpeg_path not in os.environ.get('PATH', ''):
                os.environ['PATH'] = ffmpeg_path + ';' + os.environ.get('PATH', '')
                logger.info(f'Added ffmpeg path to PATH: {ffmpeg_path}')
            
            import whisper
            model = whisper.load_model("base")
            result = model.transcribe(audio_path, language="zh")
            
            transcript = result["text"]
            logger.info(f'Transcription complete: {transcript[:100]}...')
            return transcript
        
        except Exception as e:
            logger.error(f'Error transcribing audio: {str(e)}. Falling back to empty transcript.')
            return ''
    
    def analyze_video_with_kimi(self, video_path):
        """Analyze video directly using Kimi API with video upload"""
        if not self.kimi_client:
            logger.error('Kimi client not available')
            return None
        
        try:
            logger.info(f'Uploading video to Kimi API: {video_path}')
            
            file_object = self.kimi_client.files.create(
                file=Path(video_path),
                purpose="video"
            )
            logger.info(f'Video uploaded successfully, file ID: {file_object.id}')
            
            logger.info('Analyzing video with Kimi API...')
            
            completion = self.kimi_client.chat.completions.create(
                model="kimi-k2.6",
                messages=[
                    {
                        "role": "system",
                        "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手。请分析视频内容，识别其中的敏感信息。"
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "video_url",
                                "video_url": {
                                    "url": f"ms://{file_object.id}"
                                }
                            },
                            {
                                "type": "text",
                                "text": "请分析这个视频，判断是否包含以下敏感内容，并给出详细分析结果：\n\n1. 暴力血腥内容：是否有血迹、伤口、武器、打斗等暴力元素\n2. 色情低俗内容：是否有裸露身体、性暗示等内容\n3. 其他敏感内容：政治敏感、违法信息等\n\n请按照以下JSON格式输出结果：\n{\n  \"class\": \"normal\" | \"pornographic\" | \"violent\" | \"suggestive\" | \"political\",\n  \"riskScore\": 0-100,\n  \"confidence\": 0-1,\n  \"summary\": \"视频内容简介\",\n  \"reasoning\": [\"原因1\", \"原因2\", ...]\n}"
                            }
                        ]
                    }
                ]
            )
            
            content = completion.choices[0].message.content.strip()
            
            content_clean = content
            if content_clean.startswith('```json'):
                content_clean = content_clean[7:]
            if content_clean.endswith('```'):
                content_clean = content_clean[:-3]
            content_clean = content_clean.strip()
            
            result = json.loads(content_clean)
            logger.info(f'Kimi video analysis result: {result}')
            
            return result
        
        except Exception as e:
            logger.error(f'Error analyzing video with Kimi API: {str(e)}')
            import traceback
            logger.error('Traceback: ' + traceback.format_exc())
            return None