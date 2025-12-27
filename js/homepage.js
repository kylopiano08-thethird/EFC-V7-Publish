/**
 * Homepage Script - Handles UI updates and interactions
 */

class HomepageManager {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.isInitialized = false;
        this.countdownInterval = null;
        
        // DOM Elements
        this.elements = {
            // Header countdown
            timerDisplay: document.getElementById('timer-display'),
            
            // Hero stats
            totalRaces: document.getElementById('total-races'),
            totalDrivers: document.getElementById('total-drivers'),
            totalTeams: document.getElementById('total-teams'),
            
            // Next Race
            nextGpName: document.getElementById('next-gp-name'),
            nextGpDate: document.getElementById('next-gp-date'),
            nextGpRound: document.getElementById('next-gp-round'),
            nextGpCircuit: document.getElementById('next-gp-circuit') || document.getElementById('next-gp-location'), // Use circuit or fallback to location
            nextGpCountdown: document.getElementById('next-gp-countdown'),
            
            // Previous Race
            prevGpName: document.getElementById('prev-gp-name'),
            prevGpWinner: document.getElementById('prev-gp-winner'),
            prevGpFastest: document.getElementById('prev-gp-fastest'),
            prevGpDate: document.getElementById('prev-gp-date'),
            prevGpResult: document.getElementById('prev-gp-result'),
            
            // Driver of the Day - EXPANDED
            dotdName: document.getElementById('dotd-name'),
            dotdAvatar: document.getElementById('dotd-avatar'),
            
            // Standings tables
            driverStandings: document.querySelector('#driver-standings .standings-body'),
            constructorStandings: document.querySelector('#constructor-standings .standings-body'),
            driverRatings: document.querySelector('#driver-ratings .ratings-body'),
            
            // Calendar
            upcomingCalendar: document.getElementById('upcoming-calendar'),
            
            // Article
            articleDate: document.getElementById('article-date'),
            articleTitle: document.getElementById('article-title'),
            articleExcerpt: document.getElementById('article-excerpt'),
            articleLink: document.getElementById('article-link'),
            
            // Poll
            pollQuestion: document.getElementById('poll-question'),
            pollOptions: document.getElementById('poll-options'),
            pollStatus: document.getElementById('poll-status'),
            votesCount: document.getElementById('votes-count')
        };
    }

    /**
     * Initialize homepage
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing homepage...');
        
        try {
            // Load data
            await this.dataLoader.loadHomepageData();
            
            // Update all widgets
            this.updateAllWidgets();
            
            // Start countdown timer
            this.startCountdownTimer();
            
            // Add event listeners (but NOT for navigation links)
            this.addDemoEventListeners();
            
            this.isInitialized = true;
            console.log('Homepage initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize homepage:', error);
            // Try to update with mock data as fallback
            this.updateWithFallbackData();
        }
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        // Add loading class to key elements
        const loadingElements = [
            this.elements.nextGpName,
            this.elements.prevGpName,
            this.elements.dotdName
        ];
        
        loadingElements.forEach(el => {
            if (el) el.classList.add('loading');
        });
    }

    /**
     * Update with fallback data if loading fails
     */
    updateWithFallbackData() {
        console.log('Using fallback data');
        const fallbackData = this.dataLoader.getMockData();
        this.updateAllWidgetsFromData(fallbackData);
    }

    /**
     * Update all homepage widgets
     */
    updateAllWidgets() {
        const widgetData = this.dataLoader.getHomepageWidgetData();
        
        if (!widgetData) {
            console.warn('No widget data available, using fallback');
            this.updateWithFallbackData();
            return;
        }

        this.updateAllWidgetsFromData(widgetData);
    }

    /**
     * Update widgets from data object
     */
    updateAllWidgetsFromData(widgetData) {
        // Update Hero Stats
        this.updateHeroStats(widgetData.heroStats);
        
        // Update Next Race - FIXED VERSION
        this.updateNextRace(widgetData.nextRace);
        
        // Update Previous Race
        this.updatePreviousRace(widgetData.previousRace);
        
        // Update Driver of the Day - SIMPLIFIED
        this.updateDriverOfTheDay(widgetData.driverOfTheDay);
        
        // Update Driver Standings
        this.updateDriverStandings(widgetData.topDrivers);
        
        // Update Constructor Standings
        this.updateConstructorStandings(widgetData.topConstructors);
        
        // Update Driver Ratings
        this.updateDriverRatings(widgetData.topRatedDrivers);
        
        // Update Calendar
        this.updateCalendar(widgetData.upcomingRaces);
        
        // Update Latest Article
        this.updateLatestArticle(widgetData.latestArticle);
    }

    /**
     * Update Hero Stats
     */
    updateHeroStats(stats) {
        if (!stats) return;
        
        if (this.elements.totalRaces) {
            this.elements.totalRaces.textContent = stats.totalRaces || 0;
        }
        if (this.elements.totalDrivers) {
            this.elements.totalDrivers.textContent = stats.totalDrivers || 0;
        }
        if (this.elements.totalTeams) {
            this.elements.totalTeams.textContent = stats.totalTeams || 0;
        }
    }

    /**
     * Update Next Race widget - FIXED VERSION
     */
    updateNextRace(raceData) {
        if (!raceData) return;
        
        const { name, round, date, circuit, status } = raceData;
        
        console.log('Next Race Data:', { name, round, date, circuit, status });
        
        if (this.elements.nextGpName) {
            this.elements.nextGpName.textContent = name;
            this.elements.nextGpName.classList.remove('loading');
            
            if (status === 'not_started') {
                this.elements.nextGpName.classList.add('not-started');
            }
        }
        
        // Show round number (e.g., "Round 1")
        if (this.elements.nextGpRound) {
            this.elements.nextGpRound.textContent = round || '-';
        }
        
        // Show formatted date
        if (this.elements.nextGpDate) {
            this.elements.nextGpDate.textContent = date || 'TBD';
        }
        
        // Show circuit from CircuitMaster
        if (this.elements.nextGpCircuit) {
            this.elements.nextGpCircuit.textContent = circuit || 'TBA';
        }
        
        // Update countdown - only if we have a valid date
        if (status === 'upcoming' && date && date !== 'TBD' && date !== 'Coming Soon') {
            this.updateRaceCountdown(date);
        } else if (status === 'not_started') {
            if (this.elements.nextGpCountdown) {
                this.elements.nextGpCountdown.textContent = 'SEASON STARTING SOON';
            }
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON STARTING SOON';
            }
        } else if (status === 'completed') {
            if (this.elements.nextGpCountdown) {
                this.elements.nextGpCountdown.textContent = 'SEASON COMPLETED';
            }
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON COMPLETED';
            }
        } else {
            if (this.elements.nextGpCountdown) {
                this.elements.nextGpCountdown.textContent = 'SEASON IN PROGRESS';
            }
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON IN PROGRESS';
            }
        }
    }

    /**
     * Update Previous Race widget
     */
    updatePreviousRace(raceData) {
        if (!raceData) return;
        
        const { name, winner, fastestLap, date, status } = raceData;
        
        if (this.elements.prevGpName) {
            this.elements.prevGpName.textContent = name;
            this.elements.prevGpName.classList.remove('loading');
            
            if (status === 'not_started') {
                this.elements.prevGpName.classList.add('not-started');
            }
        }
        
        if (this.elements.prevGpWinner) this.elements.prevGpWinner.textContent = winner;
        if (this.elements.prevGpFastest) this.elements.prevGpFastest.textContent = fastestLap;
        if (this.elements.prevGpDate) this.elements.prevGpDate.textContent = date;
        
        // Update result text
        if (this.elements.prevGpResult) {
            if (status === 'not_started') {
                this.elements.prevGpResult.textContent = 'AWAITING SEASON START';
                this.elements.prevGpResult.classList.add('awaiting-start');
            } else if (status === 'completed') {
                this.elements.prevGpResult.textContent = 'RACE COMPLETED';
            } else {
                this.elements.prevGpResult.textContent = 'NO DATA AVAILABLE';
            }
        }
    }

    /**
     * Update Driver of the Day widget - SIMPLIFIED
     */
    updateDriverOfTheDay(driverData) {
        if (!driverData) {
            if (this.elements.dotdName) {
                this.elements.dotdName.textContent = 'No Data';
                this.elements.dotdName.classList.remove('loading');
            }
            return;
        }
        
        const { name, photo } = driverData;
        
        if (this.elements.dotdName) {
            this.elements.dotdName.textContent = name;
            this.elements.dotdName.classList.remove('loading');
        }
        
        // Set avatar with photo if available
        if (this.elements.dotdAvatar) {
            // Clear any existing content
            this.elements.dotdAvatar.innerHTML = '';
            this.elements.dotdAvatar.style.backgroundImage = '';
            this.elements.dotdAvatar.style.backgroundColor = '';
            
            // Check if photo is a valid URL
            const hasValidPhoto = photo && 
                                 photo.trim() !== '' && 
                                 photo !== 'http://' && 
                                 photo !== 'https://' && 
                                 (photo.startsWith('http://') || photo.startsWith('https://'));
            
            if (hasValidPhoto) {
                // Use photo URL
                this.elements.dotdAvatar.style.backgroundImage = `url(${photo})`;
                this.elements.dotdAvatar.style.backgroundSize = 'cover';
                this.elements.dotdAvatar.style.backgroundPosition = 'center';
                console.log('Loaded DOTD photo:', photo);
            } else {
                // No valid photo, use initials with gold gradient
                const initials = this.getDriverInitials(name);
                this.elements.dotdAvatar.innerHTML = `<div class="fallback">${initials}</div>`;
                this.elements.dotdAvatar.style.background = 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
                console.log('Using initials for DOTD:', initials);
            }
        }
    }

    /**
     * Get driver initials from name
     */
    getDriverInitials(name) {
        if (!name) return 'DOTD';
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .substring(0, 3);
    }

    /**
     * Update Driver Standings widget
     */
    updateDriverStandings(drivers) {
        if (!this.elements.driverStandings) return;
        
        if (!drivers || drivers.length === 0) {
            this.elements.driverStandings.innerHTML = `
                <div class="standings-row">
                    <div class="pos">-</div>
                    <div class="driver">No Data</div>
                    <div class="points">-</div>
                </div>
            `;
            return;
        }
        
        const standingsHTML = drivers.map(driver => `
            <div class="standings-row">
                <div class="pos">${driver.position || '-'}</div>
                <div class="driver">${driver.name || 'Unknown'}</div>
                <div class="points">${driver.points || 0}</div>
            </div>
        `).join('');
        
        this.elements.driverStandings.innerHTML = standingsHTML;
    }

    /**
     * Update Constructor Standings widget
     */
    updateConstructorStandings(constructors) {
        if (!this.elements.constructorStandings) return;
        
        if (!constructors || constructors.length === 0) {
            this.elements.constructorStandings.innerHTML = `
                <div class="standings-row">
                    <div class="pos">-</div>
                    <div class="team">No Data</div>
                    <div class="points">-</div>
                </div>
            `;
            return;
        }
        
        const standingsHTML = constructors.map(constructor => `
            <div class="standings-row">
                <div class="pos">${constructor.position || '-'}</div>
                <div class="team">${constructor.name || 'Unknown'}</div>
                <div class="points">${constructor.points || 0}</div>
            </div>
        `).join('');
        
        this.elements.constructorStandings.innerHTML = standingsHTML;
    }

    /**
     * Update Driver Ratings widget
     */
    updateDriverRatings(drivers) {
        if (!this.elements.driverRatings) return;
        
        if (!drivers || drivers.length === 0) {
            this.elements.driverRatings.innerHTML = `
                <div class="ratings-row">
                    <div class="pos">-</div>
                    <div class="driver">No Data</div>
                    <div class="rating">-</div>
                </div>
            `;
            return;
        }
        
        const ratingsHTML = drivers.map(driver => `
            <div class="ratings-row">
                <div class="pos">${driver.position || '-'}</div>
                <div class="driver">${driver.name || 'Unknown'}</div>
                <div class="rating">${driver.rating?.toFixed(1) || '0.0'}</div>
            </div>
        `).join('');
        
        this.elements.driverRatings.innerHTML = ratingsHTML;
    }

    /**
     * Update Calendar widget
     */
    updateCalendar(races) {
        if (!this.elements.upcomingCalendar) return;
        
        if (!races || races.length === 0) {
            this.elements.upcomingCalendar.innerHTML = `
                <div class="calendar-empty">
                    <i class="fas fa-calendar-times"></i>
                    <p>No upcoming races scheduled</p>
                </div>
            `;
            return;
        }
        
        const calendarHTML = races.map(race => `
            <div class="calendar-item">
                <div class="calendar-item-round">${race.round?.replace('Round ', 'R') || 'R-'}</div>
                <div class="calendar-item-content">
                    <div class="calendar-item-name">${race.name || 'TBD'}</div>
                    <div class="calendar-item-date">${race.date || 'TBD'}</div>
                </div>
                <div class="calendar-item-location">${race.location || 'TBA'}</div>
            </div>
        `).join('');
        
        this.elements.upcomingCalendar.innerHTML = calendarHTML;
    }

    /**
     * Update Latest Article
     */
    /**
 * Update Latest Article
 */
updateLatestArticle(articleData = null) {
    if (articleData) {
        // If we have real article data, use it but override the link to go to news page
        const article = {
            ...articleData,
            link: 'news.html' // Always go to news page, not direct article link
        };
        
        if (this.elements.articleDate) this.elements.articleDate.textContent = article.date;
        if (this.elements.articleTitle) this.elements.articleTitle.textContent = article.title;
        if (this.elements.articleExcerpt) this.elements.articleExcerpt.textContent = article.excerpt;
        if (this.elements.articleLink) {
            this.elements.articleLink.href = article.link;
            this.elements.articleLink.textContent = 'READ FULL ARTICLE';
        }
    } else {
        // Use default article data that links to news page
        const article = {
            title: 'EFC Season 2 Launch Announcement',
            excerpt: 'The new season brings exciting changes and new competitors to the grid.',
            date: '2024-03-10',
            link: 'news.html' // Link to news page
        };
        
        if (this.elements.articleDate) this.elements.articleDate.textContent = article.date;
        if (this.elements.articleTitle) this.elements.articleTitle.textContent = article.title;
        if (this.elements.articleExcerpt) this.elements.articleExcerpt.textContent = article.excerpt;
        if (this.elements.articleLink) {
            this.elements.articleLink.href = article.link;
            this.elements.articleLink.textContent = 'READ FULL ARTICLE';
        }
    }
}

    /**
     * Update race countdown
     */
    updateRaceCountdown(dateStr) {
        // Try to parse date
        let targetDate;
        
        console.log('Parsing date for countdown:', dateStr);
        
        try {
            // Try different date formats
            if (dateStr.includes(',')) {
                // Format like "March 30, 2024"
                targetDate = new Date(dateStr);
            } else if (dateStr.includes('/')) {
                // Format like "3/30/2024" - but our dates should already be formatted
                // If we get here, it means the date formatting failed
                const [month, day, year] = dateStr.split('/').map(Number);
                targetDate = new Date(year, month - 1, day);
            } else {
                // Unknown format, try to parse anyway
                targetDate = new Date(dateStr);
            }
            
            // Check if date is valid
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date');
            }
            
            console.log('Countdown target date:', targetDate);
            
        } catch (error) {
            console.error('Failed to parse date for countdown:', dateStr, error);
            // Use mock date (1 week from now) if parsing fails
            targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 7);
        }
        
        const updateCountdown = () => {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                if (this.elements.nextGpCountdown) {
                    this.elements.nextGpCountdown.textContent = 'RACE DAY!';
                }
                if (this.elements.timerDisplay) {
                    this.elements.timerDisplay.textContent = 'RACE DAY!';
                }
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const timerString = `${days}d ${hours}h ${minutes}m`;
            const fullTimerString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
            
            if (this.elements.nextGpCountdown) {
                this.elements.nextGpCountdown.textContent = timerString;
            }
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = fullTimerString;
            }
        };
        
        // Clear existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Update immediately
        updateCountdown();
        
        // Update every second
        this.countdownInterval = setInterval(updateCountdown, 1000);
    }

    /**
     * Start countdown timer
     */
    startCountdownTimer() {
        const widgetData = this.dataLoader.getHomepageWidgetData();
        if (widgetData && widgetData.nextRace && widgetData.nextRace.status === 'upcoming') {
            this.updateRaceCountdown(widgetData.nextRace.date);
        }
    }

    /**
     * Get team CSS class name
     */
    getTeamClassName(teamName) {
        if (!teamName) return 'team-default';
        
        const teamNameLower = teamName.toLowerCase();
        
        if (teamNameLower.includes('mercedes') || teamNameLower.includes('amg')) return 'team-mercedes';
        if (teamNameLower.includes('ferrari') || teamNameLower.includes('scuderia')) return 'team-ferrari';
        if (teamNameLower.includes('red bull') || teamNameLower.includes('redbull')) return 'team-redbull';
        if (teamNameLower.includes('mclaren')) return 'team-mclaren';
        if (teamNameLower.includes('alpine')) return 'team-alpine';
        if (teamNameLower.includes('aston martin') || teamNameLower.includes('astonmartin')) return 'team-astonmartin';
        if (teamNameLower.includes('haas')) return 'team-haas';
        if (teamNameLower.includes('alfa romeo') || teamNameLower.includes('alfaromeo')) return 'team-alfaromeo';
        if (teamNameLower.includes('williams')) return 'team-williams';
        if (teamNameLower.includes('racing bulls') || teamNameLower.includes('racingbulls')) return 'team-racingbulls';
        
        return 'team-default';
    }

    /**
     * Add event listeners only for demo elements (not for navigation links)
     */
    addDemoEventListeners() {
        // Refresh button for debugging
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;background:var(--primary);color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;';
        refreshBtn.addEventListener('click', () => this.refreshData());
        document.body.appendChild(refreshBtn);
    }

    /**
     * Refresh data
     */
    async refreshData() {
        console.log('Refreshing data...');
        this.dataLoader.dataCache = {};
        await this.initialize();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const homepageManager = new HomepageManager();
    homepageManager.initialize();
});