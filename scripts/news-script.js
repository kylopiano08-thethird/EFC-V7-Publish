// EFC News - Fixed styling and modal issues with Articles tab
console.log('EFC News loading...');

// EFC YouTube Channel ID
const EFC_YOUTUBE_CHANNEL_ID = 'UCCOT_UICveuHIZFVRhXlLyg';
const EFC_LATEST_UPLOADS_PLAYLIST = 'UU' + EFC_YOUTUBE_CHANNEL_ID.substring(2);

// Your Google Sheet IDs
const TRACK_SHEET_ID = '1I1krwXhca3xE6QTj6Crw7uE-fnjFjkzJI7XAiZeZOxU';
const ARTICLES_SHEET_ID = '1XAP13NdaC_xcNRP_SVAo6DpgY2YHN-MgsE3PsohSKac';

// Track data
let currentTrackData = {
    imageUrl: 'https://via.placeholder.com/400x200/024cad/ffffff?text=Loading+Track...',
    trackName: 'Loading Track...',
    description: 'Loading track information...'
};

// Driver of the Day data
let driverOfTheDay = 'Loading...';

// Articles data
let articlesData = [];

// Track modal state to prevent multiple openings
let isModalOpen = false;

// Polls data structure
let pollsData = [];

// Function to format dates properly
function formatDate(dateString) {
    try {
        // If it's already a nicely formatted date, return as-is
        if (dateString.includes(',') && dateString.includes('202')) {
            return dateString;
        }
        
        // Otherwise try to parse it
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return dateString; // Return original if can't parse
        }
        
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return dateString;
    }
}

// Function to extract document ID from Google Docs URL
function getDocIdFromUrl(url) {
    // Handle different Google Docs URL formats
    const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return matches ? matches[1] : null;
}

// Function to fetch and display Google Doc content
async function fetchGoogleDocContent(docUrl) {
    try {
        const docId = getDocIdFromUrl(docUrl);
        if (!docId) {
            throw new Error('Invalid Google Docs URL');
        }
        
        // Export Google Doc as HTML (public docs don't need API key)
        const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
        
        const response = await fetch(exportUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch document: ${response.status}`);
        }
        
        const htmlContent = await response.text();
        return cleanGoogleDocHTML(htmlContent);
        
    } catch (error) {
        console.error('Error fetching Google Doc:', error);
        return `<p>❌ Unable to load article content. <a href="${docUrl}" target="_blank" style="color: #024cad;">Read on Google Docs</a></p>`;
    }
}

// Function to clean up Google Doc HTML
function cleanGoogleDocHTML(html) {
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove Google's specific classes and styles
    const elements = tempDiv.querySelectorAll('*');
    elements.forEach(el => {
        // Remove Google-specific classes
        el.className = '';
        
        // Remove inline styles or normalize them
        if (el.style) {
            el.style.fontFamily = 'inherit';
            el.style.fontSize = 'inherit';
            el.style.color = 'inherit';
            // Keep basic styling like bold, italics, but remove positioning
            if (el.style.position) el.style.position = 'static';
            if (el.style.margin) el.style.margin = '';
            if (el.style.padding) el.style.padding = '';
        }
    });
    
    // Convert to match your site's styling
    let cleanedHTML = tempDiv.innerHTML;
    
    // Replace Google's heading styles with your own
    cleanedHTML = cleanedHTML.replace(/<h1[^>]*>/g, '<h3 style="color: #ffffff; font-size: 24px; margin: 20px 0 10px 0; border-bottom: 2px solid #024cad; padding-bottom: 5px;">');
    cleanedHTML = cleanedHTML.replace(/<h2[^>]*>/g, '<h4 style="color: #ffffff; font-size: 20px; margin: 15px 0 8px 0;">');
    cleanedHTML = cleanedHTML.replace(/<h3[^>]*>/g, '<h5 style="color: #ffffff; font-size: 18px; margin: 12px 0 6px 0;">');
    
    // Ensure paragraphs have proper styling
    cleanedHTML = cleanedHTML.replace(/<p[^>]*>/g, '<p style="margin-bottom: 15px; line-height: 1.6; color: #e0e0e0;">');
    
    // Style links to match your theme
    cleanedHTML = cleanedHTML.replace(/<a[^>]*href="([^"]*)"[^>]*>/g, '<a href="$1" style="color: #024cad; text-decoration: none; border-bottom: 1px solid #024cad;" target="_blank">');
    
    // Style lists
    cleanedHTML = cleanedHTML.replace(/<ul[^>]*>/g, '<ul style="margin: 10px 0; padding-left: 20px; color: #e0e0e0;">');
    cleanedHTML = cleanedHTML.replace(/<ol[^>]*>/g, '<ol style="margin: 10px 0; padding-left: 20px; color: #e0e0e0;">');
    cleanedHTML = cleanedHTML.replace(/<li[^>]*>/g, '<li style="margin-bottom: 5px; line-height: 1.6;">');
    
    // Style strong and em tags
    cleanedHTML = cleanedHTML.replace(/<strong>/g, '<strong style="color: #ffffff;">');
    cleanedHTML = cleanedHTML.replace(/<em>/g, '<em style="color: #ffd700;">');
    
    return cleanedHTML;
}

// Create our news display function
// Create our news display function
// Create our news display function
function displayEFCNews(container) {
    console.log('Displaying EFC News');
    
    // Clear the entire container first
    container.innerHTML = '';
    
    // Create the news content directly in the container
    container.innerHTML = `
        <div class="news-tabs">
            <button class="news-tab-button active" onclick="switchNewsTab('dashboard')">Dashboard</button>
            <button class="news-tab-button" onclick="switchNewsTab('articles')">Articles</button>
            <button class="news-tab-button" onclick="switchNewsTab('polls')">Polls</button>
        </div>
        <div class="news-tab-content active" id="news-dashboard">
            <div class="loading">Loading news content...</div>
        </div>
        <div class="news-tab-content" id="news-articles">
            <div class="loading">Loading articles...</div>
        </div>
        <div class="news-tab-content" id="news-polls">
            <div class="loading">Loading polls...</div>
        </div>
    `;
    
        // Load data from BOTH sources - your existing sheets + new WebsiteData
    Promise.all([
        loadAllData(),        // Your existing track data, articles, etc.
        loadWebsiteData()     // NEW: News, polls, admin content
    ]).then(() => {
        displayNewsContent(document.getElementById('news-dashboard'));
        displayArticlesContent(document.getElementById('news-articles'));
        displayPollsContent(document.getElementById('news-polls'));
    }).catch(error => {
        console.error('Error loading news data:', error);
        displayNewsContent(document.getElementById('news-dashboard'));
        displayArticlesContent(document.getElementById('news-articles'));
        displayPollsContent(document.getElementById('news-polls'));
    });
}

// Function to switch between news tabs
function switchNewsTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.news-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.news-tab-button').forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab and activate button
    document.getElementById('news-' + tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// Function to load all data from your Google Sheet
async function loadAllData() {
    try {
        console.log('Loading data from Google Sheet...');
        
        // Load track data from your original sheet
        const trackCsvUrl = `https://docs.google.com/spreadsheets/d/${TRACK_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Track Info`;
        const trackResponse = await fetch(trackCsvUrl);
        const trackCsvText = await trackResponse.text();
        
        const trackRows = parseCSV(trackCsvText);
        console.log('Parsed track rows:', trackRows);
        
        if (trackRows.length >= 2) {
            const headerRow = trackRows[0];
            const dataRow = trackRows[1];
            
            console.log('Header row:', headerRow);
            console.log('Data row:', dataRow);
            
            // Extract track data - based on your sheet structure:
            // CurrentTrack, ImageURL, TrackName, Description, , dotd
            // x, https://i.postimg.cc/C18ZQw0S/weather-report-3.png, Miami Grand Prix, A track, , ksdoom16
            if (dataRow[0] && dataRow[0].toLowerCase() === 'x') {
                currentTrackData = {
                    imageUrl: dataRow[1] || 'https://via.placeholder.com/400x200/024cad/ffffff?text=No+Image',
                    trackName: dataRow[2] || 'Unknown Track',
                    description: dataRow[3] || 'No description available'
                };
                
                console.log('Loaded track data:', currentTrackData);
            }
            
            // Extract DOTD from column 5 (index 5) - the last column
            if (dataRow[5] && dataRow[5].trim() !== '') {
                driverOfTheDay = dataRow[5].trim();
                console.log('Loaded DOTD:', driverOfTheDay);
            } else {
                driverOfTheDay = 'Not Available';
            }
        } else {
            console.warn('Not enough rows in sheet');
            driverOfTheDay = 'Not Available';
        }
        
        // Load articles data from your new sheet - FIXED FOR YOUR STRUCTURE
        try {
            console.log('Loading articles from sheet:', ARTICLES_SHEET_ID);
            
            const articlesCsvUrl = `https://docs.google.com/spreadsheets/d/${ARTICLES_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Articles`;
            console.log('Articles URL:', articlesCsvUrl);
            
            const articlesResponse = await fetch(articlesCsvUrl);
            if (!articlesResponse.ok) {
                throw new Error(`HTTP error! status: ${articlesResponse.status}`);
            }
            
            const articlesCsvText = await articlesResponse.text();
            console.log('Raw articles CSV:', articlesCsvText);
            
            const articlesRows = parseCSV(articlesCsvText);
            console.log('Parsed articles rows:', articlesRows);
            
            if (articlesRows.length > 1) {
                // YOUR STRUCTURE: Row 0 = ["Date", "Title", "Article"] (HEADER - SKIP THIS)
                // Row 1+ = ["Thursday, November 27, 2025", "Hockenheim Pre-Race Buildup...", "https://docs.google.com/..."]
                
                // Skip the header row (row 0) and start from row 1
                articlesData = articlesRows.slice(1);
                
                console.log(`Loaded ${articlesData.length} articles after removing header`);
                
                // Filter out any empty rows
                articlesData = articlesData.filter(article => {
                    const hasDate = article[0] && article[0].trim() !== '';
                    const hasTitle = article[1] && article[1].trim() !== '';
                    return hasDate && hasTitle;
                });
                
                console.log(`After filtering: ${articlesData.length} valid articles`);
                
                // Log each article to verify the structure
                articlesData.forEach((article, index) => {
                    console.log(`Article ${index + 1}:`, {
                        date: article[0],
                        title: article[1], 
                        googleDocUrl: article[2],
                        hasGoogleDoc: !!(article[2] && article[2].includes('docs.google.com'))
                    });
                });
                
                // Sort articles by date - most recent first
                articlesData.sort((a, b) => {
                    try {
                        const dateA = new Date(a[0]);
                        const dateB = new Date(b[0]);
                        return dateB - dateA; // Most recent first
                    } catch (error) {
                        console.error('Error sorting dates:', error);
                        return 0;
                    }
                });
                
            } else {
                console.warn('No articles data found in sheet (only header row or empty)');
                articlesData = [];
            }
            
        } catch (articlesError) {
            console.error('Failed to load articles:', articlesError);
            articlesData = [];
        }
        
        // Load polls data
        await loadPollsData();
        
    } catch (error) {
        console.error('Failed to load main data:', error);
        // Set fallback data
        currentTrackData = {
            imageUrl: 'https://i.imgur.com/aIQyBjU.png',
            trackName: 'Miami Grand Prix',
            description: 'A track'
        };
        driverOfTheDay = 'ksdoom16';
        articlesData = [];
        pollsData = [];
    }
}

// NEW: Load additional data from WebsiteData sheet (news, polls, admin content)
async function loadWebsiteData() {
    const sheetId = '12zbjwk6DbdgowVT6Jtil9dcVFY2XPqcQqBFz1KxUTQc';
    const jsonUrl = `https://opensheet.elk.sh/${sheetId}/WebsiteData`;
    
    try {
        console.log('📡 Loading additional data from WebsiteData sheet...');
        const response = await fetch(jsonUrl);
        const sheetData = await response.json();
        
        // Convert sheet rows to object
        const data = {};
        sheetData.forEach(row => {
            try {
                // For JSON objects, parse them
                if (row.Data && (row.Data.startsWith('{') || row.Data.startsWith('['))) {
                    data[row.Key] = JSON.parse(row.Data);
                } else {
                    data[row.Key] = row.Data;
                }
            } catch (e) {
                console.warn(`Failed to parse data for ${row.Key}:`, e);
                data[row.Key] = row.Data;
            }
        });
        
        console.log('📊 Data loaded from WebsiteData:', data);
        
        // Load polls from WebsiteData
        if (data.polls && Array.isArray(data.polls)) {
            console.log('✅ Loaded polls from WebsiteData:', data.polls);
            localStorage.setItem('efc_polls', JSON.stringify(data.polls));
            pollsData = data.polls;
        }
        
        // Load circuit data from WebsiteData
        if (data.circuitData && typeof data.circuitData === 'object') {
            console.log('✅ Loaded circuit data from WebsiteData');
            localStorage.setItem('efc_circuit_data', JSON.stringify(data.circuitData));
        }
        
        // Load race dates from WebsiteData
        if (data.raceDates && typeof data.raceDates === 'object') {
            console.log('✅ Loaded race dates from WebsiteData');
            localStorage.setItem('efc_race_dates', JSON.stringify(data.raceDates));
        }
        
        console.log('✅ Successfully loaded data from WebsiteData');
        
    } catch (error) {
        console.log('❌ Failed to load from WebsiteData:', error);
    }
}

// Simple CSV parser
function parseCSV(csvText) {
    const rows = [];
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    
    for (const line of lines) {
        const cells = [];
        let currentCell = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                cells.push(currentCell.trim());
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
        
        // Add the last cell
        cells.push(currentCell.trim());
        rows.push(cells);
    }
    
    return rows;
}

// Function to display the actual news content
function displayNewsContent(container) {
    container.innerHTML = '';
    
    // Create main news container with grid layout - REDUCED GAP
    const newsContainer = document.createElement('div');
    newsContainer.className = 'news-container';
    newsContainer.style.display = 'grid';
    newsContainer.style.gridTemplateColumns = '1fr 2fr';
    newsContainer.style.gridTemplateRows = 'auto auto auto';
    newsContainer.style.gap = '10px'; // REDUCED FROM 20px TO 10px
    newsContainer.style.alignItems = 'start';
    
    // Track Info Card - Top Left (1/3 width) - TALLER BUT NOT SPANNING
    const trackCard = document.createElement('div');
    trackCard.className = 'news-card';
    trackCard.style.gridColumn = '1';
    trackCard.style.gridRow = '1';
    trackCard.style.minHeight = '300px'; // INCREASED HEIGHT
    trackCard.style.display = 'flex';
    trackCard.style.flexDirection = 'column';
    trackCard.innerHTML = `
        <div class="news-image track-info" style="flex: 1;">
            <img src="${currentTrackData.imageUrl}" 
                 alt="${currentTrackData.trackName}" 
                 class="track-image"
                 id="trackImage"
                 onerror="handleTrackImageError(this)"
                 style="cursor: pointer; width: 100%; height: 180px; object-fit: cover; border-radius: 8px 8px 0 0;">
        </div>
        <div class="news-content" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 15px;">
            <div>
                <div class="news-date">Current Circuit</div>
                <div class="news-title" id="trackTitle" style="font-size: 20px; margin: 8px 0;">${currentTrackData.trackName}</div>
                <div class="news-description" id="trackDescription" style="line-height: 1.4; margin-bottom: 12px; font-size: 14px;">
                    ${currentTrackData.description}
                </div>
            </div>
            <div>
                <div class="news-tags" style="margin-bottom: 12px;">
                    <span class="news-tag circuit">Circuit</span>
                    <span class="news-tag info">Info</span>
                    <span class="news-tag dynamic">Live Data</span>
                </div>
                <button class="expand-image-button" onclick="expandTrackImage('${currentTrackData.imageUrl}', '${currentTrackData.trackName}')" 
                        style="width: 100%; padding: 8px; background: #024cad; color: white; border: none; border-radius: 5px; cursor: pointer; margin-bottom: 8px; font-size: 14px;">
                    🔍 Expand Image
                </button>
                <div style="font-size: 10px; color: #888; text-align: center;">
                    Data from Google Sheet
                </div>
            </div>
        </div>
    `;
    
    // YouTube Card - Top Right (2/3 width) - FIXED HEIGHT
    const youtubeCard = document.createElement('div');
    youtubeCard.className = 'news-card';
    youtubeCard.style.gridColumn = '2';
    youtubeCard.style.gridRow = '1 / span 2';
    youtubeCard.style.padding = '0';
    youtubeCard.style.overflow = 'hidden';
    youtubeCard.style.display = 'flex';
    youtubeCard.style.flexDirection = 'column';
    youtubeCard.innerHTML = `
        <div class="youtube-embed-container">
            <iframe 
                src="https://www.youtube.com/embed/videoseries?list=${EFC_LATEST_UPLOADS_PLAYLIST}&autoplay=0&rel=0&modestbranding=1&color=white"
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen
                class="youtube-iframe">
            </iframe>
        </div>
        <div class="news-content" style="padding: 20px;">
            <div class="news-date">Latest Uploads</div>
            <div class="news-title">EFC YouTube Channel</div>
            <div class="news-description">
                Watch the latest race highlights, driver interviews, and championship content from our official YouTube channel. 
                This playlist automatically updates with new uploads.
            </div>
            <div class="news-tags">
                <span class="news-tag media">Media</span>
                <span class="news-tag videos">Videos</span>
                <span class="news-tag playlist">Playlist</span>
                <span class="news-tag latest">Latest</span>
            </div>
            <button class="youtube-button" onclick="window.open('https://www.youtube.com/@EuropeanFormulaApexChampionshi', '_blank')">
                Visit YouTube Channel
            </button>
        </div>
    `;
    
    // Driver of the Day Card - Moved closer to track card
    const dotdCard = document.createElement('div');
    dotdCard.className = 'news-card dotd-card';
    dotdCard.style.gridColumn = '1';
    dotdCard.style.gridRow = '2'; // MOVED BACK TO ROW 2
    dotdCard.style.padding = '12px'; // REDUCED PADDING
    dotdCard.style.marginTop = '0'; // REMOVE ANY MARGIN
    dotdCard.innerHTML = `
        <div class="dotd-header-compact">
            <div class="dotd-trophy-compact">🏆</div>
            <div class="dotd-title-compact">
                <div class="news-date" style="font-size: 10px;">Driver of the Day</div>
            </div>
        </div>
        <div class="dotd-content-compact">
            <div class="dotd-driver-name-compact">${driverOfTheDay}</div>
        </div>
    `;
    
    // Transfer Window Card - Bottom Full Width (small)
    const transferCard = document.createElement('div');
    transferCard.className = 'news-card';
    transferCard.style.gridColumn = '1 / span 2';
    transferCard.style.gridRow = '3';
    transferCard.style.display = 'flex';
    transferCard.style.alignItems = 'center';
    transferCard.style.padding = '12px'; // REDUCED PADDING
    transferCard.style.minHeight = 'auto';
    transferCard.style.marginTop = '0'; // REMOVE ANY MARGIN
    transferCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <div style="font-size: 28px; background: #dc0000; padding: 12px; border-radius: 8px; display: flex; align-items: center; justify-content: center; min-width: 50px;">
                🔒
            </div>
            <div style="flex: 1;">
                <div class="news-date">Current Status</div>
                <div class="news-title" style="margin-bottom: 4px; font-size: 16px;">Transfer Window Status</div>
                <div class="news-description" style="margin-bottom: 0; font-size: 13px;">
                    The transfer window is currently <strong>CLOSED</strong>. No driver changes are permitted until the next opening period.
                </div>
            </div>
            <div class="news-tags">
                <span class="news-tag closed">Closed</span>
                <span class="news-tag transfers">Transfers</span>
            </div>
        </div>
    `;
    
    newsContainer.appendChild(trackCard);
    newsContainer.appendChild(youtubeCard);
    newsContainer.appendChild(dotdCard);
    newsContainer.appendChild(transferCard);
    container.appendChild(newsContainer);
}

// Function to display articles content - UPDATED TO LOAD GOOGLE DOC CONTENT
async function displayArticlesContent(container) {
    container.innerHTML = '';
    
    console.log('Displaying articles, data count:', articlesData.length);
    
    if (!articlesData || articlesData.length === 0) {
        container.innerHTML = `
            <div class="no-articles">
                <h3>No articles available yet.</h3>
                <p>Check back soon for the latest news and updates!</p>
            </div>
        `;
        return;
    }
    
    const articlesGrid = document.createElement('div');
    articlesGrid.className = 'articles-container';
    
    // Show loading for all articles first
    articlesData.forEach((article, index) => {
        const articleCard = document.createElement('div');
        articleCard.className = 'article-card';
        articleCard.id = `article-${index}`;
        
        const date = article[0];
        const title = article[1];
        const docUrl = article[2];
        
        articleCard.innerHTML = `
            <div class="article-date">${formatDate(date)}</div>
            <div class="article-title">${title || 'Untitled Article'}</div>
            <div class="article-content" id="content-${index}">
                <div style="text-align: center; padding: 20px; color: #888;">
                    <div>📄 Loading article content...</div>
                </div>
            </div>
            ${docUrl && docUrl.includes('docs.google.com') ? `
                <div class="article-actions" style="margin-top: 20px; text-align: center;">
                    
                </div>
            ` : ''}
        `;
        
        articlesGrid.appendChild(articleCard);
    });
    
    container.appendChild(articlesGrid);
    
    // Now load the actual content for each article
    articlesData.forEach(async (article, index) => {
        const date = article[0];
        const title = article[1];
        const docUrl = article[2];
        
        const contentElement = document.getElementById(`content-${index}`);
        
        if (docUrl && docUrl.includes('docs.google.com')) {
            try {
                console.log(`Loading content for article ${index + 1}:`, title);
                const articleContent = await fetchGoogleDocContent(docUrl);
                contentElement.innerHTML = articleContent;
            } catch (error) {
                console.error(`Failed to load content for article ${index + 1}:`, error);
                contentElement.innerHTML = `
                    <p>❌ Unable to load article content.</p>
                    <p><a href="${docUrl}" target="_blank" style="color: #024cad;">Read on Google Docs</a></p>
                `;
            }
        } else {
            contentElement.innerHTML = `
                <p>Article content coming soon...</p>
                ${docUrl ? `<p><a href="${docUrl}" target="_blank" style="color: #024cad;">View external content</a></p>` : ''}
            `;
        }
    });
}

// Function to expand track image
window.expandTrackImage = function(imageUrl, trackName) {
    // Prevent multiple modals
    if (isModalOpen) return;
    isModalOpen = true;
    
    console.log('Opening modal for:', trackName);
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'track-modal-overlay';
    modalOverlay.style.position = 'fixed';
    modalOverlay.style.top = '0';
    modalOverlay.style.left = '0';
    modalOverlay.style.width = '100%';
    modalOverlay.style.height = '100%';
    modalOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    modalOverlay.style.display = 'flex';
    modalOverlay.style.alignItems = 'center';
    modalOverlay.style.justifyContent = 'center';
    modalOverlay.style.zIndex = '10000';
    modalOverlay.style.padding = '20px';
    
    modalOverlay.innerHTML = `
        <div class="track-modal" style="background: #2a2a2a; border-radius: 15px; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
            <div class="track-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid #333;">
                <div class="track-modal-title" style="font-size: 20px; font-weight: bold; color: white;">${trackName}</div>
                <button class="track-modal-close" onclick="closeTrackModal()" style="background: none; border: none; color: white; font-size: 30px; cursor: pointer; padding: 0; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">×</button>
            </div>
            <div class="track-modal-content" style="flex: 1; padding: 20px; display: flex; align-items: center; justify-content: center; overflow: auto;">
                <img src="${imageUrl}" alt="${trackName}" class="track-modal-image" style="max-width: 100%; max-height: 70vh; border-radius: 10px;">
            </div>
            <div class="track-modal-footer" style="padding: 20px; border-top: 1px solid #333; text-align: center;">
                <button class="track-modal-download" onclick="downloadTrackImage('${imageUrl}', '${trackName}')" style="background: #024cad; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 14px;">
                    📥 Download Image
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Close on ESC key
    const escHandler = function(e) {
        if (e.key === 'Escape') {
            closeTrackModal();
        }
    };
    document.addEventListener('keydown', escHandler);
    
    // Store handler for cleanup
    modalOverlay._escHandler = escHandler;
}

// Function to close track modal
window.closeTrackModal = function() {
    const modal = document.querySelector('.track-modal-overlay');
    if (modal) {
        // Remove ESC handler
        if (modal._escHandler) {
            document.removeEventListener('keydown', modal._escHandler);
        }
        modal.remove();
        isModalOpen = false;
    }
}

// Function to refresh all data
window.refreshAllData = async function() {
    const container = document.getElementById('standings-container');
    container.innerHTML = '<div class="loading">Refreshing data from Google Sheet...</div>';
    
    try {
        await loadAllData();
        displayNewsContent(document.getElementById('news-dashboard'));
        displayArticlesContent(document.getElementById('news-articles'));
        console.log('Data refreshed successfully from Google Sheet');
    } catch (error) {
        console.error('Error refreshing data:', error);
        container.innerHTML = '<div class="error">Error refreshing data</div>';
        setTimeout(() => {
            displayNewsContent(document.getElementById('news-dashboard'));
            displayArticlesContent(document.getElementById('news-articles'));
        }, 2000);
    }
}

// Function to download track image
window.downloadTrackImage = function(imageUrl, trackName) {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${trackName.replace(/\s+/g, '_')}_track.png`;
    link.click();
}

// Function to handle image loading errors
window.handleTrackImageError = function(imgElement) {
    console.error('Track image failed to load:', imgElement.src);
    imgElement.src = 'https://via.placeholder.com/400x200/dc0000/ffffff?text=Image+Not+Found';
}

// Load polls data
// Load polls data
async function loadPollsData() {
    try {
        // FIRST check if we have polls from WebsiteData (loaded by loadWebsiteData)
        const websitePolls = localStorage.getItem('efcPolls');
        
        if (websitePolls) {
            pollsData = JSON.parse(websitePolls);
            console.log('Loaded polls from WebsiteData:', pollsData);
        } else {
            // Fallback to localStorage (admin edits)
            const savedPolls = localStorage.getItem('efc_polls');
            
            if (savedPolls) {
                pollsData = JSON.parse(savedPolls);
                console.log('Loaded polls from storage:', pollsData);
            } else {
                // Final fallback to sample data
                pollsData = [
                    {
                        id: 1,
                        question: "Who will win the EFC Championship this season?",
                        options: [
                            { text: "Max Verstappen", votes: 45, percentage: 45 },
                            { text: "Lewis Hamilton", votes: 30, percentage: 30 },
                            { text: "Charles Leclerc", votes: 15, percentage: 15 },
                            { text: "Lando Norris", votes: 10, percentage: 10 }
                        ],
                        totalVotes: 100,
                        status: "live",
                        endDate: "2024-12-31",
                        userVoted: false,
                        userSelection: null
                    }
                ];
                // Save sample data to localStorage
                localStorage.setItem('efc_polls', JSON.stringify(pollsData));
            }
        }
        
        // Load user's previous votes from localStorage
        loadUserVotes();
        
    } catch (error) {
        console.error('Error loading polls data:', error);
        pollsData = [];
    }
}

// Load user votes from localStorage
function loadUserVotes() {
    const userVotes = localStorage.getItem('efc_poll_votes');
    if (userVotes) {
        const votes = JSON.parse(userVotes);
        pollsData.forEach(poll => {
            if (votes[poll.id] !== undefined) {
                poll.userVoted = true;
                poll.userSelection = votes[poll.id];
            }
        });
    }
}

// Save user vote to localStorage
function saveUserVote(pollId, optionIndex) {
    let userVotes = JSON.parse(localStorage.getItem('efc_poll_votes') || '{}');
    userVotes[pollId] = optionIndex;
    localStorage.setItem('efc_poll_votes', JSON.stringify(userVotes));
}

// Display polls content
function displayPollsContent(container) {
    container.innerHTML = '';
    
    if (pollsData.length === 0) {
        container.innerHTML = '<div class="no-polls">No polls available yet. Check back soon for new polls!</div>';
        return;
    }
    
    const pollsContainer = document.createElement('div');
    pollsContainer.className = 'polls-container';
    
    pollsData.forEach(poll => {
        const pollCard = createPollCard(poll);
        pollsContainer.appendChild(pollCard);
    });
    
    container.appendChild(pollsContainer);
}

// Create individual poll card
function createPollCard(poll) {
    const pollCard = document.createElement('div');
    pollCard.className = 'poll-card';
    pollCard.innerHTML = `
        <div class="poll-header">
            <h3 class="poll-question">${poll.question}</h3>
            <span class="poll-status ${poll.status}">${poll.status.toUpperCase()}</span>
        </div>
        
        <div class="poll-meta">
            <span class="poll-date">📅 Ends: ${new Date(poll.endDate).toLocaleDateString()}</span>
            <span class="poll-votes">🗳️ ${poll.totalVotes} votes</span>
        </div>
        
        <div class="poll-options" id="poll-options-${poll.id}">
            ${poll.options.map((option, index) => `
                <div class="poll-option ${poll.userVoted ? 'disabled' : ''} ${poll.userSelection === index ? 'selected' : ''}" 
                     onclick="handlePollOptionClick(${poll.id}, ${index})"
                     data-option="${index}">
                    <div class="vote-bar" style="width: ${poll.userVoted ? option.percentage : 0}%"></div>
                    <div class="option-content">
                        <span class="option-text">${option.text}</span>
                        ${poll.userVoted ? `
                            <div class="option-stats">
                                <span class="option-votes">${option.votes}</span>
                                <span class="option-percentage">${option.percentage}%</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        
        <div class="poll-actions">
            ${!poll.userVoted && poll.status === 'live' ? `
                <button class="vote-button" onclick="submitVote(${poll.id})" id="vote-btn-${poll.id}" disabled>
                    Vote Now
                </button>
            ` : ''}
            
            ${poll.userVoted || poll.status === 'closed' ? `
                <button class="view-results" onclick="toggleResults(${poll.id})" id="results-btn-${poll.id}">
                    ${poll.userVoted ? 'Hide Results' : 'View Results'}
                </button>
            ` : ''}
        </div>
        
        ${poll.userVoted ? `
            <div class="poll-results" id="results-${poll.id}">
                <div class="results-header">
                    <span>Poll Results</span>
                    <span class="total-votes">Total Votes: ${poll.totalVotes}</span>
                </div>
                <!-- Results are shown in the options above -->
            </div>
        ` : ''}
    `;
    
    return pollCard;
}

// Handle poll option selection
function handlePollOptionClick(pollId, optionIndex) {
    const poll = pollsData.find(p => p.id === pollId);
    if (!poll || poll.userVoted || poll.status !== 'live') return;
    
    // Update UI
    const optionsContainer = document.getElementById(`poll-options-${pollId}`);
    const options = optionsContainer.querySelectorAll('.poll-option');
    
    options.forEach(option => {
        option.classList.remove('selected');
    });
    
    options[optionIndex].classList.add('selected');
    
    // Enable vote button
    const voteButton = document.getElementById(`vote-btn-${pollId}`);
    voteButton.disabled = false;
    
    // Store selection temporarily
    poll.userSelection = optionIndex;
}

// Submit vote
function submitVote(pollId) {
    const poll = pollsData.find(p => p.id === pollId);
    if (!poll || poll.userVoted || poll.status !== 'live' || poll.userSelection === null) return;
    
    // Update poll data
    poll.options[poll.userSelection].votes++;
    poll.totalVotes++;
    
    // Recalculate percentages
    poll.options.forEach(option => {
        option.percentage = Math.round((option.votes / poll.totalVotes) * 100);
    });
    
    poll.userVoted = true;
    
    // Save to localStorage
    saveUserVote(pollId, poll.userSelection);
    
    // Update the main polls data in localStorage
    const existingPolls = JSON.parse(localStorage.getItem('efc_polls') || '[]');
    const pollIndex = existingPolls.findIndex(p => p.id === pollId);
    if (pollIndex !== -1) {
        existingPolls[pollIndex] = poll;
        localStorage.setItem('efc_polls', JSON.stringify(existingPolls));
    }
    
    // Update UI
    displayPollsContent(document.getElementById('news-polls'));
    
    // Show success message
    showPollNotification('Vote submitted successfully!', 'success');
}

// Toggle results view
function toggleResults(pollId) {
    const poll = pollsData.find(p => p.id === pollId);
    if (!poll) return;
    
    const resultsBtn = document.getElementById(`results-btn-${pollId}`);
    const resultsDiv = document.getElementById(`results-${pollId}`);
    
    if (resultsDiv.style.display === 'none' || !resultsDiv.style.display) {
        resultsDiv.style.display = 'block';
        resultsBtn.textContent = 'Hide Results';
    } else {
        resultsDiv.style.display = 'none';
        resultsBtn.textContent = 'View Results';
    }
}

// Show poll notification
function showPollNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `poll-notification poll-notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#dc0000'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Make it globally available
window.displayEFCNews = displayEFCNews;
console.log('✅ EFC News ready with Google Docs content loading');



// Add this debug function
async function debugWebsiteDataLoad() {
    const sheetId = '12zbjwk6DbdgowVT6Jtil9dcVFY2XPqcQqBFz1KxUTQc';
    const jsonUrl = `https://opensheet.elk.sh/${sheetId}/WebsiteData`;
    
    try {
        console.log('🔍 DEBUG: Testing WebsiteData load...');
        const response = await fetch(jsonUrl);
        const sheetData = await response.json();
        
        console.log('🔍 DEBUG: Raw sheet data:', sheetData);
        
        sheetData.forEach(row => {
            console.log(`🔍 DEBUG: Row - Key: "${row.Key}", Data: "${row.Data.substring(0, 100)}..."`);
        });
        
    } catch (error) {
        console.log('🔍 DEBUG: Failed to load:', error);
    }
}

// Call this temporarily to debug
debugWebsiteDataLoad();