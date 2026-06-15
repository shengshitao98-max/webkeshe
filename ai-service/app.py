from flask import Flask, request, jsonify
import os
from datetime import datetime
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 209715200

from processors.video_processor import VideoProcessor
from classifiers.image_classifier import ImageClassifier
from classifiers.video_classifier import VideoClassifier
from classifiers.yolo_classifier import VideoContentAnalyzer
from processors.keyword_detector import KeywordDetector
from processors.local_monitor import LocalFrameMonitor
from processors.frame_comparator import FrameComparator
from database.local_db import LocalFrameDatabase

video_processor = VideoProcessor()
image_classifier = ImageClassifier()
video_classifier = VideoClassifier()
content_analyzer = VideoContentAnalyzer()
keyword_detector = KeywordDetector()
local_monitor = LocalFrameMonitor()
frame_comparator = FrameComparator()
local_db = LocalFrameDatabase()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/analyze-local', methods=['POST'])
def analyze_local_only():
    """Perform only local analysis without Kimi API"""
    try:
        data = request.json
        video_path = data.get('videoPath')

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Performing local-only analysis for: {video_path}')

        local_result = perform_local_analysis(video_path)
        local_result['analysisMethod'] = 'local_only'
        local_result['localThreshold'] = 30
        
        return jsonify(local_result)
            
    except Exception as e:
        logger.error(f'Error in local analysis: {str(e)}')
        return jsonify({
            'error': str(e),
            'status': 'error',
            'analysisMethod': 'error',
            'riskScore': 0,
            'class': 'normal',
            'reasoning': ['本地分析失败'],
        }), 500

@app.route('/api/analyze-video', methods=['POST'])
def analyze_video_with_kimi():
    """Two-stage analysis: local screening first, then AI deep analysis if suspicious"""
    try:
        data = request.json
        video_path = data.get('videoPath')
        kimi_threshold = data.get('kimiThreshold', 30)

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Starting two-stage video analysis for: {video_path}, Kimi threshold: {kimi_threshold}')

        local_result = perform_local_analysis(video_path)
        
        if local_result['riskScore'] >= kimi_threshold:
            logger.info(f'Local analysis detected risk ({local_result["riskScore"]} >= {kimi_threshold}), calling Kimi API')
            kimi_result = perform_kimi_analysis(video_path, local_result)
            kimi_result['localThreshold'] = kimi_threshold
            return jsonify(kimi_result)
        else:
            logger.info(f'Local analysis passed ({local_result["riskScore"]} < {kimi_threshold}), skipping Kimi API')
            local_result['analysisMethod'] = 'local_only'
            local_result['localThreshold'] = kimi_threshold
            return jsonify(local_result)
            
    except Exception as e:
        logger.error(f'Error in two-stage analysis: {str(e)}')
        return jsonify({
            'error': str(e),
            'status': 'error',
            'analysisMethod': 'error',
        }), 500

def perform_local_analysis(video_path):
    """Perform local screening analysis using SVM + 26D features algorithm (based on Ren Dong paper)"""
    logger.info(f'Performing local analysis for: {video_path}')
    
    keyframes = video_processor.extract_keyframes(video_path)
    
    analyzer_results = content_analyzer.classify_images(keyframes)
    
    audio_path = video_processor.extract_audio(video_path)
    transcription = ""
    if audio_path and os.path.exists(audio_path):
        transcription = video_processor.transcribe_audio(audio_path)
    
    keyword_results = keyword_detector.detect_keywords(transcription, use_kimi=False)
    
    overall_risk = 0
    overall_class = 'normal'
    reasoning = []
    frame_reasoning = []
    
    suspicious_frames = 0
    violation_frames = 0
    
    for frame_result in analyzer_results:
        frame_risk = frame_result.get('risk_score', 0)
        if frame_risk > overall_risk:
            overall_risk = frame_risk
        
        frame_class = frame_result.get('class', 'normal')
        
        if frame_class == 'violation':
            violation_frames += 1
            overall_class = 'pornographic'
        elif frame_class == 'suspicious':
            suspicious_frames += 1
            if overall_class == 'normal':
                overall_class = 'suggestive'
        
        if frame_result.get('reasoning'):
            frame_reasoning.extend(frame_result['reasoning'])
        if frame_result.get('objects'):
            obj_names = [obj['name'] for obj in frame_result['objects']]
            frame_reasoning.append(f"检测到物体: {', '.join(obj_names)}")
    
    reasoning.append(f"分析帧数: {len(keyframes)}")
    reasoning.append(f"平均肤色占比: {sum(r.get('skin_ratio', 0) for r in analyzer_results) / max(len(analyzer_results), 1):.2%}")
    
    if violation_frames > 0:
        reasoning.append(f"检测到 {violation_frames} 帧违规内容")
    if suspicious_frames > 0:
        reasoning.append(f"检测到 {suspicious_frames} 帧可疑内容")
    
    if keyword_results['riskScore'] > overall_risk:
        overall_risk = keyword_results['riskScore']
        if keyword_results['riskScore'] > 50:
            if any('血腥' in str(k) for k in keyword_results.get('keywords', [])):
                overall_class = 'bloody'
            elif any('暴力' in str(k) for k in keyword_results.get('keywords', [])):
                overall_class = 'violent'
            elif any('色情' in str(k) for k in keyword_results.get('keywords', [])):
                overall_class = 'pornographic'
            else:
                overall_class = 'suggestive'
    
    if keyword_results.get('keywords'):
        reasoning.append(f"检测到敏感词: {', '.join(keyword_results['keywords'])}")
    
    reasoning.extend(frame_reasoning[:10])
    
    class_description = {
        'normal': '正常',
        'suggestive': '可疑',
        'bloody': '血腥',
        'violent': '暴力',
        'pornographic': '色情',
        'political': '政治敏感'
    }
    
    result = {
        'status': 'success',
        'analysisMethod': 'svm_26d',
        'class': overall_class,
        'className': class_description.get(overall_class, overall_class),
        'riskScore': overall_risk,
        'reasoning': reasoning,
        'summary': f"本地分析（SVM+26D特征）完成，检测到 {len(keyframes)} 个关键帧，风险等级: {class_description.get(overall_class, overall_class)}",
        'keyframes': keyframes,
        'analyzerResults': analyzer_results,
        'transcription': transcription,
        'keywordResults': keyword_results,
        'suspiciousFrames': suspicious_frames,
        'violationFrames': violation_frames,
    }
    
    logger.info(f'Local analysis completed: class={overall_class}, riskScore={overall_risk}, suspiciousFrames={suspicious_frames}, violationFrames={violation_frames}')
    return result

def perform_kimi_analysis(video_path, local_result):
    """Perform Kimi AI deep analysis when local screening detects issues"""
    try:
        logger.info(f'Calling Kimi API for deep analysis: {video_path}')
        
        kimi_result = video_processor.analyze_video_with_kimi(video_path)
        
        if kimi_result:
            logger.info('Kimi AI analysis succeeded')
            result = {
                'status': 'success',
                'analysisMethod': 'kimi',
                'class': kimi_result.get('class', local_result.get('class', 'normal')),
                'riskScore': kimi_result.get('riskScore', local_result.get('riskScore', 0)),
                'summary': kimi_result.get('summary', ''),
                'reasoning': kimi_result.get('reasoning', []),
                'kimiVideoAnalysis': kimi_result,
                'localAnalysis': local_result,
            }
            return result
        else:
            logger.warning('Kimi AI analysis failed, using local result')
            local_result['analysisMethod'] = 'local_fallback'
            return local_result
            
    except Exception as e:
        logger.error(f'Kimi AI analysis failed: {str(e)}, using local result')
        local_result['analysisMethod'] = 'local_fallback'
        return local_result

@app.route('/api/analyze', methods=['POST'])
def analyze_video():
    try:
        data = request.json
        video_path = data.get('videoPath')
        audio_path = data.get('audioPath')
        use_kimi_video = data.get('useKimiVideo', False)

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Starting analysis for video: {video_path}, useKimiVideo: {use_kimi_video}')

        final_result = {
            'status': 'success',
        }

        if use_kimi_video:
            kimi_result = video_processor.analyze_video_with_kimi(video_path)
            if kimi_result:
                final_result['kimiVideoAnalysis'] = kimi_result
                final_result['class'] = kimi_result.get('class', 'normal')
                final_result['riskScore'] = kimi_result.get('riskScore', 0)
                final_result['summary'] = kimi_result.get('summary', '')
                final_result['reasoning'] = kimi_result.get('reasoning', [])
            else:
                logger.warning('Kimi video analysis failed, falling back to frame analysis')
                use_kimi_video = False

        if not use_kimi_video or not final_result.get('kimiVideoAnalysis'):
            keyframes = video_processor.extract_keyframes(video_path)
            image_results = image_classifier.classify_images(keyframes)

            transcription = ""
            if audio_path:
                transcription = video_processor.transcribe_audio(audio_path)

            keyword_results = keyword_detector.detect_keywords(transcription)

            final_result['keyframes'] = keyframes
            final_result['imageResults'] = image_results
            final_result['transcription'] = transcription
            final_result['keywordResults'] = keyword_results

            overall_risk = 0
            overall_class = 'normal'
            
            for img_result in image_results:
                if img_result['riskScore'] > overall_risk:
                    overall_risk = img_result['riskScore']
                    overall_class = img_result['class']
            
            if keyword_results['riskScore'] > overall_risk:
                overall_risk = keyword_results['riskScore']
                if keyword_results['riskScore'] > 50:
                    overall_class = 'violent' if '暴力' in str(keyword_results.get('keywords', [])) else 'suggestive'
            
            final_result['class'] = overall_class
            final_result['riskScore'] = overall_risk

        return jsonify(final_result)
    except Exception as e:
        logger.error(f'Error analyzing video: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-metadata', methods=['POST'])
def get_metadata():
    try:
        data = request.json
        video_path = data.get('videoPath')

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Extracting metadata from: {video_path}')
        metadata = video_processor.get_metadata(video_path)

        if metadata:
            return jsonify({
                'metadata': metadata,
                'status': 'success',
            })
        else:
            return jsonify({'error': 'Failed to extract metadata'}), 500
    except Exception as e:
        logger.error(f'Error extracting metadata: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-keyframes', methods=['POST'])
def extract_keyframes():
    try:
        data = request.json
        video_path = data.get('videoPath')
        interval = data.get('interval', 5)

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Extracting keyframes from: {video_path}')
        keyframes = video_processor.extract_keyframes(video_path, interval)

        return jsonify({
            'keyframes': keyframes,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error extracting keyframes: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-audio', methods=['POST'])
def extract_audio():
    try:
        data = request.json
        video_path = data.get('videoPath')

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Extracting audio from: {video_path}')
        audio_path = video_processor.extract_audio(video_path)

        return jsonify({
            'audioPath': audio_path,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error extracting audio: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    try:
        data = request.json
        audio_path = data.get('audioPath')

        if not audio_path:
            return jsonify({'error': 'audioPath is required'}), 400

        logger.info(f'Transcribing audio: {audio_path}')
        text = video_processor.transcribe_audio(audio_path)

        return jsonify({
            'text': text,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error transcribing audio: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/classify-images', methods=['POST'])
def classify_images():
    try:
        data = request.json
        image_paths = data.get('imagePaths', [])

        if not image_paths:
            return jsonify({'error': 'imagePaths is required'}), 400

        logger.info(f'Classifying {len(image_paths)} images')
        results = image_classifier.classify_images(image_paths)

        return jsonify({
            'classifications': results,
            'maxRiskScore': max([r.get('riskScore', 0) for r in results], default=0),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error classifying images: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/classify-video', methods=['POST'])
def classify_video():
    try:
        data = request.json
        title = data.get('title', '')
        description = data.get('description', '')
        transcription = data.get('transcription', '')

        logger.info(f'Classifying video: title={title[:50]}, description={description[:50]}')
        result = video_classifier.classify(title, description, transcription)

        return jsonify({
            'category': result['category'],
            'categoryName': result['categoryName'],
            'confidence': result['confidence'],
            'reasoning': result['reasoning'],
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error classifying video: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/detect-keywords', methods=['POST'])
def detect_keywords():
    try:
        data = request.json
        text = data.get('text', '')

        if not text:
            return jsonify({'keywords': [], 'riskScore': 0}), 200

        logger.info(f'Detecting keywords in text: {text[:100]}...')
        results = keyword_detector.detect_keywords(text)

        return jsonify({
            'keywords': results['keywords'],
            'riskScore': results['riskScore'],
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error detecting keywords: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize-video', methods=['POST'])
def summarize_video():
    try:
        data = request.json
        title = data.get('title', '')
        description = data.get('description', '')
        transcription = data.get('transcription', '')
        category = data.get('category', '')
        keyframes = data.get('keyframes', [])

        logger.info(f'Generating summary for video: {title[:50]}, keyframes: {len(keyframes)}')
        
        summary = keyword_detector.generate_summary(title, description, transcription, category, keyframes)

        return jsonify({
            'summary': summary,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error generating summary: {str(e)}')
        import traceback
        logger.error('Traceback: ' + traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/start', methods=['POST'])
def start_monitor():
    try:
        data = request.json
        video_path = data.get('videoPath')
        session_id = data.get('sessionId')
        frame_interval = data.get('frameInterval', 0.5)
        
        logger.info(f'Starting local monitor: videoPath={video_path}, sessionId={session_id}, interval={frame_interval}')
        
        local_monitor.frame_interval = frame_interval
        
        import threading
        thread = threading.Thread(
            target=local_monitor.start_monitoring,
            args=(video_path, session_id),
            daemon=True
        )
        thread.start()
        
        return jsonify({
            'status': 'success',
            'sessionId': local_monitor.current_session_id,
            'message': 'Monitoring started in background',
        })
    except Exception as e:
        logger.error(f'Error starting monitor: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/stop', methods=['POST'])
def stop_monitor():
    try:
        local_monitor.stop_monitoring()
        return jsonify({
            'status': 'success',
            'message': 'Monitoring stopped',
        })
    except Exception as e:
        logger.error(f'Error stopping monitor: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/status', methods=['GET'])
def get_monitor_status():
    try:
        session_info = local_monitor.get_session_info()
        return jsonify({
            'isRunning': local_monitor.is_running,
            'currentSessionId': local_monitor.current_session_id,
            'sessionInfo': session_info,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error getting monitor status: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/sessions', methods=['GET'])
def get_monitor_sessions():
    try:
        status = request.args.get('status')
        sessions = local_monitor.get_all_sessions()
        if status:
            sessions = [s for s in sessions if s['status'] == status]
        return jsonify({
            'sessions': sessions,
            'count': len(sessions),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error getting sessions: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/suspicious-frames', methods=['GET'])
def get_suspicious_frames():
    try:
        video_id = request.args.get('videoId')
        limit = int(request.args.get('limit', 50))
        
        frames = local_db.get_suspicious_frames(video_id, limit)
        return jsonify({
            'frames': frames,
            'count': len(frames),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error getting suspicious frames: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/analyze-anomalies', methods=['POST'])
def analyze_anomalies():
    try:
        data = request.json
        video_id = data.get('videoId')
        threshold = data.get('threshold', 70)
        
        logger.info(f'Analyzing anomalies for video: {video_id}, threshold: {threshold}')
        
        anomalies = frame_comparator.detect_anomalies(video_id, threshold)
        statistics = frame_comparator.get_statistics(video_id)
        
        return jsonify({
            'anomalies': anomalies,
            'statistics': statistics,
            'count': len(anomalies),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error analyzing anomalies: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/analyze-sequence', methods=['POST'])
def analyze_sequence():
    try:
        data = request.json
        video_id = data.get('videoId')
        window_size = data.get('windowSize', 5)
        
        sequences = frame_comparator.analyze_sequence(video_id, window_size)
        return jsonify({
            'sequences': sequences,
            'count': len(sequences),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error analyzing sequence: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/upload-suspicious', methods=['POST'])
def upload_suspicious_frames():
    try:
        data = request.json
        video_id = data.get('videoId')
        max_count = data.get('maxCount', 10)
        
        suspicious_frames = local_db.get_suspicious_frames(video_id, max_count)
        
        uploaded_count = 0
        results = []
        
        for frame in suspicious_frames:
            try:
                frame_data = {
                    'frameId': frame['id'],
                    'videoId': frame['video_id'],
                    'frameIndex': frame['frame_index'],
                    'timestamp': frame['timestamp'],
                    'riskScore': frame['risk_score'],
                    'framePath': frame['frame_path'],
                }
                
                results.append({
                    'frameId': frame['id'],
                    'status': 'pending',
                    'data': frame_data,
                })
                
                local_db.mark_frame_uploaded(frame['id'])
                uploaded_count += 1
                
            except Exception as e:
                logger.error(f'Error processing frame {frame.get("id")}: {str(e)}')
        
        logger.info(f'Uploaded {uploaded_count} suspicious frames for video {video_id}')
        
        return jsonify({
            'uploadedCount': uploaded_count,
            'totalFound': len(suspicious_frames),
            'results': results,
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error uploading suspicious frames: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/add-template', methods=['POST'])
def add_feature_template():
    try:
        data = request.json
        template_name = data.get('templateName')
        description = data.get('description', '')
        features = data.get('features', {})
        
        if not template_name:
            return jsonify({'error': 'templateName is required'}), 400
        
        success = local_db.add_feature_template(template_name, description, features)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Template added successfully',
            })
        else:
            return jsonify({'error': 'Failed to add template'}), 500
    except Exception as e:
        logger.error(f'Error adding template: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/templates', methods=['GET'])
def get_feature_templates():
    try:
        templates = local_db.get_feature_templates()
        return jsonify({
            'templates': templates,
            'count': len(templates),
            'status': 'success',
        })
    except Exception as e:
        logger.error(f'Error getting templates: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/api/monitor/clear-data', methods=['POST'])
def clear_old_data():
    try:
        data = request.json
        days = data.get('days', 7)
        
        success = local_db.clear_old_data(days)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': f'Cleared data older than {days} days',
            })
        else:
            return jsonify({'error': 'Failed to clear data'}), 500
    except Exception as e:
        logger.error(f'Error clearing data: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
