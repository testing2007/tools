import asyncio
import aiohttp

# https://dcs.megaphone.fm/ALLE8411135636.mp3?key=e1883972bad042e72a2e89757b3c4206&request_event_id=f0838fc3-4e40-4937-a378-c15892932243&session_id=29704a73-42c8-44e6-b1c5-640fdab0b6a1&timetoken=1772426192_7E04D7592BA11A542DE0C7C26F1E25BE
# https://dcs-spotify.megaphone.fm/ALLE6656890725.mp3?key=825a5328c8cb145a0f9f95ee2be68846&request_event_id=f72a3e57-d5a3-4b75-9623-69ba3ecb3860&session_id=d2ef8f4a-1d49-48dc-93ad-4049a7637de5&timetoken=1769748965_5450301C6A4B0DC1BB6C5859E2F49252
async def main():
    # url = 'https://download.dogwood.com.cn/online/sj500/01.mp3'
    url = 'https://podcasts.apple.com/cn/podcast/all-ears-english-podcast/id751574016?i=1000752056855'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(headers=headers, connector=connector) as session:
            async with session.get(url) as response:
                print('Status:', response.status)
                print('Reason:', response.reason)
                print('Content-Type:', response.headers.get('Content-Type'))
                print('History:', response.history)
                text = await response.text()
                print('Body length:', len(text))
                import re
                urls = re.findall(r'https?://[^\s<>"\'\]\[]+\.mp3', text)
                print('Found MP3 URLs:', urls)
                
                # Let's also check for m4a or other audio formats
                audio_urls = re.findall(r'https?://[^\s<>"\'\]\[]+\.(?:mp3|m4a|aac|wav|ogg)', text)
                print('Found Audio URLs:', audio_urls)
                
                # Check for Apple Podcasts specific audio URL patterns
                apple_audio = re.findall(r'"assetUrl"\s*:\s*"([^"]+)"', text)
                print('Found Apple Asset URLs:', apple_audio)
    except Exception as e:
        print('Error:', e)

asyncio.run(main())
