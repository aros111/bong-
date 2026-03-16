import os, glob, re

def unmojibake_string(s):
    # Find sequences of characters that are typical of Windows-1252 to UTF-8 mojibake.
    # In UTF-8, multi-byte starts with \xc2-\xf4. In windows-1252, \xc2 is Â, \xc3 is Ã, \xe2 is â, \xf0 is ð.
    # We can match [ÂÃâð] followed by 1 to 3 characters that are in the cp1252 upper half or specific ascii chars.
    
    pattern = re.compile(r'([ÂÃâð][\x80-\xff\x1a\x90-\x9f\x18-\x1f\x00-\x7f]{1,3})')
    
    def replacer(match):
        chunk = match.group(1)
        try:
            # We encode the chunk back to cp1252 to get the original utf-8 bytes
            original_bytes = chunk.encode('cp1252')
            # Decode the bytes as utf-8
            return original_bytes.decode('utf-8')
        except Exception:
            try:
                # If cp1252 fails, try latin-1
                original_bytes = chunk.encode('latin-1')
                return original_bytes.decode('utf-8')
            except Exception:
                return chunk
    
    # We need to iteratively apply the replacement because some might be 4 bytes matching less, etc.
    # Actually, the greedy regex might not capture the exact boundary.
    # A safer approach is to replace known dictionary first, then use a sliding window for leftovers.
    pass

# Safe static dictionary based on the file contents we observed:
replacements = {
    'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü', 'Ã„': 'Ä', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'ÃŸ': 'ß',
    'â‚¬': '€', 'â€“': '–', 'â€”': '—',
    'â€œ': '“', 'â€': '”', 'â€ž': '„', 'â€˜': '‘', 'â€™': '’', 'â€š': '‚',
    'Â·': '·', 'âœ“': '✓', 'âœ•': '✖', 'âš¡': '⚡', 'â„¹ï¸': 'ℹ️', 'âš ï¸': '⚠️',
    'ðŸ§¾': '🧾', 'ðŸ  ': '🏠', 'ðŸ“±': '📱', 'ðŸ›¡ï¸': '🛡️', 'ðŸ›‹ï¸': '🛋️', 
    'ðŸ“º': '📺', 'ðŸ”„': '🔄', 'ðŸŒ¿': '🌿', 'ðŸ’¡': '💡', 'ðŸ“¤': '📤', 
    'â†’': '→', 'â† ': '←', 'âˆ’': '−', 'âˆ…': '∅', 'Ã—': '×', 'Â§': '§',
    'â Œ': '❌', 'ðŸ‡©ðŸ‡ª': '🇩🇪', 'ðŸ‡¦ðŸ‡¹': '🇦🇹', 'ðŸ‡¨ðŸ‡­': '🇨🇭', 'ðŸŒ ': '🌍',
    'â–ˆ': '█', 'â”€': '─',
    'Ã¢': 'â', 'Ã': 'à', 'Ã©': 'é', 'Ã¨': 'è', 'Ãª': 'ê', 'Â': ' ', 'Ã¡':'á',
    # fix the '═' and other box drawings since \x90 fails
    'â• ': '═',
    'â•': '═'
}

def fix_mojibake(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    orig = text
    for k, v in replacements.items():
        text = text.replace(k, v)
        
    # Also handle combinations like 'ï¸' (variation selector 16)
    text = text.replace('ï¸', '️')
    
    if text != orig:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f"Fixed {file_path}")

for f in glob.glob('js/*.js') + ['index.html', 'style.css']:
    fix_mojibake(f)
