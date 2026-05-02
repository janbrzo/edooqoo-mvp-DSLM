import html2pdf from 'html2pdf.js';

export const generatePDF = async (elementId: string, filename: string, isTeacherView = false, title = 'English Worksheet') => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('Element not found:', elementId);
      return false;
    }

    // Clone the element to avoid modifying the original
    const clonedElement = element.cloneNode(true) as HTMLElement;
    
    // For teacher view, keep teacher tips but remove other data-no-pdf elements
    if (isTeacherView) {
      // Remove non-teacher-tip elements marked with data-no-pdf
      const nonTeacherTipElements = clonedElement.querySelectorAll('[data-no-pdf="true"]:not([class*="teacher-tip"]):not(.bg-amber-50)');
      nonTeacherTipElements.forEach(el => el.remove());
      
      // Make sure teacher tips are visible
      const teacherTips = clonedElement.querySelectorAll('[class*="teacher-tip"], .bg-amber-50');
      teacherTips.forEach(tip => {
        (tip as HTMLElement).style.display = 'block';
        (tip as HTMLElement).style.visibility = 'visible';
      });
    } else {
      // For student view, remove all data-no-pdf elements including teacher tips
      const allNoPublishElements = clonedElement.querySelectorAll('[data-no-pdf="true"]');
      allNoPublishElements.forEach(el => el.remove());
      
      // Also remove teacher tips by class
      const teacherTipElements = clonedElement.querySelectorAll('[class*="teacher-tip"], .bg-amber-50');
      teacherTipElements.forEach(el => el.remove());
    }

    // Create a temporary container for the cloned content
    const container = document.createElement('div');
    container.appendChild(clonedElement);
    
    // Set the wrapper style for the PDF
    clonedElement.style.padding = '20px';
    
    // Add a header to show whether it's a student or teacher version
    const header = document.createElement('div');
    header.style.position = 'running(header)';
    header.style.fontWeight = 'bold';
    header.style.textAlign = 'center';
    header.style.padding = '10px 0';
    header.style.borderBottom = '1px solid #ddd';
    header.style.color = '#3d348b';
    header.style.fontSize = '12.6px'; // Reduced by 10% from 14px
    header.innerHTML = `${title} - ${isTeacherView ? 'Teacher' : 'Student'} Version`;
    container.prepend(header);
    
    // Add a footer with page numbers
    const footer = document.createElement('div');
    footer.style.position = 'running(footer)';
    footer.style.textAlign = 'center';
    footer.style.padding = '10px 0';
    footer.style.fontSize = '9px'; // Reduced by 10% from 10px
    footer.style.color = '#666';
    footer.innerHTML = 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>';
    container.appendChild(footer);
    
    // Apply font size reductions and space optimization
    const fontSizeAdjustments = `
      <style>
        /* Base font size reductions */
        h1 { font-size: 27px !important; } /* Reduced from 30px */
        h2 { font-size: 21.6px !important; } /* Reduced from 24px */
        h3 { font-size: 18px !important; } /* Reduced from 20px */
        h4 { font-size: 16.2px !important; } /* Reduced from 18px */
        p, li, td, th { font-size: 13.5px !important; } /* Reduced from 15px */
        
        /* Exercise specific reductions */
        .exercise-header { font-size: 18px !important; } /* Reduced from 20px */
        .exercise-instructions { font-size: 13.5px !important; } /* Reduced from 15px */
        .exercise-content { font-size: 13.5px !important; } /* Reduced from 15px */
        .question-text { font-size: 13.5px !important; } /* Reduced from 15px */
        .answer-text { font-size: 12.6px !important; } /* Reduced from 14px */
        
        /* Teacher tips styling for PDF */
        .bg-amber-50, [class*="teacher-tip"] {
          background: linear-gradient(90deg, #FEF7CD 85%, #FAF5E3 100%) !important;
          border: 1.5px solid #ffeab9 !important;
          padding: 8px !important;
          margin: 4px 0 !important;
          border-radius: 6px !important;
          display: block !important;
          visibility: visible !important;
        }
        
        /* Reduce whitespace - aggressive space reduction */
        .mb-6 { margin-bottom: 0.5rem !important; }
        .mb-8 { margin-bottom: 0.5rem !important; }
        .mb-4 { margin-bottom: 0.4rem !important; }
        .p-6 { padding: 0.5rem !important; }
        .p-5 { padding: 0.5rem !important; }
        .p-4 { padding: 0.4rem !important; }
        .py-2 { padding-top: 0.15rem !important; padding-bottom: 0.15rem !important; }
        
        /* Fix spacing between exercises */
        .exercise + .exercise { margin-top: 2px !important; }
        
        /* Remove vertical white space */
        .space-y-4 > * + * { margin-top: 0.25rem !important; }
        .space-y-2 > * + * { margin-top: 0.15rem !important; }
        
        /* Target specific exercise types for space optimization */
        .bg-gray-50 { padding: 0.3rem !important; margin-bottom: 0.3rem !important; }
        
        /* Make sure text is compact but still readable */
        .whitespace-pre-line { white-space: normal !important; }
        
        /* Optimize page breaks */
        .page-break { page-break-before: always; }
        h1, h2, h3, h4 { page-break-after: avoid; }
      </style>
    `;
    container.insertAdjacentHTML('afterbegin', fontSizeAdjustments);
    
    // Configure html2pdf options with corrected margins (0.5cm for top/bottom)
    const options = {
      margin: [5, 3.75, 5, 3.75], // top, right, bottom, left (top/bottom changed from 15/20 to 5mm = 0.5cm)
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2,
        useCORS: true, 
        letterRendering: true,
        logging: false, 
        dpi: 192, 
        scrollX: 0,
        scrollY: 0
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true,
        putOnlyUsedFonts: true
      },
      pagebreak: { 
        mode: ['avoid-all', 'css', 'legacy'], 
        before: '.page-break', 
        avoid: ['img', 'table', 'div.avoid-page-break'] 
      },
      enableLinks: true
    };
    
    // Generate the PDF
    const result = await html2pdf().set(options).from(container.innerHTML).save();
    console.log('PDF generated successfully:', filename);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};

/**
 * Fetches CSS content from a URL
 */
async function fetchCSSContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (response.ok) {
      return await response.text();
    }
  } catch (error) {
    console.warn(`Failed to fetch CSS from ${url}:`, error);
  }
  return '';
}

/**
 * Exports the current view as a standalone HTML file with all styles inlined
 */
export async function exportAsHTML(elementId: string, filename: string, viewMode: 'student' | 'teacher' = 'student', title: string = 'English Worksheet'): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('Element not found:', elementId);
      return false;
    }

    // Clone the entire document
    const docClone = document.cloneNode(true) as Document;
    
    // Remove all script tags to prevent JavaScript execution
    const scripts = docClone.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    // Remove any existing style elements to avoid duplication
    const existingStyles = docClone.querySelectorAll('style[data-inline="true"]');
    existingStyles.forEach(style => style.remove());

    // Get all external stylesheets
    const externalStylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    
    // Fetch and inline all external CSS
    const cssPromises = externalStylesheets.map(async (link) => {
      const href = link.href;
      console.log('Fetching CSS from:', href);
      
      try {
        // Handle relative URLs
        const absoluteUrl = new URL(href, window.location.origin).href;
        const cssContent = await fetchCSSContent(absoluteUrl);
        
        if (cssContent) {
          return `/* CSS from ${href} */\n${cssContent}\n`;
        }
      } catch (error) {
        console.warn(`Failed to process CSS from ${href}:`, error);
      }
      return '';
    });

    // Wait for all CSS to be fetched
    const allCSS = await Promise.all(cssPromises);
    const combinedCSS = allCSS.filter(css => css.length > 0).join('\n');

    // Also collect CSS from existing <style> elements and document.styleSheets
    let inlineCSS = '';
    
    // Get CSS from existing <style> elements
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach(style => {
      if (style.textContent) {
        inlineCSS += `/* Inline styles */\n${style.textContent}\n`;
      }
    });

    // Try to get CSS from document.styleSheets (for same-origin stylesheets)
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          if (sheet.cssRules) {
            const rules = Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            if (rules) {
              inlineCSS += `/* Document stylesheet rules */\n${rules}\n`;
            }
          }
        } catch (e) {
          // CORS blocked or other error - skip this stylesheet
          console.warn('Could not access stylesheet rules (likely CORS):', e);
        }
      });
    } catch (error) {
      console.warn('Error accessing document.styleSheets:', error);
    }

    // Add additional styles to ensure proper rendering and hide browser print headers/footers
    const additionalCSS = `
      /* Additional styles for standalone HTML */
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 20px;
        background-color: #f8f9fa;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      .worksheet-content {
        background: white;
        padding: 20px;
      }
      
      /* Print button styles */
      .print-button {
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #3d348b;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
      }
      
      .print-button:hover {
        background-color: #2d1b7b;
      }
      
      /* Hide rating section in HTML export */
      [data-no-pdf="true"]:not(.teacher-tip):not(.bg-amber-50) {
        display: none !important;
      }
      
      /* Show teacher tips in teacher version */
      .teacher-tip, .bg-amber-50 {
        display: ${viewMode === 'teacher' ? 'block' : 'none'} !important;
        background: linear-gradient(90deg, #FEF7CD 85%, #FAF5E3 100%) !important;
        border: 1.5px solid #ffeab9 !important;
        padding: 12px !important;
        margin: 8px 0 !important;
        border-radius: 6px !important;
        visibility: visible !important;
      }
      
      /* Print styles - hide file path but show page counter */
      @media print {
        @page {
          margin: 0.5cm 1.5cm 0.5cm 1.5cm !important; /* Updated margins: top 0.5cm, left/right 1.5cm, bottom 0.5cm */
          size: A4 !important;
          
          /* Hide default browser headers/footers with file path */
          @top-left { content: none !important; }
          @top-center { content: none !important; }
          @top-right { content: none !important; }
          @bottom-left { content: none !important; }
          @bottom-center { 
            /* Show only page numbers */
            content: counter(page) " / " counter(pages) !important;
            font-size: 10px !important;
            color: #666 !important;
          }
          @bottom-right { content: none !important; }
        }
        
        /* Hide print button when printing */
        .print-button {
          display: none !important;
        }
        
        /* Ensure page counter is visible */
        html {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Enable CSS page counters */
        body {
          counter-reset: page;
        }
        
        /* Force no browser generated headers/footers except page numbers */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      
      /* Tailwind-like utility classes for fallback */
      .bg-white { background-color: #ffffff; }
      .p-6 { padding: 1.5rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .font-bold { font-weight: 700; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .border { border-width: 1px; border-color: #d1d5db; }
      .rounded-lg { border-radius: 0.5rem; }
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    `;

    // Create comprehensive CSS content
    const finalCSS = [
      combinedCSS,
      inlineCSS,
      additionalCSS
    ].filter(css => css.length > 0).join('\n');

    // Create a new style element with all CSS
    if (finalCSS) {
      const newStyleElement = docClone.createElement('style');
      newStyleElement.setAttribute('data-inline', 'true');
      newStyleElement.textContent = finalCSS;
      
      // Insert the style element at the beginning of head
      const head = docClone.querySelector('head');
      if (head) {
        head.insertBefore(newStyleElement, head.firstChild);
      }
    }

    // Remove external stylesheet links since we've inlined them
    const clonedLinks = docClone.querySelectorAll('link[rel="stylesheet"]');
    clonedLinks.forEach(link => link.remove());

    // Find the worksheet content in the cloned document
    const clonedElement = docClone.getElementById(elementId);
    if (!clonedElement) {
      console.error('Cloned element not found:', elementId);
      return false;
    }

    // Handle teacher tips and data-no-pdf elements
    if (viewMode === 'teacher') {
      // Remove non-teacher-tip elements marked with data-no-pdf
      const nonTeacherTipElements = clonedElement.querySelectorAll('[data-no-pdf="true"]:not([class*="teacher-tip"]):not(.bg-amber-50)');
      nonTeacherTipElements.forEach(el => el.remove());
      
      // Make sure teacher tips are visible
      const teacherTips = clonedElement.querySelectorAll('[class*="teacher-tip"], .bg-amber-50');
      teacherTips.forEach(tip => {
        (tip as HTMLElement).style.display = 'block';
        (tip as HTMLElement).style.visibility = 'visible';
      });
    } else {
      // For student view, remove all data-no-pdf elements including teacher tips
      const allNoPublishElements = clonedElement.querySelectorAll('[data-no-pdf="true"]');
      allNoPublishElements.forEach(el => el.remove());
      
      // Also remove teacher tips by class
      const teacherTipElements = clonedElement.querySelectorAll('[class*="teacher-tip"], .bg-amber-50');
      teacherTipElements.forEach(el => el.remove());
    }

    // Create a header to show whether it's a student or teacher version
    const versionHeader = docClone.createElement('div');
    versionHeader.style.textAlign = 'center';
    versionHeader.style.padding = '20px 0';
    versionHeader.style.borderBottom = '2px solid #3d348b';
    versionHeader.style.marginBottom = '20px';
    versionHeader.style.color = '#3d348b';
    versionHeader.style.fontSize = '18px';
    versionHeader.style.fontWeight = 'bold';
    versionHeader.innerHTML = `${title} - ${viewMode === 'teacher' ? 'Teacher' : 'Student'} Version`;

    // Create print button
    const printButton = docClone.createElement('button');
    printButton.className = 'print-button';
    printButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6,9 6,2 18,2 18,9"></polyline>
        <path d="M6,18 L4,18 C2.9,18 2,17.1 2,16 L2,10 C2,8.9 2.9,8 4,8 L20,8 C21.1,8 22,8.9 22,10 L22,16 C22,17.1 21.1,18 20,18 L18,18"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      PRINT
    `;
    printButton.setAttribute('onclick', 'window.print()');

    // Create a minimal HTML structure with only the necessary content
    const minimalHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${viewMode === 'teacher' ? 'Teacher' : 'Student'} Version</title>
    <style>
${finalCSS}
    </style>
</head>
<body>
    ${printButton.outerHTML}
    <div class="container">
        ${versionHeader.outerHTML}
        ${clonedElement.outerHTML}
    </div>
</body>
</html>`;

    // Create and download the file
    const blob = new Blob([minimalHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log('HTML export completed successfully');
    return true;
  } catch (error) {
    console.error('Error exporting HTML:', error);
    return false;
  }
}
