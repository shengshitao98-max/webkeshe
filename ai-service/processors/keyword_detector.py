import logging
import os
import json
import requests
from dotenv import load_dotenv

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

load_dotenv()

logger = logging.getLogger(__name__)

class KeywordDetector:
    """Sensitive keyword detection using Kimi API"""
    
    def __init__(self):
        """Initialize detector with Kimi API"""
        self.kimi_api_key = os.getenv('MOONSHOT_API_KEY', 'sk-nljtNtZFb2fLV6owohfycEFu8dF1034vxav4UKtDZCmISxvo')
        
        if OPENAI_AVAILABLE:
            self.kimi_client = OpenAI(
                base_url="https://api.moonshot.cn/v1",
                api_key=self.kimi_api_key,
            )
            logger.info('Kimi API configured with OpenAI SDK')
        else:
            self.kimi_client = None
            logger.warning('OpenAI SDK not available, falling back to requests')
        
        self.keywords_db = {
            'political': [
                '台独', '疆独', '藏独', '港独',
                '分裂国家', '颠覆政权', '恐怖主义',
            ],
            'porn': [
                '色情', '淫秽', '裸露', '下流', '猥琐',
                '性交易', '卖淫', '嫖娼',
            ],
            'violence': [
                '暴力', '杀害', '砍杀', '殴打',
                '血腥', '屠杀', '袭击',
            ],
            'illegal': [
                '毒品', '贩毒', '吸毒', '制毒',
                '诈骗', '赌博', '洗钱', '走私',
            ],
        }
        
        self.category_scores = {
            'political': 25,
            'porn': 20,
            'violence': 20,
            'illegal': 25,
        }
        
        logger.info('KeywordDetector initialized with Kimi support')
    
    def _call_kimi_api(self, text):
        """Call Kimi API for content moderation using OpenAI SDK"""
        try:
            if self.kimi_client:
                response = self.kimi_client.chat.completions.create(
                    model="kimi-k2.6",
                    messages=[
                        {
                            'role': 'system',
                            'content': '你是一个专业的内容审核AI助手。请分析以下文本，识别其中的敏感内容。返回格式为JSON：{"sensitive": true/false, "keywords": ["关键词1", "关键词2"], "risk_level": "high/medium/low", "risk_score": 0-100}'
                        },
                        {
                            'role': 'user',
                            'content': f'请分析以下文本的敏感内容：{text}'
                        }
                    ],
                    stream=False,
                )
                content = response.choices[0].message.content
            else:
                headers = {
                    'Authorization': f'Bearer {self.kimi_api_key}',
                    'Content-Type': 'application/json',
                }
                payload = {
                    'model': 'kimi-k2.6',
                    'messages': [
                        {
                            'role': 'system',
                            'content': '你是一个专业的内容审核AI助手。请分析以下文本，识别其中的敏感内容。返回格式为JSON：{"sensitive": true/false, "keywords": ["关键词1", "关键词2"], "risk_level": "high/medium/low", "risk_score": 0-100}'
                        },
                        {
                            'role': 'user',
                            'content': f'请分析以下文本的敏感内容：{text}'
                        }
                    ]
                }
                response = requests.post(
                    'https://api.moonshot.cn/v1/chat/completions',
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                if response.status_code == 200:
                    result = response.json()
                    content = result.get('choices', [{}])[0].get('message', {}).get('content', '')
                else:
                    logger.error(f'Kimi API error: {response.status_code}')
                    return None
            
            content_clean = content.strip()
            if content_clean.startswith('```json'):
                content_clean = content_clean[7:]
            if content_clean.endswith('```'):
                content_clean = content_clean[:-3]
            content_clean = content_clean.strip()
            
            try:
                return json.loads(content_clean)
            except:
                logger.error(f'Failed to parse Kimi API response: {content}')
                return None
        
        except Exception as e:
            logger.error(f'Error calling Kimi API: {str(e)}')
            return None
    
    def detect_keywords(self, text, use_kimi=True):
        """
        Detect sensitive keywords in text using Kimi API or local detection
        
        Args:
            text: Input text to analyze
            use_kimi: Whether to use Kimi API for detection
            
        Returns:
            Dictionary with detected keywords and risk score
        """
        if not text:
            return {'keywords': [], 'riskScore': 0}
        
        if use_kimi:
            api_result = self._call_kimi_api(text)
            if api_result:
                logger.info(f'Kimi API result: {api_result}')
                return {
                    'keywords': api_result.get('keywords', []),
                    'riskScore': api_result.get('risk_score', 0),
                }
        
        detected_keywords = []
        total_score = 0
        
        try:
            for category, keywords in self.keywords_db.items():
                for keyword in keywords:
                    if keyword.lower() in text.lower():
                        detected_keywords.append(keyword)
                        score = self.category_scores.get(category, 10)
                        total_score = min(100, total_score + score)
            
            detected_keywords = list(set(detected_keywords))
            risk_score = min(100, total_score)
            
            logger.info(f'Detected {len(detected_keywords)} keywords, risk score: {risk_score}')
            
            return {
                'keywords': detected_keywords,
                'riskScore': risk_score,
            }
        except Exception as e:
            logger.error(f'Error detecting keywords: {str(e)}')
            return {'keywords': [], 'riskScore': 0}
    
    def add_keyword(self, keyword, category, score=10):
        """Add new keyword to detection database"""
        if category not in self.keywords_db:
            self.keywords_db[category] = []
        
        if keyword not in self.keywords_db[category]:
            self.keywords_db[category].append(keyword)
            logger.info(f'Added keyword: {keyword} ({category})')
    
    def remove_keyword(self, keyword, category):
        """Remove keyword from detection database"""
        if category in self.keywords_db and keyword in self.keywords_db[category]:
            self.keywords_db[category].remove(keyword)
            logger.info(f'Removed keyword: {keyword} ({category})')
