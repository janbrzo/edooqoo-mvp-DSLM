
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
 * Exports the current view as a standalone HTML file with all styles inlined and functional navigation
 */
export async function exportAsHTML(elementId: string, filename: string, exportViewMode: 'student' | 'teacher' = 'student', title: string = 'English Worksheet'): Promise<boolean> {
  try {
    console.log(`[HTML EXPORT] Starting HTML export of current view for "${filename}"`);
    
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('[HTML EXPORT] Element not found:', elementId);
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
      console.log('[HTML EXPORT] Fetching CSS from:', href);
      
      try {
        const absoluteUrl = new URL(href, window.location.origin).href;
        const cssContent = await fetchCSSContent(absoluteUrl);
        
        if (cssContent) {
          return `/* CSS from ${href} */\n${cssContent}\n`;
        }
      } catch (error) {
        console.warn(`[HTML EXPORT] Failed to process CSS from ${href}:`, error);
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
          console.warn('[HTML EXPORT] Could not access stylesheet rules (likely CORS):', e);
        }
      });
    } catch (error) {
      console.warn('[HTML EXPORT] Error accessing document.styleSheets:', error);
    }

    // Add additional styles including functional navigation
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
      
      /* Floating Navigation Styles */
      .nav-menu-button {
        position: fixed;
        top: 20px;
        left: 20px;
        background-color: #3d348b;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 1001;
      }
      
      .nav-numbered-buttons {
        position: fixed;
        top: 20px;
        left: 75px;
        display: flex;
        gap: 4px;
        z-index: 1001;
      }
      
      .nav-number-btn {
        width: 32px;
        height: 32px;
        border: 1px solid #3d348b;
        background: white;
        color: #3d348b;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      
      .nav-number-btn:hover, .nav-number-btn.active {
        background-color: #3d348b;
        color: white;
      }
      
      .nav-sidebar {
        position: fixed;
        top: 70px;
        left: 20px;
        width: 300px;
        max-height: calc(100vh - 90px);
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 1000;
        overflow-y: auto;
        display: none;
      }
      
      .nav-sidebar.open {
        display: block;
      }
      
      .nav-header {
        padding: 16px;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .nav-controls {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }
      
      .nav-control-btn {
        flex: 1;
        padding: 6px 12px;
        border: 1px solid #e2e8f0;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .nav-control-btn:hover {
        background: #f8f9fa;
      }
      
      .nav-exercises {
        padding: 16px;
      }
      
      .nav-exercise-item {
        padding: 8px 12px;
        margin-bottom: 8px;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .nav-exercise-item:hover {
        background: #f8f9fa;
        border-color: #e2e8f0;
      }
      
      .nav-exercise-item.active {
        background: #f0f4ff;
        border-color: #3d348b;
      }
      
      /* Scroll up button styles */
      .scroll-up-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: #3d348b;
        color: white;
        border: none;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        z-index: 999;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .scroll-up-button:hover {
        background-color: #2d1b7b;
      }
      
      .scroll-up-button.visible {
        opacity: 1;
      }
      
      /* Hide floating navigation elements in exported HTML */
      .nav-menu-button,
      .nav-numbered-buttons, 
      .nav-sidebar,
      .fixed.left-4.top-20 {
        display: none !important;
        visibility: hidden !important;
      }
      
      /* Keep scroll-up button visible */
      .scroll-up-button {
        display: flex !important;
        visibility: visible !important;
      }
      
      /* Hide elements not meant for export, like the rating section */
      [data-no-pdf="true"]:not([data-teacher-tip="true"]) {
        display: none !important;
      }
      
      /* Exercise collapsible styles */
      .exercise-content {
        transition: all 0.3s ease;
      }
      
      .exercise-content.collapsed {
        display: none;
      }
      
      /* Print styles */
      @media print {
        /* ULTRA AGGRESSIVE: Remove ALL margins except container */
        *:not(.container) {
          margin: 0 !important;
          padding: 0 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        html, body {
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        /* Set page to ZERO margin (forces browser to use our padding) */
        @page {
          margin: 0 !important;
          size: A4 portrait !important;
        }
        
        /* Apply all spacing as PADDING on container */
        .container {
          box-sizing: border-box !important;
          width: 100% !important;
          /* 0.5cm top/bottom, 1cm sides = matches your requirement */
          padding: 0.5cm 1cm !important;
          margin: 0 !important;
          min-height: 100vh !important;
        }
        
        /* Spacing between exercises and sections */
        [data-exercise-index],
        .exercise,
        .exercise-section,
        section {
          margin-bottom: 0.3cm !important;
        }
        
        /* Remove margin from last exercise to avoid extra space at end */
        [data-exercise-index]:last-child,
        .exercise:last-child,
        .exercise-section:last-child,
        section:last-child {
          margin-bottom: 0 !important;
        }
        
        /* Ensure content doesn't overflow */
        .worksheet-content {
          max-width: 100% !important;
          overflow: hidden !important;
        }
        
        /* Hide navigation and buttons */
        .print-button, .scroll-up-button, .nav-menu-button, 
        .nav-numbered-buttons, .nav-sidebar, .pdf-instructions {
          display: none !important;
        }
        
        /* Optimize page breaks */
        .exercise {
          page-break-inside: avoid !important;
        }
        
        h2, h3 {
          page-break-after: avoid !important;
        }
        
        html, body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        
        .exercise-content.collapsed {
          display: block !important;
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
      console.error('[HTML EXPORT] Cloned element not found:', elementId);
      return false;
    }
    
    console.log(`[HTML EXPORT] Original DOM for #${elementId} has been cloned. Cleaning up for export.`);

    // Remove elements that should not be in the export, like feedback forms.
    // Teacher tips are handled correctly because the view is already set before calling this function.
    const elementsToRemove = clonedElement.querySelectorAll('[data-no-pdf="true"]:not([data-teacher-tip="true"])');
    console.log(`[HTML EXPORT] Removing ${elementsToRemove.length} non-exportable elements (e.g., rating section).`);
    elementsToRemove.forEach(el => el.remove());
    
    // PROBLEM 1 FIX: For student view, remove all visible answers (True/False green text, teacher answers)
    if (exportViewMode === 'student') {
      // Remove green answer text (correct answers shown in teacher view)
      const greenAnswers = clonedElement.querySelectorAll('.text-green-600, .text-green-700, .text-emerald-600');
      greenAnswers.forEach(el => {
        // Only remove if it looks like an answer indicator (short text, specific patterns)
        const text = el.textContent?.trim() || '';
        if (text === 'True' || text === 'False' || text === '✓' || text === '(True)' || text === '(False)' || 
            text.startsWith('Answer:') || text.startsWith('Correct:') ||
            el.classList.contains('teacher-answer') || el.closest('[data-answer]')) {
          el.remove();
        }
      });
      
      // Remove elements explicitly marked as teacher-only answers
      const teacherAnswers = clonedElement.querySelectorAll('.teacher-answer, [data-teacher-answer], [data-correct-answer]');
      teacherAnswers.forEach(el => el.remove());
      
      // Remove True/False answer badges and indicators
      const tfIndicators = clonedElement.querySelectorAll('[data-answer-true], [data-answer-false], .answer-indicator');
      tfIndicators.forEach(el => el.remove());
      
      // PROBLEM 3 FIX: Uncheck ALL radio buttons to hide True/False answers in student export
      const radioButtons = clonedElement.querySelectorAll('input[type="radio"]');
      radioButtons.forEach(radio => {
        const inputRadio = radio as HTMLInputElement;
        inputRadio.checked = false;
        inputRadio.removeAttribute('checked');
        // Force unchecked state in serialized HTML
        inputRadio.setAttribute('data-checked', 'false');
        inputRadio.defaultChecked = false;
      });
      console.log(`[HTML EXPORT] Student view: Unchecked ${radioButtons.length} radio buttons for clean export.`);
      
      // Additional True/False cleanup: remove any green/correct indicators in T/F sections
      const tfCorrectLabels = clonedElement.querySelectorAll('.text-green-600.italic, .text-green-700.italic');
      tfCorrectLabels.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.includes('True') || text.includes('False') || text.includes('Correct') || text.includes('Answer')) {
          el.remove();
        }
      });
      
      console.log(`[HTML EXPORT] Student view: Removed answer indicators for clean student worksheet.`);
    }

    // Copy existing navigation elements from the current DOM
    const existingMenuButton = document.querySelector('.nav-menu-button');
    const existingNumberedButtons = document.querySelector('.fixed.top-16.left-4.z-50.flex.flex-col.gap-1');
    const existingSidebar = document.querySelector('.nav-sidebar');
    
    let navMenuButton, numberedButtonsContainer, navSidebar;
    
    if (existingMenuButton) {
      navMenuButton = existingMenuButton.cloneNode(true);
    } else {
      // Fallback: create basic menu button
      navMenuButton = docClone.createElement('button');
      navMenuButton.className = 'nav-menu-button';
      navMenuButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      `;
    }

    if (existingNumberedButtons) {
      numberedButtonsContainer = existingNumberedButtons.cloneNode(true);
    } else {
      // Fallback: create numbered buttons
      numberedButtonsContainer = docClone.createElement('div');
      numberedButtonsContainer.className = 'nav-numbered-buttons';
      
      const exerciseSections = clonedElement.querySelectorAll('[data-exercise-index]');
      for (let i = 0; i < exerciseSections.length; i++) {
        const numberBtn = docClone.createElement('button');
        numberBtn.className = 'nav-number-btn';
        numberBtn.textContent = (i + 1).toString();
        numberBtn.setAttribute('data-scroll-to', i.toString());
        numberedButtonsContainer.appendChild(numberBtn);
      }
    }

    if (existingSidebar) {
      navSidebar = existingSidebar.cloneNode(true);
    } else {
      // Fallback: create basic sidebar
      navSidebar = docClone.createElement('div');
      navSidebar.className = 'nav-sidebar';
      navSidebar.innerHTML = `
        <div class="nav-header">
          <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Exercise Navigation</h3>
          <div class="nav-controls">
            <button class="nav-control-btn" onclick="expandAllExercises()">Expand All</button>
            <button class="nav-control-btn" onclick="collapseAllExercises()">Collapse All</button>
          </div>
        </div>
        <div class="nav-exercises" id="nav-exercises-list">
          <!-- Exercise list will be populated by JavaScript -->
        </div>
      `;
    }

    // Create header with actual worksheet title
    const versionHeader = docClone.createElement('div');
    versionHeader.style.textAlign = 'center';
    versionHeader.style.padding = '20px 0';
    versionHeader.style.borderBottom = '2px solid #3d348b';
    versionHeader.style.marginBottom = '20px';
    versionHeader.style.color = '#3d348b';
    versionHeader.style.fontSize = '18px';
    versionHeader.style.fontWeight = 'bold';
    versionHeader.innerHTML = `${title} - ${exportViewMode === 'teacher' ? 'Teacher' : 'Student'} Version`;

    // Create print button with new text
    const printButton = docClone.createElement('button');
    printButton.className = 'print-button';
    printButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6,9 6,2 18,2 18,9"></polyline>
        <path d="M6,18 L4,18 C2.9,18 2,17.1 2,16 L2,10 C2,8.9 2.9,8 4,8 L20,8 C21.1,8 22,8.9 22,10 L22,16 C22,17.1 21.1,18 20,18 L18,18"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
      GET PDF
    `;
    printButton.setAttribute('onclick', 'window.print()');

    // Create scroll up button
    const scrollUpButton = docClone.createElement('button');
    scrollUpButton.className = 'scroll-up-button';
    scrollUpButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m18 15-6-6-6 6"/>
      </svg>
    `;
    scrollUpButton.setAttribute('onclick', 'window.scrollTo({top: 0, behavior: "smooth"})');

    // Create comprehensive navigation script
    const navigationScript = docClone.createElement('script');
    navigationScript.textContent = `
      let isNavOpen = false;
      let exerciseCollapsed = {};
      
      // Initialize navigation
      document.addEventListener('DOMContentLoaded', function() {
        initializeNavigation();
        setupScrollTracking();
        populateExerciseList();
      });
      
      function initializeNavigation() {
        const menuButton = document.querySelector('.nav-menu-button');
        const sidebar = document.querySelector('.nav-sidebar');
        const numberButtons = document.querySelectorAll('.nav-number-btn');
        
        // Menu button click
        menuButton.addEventListener('click', function() {
          isNavOpen = !isNavOpen;
          sidebar.classList.toggle('open', isNavOpen);
        });
        
        // Numbered button clicks
        numberButtons.forEach((btn, index) => {
          btn.addEventListener('click', function() {
            scrollToExercise(index);
            updateActiveButton(index);
          });
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', function(e) {
          if (!sidebar.contains(e.target) && !menuButton.contains(e.target) && isNavOpen) {
            isNavOpen = false;
            sidebar.classList.remove('open');
          }
        });
      }
      
      function populateExerciseList() {
        const container = document.getElementById('nav-exercises-list');
        const exercises = document.querySelectorAll('[data-exercise-index]');
        
        exercises.forEach((exercise, index) => {
          const title = exercise.querySelector('h3, h2, .exercise-title')?.textContent || 'Exercise ' + (index + 1);
          
          const item = document.createElement('div');
          item.className = 'nav-exercise-item';
          item.innerHTML = '📝 ' + title;
          item.addEventListener('click', function() {
            scrollToExercise(index);
            updateActiveButton(index);
          });
          
          container.appendChild(item);
        });
      }
      
      function scrollToExercise(index) {
        const exercises = document.querySelectorAll('[data-exercise-index]');
        if (exercises[index]) {
          exercises[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
      
      function updateActiveButton(index) {
        document.querySelectorAll('.nav-number-btn').forEach((btn, i) => {
          btn.classList.toggle('active', i === index);
        });
        
        document.querySelectorAll('.nav-exercise-item').forEach((item, i) => {
          item.classList.toggle('active', i === index);
        });
      }
      
      function expandAllExercises() {
        const collapsedContents = document.querySelectorAll('.exercise-content.collapsed');
        collapsedContents.forEach(content => {
          content.classList.remove('collapsed');
        });
        exerciseCollapsed = {};
      }
      
      function collapseAllExercises() {
        const exerciseContents = document.querySelectorAll('.exercise-content');
        exerciseContents.forEach((content, index) => {
          content.classList.add('collapsed');
          exerciseCollapsed[index] = true;
        });
      }
      
      function setupScrollTracking() {
        const scrollUpBtn = document.querySelector('.scroll-up-button');
        
        window.addEventListener('scroll', function() {
          // Show/hide scroll up button
          if (window.scrollY > 300) {
            scrollUpBtn.classList.add('visible');
          } else {
            scrollUpBtn.classList.remove('visible');
          }
          
          // Track active exercise
          const exercises = document.querySelectorAll('[data-exercise-index]');
          let activeIndex = 0;
          
          exercises.forEach((exercise, index) => {
            const rect = exercise.getBoundingClientRect();
            if (rect.top <= window.innerHeight * 0.3 && rect.bottom >= 0) {
              activeIndex = index;
            }
          });
          
          updateActiveButton(activeIndex);
        });
      }
    `;

    // Create a minimal HTML structure with only the necessary content
    const minimalHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${exportViewMode === 'teacher' ? 'Teacher' : 'Student'} Version</title>
    <style>
${finalCSS}
    </style>
</head>
<body>
    <!-- Print Button -->
    <button class="print-button" onclick="window.print()">🖨️ Print / Save as PDF</button>
    ${scrollUpButton.outerHTML}
    ${navMenuButton.outerHTML}
    ${numberedButtonsContainer.outerHTML}
    ${navSidebar.outerHTML}
    <div class="container">
        ${versionHeader.outerHTML}
        ${clonedElement.outerHTML}
    </div>
    ${navigationScript.outerHTML}
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
    
    console.log(`[HTML EXPORT] HTML export completed successfully.`);
    return true;
  } catch (error) {
    console.error('[HTML EXPORT] Error exporting HTML:', error);
    return false;
  }
}
