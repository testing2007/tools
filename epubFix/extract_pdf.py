import fitz

def extract_text_from_pdf(pdf_path):
    """
    Extracts plain text from a PDF file.
    Returns a unified string of the PDF content.
    """
    doc = fitz.open(pdf_path)
    text_pieces = []
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        # get_text("text") returns the plain text of the page
        text = page.get_text("text")
        text_pieces.append(text)
        
    return "\n".join(text_pieces)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(extract_text_from_pdf(sys.argv[1])[:500])
