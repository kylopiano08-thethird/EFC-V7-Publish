// scripts/race-calendar.js
class RaceCalendar {
    constructor() {
        this.races = [];
        this.nextRace = null;
        this.selectedRace = null;
        this.circuitData = {};
        this.init();
    }

    async init() {
        await this.loadDataFromWebsiteSheet(); // Load from Google Sheet first
        await this.loadCircuitData();
        await this.loadRacesFromResults();
        await this.loadSavedDates();
        this.findNextRace();
    }

    async loadDataFromWebsiteSheet() {
        const sheetId = '12zbjwk6DbdgowVT6Jtil9dcVFY2XPqcQqBFz1KxUTQc';
        const jsonUrl = `https://opensheet.elk.sh/${sheetId}/WebsiteData`;
        
        try {
            console.log('📡 Loading calendar data from WebsiteData sheet...');
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
            
            console.log('📊 Calendar data loaded from WebsiteData:', data);
            
            // Load circuit data from WebsiteData
            if (data.circuitData && typeof data.circuitData === 'object') {
                console.log('✅ Loaded circuit data from WebsiteData');
                this.circuitData = data.circuitData;
                localStorage.setItem('efc_circuit_data', JSON.stringify(data.circuitData));
            }
            
            // Load race dates from WebsiteData
            if (data.raceDates && typeof data.raceDates === 'object') {
                console.log('✅ Loaded race dates from WebsiteData');
                localStorage.setItem('efc_race_dates', JSON.stringify(data.raceDates));
            }
            
            console.log('✅ Successfully loaded calendar data from WebsiteData');
            
        } catch (error) {
            console.log('❌ Failed to load from WebsiteData, using localStorage:', error);
            // Fallback to localStorage if available
            await this.loadCircuitData();
        }
    }

    async loadCircuitData() {
        // Try localStorage first (might have been set by WebsiteData load)
        const savedCircuitData = localStorage.getItem('efc_circuit_data');
        if (savedCircuitData) {
            this.circuitData = JSON.parse(savedCircuitData);
            console.log('Loaded circuit data from localStorage:', this.circuitData);
        } else {
            // Default empty circuit data
            this.circuitData = {};
            console.log('No circuit data found.');
        }
    }

    async loadSavedDates() {
        try {
            const savedDates = localStorage.getItem('efc_race_dates');
            if (savedDates) {
                const dates = JSON.parse(savedDates);
                this.races.forEach(race => {
                    if (dates[race.name]) {
                        race.date = new Date(dates[race.name]);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading saved dates:', error);
        }
    }

    async loadRacesFromResults() {
    try {
        // Get race results data
        const raceResults = await this.getRaceResultsData();
        
        if (raceResults && raceResults.length > 0 && raceResults[0].results) {
            // Extract race names from the first driver's results
            const raceNames = Object.keys(raceResults[0].results).filter(race => {
                return race && race.trim() !== '' && 
                       race !== 'X' && race !== 'Completed?' &&
                       !race.includes('Position');
            });
            
            console.log('Found races:', raceNames);
            
            // Load saved dates from localStorage (set by WebsiteData)
            const savedDates = localStorage.getItem('efc_race_dates');
            const customDates = savedDates ? JSON.parse(savedDates) : {};
            
            // Create race objects with custom dates from Google Sheet
            this.races = raceNames.map((raceName, index) => {
                const fullRaceName = raceName + ' Grand Prix';
                
                // Use custom date from Google Sheet if available, otherwise calculate default
                let raceDate;
                if (customDates[fullRaceName]) {
                    raceDate = new Date(customDates[fullRaceName]);
                    console.log(`Using custom date for ${fullRaceName}:`, raceDate);
                } else {
                    raceDate = this.calculateRaceDate(index);
                    console.log(`Using calculated date for ${fullRaceName}:`, raceDate);
                }
                
                return {
                    name: fullRaceName,
                    originalName: raceName,
                    round: index + 1,
                    date: raceDate,
                    completed: this.isRaceCompleted(raceResults, raceName)
                };
            });
            
            console.log('Final races with dates:', this.races);
            
        } else {
            console.log('No race results found');
            this.races = [];
        }
        
    } catch (error) {
        console.error('Error loading races:', error);
        this.races = [];
    }
}

    calculateRaceDate(roundIndex) {
        // Calculate dates starting from next Saturday, spaced 2 weeks apart
        const baseDate = new Date();
        const daysUntilSaturday = (6 - baseDate.getDay() + 7) % 7 || 7;
        const raceDate = new Date(baseDate);
        raceDate.setDate(raceDate.getDate() + daysUntilSaturday + (roundIndex * 7));
        raceDate.setHours(14, 0, 0, 0);
        return raceDate;
    }

    isRaceCompleted(raceResults, raceName) {
        // Check if any driver has a result for this race
        if (!raceResults || raceResults.length === 0) return false;
        
        const sampleDriver = raceResults[0];
        const result = sampleDriver.results[raceName];
        return result && result.trim() !== '' && 
               !result.includes('DNS') && !result.includes('DNF');
    }

    async getRaceResultsData() {
        try {
            if (window.getRaceResultsData) {
                return await window.getRaceResultsData();
            }
            return null;
        } catch (error) {
            console.error('Error getting race results:', error);
            return null;
        }
    }

    findNextRace() {
        if (this.races.length === 0) {
            this.nextRace = null;
            return;
        }

        // Find the first race that isn't completed
        for (let i = 0; i < this.races.length; i++) {
            if (!this.races[i].completed) {
                this.nextRace = this.races[i];
                console.log('Next race:', this.nextRace.name);
                return;
            }
        }

        // All races completed
        this.nextRace = null;
        console.log('All races completed');
    }

    displayFullCalendar() {
        const container = document.getElementById('standings-container');
        if (!container) return;

        if (this.races.length === 0) {
            container.innerHTML = `
                <div class="combined-calendar">
                    <h2>🏁 Race Calendar & Circuits</h2>
                    <div class="loading">
                        No race data available. 
                        <br><small>Visit the Race Results tab first to load race information.</small>
                    </div>
                </div>
            `;
            return;
        }

        // AUTO-SELECT NEXT RACE BEFORE generating HTML
        if (this.nextRace && !this.selectedRace) {
            this.selectedRace = this.nextRace.name;
        }

        container.innerHTML = this.generateCombinedCalendarHTML(); 
    }

    generateCombinedCalendarHTML() {
        return `
            <div class="combined-calendar">
                <h2>🏁 Race Calendar & Circuits</h2>
                
                <!-- Next Race Highlight Card -->
                ${this.nextRace ? this.generateNextRaceCard() : this.generateNoUpcomingRacesCard()}
                
                <!-- Circuit Info Display -->
                <div class="circuit-display-section">
                    ${this.selectedRace ? this.generateCircuitInfo() : this.generateDefaultCircuitMessage()}
                </div>
                
                <!-- Full Race Calendar -->
                <div class="full-calendar-section">
                    <h3>Full Race Calendar</h3>
                    <div class="calendar-grid">
                        ${this.races.map(race => this.generateRaceCard(race)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    generateNextRaceCard() {
        const circuitInfo = this.circuitData[this.nextRace.name];
        
        return `
            <div class="next-race-highlight">
                <div class="next-race-banner">
                    <span class="next-badge">NEXT RACE</span>
                    <h3>${this.nextRace.name}</h3>
                    <div class="race-date">${this.formatDate(this.nextRace.date)}</div>
                </div>
                
                <div class="next-race-content">
                    <div class="next-race-info">
                        <div class="info-item">
                            <label>Round</label>
                            <value>${this.nextRace.round}</value>
                        </div>
                        <div class="info-item">
                            <label>Date</label>
                            <value>${this.formatDate(this.nextRace.date)}</value>
                        </div>
                        ${circuitInfo ? `
                            <div class="info-item">
                                <label>Circuit</label>
                                <value>${circuitInfo.circuit || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Location</label>
                                <value>${circuitInfo.city || 'N/A'}, ${circuitInfo.country || 'N/A'}</value>
                            </div>
                        ` : `
                            <div class="info-item">
                                <label>Circuit Info</label>
                                <value class="missing-data">Add circuit data in admin page</value>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    generateNoUpcomingRacesCard() {
        return `
            <div class="next-race-highlight completed-season">
                <div class="next-race-banner">
                    <span class="next-badge">SEASON COMPLETED</span>
                    <h3>All Races Finished</h3>
                    <div class="race-date">See you next season!</div>
                </div>
            </div>
        `;
    }

    generateCircuitInfo() {
        const circuitInfo = this.circuitData[this.selectedRace];
        if (!circuitInfo) {
            return this.generateDefaultCircuitMessage();
        }

        return `
            <div class="circuit-detail-view">
                <div class="circuit-header">
                    <h3>${circuitInfo.circuit}</h3>
                    <button class="close-circuit-btn" onclick="raceCalendar.clearSelection()">×</button>
                </div>
                
                <div class="circuit-layout">
                    <div class="circuit-image">
                        <img src="${circuitInfo.image || 'https://via.placeholder.com/600x300/333333/ffffff?text=Circuit+Image'}" 
                             alt="${circuitInfo.circuit}"
                             onerror="this.src='https://via.placeholder.com/600x300/333333/ffffff?text=Circuit+Image'">
                    </div>
                    
                    <div class="circuit-info-panel">
                        <div class="info-grid">
                            <div class="info-item">
                                <label>Circuit Length</label>
                                <value>${circuitInfo.length || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Race Laps</label>
                                <value>${circuitInfo.laps || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Race Distance</label>
                                <value>${circuitInfo.distance || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Lap Record</label>
                                <value>${circuitInfo.lapRecord || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Number of Corners</label>
                                <value>${circuitInfo.corners || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>First Grand Prix</label>
                                <value>${circuitInfo.firstGrandPrix || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Capacity</label>
                                <value>${circuitInfo.capacity || 'Not set'}</value>
                            </div>
                            <div class="info-item">
                                <label>Race Time</label>
                                <value>${circuitInfo.timezone || 'Not set'}</value>
                            </div>
                        </div>
                        
                        ${circuitInfo.description ? `
                            <div class="circuit-description">
                                <h4>Circuit Overview</h4>
                                <p>${circuitInfo.description}</p>
                            </div>
                        ` : ''}
                        
                        <div class="circuit-actions">
                            <button class="admin-link-btn" onclick="window.location.href='admin.html#circuit-editor'">
                                ⚙️ Edit Circuit Info
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateDefaultCircuitMessage() {
        return `
            <div class="circuit-placeholder">
                <div class="placeholder-content">
                    <div class="placeholder-icon">🏁</div>
                    <h4>Select a Race to View Circuit</h4>
                    <p>Click on any race in the calendar below to view its circuit information.</p>
                    <p class="admin-note">Use the admin page to add circuit images and details.</p>
                    <button class="admin-link-btn" onclick="window.location.href='admin.html'">
                        ⚙️ Go to Admin Page
                    </button>
                </div>
            </div>
        `;
    }

    generateRaceCard(race) {
        const isNext = this.nextRace && race.name === this.nextRace.name;
        const isSelected = this.selectedRace === race.name;
        const circuitInfo = this.circuitData[race.name];
        const cardClass = [
            'race-card',
            isNext ? 'next-race' : '',
            race.completed ? 'completed-race' : '',
            isSelected ? 'selected-race' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${cardClass}" onclick="raceCalendar.selectRace('${race.name}')">
                <div class="race-card-header">
                    <div class="race-round">Round ${race.round}</div>
                    ${isNext ? '<div class="next-badge-small">NEXT</div>' : ''}
                    ${race.completed ? '<div class="completed-badge">COMPLETED</div>' : ''}
                </div>
                <div class="race-name">${race.name}</div>
                <div class="race-date">${this.formatDate(race.date)}</div>
                <div class="circuit-name">${circuitInfo ? circuitInfo.circuit : 'Circuit info needed'}</div>
                <div class="race-status">
                    ${circuitInfo ? '✅ Circuit data ready' : '⚠️ Add circuit info'}
                </div>
            </div>
        `;
    }

    selectRace(raceName) {
        this.selectedRace = raceName;
        this.displayFullCalendar();
        
        // Scroll to circuit display section
        const circuitSection = document.querySelector('.circuit-display-section');
        if (circuitSection) {
            circuitSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    clearSelection() {
        this.selectedRace = null;
        this.displayFullCalendar();
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Method to update circuit data from admin
    updateCircuitData(circuitName, data) {
        this.circuitData[circuitName] = data;
        localStorage.setItem('efc_circuit_data', JSON.stringify(this.circuitData));
        this.displayFullCalendar(); // Refresh display
    }

    // Method to get all circuit names for admin
    getCircuitNames() {
        return this.races.map(race => race.name);
    }

    // NEW: Method to refresh data from WebsiteData
    // NEW: Method to refresh data from WebsiteData
async refreshFromWebsiteData() {
    console.log('🔄 Refreshing calendar data from WebsiteData...');
    await this.loadDataFromWebsiteSheet();
    await this.loadCircuitData();
    
    // Reload races to get updated dates
    const raceResults = await this.getRaceResultsData();
    if (raceResults) {
        await this.loadRacesFromResults();
    }
    
    this.findNextRace();
    this.displayFullCalendar();
    console.log('✅ Calendar refreshed with latest data');
}
}

// Initialize when loaded
window.RaceCalendar = RaceCalendar;
window.raceCalendar = new RaceCalendar();