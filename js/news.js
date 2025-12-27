/**
 * EFC News Page JavaScript - ENHANCED WITH YOUTUBE EMBED
 */

class EFCNewsPage {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.mediaData = null;
        this.articles = [];
        this.youtubeVideoId = null;
        
        // YouTube configuration
        this.EFC_YOUTUBE_CHANNEL_ID = 'UCCOT_UICveuHIZFVRhXlLyg';
        this.EFC_LATEST_UPLOADS_PLAYLIST = 'UU' + this.EFC_YOUTUBE_CHANNEL_ID.substring(2);
        this.YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE'; // Replace with actual API key
        
        this.initialize();
    }

    initialize() {
        document.addEventListener('DOMContentLoaded', () => {
            this.loadAllData();
            this.setupEventListeners();
            // Don't start countdown timer here - we'll do it after data loads
        });
    }

    async loadAllData() {
        try {
            console.log('Loading all news data...');
            
            // Load data from Google Sheets
            await this.dataLoader.loadHomepageData();
            
            // Get media data directly
            this.mediaData = await this.fetchMediaData();
            
            // Load YouTube video
            await this.loadYouTubeVideo();
            
            // Load and parse Google Docs article
            await this.loadAndParseGoogleDoc();
            
            // Update all sections with real data
            this.updateYouTubeSection();
            this.updateDriverOfTheDay();
            this.updateArticleSection();
            this.updateTransferSection();
            this.updateFooterLinks();
            
            // Start countdown timer AFTER data loads
            this.startCountdownTimer();
            
        } catch (error) {
            console.error('Error loading news data:', error);
            this.showError('Failed to load news data. Please check your connection.');
        }
    }

    async loadYouTubeVideo() {
        // Method 1: Try to get latest single video using YouTube API
        this.youtubeVideoId = await this.getLatestVideoId();
        
        // Method 2: Fallback to playlist if API key is not available or fails
        if (!this.youtubeVideoId) {
            console.log('Falling back to YouTube playlist embed');
        }
    }

    async getLatestVideoId() {
        // Only proceed if API key is set (not the placeholder)
        if (!this.YOUTUBE_API_KEY || this.YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
            console.warn('YouTube API key not configured. Using playlist embed instead.');
            return null;
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/search?key=${this.YOUTUBE_API_KEY}&channelId=${this.EFC_YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=1&type=video`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.items && data.items.length > 0) {
                console.log('Found latest video:', data.items[0].snippet.title);
                return data.items[0].id.videoId;
            }
        } catch (error) {
            console.error('Error fetching YouTube video:', error);
        }
        
        return null;
    }

    async fetchMediaData() {
        try {
            const csvText = await this.dataLoader.fetchCSV('Media');
            const lines = csvText.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                console.warn('Media sheet has insufficient data');
                return this.getDefaultMediaData();
            }
            
            // Parse CSV with proper quote handling
            const parseCSVLine = (line) => {
                const result = [];
                let inQuotes = false;
                let currentValue = '';
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const nextChar = line[i + 1];
                    
                    if (char === '"' && !inQuotes) {
                        inQuotes = true;
                    } else if (char === '"' && inQuotes && nextChar === '"') {
                        currentValue += '"';
                        i++;
                    } else if (char === '"' && inQuotes) {
                        inQuotes = false;
                    } else if (char === ',' && !inQuotes) {
                        result.push(currentValue.trim());
                        currentValue = '';
                    } else {
                        currentValue += char;
                    }
                }
                
                result.push(currentValue.trim());
                return result;
            };
            
            const headers = parseCSVLine(lines[0]);
            const values = parseCSVLine(lines[1]);
            
            const mediaData = {};
            headers.forEach((header, index) => {
                mediaData[header.trim()] = values[index] || '';
            });
            
            console.log('Media data loaded:', mediaData);
            return mediaData;
            
        } catch (error) {
            console.error('Error fetching media data:', error);
            return this.getDefaultMediaData();
        }
    }

    getDefaultMediaData() {
        return {
            'Dotd': 'notunbeatable08',
            'Article Link': 'https://docs.google.com/document/d/1cpuXrpegj55q49pZVZexERvk3MJrdAtFlDuHU0wWxpc/edit?usp=sharing',
            'Youtube Link': 'https://www.youtube.com/@EuropeanFormulaApexChampionshi',
            'Transfer Window Status': 'Open',
            'Transfer Window News': 'Transfer window is open for team negotiations.'
        };
    }

    updateYouTubeSection() {
        const youtubePlayer = document.getElementById('youtube-player');
        const videoTitle = document.getElementById('youtube-title');
        const videoDescription = document.getElementById('youtube-description');
        const youtubeLinkElement = document.getElementById('youtube-link');
        const youtubeViews = document.getElementById('youtube-views');
        const youtubeDate = document.getElementById('youtube-date');
        const youtubeUploadDate = document.getElementById('youtube-upload-date');
        
        // EMBED THE YOUTUBE CONTENT
        if (this.youtubeVideoId) {
            // Embed latest single video
            youtubePlayer.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${this.youtubeVideoId}?autoplay=0&rel=0&modestbranding=1&color=white" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    style="width: 100%; height: 100%; border-radius: 8px;"
                    title="Latest EFC Video"
                ></iframe>
            `;
            
            videoTitle.textContent = 'Latest EFC Video';
            videoDescription.textContent = 'Watch the most recent race highlights, interviews, and behind-the-scenes content from the European Formula Championship.';
            youtubeViews.textContent = 'Latest Upload';
            youtubeDate.textContent = new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            youtubeUploadDate.textContent = 'Recent';
            
            // Set YouTube link to the video
            youtubeLinkElement.href = `https://www.youtube.com/watch?v=${this.youtubeVideoId}`;
            
        } else {
            // Embed playlist of latest uploads (no API key needed)
            youtubePlayer.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/videoseries?list=${this.EFC_LATEST_UPLOADS_PLAYLIST}&autoplay=0&rel=0&modestbranding=1&color=white"
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen
                    style="width: 100%; height: 100%; border-radius: 8px;"
                    title="EFC Latest Uploads Playlist"
                ></iframe>
            `;
            
            videoTitle.textContent = 'EFC Latest Uploads';
            videoDescription.textContent = 'Watch the latest race highlights, driver interviews, and championship content from our official YouTube channel. This playlist automatically updates with new uploads.';
            youtubeViews.textContent = 'Playlist';
            youtubeDate.textContent = new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            youtubeUploadDate.textContent = 'Auto-updating';
            
            // Set YouTube link to the channel
            youtubeLinkElement.href = 'https://www.youtube.com/@EuropeanFormulaApexChampionshi';
        }
        
        youtubeLinkElement.target = '_blank';
    }

    updateDriverOfTheDay() {
        let dotdData;
        
        if (this.mediaData && this.mediaData['Dotd']) {
            const dotdDriver = this.mediaData['Dotd'];
            
            // Get driver info from data loader
            const driverMaster = this.dataLoader.dataCache?.driverMaster || [];
            const driverStats = this.dataLoader.dataCache?.driverStats || [];
            
            const driverInfo = driverMaster.find(d => 
                d.username && d.username.toLowerCase() === dotdDriver.toLowerCase()
            );
            
            const driverStat = driverStats.find(d => 
                d.driver && d.driver.toLowerCase() === dotdDriver.toLowerCase()
            );
            
            dotdData = {
                name: dotdDriver,
                rating: driverStat ? driverStat.driverRating : 9.2,
                team: driverInfo ? driverInfo.teamName : 'Unknown Team',
                points: driverStat ? driverStat.points : 0,
                wins: driverStat ? driverStat.wins : 0,
                podiums: driverStat ? driverStat.podiums : 0,
                photo: driverInfo ? driverInfo.photo : '',
                nationality: driverInfo ? driverInfo.nationality : '',
                number: driverInfo ? driverInfo.number : '',
                fastestLaps: driverStat ? driverStat.fastestLaps : 0,
                races: driverStat ? driverStat.racesAttended : 0
            };
        } else {
            // Fallback data
            dotdData = {
                name: 'notunbeatable08',
                rating: 9.8,
                team: 'McLaren',
                points: 156,
                wins: 3,
                podiums: 5,
                photo: '',
                nationality: '(UK)',
                number: '04',
                fastestLaps: 2,
                races: 10
            };
        }
        
        // Get team class for styling
        const teamClass = this.getTeamClass(dotdData.team);
        
        // Update DOTD card
        const dotdAvatar = document.getElementById('news-dotd-avatar');
        const dotdName = document.getElementById('news-dotd-name');
        const dotdTeam = document.getElementById('news-dotd-team');
        const dotdPoints = document.getElementById('news-dotd-points');
        const dotdWins = document.getElementById('news-dotd-wins');
        const dotdRating = document.getElementById('news-dotd-rating');
        const dotdDescription = document.getElementById('news-dotd-description');
        const dotdPodiums = document.getElementById('news-dotd-podiums');
        const dotdFastestLaps = document.getElementById('news-dotd-fastest-laps');
        const dotdRaces = document.getElementById('news-dotd-races');
        
        // Set team class for styling
        dotdAvatar.className = `driver-avatar-large ${teamClass}`;
        
        // Set avatar background with proper initials
        const avatarFallback = dotdAvatar.querySelector('.fallback');
        if (avatarFallback) {
            // Better method to get initials from username
            const username = dotdData.name;
            let initials;
            
            // Check for pattern like "notunbeatable08"
            if (username.includes('notunbeatable08')) {
                initials = 'NB'; // For notunbeatable08
            } else if (username.length >= 2) {
                // Take first two characters in uppercase
                initials = username.substring(0, 2).toUpperCase();
            } else {
                initials = username.toUpperCase();
            }
            
            avatarFallback.textContent = initials;
            console.log('DOTD initials:', initials, 'from username:', username);
        }
        
        // Update text content
        dotdName.textContent = dotdData.name;
        dotdTeam.textContent = dotdData.team;
        dotdPoints.textContent = dotdData.points;
        dotdWins.textContent = dotdData.wins;
        dotdRating.textContent = dotdData.rating.toFixed(1);
        dotdPodiums.textContent = dotdData.podiums;
        dotdFastestLaps.textContent = dotdData.fastestLaps;
        dotdRaces.textContent = dotdData.races;
        
        // REMOVED: Don't set description text - hide it instead
        dotdDescription.textContent = '';
        dotdDescription.style.display = 'none';
        
        // Update round info
        const completedRaces = this.dataLoader.getCompletedRacesCount();
        document.getElementById('dotd-round').textContent = completedRaces > 0 ? `Round ${completedRaces}` : 'Season Start';
    }

    async loadAndParseGoogleDoc() {
        if (!this.mediaData || !this.mediaData['Article Link']) {
            console.warn('No article link in media data');
            this.articles = [];
            return;
        }

        try {
            console.log('Loading and parsing Google Doc...');
            
            const docUrl = this.mediaData['Article Link'];
            const docId = this.extractGoogleDocId(docUrl);
            
            if (!docId) {
                console.warn('Invalid Google Docs URL:', docUrl);
                this.articles = [];
                return;
            }
            
            // Try to fetch the document content
            const apiUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error('Cannot fetch document');
            }
            
            const textContent = await response.text();
            const lines = textContent.split('\n').filter(line => line.trim() !== '');
            
            // Extract title (first non-empty line)
            const title = lines.length > 0 ? lines[0].trim() : 'EFC Latest News';
            
            // Extract excerpt (next few lines)
            const excerptLines = lines.slice(1, 4).filter(line => line.trim() !== '');
            const excerpt = excerptLines.length > 0 
                ? excerptLines.join(' ').substring(0, 150) + '...'
                : 'Read the latest updates from the European Formula Championship.';
            
            // Extract full content
            const fullContent = lines.slice(1).join('\n');
            
            const articleDate = new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
            
            this.articles = [{
                id: 'latest-article',
                title: title,
                excerpt: excerpt,
                fullContent: fullContent,
                author: 'EFC Media Team',
                date: articleDate,
                category: 'general',
                timestamp: new Date().getTime(),
                docId: docId
            }];
            
            console.log('Article loaded and parsed');
            
        } catch (error) {
            console.warn('Could not parse Google Doc:', error);
            this.createFallbackArticle();
        }
    }

    createFallbackArticle() {
        const docUrl = this.mediaData['Article Link'];
        const docId = this.extractGoogleDocId(docUrl);
        
        if (!docId) return;
        
        const articleDate = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
        
        this.articles = [{
            id: 'latest-article',
            title: 'Latest EFC News',
            excerpt: 'Read the latest updates from the European Formula Championship. Stay tuned for race reports, team news, and driver interviews.',
            author: 'EFC Media Team',
            date: articleDate,
            category: 'general',
            timestamp: new Date().getTime(),
            docId: docId
        }];
    }

    extractGoogleDocId(url) {
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        return match ? match[1] : null;
    }

    updateArticleSection() {
        const articlesGrid = document.getElementById('articles-grid');
        const loadMoreBtn = document.getElementById('load-more-articles');
        
        // Clear loading state
        articlesGrid.innerHTML = '';
        
        if (this.articles.length === 0) {
            articlesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-newspaper"></i>
                    <h3>No Articles Available</h3>
                    <p>Check back soon for the latest news and updates.</p>
                </div>
            `;
            loadMoreBtn.style.display = 'none';
            return;
        }
        
        // Create article cards
        this.articles.forEach(article => {
            const articleCard = this.createArticleCard(article);
            articlesGrid.appendChild(articleCard);
        });
        
        // Hide load more button since we only have one article
        loadMoreBtn.style.display = 'none';
    }

    createArticleCard(article) {
        const card = document.createElement('div');
        card.className = 'article-card';
        card.dataset.articleId = article.id;
        
        card.innerHTML = `
            <div class="article-image">
                <div class="fallback" style="background: linear-gradient(135deg, #00F7FF 0%, #0066FF 100%);">
                    EFC
                </div>
                <div class="article-category">Latest News</div>
            </div>
            <div class="article-content">
                <div class="article-meta">
                    <span class="article-date">${article.date}</span>
                    <span class="article-author">
                        <i class="fas fa-user-edit"></i> ${article.author}
                    </span>
                </div>
                <h3 class="article-title">${article.title}</h3>
                <p class="article-excerpt">${article.excerpt}</p>
                <div class="article-footer">
                    <button class="read-article-btn" data-article-id="${article.id}">
                        READ FULL ARTICLE <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
        
        return card;
    }

    updateTransferSection() {
    const transfersContainer = document.getElementById('transfers-container');
    const transferStatus = document.getElementById('transfer-status');
    
    if (!this.mediaData) {
        transfersContainer.innerHTML = `
            <div class="transfer-card">
                <div class="transfer-icon">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div class="transfer-content">
                    <h4>Transfer Information</h4>
                    <p>Transfer window details will be available here when announced.</p>
                    <div class="transfer-date">Status: TBD</div>
                </div>
            </div>
        `;
        transferStatus.textContent = 'TBD';
        transferStatus.style.background = 'rgba(255, 165, 0, 0.1)';
        transferStatus.style.color = '#FFA500';
        return;
    }
    
    // Get data from columns D and E
    const status = (this.mediaData['Transfer Window Status'] || 'TBD').toLowerCase();
    const news = this.mediaData['Transfer Window News'] || '';
    
    // Set status text and color
    transferStatus.textContent = status.toUpperCase();
    
    // Set color based on status
    let statusColor, statusBg, statusBorder;
    
    if (status === 'open') {
        statusColor = '#00FF00';
        statusBg = 'rgba(0, 255, 0, 0.1)';
        statusBorder = 'rgba(0, 255, 0, 0.3)';
    } else if (status === 'closed') {
        statusColor = '#FF0000';
        statusBg = 'rgba(255, 0, 0, 0.1)';
        statusBorder = 'rgba(255, 0, 0, 0.3)';
    } else {
        statusColor = '#FFA500';
        statusBg = 'rgba(255, 165, 0, 0.1)';
        statusBorder = 'rgba(255, 165, 0, 0.3)';
    }
    
    // Apply styles to transfer status badge
    transferStatus.style.background = statusBg;
    transferStatus.style.color = statusColor;
    transferStatus.style.border = `1px solid ${statusBorder}`;
    
    // Update transfer card with matching color
    const iconColor = status === 'open' ? '#00FF00' : (status === 'closed' ? '#FF0000' : '#FFA500');
    
    if (news && news.trim() !== '') {
        transfersContainer.innerHTML = `
            <div class="transfer-card" style="background: linear-gradient(135deg, ${statusBg} 0%, rgba(10, 10, 22, 0.5) 100%); border: 1px solid ${statusBorder};">
                <div class="transfer-icon" style="background: ${statusBg}; border: 2px solid ${statusBorder};">
                    <i class="fas fa-exchange-alt" style="color: ${iconColor};"></i>
                </div>
                <div class="transfer-content">
                    <h4 style="color: ${iconColor};">Transfer Window: ${status.toUpperCase()}</h4>
                    <p>${news}</p>
                    <div class="transfer-date" style="color: ${iconColor};">Status: ${status.toUpperCase()}</div>
                </div>
            </div>
        `;
    } else {
        const defaultNews = status === 'open' 
            ? 'The transfer window is currently open. Teams can now negotiate driver contracts and make team changes.'
            : 'The transfer window is currently closed. No team changes can be made at this time.';
        
        transfersContainer.innerHTML = `
            <div class="transfer-card" style="background: linear-gradient(135deg, ${statusBg} 0%, rgba(10, 10, 22, 0.5) 100%); border: 1px solid ${statusBorder};">
                <div class="transfer-icon" style="background: ${statusBg}; border: 2px solid ${statusBorder};">
                    <i class="fas fa-exchange-alt" style="color: ${iconColor};"></i>
                </div>
                <div class="transfer-content">
                    <h4 style="color: ${iconColor};">Transfer Window: ${status.toUpperCase()}</h4>
                    <p>${defaultNews}</p>
                    <div class="transfer-date" style="color: ${iconColor};">Status: ${status.toUpperCase()}</div>
                </div>
            </div>
        `;
    }
    
    // Add pulsing animation for open status
    if (status === 'open') {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse-green-glow {
                0%, 100% { 
                    box-shadow: 0 0 5px ${statusBorder}, 0 0 10px ${statusBorder}; 
                }
                50% { 
                    box-shadow: 0 0 15px ${statusBorder}, 0 0 30px ${statusBorder}; 
                }
            }
            .transfer-card[style*="border: 1px solid rgba(0, 255, 0"] {
                animation: pulse-green-glow 2s infinite;
            }
        `;
        document.head.appendChild(style);
    }
}

    updateFooterLinks() {
        if (!this.mediaData) return;
        
        // Update YouTube link
        const youtubeLink = document.getElementById('youtube-footer-link');
        if (youtubeLink && this.mediaData['Youtube Link']) {
            youtubeLink.href = this.mediaData['Youtube Link'];
            youtubeLink.target = '_blank';
        }
        
        // Discord link
        const discordLink = document.getElementById('discord-link');
        if (discordLink) {
            discordLink.href = 'https://discord.gg/example';
            discordLink.target = '_blank';
        }
        
        // Article submission link
        const articleSubmitLink = document.getElementById('article-submit-link');
        if (articleSubmitLink) {
            articleSubmitLink.href = 'mailto:news@efc-racing.com?subject=Article%20Submission';
        }
    }

    setupEventListeners() {
        // Read article buttons
        document.addEventListener('click', (e) => {
            const readBtn = e.target.closest('.read-article-btn');
            if (readBtn) {
                const articleId = readBtn.dataset.articleId;
                this.showArticle(articleId);
            }
        });
    }

    showArticle(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        if (!article) return;
        
        // Create or update article viewer
        let viewer = document.getElementById('article-viewer');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = 'article-viewer';
            viewer.className = 'article-viewer';
            document.querySelector('.articles-section .container').appendChild(viewer);
        }
        
        if (article.fullContent) {
            // Show parsed content
            viewer.innerHTML = `
                <div class="article-viewer-header">
                    <h3><i class="fas fa-newspaper"></i> ARTICLE VIEWER</h3>
                    <div class="article-actions">
                        <button class="close-article-btn" onclick="efcNewsPage.closeArticleViewer()">
                            <i class="fas fa-times"></i> CLOSE
                        </button>
                    </div>
                </div>
                <div class="article-viewer-content">
                    <div class="article-content-container">
                        <h1 class="article-content-title">${article.title}</h1>
                        <div class="article-meta" style="margin-bottom: 2rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: var(--border-radius); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                            <div><strong>Author:</strong> ${article.author}</div>
                            <div><strong>Published:</strong> ${article.date}</div>
                        </div>
                        <div class="article-content-body">
                            ${this.formatArticleContent(article.fullContent)}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Fallback to iframe
            viewer.innerHTML = `
                <div class="article-viewer-header">
                    <h3><i class="fas fa-newspaper"></i> ${article.title}</h3>
                    <div class="article-actions">
                        <button class="close-article-btn" onclick="efcNewsPage.closeArticleViewer()">
                            <i class="fas fa-times"></i> CLOSE
                        </button>
                    </div>
                </div>
                <div class="article-viewer-content">
                    <iframe 
                        src="https://docs.google.com/document/d/${article.docId}/preview" 
                        class="article-content-iframe"
                        title="${article.title}"
                    ></iframe>
                </div>
            `;
        }
        
        // Scroll to viewer
        viewer.scrollIntoView({ behavior: 'smooth' });
    }

    formatArticleContent(content) {
        // Simple formatting for plain text
        return content
            .split('\n')
            .map(line => {
                const trimmed = line.trim();
                if (!trimmed) return '';
                
                // Check for headings
                if (trimmed.length < 80 && trimmed === trimmed.toUpperCase()) {
                    return `<h2>${trimmed}</h2>`;
                }
                
                // Check for subheadings
                if (trimmed.endsWith(':')) {
                    return `<h3>${trimmed}</h3>`;
                }
                
                return `<p>${trimmed}</p>`;
            })
            .join('');
    }

    closeArticleViewer() {
        const viewer = document.getElementById('article-viewer');
        if (viewer) {
            viewer.remove();
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--gradient-secondary);
            color: white;
            padding: 1rem 2rem;
            border-radius: var(--border-radius);
            z-index: 9999;
            font-family: var(--font-heading);
            font-weight: 600;
            box-shadow: 0 0 20px rgba(255, 0, 85, 0.5);
            text-align: center;
            max-width: 80%;
        `;
        
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle" style="margin-right: 0.5rem;"></i>
            ${message}
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    startCountdownTimer() {
        const timerDisplay = document.getElementById('timer-display');
        
        // Get the next race date from the data loader
        const nextRace = this.dataLoader.getNextRace();
        console.log('Next race from data loader:', nextRace);
        
        let targetDate;
        
        if (nextRace && nextRace.date && nextRace.date !== 'TBD' && nextRace.status !== 'completed') {
            targetDate = new Date(nextRace.date);
            
            // Check if date is valid
            if (isNaN(targetDate.getTime())) {
                console.warn('Invalid date from next race, using fallback:', nextRace.date);
                // Fallback: 77 days from now (as requested)
                targetDate = new Date();
                targetDate.setDate(targetDate.getDate() + 77);
            } else {
                console.log('Valid next race date:', targetDate);
            }
        } else {
            console.warn('No valid next race found, using fallback');
            // Fallback: 77 days from now (as requested)
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 77);
        }
        
        console.log('Target date for countdown:', targetDate);
        
        function updateCountdown() {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                timerDisplay.textContent = 'RACE DAY!';
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            // Check if it should be around 77 days
            console.log('Countdown days:', days);
            
            timerDisplay.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
        
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }

    getTeamClass(teamName) {
        const teamMap = {
            'McLaren': 'team-mclaren',
            'Mercedes': 'team-mercedes',
            'Ferrari': 'team-ferrari',
            'Red Bull': 'team-redbull',
            'Alpine': 'team-alpine',
            'Aston Martin': 'team-astonmartin',
            'Haas': 'team-haas',
            'Alfa Romeo': 'team-alfaromeo',
            'Williams': 'team-williams',
            'Racing Bulls': 'team-racingbulls'
        };
        
        return teamMap[teamName] || 'team-default';
    }
}

// Initialize the news page when the script loads
const efcNewsPage = new EFCNewsPage();