import bs4
from bs4 import BeautifulSoup
from aligner import fix_html_spacing

def process_html_content(html_content, pdf_text):
    """
    Parses HTML content, extracts text nodes, aligns them with pdf_text to fix spaces,
    and returns the modified HTML string.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    text_nodes = []
    
    for element in soup.find_all(string=True):
        if element.parent.name in ['style', 'script', 'head', 'title', 'meta', '[document]']:
            continue
        if isinstance(element, bs4.element.Comment):
            continue
            
        text_nodes.append(element)
        
    if not text_nodes:
        return html_content
        
    node_texts = [str(node) for node in text_nodes]
    
    # Fix spacing using the aligner module
    fixed_texts = fix_html_spacing(pdf_text, node_texts)
    
    # Replace back into the soup
    for node, fixed_text in zip(text_nodes, fixed_texts):
        node.replace_with(fixed_text)
        
    return str(soup)

if __name__ == "__main__":
    html = "<html><body><p>thetwo <i>trees.</i></p><p>su nflower seeds are good.</p></body></html>"
    pdf = "the two trees. sunflower seeds are good."
    
    print("Original HTML:", html)
    fixed = process_html_content(html, pdf)
    print("Fixed HTML:", fixed)
