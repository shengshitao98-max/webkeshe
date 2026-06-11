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
from processors.keyword_detector import KeywordDetector

video_processor = VideoProcessor()
image_classifier = ImageClassifier()
video_classifier = VideoClassifier()
keyword_detector = KeywordDetector()

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})

@app.route('/api/analyze-video', methods=['POST'])
def analyze_video_with_kimi():
    """Analyze video directly using Kimi API"""
    try:
        data = request.json
        video_path = data.get('videoPath')

        if not video_path:
            return jsonify({'error': 'videoPath is required'}), 400

        logger.info(f'Starting Kimi video analysis for: {video_path}')

        result = video_processor.analyze_video_with_kimi(video_path)

        if result:
            return jsonify({
                'kimiVideoAnalysis': result,
                'class': result.get('class', 'normal'),
                'riskScore': result.get('riskScore', 0),
                'summary': result.get('summary', ''),
                'reasoning': result.get('reasoning', []),
                'status': 'success',
            })
        else:
            return jsonify({'error': 'Kimi video analysis failed'}), 500
    except Exception as e:
        logger.error(f'Error in Kimi video analysis: {str(e)}')
        return jsonify({'error': str(e)}), 500

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

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
