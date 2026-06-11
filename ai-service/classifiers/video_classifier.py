import logging

logger = logging.getLogger(__name__)

class VideoClassifier:
    """Video content category classification based on title, description, and transcription"""
    
    def __init__(self):
        self.categories = {
            'news': {
                'name': '新闻资讯',
                'keywords': ['新闻', '报道', '最新', '时事', '政策', '发布会', '记者', '媒体', '直播', '事件', '突发', '快讯', '头条', '要闻', '焦点', '热点'],
                'description': '新闻资讯类内容',
            },
            'entertainment': {
                'name': '娱乐搞笑',
                'keywords': ['搞笑', '喜剧', '综艺', '明星', '娱乐', '电影', '电视剧', '音乐', '演唱会', '真人秀', '搞笑视频', '段子', '幽默', '恶搞'],
                'description': '娱乐搞笑类内容',
            },
            'education': {
                'name': '教育科普',
                'keywords': ['教程', '教学', '学习', '科普', '知识', '讲解', '课程', '培训', '讲座', '公开课', '科普知识', '知识分享', '技能', '教学视频'],
                'description': '教育科普类内容',
            },
            'life': {
                'name': '生活记录',
                'keywords': ['日常', '生活', 'vlog', '记录', '美食', '旅行', '健身', '穿搭', '美妆', '家居', '手工', '做饭', '宠物', '亲子'],
                'description': '生活记录类内容',
            },
            'technology': {
                'name': '科技数码',
                'keywords': ['科技', '数码', '手机', '电脑', '评测', '开箱', '技术', '互联网', 'AI', '人工智能', '编程', '软件', '硬件'],
                'description': '科技数码类内容',
            },
            'sports': {
                'name': '体育竞技',
                'keywords': ['体育', '运动', '比赛', '足球', '篮球', '健身', '跑步', '赛事', '运动员', '训练', '体育赛事', '竞技'],
                'description': '体育竞技类内容',
            },
        }
        
        self.category_weights = {
            'news': {'title': 2, 'description': 1.5, 'transcription': 1},
            'entertainment': {'title': 1.5, 'description': 2, 'transcription': 1.5},
            'education': {'title': 1, 'description': 2, 'transcription': 2},
            'life': {'title': 1.5, 'description': 2, 'transcription': 1},
            'technology': {'title': 2, 'description': 1.5, 'transcription': 1},
            'sports': {'title': 1.5, 'description': 1, 'transcription': 1},
        }
        
        logger.info('VideoClassifier initialized')
    
    def classify(self, title='', description='', transcription=''):
        """
        Classify video into one of the predefined categories
        
        Args:
            title: Video title
            description: Video description
            transcription: Audio transcription text
        
        Returns:
            Dictionary with category ID, name, confidence, and reasoning
        """
        scores = {}
        reasoning = []
        
        text_parts = {
            'title': title.lower() if title else '',
            'description': description.lower() if description else '',
            'transcription': transcription.lower() if transcription else '',
        }
        
        for category_id, category_data in self.categories.items():
            score = 0
            category_reasoning = []
            
            for text_type, text in text_parts.items():
                if not text:
                    continue
                
                weight = self.category_weights[category_id][text_type]
                
                for keyword in category_data['keywords']:
                    if keyword in text:
                        score += weight
                        category_reasoning.append(f"{text_type}中包含'{keyword}'")
            
            scores[category_id] = {
                'score': score,
                'reasoning': category_reasoning,
            }
        
        max_score = max([s['score'] for s in scores.values()], default=0)
        
        if max_score > 0:
            top_category = max(scores.items(), key=lambda x: x[1]['score'])[0]
            confidence = min(1.0, max_score / 10.0)
            
            reasoning = scores[top_category]['reasoning']
            
            return {
                'category': top_category,
                'categoryName': self.categories[top_category]['name'],
                'confidence': round(confidence, 2),
                'reasoning': reasoning,
                'scores': {k: v['score'] for k, v in scores.items()},
            }
        else:
            return {
                'category': 'other',
                'categoryName': '其他',
                'confidence': 0.5,
                'reasoning': ['未匹配到已知分类关键词'],
                'scores': {k: 0 for k in self.categories.keys()},
            }