import argparse
import glob
import os
import shutil
import tempfile
import zipfile
import urllib.parse
from bs4 import BeautifulSoup
import bs4

from extract_pdf import extract_text_from_pdf
from aligner import fix_html_spacing

def get_epub_files_in_order(epub_extracted_dir):
    """
    Finds and parses the OPF file to return the HTML/XHTML files in their exact spine reading order.
    """
    opf_files = glob.glob(os.path.join(epub_extracted_dir, "**", "*.opf"), recursive=True)
    
    html_extensions = ('.html', '.xhtml', '.htm')
    
    if not opf_files:
        # Fallback to sorted file listing if OPF is missing
        print("Warning: No .opf file found. Defaulting to alphabetical order.")
        all_html = []
        for ext in html_extensions:
            all_html.extend(glob.glob(os.path.join(epub_extracted_dir, "**", "*" + ext), recursive=True))
        return sorted(all_html)
        
    opf_path = opf_files[0]
    base_dir = os.path.dirname(opf_path)
    
    with open(opf_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f.read(), 'xml')
        
    manifest = soup.find('manifest')
    spine = soup.find('spine')
    
    if not manifest or not spine:
        return sorted([f for ext in html_extensions for f in glob.glob(os.path.join(epub_extracted_dir, "**", "*" + ext), recursive=True)])
    
    item_dict = {}
    for item in manifest.find_all('item'):
        item_dict[item.get('id')] = item.get('href')
        
    ordered_files = []
    for itemref in spine.find_all('itemref'):
        item_id = itemref.get('idref')
        if item_id in item_dict:
            href = item_dict[item_id]
            # Handle URL encoding in href
            href = urllib.parse.unquote(href)
            # Remove any fragment identifiers
            href = href.split('#')[0]
            full_path = os.path.normpath(os.path.join(base_dir, href))
            
            if full_path.endswith(html_extensions):
                if full_path not in ordered_files:
                    ordered_files.append(full_path)
                    
    return ordered_files

def process_html_files(html_files, pdf_text):
    """
    Given a list of ordered HTML files, parses them all, 
    collects all text nodes globally, aligns with PDF, 
    and writes the fixed HTML pages back.
    """
    print(f"Reading {len(html_files)} HTML files...")
    
    all_text_nodes = []
    soups = []
    
    # 1. Parse all files and gather ALL text nodes in spine order
    for file_path in html_files:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        soup = BeautifulSoup(content, 'html.parser')
        soups.append((file_path, soup))
        
        for element in soup.find_all(string=True):
            if element.parent.name in ['style', 'script', 'head', 'title', 'meta', '[document]']:
                continue
            if isinstance(element, bs4.element.Comment):
                continue
            all_text_nodes.append(element)
            
    if not all_text_nodes:
        print("No valid text nodes found in HTML files.")
        return
        
    print(f"Found {len(all_text_nodes)} text nodes across all files. Starting global alignment...")
    
    # 2. Extract texts and align globally
    node_texts = [str(node) for node in all_text_nodes]
    fixed_texts = fix_html_spacing(pdf_text, node_texts)
    
    # 3. Replace in soup and save
    print("Alignment complete! Writing fixed HTML files back...")
    for node, fixed_text in zip(all_text_nodes, fixed_texts):
        node.replace_with(fixed_text)
        
    for file_path, soup in soups:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(str(soup))
            
    print("All files updated successfully.")

def zip_epub(source_dir, output_epub):
    """Zips the directory back into an EPUB file."""
    # Ensure mimetype is the first file and stored uncompressed
    mimetype_path = os.path.join(source_dir, 'mimetype')
    
    with zipfile.ZipFile(output_epub, 'w') as zipf:
        if os.path.exists(mimetype_path):
            zipf.write(mimetype_path, 'mimetype', compress_type=zipfile.ZIP_STORED)
            
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                if file == 'mimetype':
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname, compress_type=zipfile.ZIP_DEFLATED)

def main():
    parser = argparse.ArgumentParser(description="Fix missing spaces in EPUB/HTML using a PDF reference.")
    parser.add_argument('--pdf', required=True, help="Path to the reference PDF file.")
    parser.add_argument('--input', required=True, help="Path to the EPUB file or HTML directory.")
    parser.add_argument('--output', help="Path to save the fixed EPUB (if input is an EPUB).")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.pdf):
        print(f"Error: PDF file {args.pdf} not found.")
        return
        
    if not os.path.exists(args.input):
        print(f"Error: Input {args.input} not found.")
        return
        
    print(f"Extracting raw text from PDF: {args.pdf}")
    pdf_text = extract_text_from_pdf(args.pdf)
    print(f"Extracted {len(pdf_text)} raw characters from PDF.")
    
    if os.path.isfile(args.input) and args.input.lower().endswith('.epub'):
        # Handle EPUB archive
        temp_dir = tempfile.mkdtemp(prefix="epubFix_")
        print(f"Extracting EPUB to temporary directory: {temp_dir}")
        try:
            with zipfile.ZipFile(args.input, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                
            ordered_files = get_epub_files_in_order(temp_dir)
            process_html_files(ordered_files, pdf_text)
            
            output_epub = args.output
            if not output_epub:
                name, ext = os.path.splitext(args.input)
                output_epub = f"{name}_fixed{ext}"
                
            print(f"Repackaging into {output_epub}")
            zip_epub(temp_dir, output_epub)
            print(f"Done! Saved perfectly spaced EPUB to: {output_epub}")
            
        finally:
            shutil.rmtree(temp_dir)
            
    elif os.path.isdir(args.input):
        # Handle directly unzipped directory
        ordered_files = get_epub_files_in_order(args.input)
        process_html_files(ordered_files, pdf_text)
        print("Done! HTML files have been overwritten with fixed texts in the directory.")
        
    else:
        print("Error: Input must be an EPUB file or a directory containing HTML files.")

if __name__ == "__main__":
    main()
