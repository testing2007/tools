"""
DeepSeek Translation Service
Provides translation functionality using DeepSeek API
"""

import requests
import json
import os

# DeepSeek API Configuration
API_KEY = "sk-076a624bf5ff4609aff9a9397f574e95"
API_URL = "https://api.deepseek.com/chat/completions"

def translate_text(text: str, context: str = "") -> str:
    """
    Translate English text to Chinese using DeepSeek API
    
    Args:
        text: English text to translate
        context: Optional context to improve translation quality
    
    Returns:
        Translated Chinese text
    """
    try:
        system_prompt = "You are a professional translator. Translate English to Chinese accurately and naturally. Preserve the tone and meaning."
        if context:
            system_prompt += f"\n\nContext: {context}"
        
        response = requests.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                "temperature": 0.3  # Lower temperature for more consistent translations
            },
            timeout=30
        )
        
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"].strip()
        
    except requests.exceptions.RequestException as e:
        print(f"[DeepSeek] Translation API error: {e}")
        raise Exception(f"Translation failed: {str(e)}")

def translate_subtitle_batch(subtitles: list, video_title: str = "") -> list:
    """
    Translate a batch of subtitle lines
    
    Args:
        subtitles: List of subtitle objects with 'text' field
        video_title: Optional video title for context
    
    Returns:
        List of translated subtitles with 'translation' field added
    """
    context = f"This is from a video titled: {video_title}" if video_title else ""
    
    translated = []
    for idx, subtitle in enumerate(subtitles):
        try:
            english_text = subtitle.get('text', '')
            if not english_text.strip():
                translated.append({**subtitle, 'translation': ''})
                continue
            
            chinese_text = translate_text(english_text, context)
            translated.append({**subtitle, 'translation': chinese_text})
            
            print(f"[DeepSeek] Translated {idx + 1}/{len(subtitles)}: {english_text[:30]}...")
            
        except Exception as e:
            print(f"[DeepSeek] Error translating subtitle {idx}: {e}")
            translated.append({**subtitle, 'translation': '[翻译失败]'})
    
    return translated

def save_translation(video_id: int, translated_subtitles: list, base_dir: str) -> str:
    """
    Save translation to a JSON file
    
    Args:
        video_id: Video ID
        translated_subtitles: List of translated subtitle objects
        base_dir: Base directory for storage (e.g., temp_media)
    
    Returns:
        Filename of the saved translation file
    """
    translations_dir = os.path.join(base_dir, "translations")
    os.makedirs(translations_dir, exist_ok=True)
    
    filename = f"{video_id}_translation.json"
    filepath = os.path.join(translations_dir, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(translated_subtitles, f, ensure_ascii=False, indent=2)
    
    print(f"[DeepSeek] Saved translation to {filepath}")
    return filename

def load_translation(translation_filename: str, base_dir: str) -> list:
    """
    Load translation from JSON file
    
    Args:
        translation_filename: Name of the translation file
        base_dir: Base directory for storage
    
    Returns:
        List of translated subtitle objects
    """
    filepath = os.path.join(base_dir, "translations", translation_filename)
    
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Translation file not found: {filepath}")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)
