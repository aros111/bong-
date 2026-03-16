import os, glob

replacements = {
    'â† ': '←',
    'â†”': '↔',
    'ðŸ  ': '🏠',
    'ðŸ–¥️': '🖥️',
    'ðŸ”´': '🔴',
    'ðŸ“·': '📷',
    'ðŸ’¼': '💼',
    'ðŸŸ¡': '🟡',
    'ðŸŸ¢': '🟢',
    'ðŸ¤–': '🤖',
    'ðŸŽ¤': '🎤',
    'ðŸ“ ': '📍',
    'ðŸ  ': '🏢',
    'ðŸ“ˆ': '📈',
    'ðŸ¥¦': '🥦',
    'ðŸ” ': '🔍',
    'ðŸ º': '🍻',
    'ðŸ”’': '🔒',
    'ðŸ“¥': '📥',
    'ðŸ ·': '🍷',
    'ðŸ¥—': '🥗',
    'â­ ': '⭐',
    'ðŸ¦': '🏦',
    'ðŸ“‹': '📋',
    'ðŸ': '🗑️', # A bit dangerous if just ðŸ, let's be more specific below
    'ðŸ—œ️': '🗜️'
}

def fix_mojibake(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    orig = text
    
    # Also handle some generic ones
    for k, v in replacements.items():
        if len(k) < 3 and k != 'â† ': 
            continue # Safe guard against small matches
        text = text.replace(k, v)
        
    text = text.replace('â† ', '←')
    text = text.replace('â†”', '↔')
    
    # Specific ones we might have missed
    text = text.replace('ðŸ—œ️', '🗜️')
    text = text.replace('ðŸ¦ ', '🏦 ')
    text = text.replace('ðŸ“‹', '📋')

    if text != orig:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Fixed emojis in {file_path}")

for f in glob.glob('js/*.js') + ['index.html', 'style.css']:
    fix_mojibake(f)
