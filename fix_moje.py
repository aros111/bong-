import os, glob, re

def fix_mojibake(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()

    def replacer(match):
        s = match.group(0)
        bytes_list = []
        for c in s:
            try:
                bytes_list.append(c.encode('cp1252')[0])
            except UnicodeEncodeError:
                # If cp1252 fails, it's typically one of the 5 undefined bytes (0x81, 0x8d, 0x8f, 0x90, 0x9d)
                # which got mapped to their unicode equivalents U+0081, U+008D etc.
                bytes_list.append(ord(c))
        
        try:
            return bytes(bytes_list).decode('utf-8')
        except Exception:
            return s

    # Match 4-byte emojis starting with F0 9F (ðŸ)
    new_text = re.sub(r'\xf0\u0178.{2}', replacer, text)
    
    # Match 3-byte emojis/symbols starting with E2 (â)
    # e2 86 90 (leftarrow) â † \x90 -> wait, † is \u2020 in utf-8, but in cp1252 it's 0x86!
    # Let's cleanly match â followed by any 2 chars that are in the cp1252 extended range or control range.
    new_text = re.sub(r'\xe2.{2}', replacer, new_text)
    
    # Specific targeted replaces that might have been mangled differently:
    new_text = new_text.replace('â† ', '←')
    
    # Manual patch for UI labels missed by earlier script
    new_text = new_text.replace('ðŸ—œ️', '🗜️')
    new_text = new_text.replace('ðŸ¦ ', '🏦 ')
    new_text = new_text.replace('ðŸ“‹', '📋')
    new_text = new_text.replace('ðŸ º', '🍻')

    if new_text != text:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_text)
        print(f"Fixed {file_path}")

for f in glob.glob('js/*.js') + ['index.html', 'style.css']:
    fix_mojibake(f)
