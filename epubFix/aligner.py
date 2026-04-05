import difflib

def fix_html_spacing(pdf_text, node_texts):
    """
    Given the ground truth pdf_text, and a list of texts from HTML nodes,
    returns a list of corrected HTML node texts where missing spaces are injected
    and extra spaces within words are removed, based on the PDF.
    """
    
    # 1. Parse PDF text into non-space chars and following spaces
    pdf_chars = []
    pdf_space_after = []
    current_space = ""
    for ch in pdf_text:
        if ch.isspace():
            current_space += ch
        else:
            if pdf_chars:
                pdf_space_after[-1] += current_space
            pdf_chars.append(ch)
            pdf_space_after.append("")
            current_space = ""
    if pdf_chars:
        pdf_space_after[-1] += current_space
        
    # 2. Parse HTML nodes into a flat token list
    tokens = [] # (type, ch, node_idx)
    for node_idx, text in enumerate(node_texts):
        for ch in text:
            if ch.isspace():
                tokens.append(('SPACE', ch, node_idx))
            else:
                tokens.append(('CHAR', ch, node_idx))
                
    char_tokens = [t for t in tokens if t[0] == 'CHAR']
    if not char_tokens:
        return node_texts # no chars to align
        
    # 3. Diff align chars
    html_chars = [t[1] for t in char_tokens]
    matcher = difflib.SequenceMatcher(None, html_chars, pdf_chars)
    
    # create mapping
    char_mapped_p_idx = [None] * len(char_tokens)
    for match in matcher.get_matching_blocks():
        for k in range(match.size):
            h_idx = match.a + k
            p_idx = match.b + k
            char_mapped_p_idx[h_idx] = p_idx
            
    # 4. Reconstruct tokens list
    new_tokens = []
    
    # Process leading spaces
    idx = 0
    while idx < len(tokens) and tokens[idx][0] == 'SPACE':
        new_tokens.append(tokens[idx])
        idx += 1
        
    char_idx = 0
    while char_idx < len(char_tokens):
        # Current character
        c_item = char_tokens[char_idx]
        p_i = char_mapped_p_idx[char_idx]
        new_tokens.append(c_item)
        
        # Gather original spaces after this character
        orig_spaces_after = []
        idx += 1 # advance past the current char in the flat token stream
        while idx < len(tokens) and tokens[idx][0] == 'SPACE':
            orig_spaces_after.append(tokens[idx])
            idx += 1
            
        if char_idx < len(char_tokens) - 1:
            next_c_item = char_tokens[char_idx + 1]
            p_j = char_mapped_p_idx[char_idx + 1]
            
            # Determine spacing
            if p_i is not None and p_j is not None and p_j > p_i:
                has_pdf_space = False
                for k in range(p_i, p_j):
                    if len(pdf_space_after[k]) > 0:
                        has_pdf_space = True
                        break
                        
                if has_pdf_space:
                    if orig_spaces_after:
                        new_tokens.extend(orig_spaces_after)
                    else:
                        new_tokens.append(('SPACE', ' ', c_item[2]))
                else:
                    # PDF does NOT have space here.
                    # This means it's a single word in PDF (e.g., sunflower).
                    # We discard orig_spaces_after to remove spaces!
                    pass
            else:
                # If alignment fails or jumps backward, fallback to original spacing
                new_tokens.extend(orig_spaces_after)
        else:
            # Last char keeps its trailing spaces
            new_tokens.extend(orig_spaces_after)
            
        char_idx += 1

    # 5. Build final new texts
    new_texts = [""] * len(node_texts)
    for t in new_tokens:
        new_texts[t[2]] += t[1]
        
    return new_texts

if __name__ == "__main__":
    # Internal test
    pdf = "the two trees. sunflower seeds are good."
    html_texts = ["thetwo ", "trees. ", "su nflower seeds are ", "good."]
    print("Original:", html_texts)
    fixed = fix_html_spacing(pdf, html_texts)
    print("Fixed:", fixed)
