/**
 * Championship Page Script
 * FIXED VERSION - Properly references global data loader
 */

class ChampionshipManager {
    constructor() {
        // Initialize with null, will be set in initialize()
        this.dataLoader = null;
        this.isInitialized = false;
        this.countdownInterval = null;
        
        // DOM Elements
        this.elements = {
            // Hero stats
            currentRound: document.getElementById('current-round'),
            nextRaceInfo: document.getElementById('next-race-info'),
            championshipStatus: document.getElementById('championship-status'),
            timerDisplay: document.getElementById('timer-display'),
            
            // Search elements
            searchInput: document.getElementById('search-input'),
            clearSearchBtn: document.getElementById('clear-search'),
            shownCount: document.getElementById('shown-count'),
            totalCount: document.getElementById('total-count'),
            noResultsMessage: document.getElementById('no-results-message'),
            resultsCount: document.getElementById('results-count'),
            
            // Tables
            driversStandingsBody: document.getElementById('drivers-standings-body'),
            constructorsStandingsBody: document.getElementById('constructors-standings-body'),
            driversProgressionBody: document.getElementById('drivers-progression-body'),
            constructorsProgressionBody: document.getElementById('constructors-progression-body'),
            driversRoundsHeader: document.getElementById('drivers-rounds-header'),
            constructorsRoundsHeader: document.getElementById('constructors-rounds-header'),
            
            // Tabs and views
            tabButtons: document.querySelectorAll('.tab-button'),
            viewOptions: document.querySelectorAll('.view-option'),
            tabContents: document.querySelectorAll('.tab-content'),
            viewContents: document.querySelectorAll('.view-content')
        };
        
        // Data storage
        this.driversData = [];
        this.filteredDriversData = [];
        this.constructorsData = [];
        this.filteredConstructorsData = [];
        this.raceResults = {};
        this.driverRoundPoints = {};
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        this.completedRaces = 0;
        this.totalRaces = 0;
        this.teamMasterMap = {};
        
        // Search state
        this.searchQuery = '';
        
        // Current active tab and view
        this.activeTab = 'drivers';
        this.activeView = 'current';
    }

    /**
     * Initialize championship page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing championship page...');
        
        try {
            // Get the data loader from window object
            if (typeof window.efcDataLoader === 'undefined') {
                console.error('efcDataLoader not found on window object');
                // Try to create it
                if (typeof EFCDataLoader !== 'undefined') {
                    window.efcDataLoader = new EFCDataLoader();
                    this.dataLoader = window.efcDataLoader;
                } else {
                    throw new Error('EFCDataLoader class not found');
                }
            } else {
                this.dataLoader = window.efcDataLoader;
            }
            
            console.log('Data loader found:', this.dataLoader);
            
            // Load data
            await this.dataLoader.loadHomepageData();
            
            // Build team master map for quick lookup
            this.buildTeamMasterMap();
            
            // Process data
            this.processChampionshipData();
            
            // Parse race results for progression
            this.parseRaceResults();
            
            // Update UI
            this.updateChampionshipStats();
            this.updateAllStandings();
            this.updateProgressionViews();
            
            // Start countdown timer
            this.startCountdownTimer();
            
            // Add event listeners
            this.addEventListeners();
            
            // Initialize tabs and views
            this.initializeTabsAndViews();
            
            this.isInitialized = true;
            console.log('Championship page initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize championship page:', error);
            this.updateWithFallbackData();
        }
    }

    /**
     * Initialize tabs and views UI
     */
    initializeTabsAndViews() {
        // Set initial active states
        this.switchTab('drivers');
        this.switchView('current');
    }

    /**
     * Build team master map for quick lookup
     */
    buildTeamMasterMap() {
        if (!this.dataLoader || !this.dataLoader.dataCache) {
            this.teamMasterMap = {};
            return;
        }
        
        const teamMaster = this.dataLoader.dataCache.teamMaster || [];
        this.teamMasterMap = {};
        
        teamMaster.forEach(team => {
            if (team && team.id) {
                this.teamMasterMap[team.id] = team;
            }
        });
    }

    /**
     * Process championship data
     */
    processChampionshipData() {
        const dataCache = this.dataLoader.dataCache;
        
        // Get race calendar
        const calendar = dataCache.raceCalendar || [];
        this.totalRaces = calendar.length;
        
        // Get completed races
        this.completedRaces = this.dataLoader.getCompletedRacesCount();
        
        // Get driver stats
        const driverStats = dataCache.driverStats || [];
        const driverMaster = dataCache.driverMaster || [];
        
        // Process drivers data
        this.driversData = driverStats.map(stat => {
            const driverInfo = driverMaster.find(d => d.username === stat.driver) || {};
            const teamCode = driverInfo.teamCode || '';
            
            // Get team info from team master map
            const teamInfo = this.teamMasterMap[teamCode];
            
            // Get team name - use the actual name from TeamMaster sheet
            let teamDisplayName = 'No Team';
            
            if (teamInfo) {
                // Use the name directly from TeamMaster sheet, not fullName
                teamDisplayName = teamInfo.name || teamCode;
            } else if (teamCode) {
                teamDisplayName = this.dataLoader.getTeamNameFromCode(teamCode) || teamCode;
            }
            
            return {
                name: stat.driver,
                teamCode: teamCode,
                teamDisplayName: teamDisplayName,
                number: driverInfo.number || '',
                nationality: driverInfo.nationality || '',
                photo: driverInfo.photo || '',
                points: stat.points || 0,
                wins: stat.wins || 0,
                podiums: stat.podiums || 0,
                poles: stat.poles || 0,
                fastestLaps: stat.fastestLaps || 0,
                dnfs: stat.dnfs || 0,
                racesAttended: stat.racesAttended || 0
            };
        }).sort((a, b) => b.points - a.points);
        
        // Initialize filtered drivers data
        this.filteredDriversData = [...this.driversData];
        
        // Calculate constructor standings
        this.constructorsData = this.calculateConstructorStandings();
        this.filteredConstructorsData = [...this.constructorsData];
        
        // Get race results for progression
        this.raceResults = dataCache.raceResults || {};
        
        console.log('Processed championship data:', {
            drivers: this.driversData.length,
            constructors: this.constructorsData.length,
            totalRaces: this.totalRaces,
            completedRaces: this.completedRaces
        });
    }

    /**
     * Parse race results to get round-by-round points - FIXED: Proper constructor points
     */
    parseRaceResults() {
        const raceResults = this.raceResults;
        const results = raceResults.results || [];
        
        console.log('Parsing race results for', results.length, 'drivers');
        
        // Initialize data structures
        this.driverRoundPoints = {};
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        
        // First, initialize constructor points for all teams
        this.constructorsData.forEach(constructor => {
            if (constructor && constructor.displayName) {
                this.constructorRoundPoints[constructor.displayName] = {};
                for (let i = 1; i <= this.totalRaces; i++) {
                    this.constructorRoundPoints[constructor.displayName][`Round ${i}`] = 0;
                }
            }
        });
        
        console.log('Initialized constructor points for:', Object.keys(this.constructorRoundPoints));
        
        // Parse each driver's results
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverRounds = driverResult.results || {};
            
            console.log(`Processing driver: ${driverName}`);
            
            // Get driver info to find their team
            const driverInfo = this.driversData.find(d => d.name === driverName);
            if (!driverInfo) {
                console.log(`Driver ${driverName} not found in driversData`);
                return;
            }
            
            const teamName = driverInfo.teamDisplayName;
            console.log(`Driver ${driverName} is in team: ${teamName}`);
            
            if (!teamName || teamName === 'No Team') {
                console.log(`Driver ${driverName} has no valid team`);
                return;
            }
            
            // Initialize driver structures
            if (!this.driverRoundPoints[driverName]) {
                this.driverRoundPoints[driverName] = {};
                this.driverRoundFastestLaps[driverName] = {};
            }
            
            // Process each round
            Object.keys(driverRounds).forEach(roundKey => {
                const roundResult = driverRounds[roundKey];
                if (!roundResult || roundResult.trim() === '') return;
                
                // Calculate points for this round
                let points = 0;
                let hasFastestLap = false;
                
                // Check for fastest lap
                if (roundResult.includes('Fastest Lap') || roundResult.includes('FL')) {
                    hasFastestLap = true;
                }
                
                // Extract position and calculate points
                const positionMatch = roundResult.match(/P(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    points = this.calculatePointsFromPosition(position);
                    
                    // Add fastest lap point
                    if (hasFastestLap) {
                        points += 1;
                    }
                }
                
                console.log(`${driverName} in ${roundKey}: ${points} points (${roundResult})`);
                
                // Store driver points
                this.driverRoundPoints[driverName][roundKey] = points;
                this.driverRoundFastestLaps[driverName][roundKey] = hasFastestLap;
                
                // Add to constructor points - FIXED: Find correct constructor name
                let constructorName = teamName;
                
                // Try to find the constructor by display name
                if (!this.constructorRoundPoints[constructorName]) {
                    // Try alternative names
                    const constructor = this.constructorsData.find(c => 
                        c.displayName === constructorName || 
                        c.displayName.includes(constructorName) ||
                        constructorName.includes(c.displayName)
                    );
                    
                    if (constructor) {
                        constructorName = constructor.displayName;
                    }
                }
                
                // Initialize constructor round if needed
                if (this.constructorRoundPoints[constructorName]) {
                    if (!this.constructorRoundPoints[constructorName][roundKey]) {
                        this.constructorRoundPoints[constructorName][roundKey] = 0;
                    }
                    this.constructorRoundPoints[constructorName][roundKey] += points;
                    
                    console.log(`Added ${points} points to ${constructorName} in ${roundKey}. Total: ${this.constructorRoundPoints[constructorName][roundKey]}`);
                } else {
                    console.log(`Constructor ${constructorName} not found in constructorRoundPoints`);
                }
            });
        });
        
        console.log('Constructor round points after parsing:', this.constructorRoundPoints);
    }

    /**
     * Calculate points from finishing position
     */
    calculatePointsFromPosition(position) {
        if (!this.dataLoader || !this.dataLoader.pointsSystem) {
            // Default points system
            const defaultPoints = {
                1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
                6: 8, 7: 6, 8: 4, 9: 2, 10: 1
            };
            return defaultPoints[position] || 0;
        }
        
        const pointsSystem = this.dataLoader.pointsSystem;
        const positionKey = `P${position}`;
        
        return pointsSystem[positionKey] !== undefined ? pointsSystem[positionKey] : 0;
    }

    /**
     * Calculate constructor standings
     */
    calculateConstructorStandings() {
        const driversData = this.driversData;
        
        // Group driver points by team
        const teamPoints = {};
        const teamWins = {};
        const teamPodiums = {};
        const teamDrivers = {};
        const teamInfoMap = {};
        
        driversData.forEach(driver => {
            if (!driver.teamCode) return;
            
            const teamCode = driver.teamCode;
            const teamInfo = this.teamMasterMap[teamCode];
            
            if (!teamPoints[teamCode]) {
                teamPoints[teamCode] = 0;
                teamWins[teamCode] = 0;
                teamPodiums[teamCode] = 0;
                teamDrivers[teamCode] = [];
                teamInfoMap[teamCode] = teamInfo;
            }
            
            teamPoints[teamCode] += driver.points;
            teamWins[teamCode] += driver.wins;
            teamPodiums[teamCode] += driver.podiums;
            teamDrivers[teamCode].push(driver.name);
        });
        
        // Convert to array and sort
        const constructors = Object.entries(teamPoints)
            .map(([teamCode, points]) => {
                const teamInfo = teamInfoMap[teamCode] || {};
                
                // Get display name
                let teamDisplayName = teamInfo.name || teamCode;
                
                return {
                    teamCode: teamCode,
                    displayName: teamDisplayName,
                    primaryColor: teamInfo.primaryColor || '#00f7ff',
                    secondaryColor: teamInfo.secondaryColor || '#ffffff',
                    logoUrl: teamInfo.logoUrl || '',
                    points: points,
                    wins: teamWins[teamCode] || 0,
                    podiums: teamPodiums[teamCode] || 0,
                    drivers: teamDrivers[teamCode] || []
                };
            })
            .sort((a, b) => b.points - a.points);
        
        console.log('Calculated constructor standings:', constructors);
        return constructors;
    }

    /**
     * Update all standings with search filter
     */
    updateAllStandings() {
        this.applySearchFilter();
        this.updateResultsCount();
        this.updateDriversStandings();
        this.updateConstructorsStandings();
        this.updateProgressionViews();
    }

    /**
     * Apply search filter to data
     */
    applySearchFilter() {
        const searchQuery = this.searchQuery.toLowerCase().trim();
        
        if (searchQuery === '') {
            // No search, show all data
            this.filteredDriversData = [...this.driversData];
            this.filteredConstructorsData = [...this.constructorsData];
        } else {
            // Filter drivers
            this.filteredDriversData = this.driversData.filter(driver => {
                const driverName = driver.name.toLowerCase();
                const teamName = driver.teamDisplayName.toLowerCase();
                return driverName.includes(searchQuery) || teamName.includes(searchQuery);
            });
            
            // Filter constructors
            this.filteredConstructorsData = this.constructorsData.filter(constructor => {
                const teamName = constructor.displayName.toLowerCase();
                const driversList = constructor.drivers.join(' ').toLowerCase();
                return teamName.includes(searchQuery) || driversList.includes(searchQuery);
            });
        }
    }

    /**
     * Update results count display
     */
    updateResultsCount() {
        let filteredData, totalData;
        
        if (this.activeTab === 'drivers') {
            filteredData = this.filteredDriversData;
            totalData = this.driversData.length;
        } else {
            filteredData = this.filteredConstructorsData;
            totalData = this.constructorsData.length;
        }
        
        if (this.elements.shownCount) {
            this.elements.shownCount.textContent = filteredData.length;
        }
        
        if (this.elements.totalCount) {
            this.elements.totalCount.textContent = totalData;
        }
        
        // Show/hide no results message
        if (this.elements.noResultsMessage) {
            if (filteredData.length === 0 && this.searchQuery !== '') {
                this.elements.noResultsMessage.style.display = 'block';
            } else {
                this.elements.noResultsMessage.style.display = 'none';
            }
        }
        
        // Show/hide results count
        if (this.elements.resultsCount) {
            if (this.searchQuery !== '') {
                this.elements.resultsCount.style.display = 'flex';
            } else {
                this.elements.resultsCount.style.display = 'none';
            }
        }
    }

    /**
     * Update championship stats
     */
    updateChampionshipStats() {
        if (!this.dataLoader || !this.dataLoader.dataCache) {
            if (this.elements.currentRound) {
                this.elements.currentRound.textContent = `ROUND 0/10`;
            }
            if (this.elements.nextRaceInfo) {
                this.elements.nextRaceInfo.textContent = 'SEASON STARTING SOON';
            }
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = 'SEASON STARTING SOON';
            }
            return;
        }
        
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        const nextRace = this.dataLoader.getNextRace();
        
        if (this.elements.currentRound) {
            this.elements.currentRound.textContent = `ROUND ${this.completedRaces}/${this.totalRaces}`;
        }
        
        // Set initial text for next race info
        if (this.elements.nextRaceInfo) {
            if (this.completedRaces === 0) {
                this.elements.nextRaceInfo.textContent = `${nextRace.name} - ${nextRace.date}`;
            } else if (this.completedRaces < this.totalRaces) {
                const nextRaceIndex = this.completedRaces;
                const nextRaceInfo = calendar[nextRaceIndex] || {};
                this.elements.nextRaceInfo.textContent = `${nextRaceInfo.name || 'TBD'} - ${nextRaceInfo.date || 'TBD'}`;
            } else {
                this.elements.nextRaceInfo.textContent = 'SEASON COMPLETED';
            }
        }
        
        // Initialize header timer display
        if (this.elements.timerDisplay) {
            if (this.completedRaces === 0) {
                this.elements.timerDisplay.textContent = 'SEASON STARTING SOON';
            } else if (this.completedRaces >= this.totalRaces) {
                this.elements.timerDisplay.textContent = 'SEASON COMPLETED';
            } else {
                this.elements.timerDisplay.textContent = 'LOADING...';
            }
        }
        
        // Update championship status text
        if (this.elements.championshipStatus) {
            let statusText = '';
            if (this.completedRaces === 0) {
                statusText = 'Season has not started yet. First race: ';
            } else if (this.completedRaces < this.totalRaces) {
                statusText = 'Season in progress. Next race: ';
            } else {
                statusText = 'Season completed. Champion: ';
                // Add champion info if available
                if (this.driversData.length > 0) {
                    statusText += this.driversData[0].name;
                }
            }
            
            const statusSpan = this.elements.championshipStatus.querySelector('span');
            if (statusSpan) {
                statusSpan.textContent = this.elements.nextRaceInfo.textContent;
            }
        }
    }

    /**
     * Update drivers standings
     */
    updateDriversStandings() {
        if (!this.elements.driversStandingsBody || this.filteredDriversData.length === 0) {
            this.showNoData(this.elements.driversStandingsBody);
            return;
        }
        
        // Calculate gaps for filtered data
        const standingsWithGaps = this.calculateGaps(this.filteredDriversData);
        
        const standingsHTML = standingsWithGaps.map((driver, index) => {
            const position = index + 1;
            const gap = driver.gap > 0 ? `+${driver.gap}` : 'Leader';
            const teamColor = this.getTeamColor(driver.teamCode);
            
            // Check if this row should be highlighted (matches search)
            const shouldHighlight = this.searchQuery !== '' && 
                (driver.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 driver.teamDisplayName.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            return `
                <div class="standing-row position-${position} ${shouldHighlight ? 'highlight' : ''}">
                    <div class="pos-cell">${position}</div>
                    <div class="driver-cell">
                        <div class="driver-number">${driver.number || position}</div>
                        <div class="driver-name" style="color: ${teamColor}">${driver.name}</div>
                    </div>
                    <div class="team-cell">
                        <div class="team-color" style="background: ${teamColor}"></div>
                        <div>${driver.teamDisplayName}</div>
                    </div>
                    <div class="points-cell">${driver.points}</div>
                    <div class="wins-cell">${driver.wins}</div>
                    <div class="podiums-cell">${driver.podiums}</div>
                    <div class="difference-cell">${gap}</div>
                </div>
            `;
        }).join('');
        
        this.elements.driversStandingsBody.innerHTML = standingsHTML;
    }

    /**
     * Update constructors standings
     */
    updateConstructorsStandings() {
        if (!this.elements.constructorsStandingsBody || this.filteredConstructorsData.length === 0) {
            this.showNoData(this.elements.constructorsStandingsBody);
            return;
        }
        
        // Calculate gaps for filtered data
        const standingsWithGaps = this.calculateGaps(this.filteredConstructorsData);
        
        const standingsHTML = standingsWithGaps.map((constructor, index) => {
            const position = index + 1;
            const gap = constructor.gap > 0 ? `+${constructor.gap}` : 'Leader';
            const teamColor = constructor.primaryColor;
            
            // Check if this row should be highlighted (matches search)
            const shouldHighlight = this.searchQuery !== '' && 
                (constructor.displayName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 constructor.drivers.some(driver => driver.toLowerCase().includes(this.searchQuery.toLowerCase())));
            
            const driversList = constructor.drivers.map(driver => 
                `<div class="driver-in-team">${driver}</div>`
            ).join('');
            
            return `
                <div class="constructors-row position-${position} ${shouldHighlight ? 'highlight' : ''}">
                    <div class="pos-cell">${position}</div>
                    <div class="team-cell-constructors">
                        ${constructor.logoUrl ? 
                            `<img src="${constructor.logoUrl}" alt="${constructor.displayName}" class="team-logo-small">` : 
                            `<div class="team-color" style="background: ${teamColor}"></div>`
                        }
                        <div style="color: ${teamColor}">${constructor.displayName}</div>
                    </div>
                    <div class="points-cell">${constructor.points}</div>
                    <div class="wins-cell">${constructor.wins}</div>
                    <div class="podiums-cell">${constructor.podiums}</div>
                    <div class="drivers-list">${driversList}</div>
                    <div class="difference-cell">${gap}</div>
                </div>
            `;
        }).join('');
        
        this.elements.constructorsStandingsBody.innerHTML = standingsHTML;
    }

    /**
     * Update progression views based on active tab
     */
    updateProgressionViews() {
        if (this.activeTab === 'drivers') {
            this.updateDriversProgression();
        } else {
            this.updateConstructorsProgression();
        }
    }

    /**
     * Update drivers progression view
     */
    updateDriversProgression() {
        if (!this.elements.driversProgressionBody || !this.elements.driversRoundsHeader) return;
        
        const completedRaces = this.completedRaces;
        
        // Clear previous content
        this.elements.driversProgressionBody.innerHTML = '';
        
        // Get filtered drivers
        const drivers = this.filteredDriversData;
        
        if (drivers.length === 0) {
            this.elements.driversProgressionBody.innerHTML = `
                <div class="progression-row">
                    <div class="progression-driver">No Data Available</div>
                    ${'<div class="progression-round">-</div>'.repeat(this.totalRaces)}
                </div>
            `;
            return;
        }
        
        // Create header with TOTAL column
        let headerHTML = `<div class="progression-header-row">`;
        headerHTML += `<div class="progression-name-header">DRIVER</div>`;
        headerHTML += `<div class="progression-total-header">TOTAL</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="progression-round-header">R${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.driversProgressionBody.innerHTML = headerHTML;
        
        // Create data rows for filtered drivers
        drivers.forEach(driver => {
            const driverName = driver.name;
            const teamColor = this.getTeamColor(driver.teamCode);
            const roundPoints = this.driverRoundPoints[driverName] || {};
            const fastestLaps = this.driverRoundFastestLaps[driverName] || {};
            
            // Calculate total points
            let totalPoints = 0;
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const points = roundPoints[roundKey] || 0;
                if (i <= completedRaces) {
                    totalPoints += points;
                }
            }
            
            let rowHTML = `<div class="progression-data-row">`;
            
            // Driver name column
            rowHTML += `
                <div class="progression-driver-cell">
                    <div class="progression-driver-number">${driver.number || ''}</div>
                    <div class="progression-driver-name" style="color: ${teamColor}">${driver.name}</div>
                </div>
            `;
            
            // Total points column
            rowHTML += `<div class="progression-total-cell">${totalPoints}</div>`;
            
            // Round columns
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const points = roundPoints[roundKey] || 0;
                const hasFastestLap = fastestLaps[roundKey] || false;
                
                if (i <= completedRaces && points !== undefined) {
                    // Determine point class based on point value
                    let pointClass = 'driver-regular';
                    if (points === 25 || points === 26) { // 25 for win, 26 for win+FL
                        pointClass = 'driver-gold';
                    } else if (points === 18 || points === 19) { // 18 for 2nd, 19 for 2nd+FL
                        pointClass = 'driver-silver';
                    } else if (points === 15 || points === 16) { // 15 for 3rd, 16 for 3rd+FL
                        pointClass = 'driver-bronze';
                    }
                    
                    // Add fastest lap class if applicable
                    const fastestLapClass = hasFastestLap ? 'has-fastest-lap' : '';
                    
                    rowHTML += `<div class="progression-round-cell ${fastestLapClass}">
                        <div class="round-points ${pointClass} ${fastestLapClass}">
                            ${points}
                        </div>
                    </div>`;
                } else {
                    rowHTML += `<div class="progression-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            
            this.elements.driversProgressionBody.innerHTML += rowHTML;
        });
    }

    /**
     * Update constructors progression view - FIXED: Better constructor points handling
     */
    updateConstructorsProgression() {
        if (!this.elements.constructorsProgressionBody || !this.elements.constructorsRoundsHeader) return;
        
        const completedRaces = this.completedRaces;
        
        // Clear previous content
        this.elements.constructorsProgressionBody.innerHTML = '';
        
        // Get filtered constructors
        const constructors = this.filteredConstructorsData;
        
        if (constructors.length === 0) {
            this.elements.constructorsProgressionBody.innerHTML = `
                <div class="progression-row">
                    <div class="progression-team">No Data Available</div>
                    ${'<div class="progression-round">-</div>'.repeat(this.totalRaces)}
                </div>
            `;
            return;
        }
        
        // Create header with TOTAL column
        let headerHTML = `<div class="progression-header-row">`;
        headerHTML += `<div class="progression-name-header">TEAM</div>`;
        headerHTML += `<div class="progression-total-header">TOTAL</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="progression-round-header">R${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.constructorsProgressionBody.innerHTML = headerHTML;
        
        // Create data rows for filtered constructors
        constructors.forEach(constructor => {
            const teamName = constructor.displayName;
            const teamColor = constructor.primaryColor;
            
            // Find constructor points - try multiple name variations
            let roundPoints = {};
            
            // First try exact match
            if (this.constructorRoundPoints[teamName]) {
                roundPoints = this.constructorRoundPoints[teamName];
            } else {
                // Try to find by partial match
                const matchingKey = Object.keys(this.constructorRoundPoints).find(key => 
                    key === teamName || 
                    key.includes(teamName) || 
                    teamName.includes(key)
                );
                
                if (matchingKey) {
                    roundPoints = this.constructorRoundPoints[matchingKey];
                } else {
                    // Try team code
                    if (constructor.teamCode && this.constructorRoundPoints[constructor.teamCode]) {
                        roundPoints = this.constructorRoundPoints[constructor.teamCode];
                    }
                }
            }
            
            console.log(`Constructor ${teamName} round points:`, roundPoints);
            
            // Calculate total points
            let totalPoints = 0;
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const points = roundPoints[roundKey] || 0;
                if (i <= completedRaces) {
                    totalPoints += points;
                }
            }
            
            // If total points is 0 but constructor has points in standings, sum up from driver points
            if (totalPoints === 0 && constructor.points > 0) {
                console.log(`Constructor ${teamName} has ${constructor.points} total points but 0 in progression. Checking drivers...`);
                
                // Sum points from all drivers in this team
                constructor.drivers.forEach(driverName => {
                    const driverRoundPoints = this.driverRoundPoints[driverName] || {};
                    for (let i = 1; i <= this.totalRaces; i++) {
                        const roundKey = `Round ${i}`;
                        const points = driverRoundPoints[roundKey] || 0;
                        if (i <= completedRaces) {
                            totalPoints += points;
                            if (!roundPoints[roundKey]) roundPoints[roundKey] = 0;
                            roundPoints[roundKey] += points;
                        }
                    }
                });
            }
            
            let rowHTML = `<div class="progression-data-row">`;
            
            // Team name column
            rowHTML += `<div class="progression-team-cell">
                <div class="progression-driver-name" style="color: ${teamColor}">${teamName}</div>
            </div>`;
            
            // Total points column
            rowHTML += `<div class="progression-total-cell">${totalPoints}</div>`;
            
            // Round columns
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const points = roundPoints[roundKey] || 0;
                
                if (i <= completedRaces && points !== undefined) {
                    rowHTML += `<div class="progression-round-cell">
                        <div class="round-points constructor-regular">
                            ${points}
                        </div>
                    </div>`;
                } else {
                    rowHTML += `<div class="progression-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            
            this.elements.constructorsProgressionBody.innerHTML += rowHTML;
        });
    }

    /**
     * Calculate gaps between positions
     */
    calculateGaps(standings) {
        if (standings.length === 0) return [];
        
        const leaderPoints = standings[0].points;
        
        return standings.map((entry, index) => {
            return {
                ...entry,
                gap: index === 0 ? 0 : leaderPoints - entry.points
            };
        });
    }

    /**
     * Get team color from team code
     */
    getTeamColor(teamCode) {
        const team = this.teamMasterMap[teamCode];
        return team?.primaryColor || '#00f7ff';
    }

    /**
     * Show no data message
     */
    showNoData(element) {
        if (!element) return;
        
        element.innerHTML = `
            <div class="standing-row">
                <div class="pos-cell">-</div>
                <div class="driver-cell">No Data Available</div>
                <div class="team-cell">-</div>
                <div class="points-cell">-</div>
                <div class="wins-cell">-</div>
                <div class="podiums-cell">-</div>
                <div class="difference-cell">-</div>
            </div>
        `;
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Tab switching
        this.elements.tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
        
        // View switching
        this.elements.viewOptions.forEach(option => {
            option.addEventListener('click', () => {
                const viewType = option.getAttribute('data-view');
                this.switchView(viewType);
            });
        });
        
        // Search input
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.updateClearButton();
                this.updateAllStandings();
            });
        }
        
        // Clear search button
        if (this.elements.clearSearchBtn) {
            this.elements.clearSearchBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.elements.searchInput.value = '';
                this.updateClearButton();
                this.updateAllStandings();
                this.elements.searchInput.focus();
            });
        }
        
        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;background:var(--primary);color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;display:none;';
        refreshBtn.addEventListener('click', () => this.refreshData());
        document.body.appendChild(refreshBtn);
    }

    /**
     * Update clear button visibility
     */
    updateClearButton() {
        if (this.elements.clearSearchBtn) {
            if (this.searchQuery.trim() !== '') {
                this.elements.clearSearchBtn.classList.add('show');
            } else {
                this.elements.clearSearchBtn.classList.remove('show');
            }
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabId) {
        console.log('Switching to tab:', tabId);
        
        // Update active tab button
        this.elements.tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        // Update active tab content
        this.elements.tabContents.forEach(content => {
            if (content.id === `${tabId}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Store active tab
        this.activeTab = tabId;
        
        // Update view for current tab
        this.switchView(this.activeView);
        
        // Update results count for the active tab
        this.updateResultsCount();
    }

    /**
     * Switch between views
     */
    switchView(viewType) {
        console.log('Switching to view:', viewType, 'for tab:', this.activeTab);
        
        // Update active view button
        this.elements.viewOptions.forEach(option => {
            if (option.getAttribute('data-view') === viewType) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
        
        // Store active view
        this.activeView = viewType;
        
        // Hide all view contents for current tab
        const tabContents = document.querySelectorAll(`#${this.activeTab}-tab .view-content`);
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // Show active view content for current tab
        const activeViewContent = document.querySelector(`#${this.activeTab}-${viewType}`);
        if (activeViewContent) {
            activeViewContent.classList.add('active');
        }
        
        // Update progression views if needed
        if (viewType === 'progression') {
            this.updateProgressionViews();
        }
    }

    /**
     * Start countdown timer for next race
     */
    startCountdownTimer() {
        if (!this.dataLoader || !this.dataLoader.dataCache) {
            return;
        }
        
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        const completedRaces = this.completedRaces;
        
        // If season hasn't started yet
        if (completedRaces === 0 && calendar.length > 0) {
            const firstRace = calendar[0];
            this.updateCountdown(firstRace.date);
        }
        // If season is in progress
        else if (completedRaces < calendar.length && calendar.length > 0) {
            const nextRace = calendar[completedRaces];
            this.updateCountdown(nextRace.date);
        }
        // If season is completed
        else {
            this.updateCompletedSeasonDisplay();
        }
    }

    /**
     * Update countdown display for both header and race info
     */
    updateCountdown(dateStr) {
        // Clear any existing interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        // Try to parse the date
        let targetDate;
        
        try {
            // Use the data loader's formatDate method
            const formattedDateStr = this.dataLoader.formatDate(dateStr);
            
            if (formattedDateStr === 'TBD' || formattedDateStr === 'Coming Soon') {
                this.setStaticTexts('DATE TBD', 'DATE TBD');
                return;
            }
            
            // Parse the formatted date
            targetDate = new Date(formattedDateStr);
            
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date');
            }
            
            // Check if race has already passed
            const now = new Date();
            if (targetDate < now) {
                this.setStaticTexts('RACE DAY!', 'RACE DAY!');
                return;
            }
            
        } catch (error) {
            console.error('Failed to parse date for countdown:', dateStr, error);
            this.setStaticTexts('DATE TBD', 'DATE TBD');
            return;
        }
        
        // Update countdown function
        const updateCountdownDisplay = () => {
            const now = new Date();
            const diff = targetDate - now;
            
            if (diff <= 0) {
                this.setStaticTexts('RACE DAY!', 'RACE DAY!');
                clearInterval(this.countdownInterval);
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            // Format with leading zeros
            const formattedHours = hours.toString().padStart(2, '0');
            const formattedMinutes = minutes.toString().padStart(2, '0');
            const formattedSeconds = seconds.toString().padStart(2, '0');
            
            const countdownStr = `${days}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
            
            // Update displays
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = countdownStr;
            }
            if (this.elements.nextRaceInfo) {
                this.elements.nextRaceInfo.textContent = countdownStr;
            }
            
            // Update the championship status span
            const statusSpan = this.elements.championshipStatus?.querySelector('span');
            if (statusSpan) {
                statusSpan.textContent = countdownStr;
            }
        };
        
        // Update immediately
        updateCountdownDisplay();
        
        // Update every second
        this.countdownInterval = setInterval(updateCountdownDisplay, 1000);
    }

    /**
     * Helper: Set static text for both timer displays
     */
    setStaticTexts(headerText, raceInfoText) {
        if (this.elements.timerDisplay) {
            this.elements.timerDisplay.textContent = headerText;
        }
        if (this.elements.nextRaceInfo) {
            this.elements.nextRaceInfo.textContent = raceInfoText;
        }
        
        // Update the championship status span
        const statusSpan = this.elements.championshipStatus?.querySelector('span');
        if (statusSpan) {
            statusSpan.textContent = raceInfoText;
        }
    }

    /**
     * Update display for completed season
     */
    updateCompletedSeasonDisplay() {
        this.setStaticTexts('SEASON COMPLETED', 'SEASON COMPLETED');
        
        // Update championship status
        if (this.elements.championshipStatus) {
            const championText = this.driversData.length > 0 ? 
                `Season completed. Champion: ${this.driversData[0].name}` : 
                'Season completed.';
            this.elements.championshipStatus.textContent = championText;
        }
    }

    /**
     * Update with fallback data
     */
    updateWithFallbackData() {
        console.log('Using fallback data for championship');
        
        // Mock data
        this.driversData = [
            { name: 'Driver 1', teamDisplayName: 'Mercedes', points: 156, wins: 3, podiums: 5, number: '44', teamCode: 'MER' },
            { name: 'Driver 2', teamDisplayName: 'Ferrari', points: 142, wins: 2, podiums: 4, number: '63', teamCode: 'FER' },
            { name: 'Driver 3', teamDisplayName: 'Red Bull', points: 128, wins: 1, podiums: 3, number: '16', teamCode: 'RBR' },
            { name: 'Driver 4', teamDisplayName: 'McLaren', points: 115, wins: 1, podiums: 2, number: '33', teamCode: 'MCL' },
            { name: 'Driver 5', teamDisplayName: 'McLaren', points: 98, wins: 0, podiums: 1, number: '31', teamCode: 'MCL' }
        ];
        
        this.constructorsData = [
            { displayName: 'Mercedes', points: 298, wins: 5, podiums: 10, drivers: ['Driver 1', 'Driver 6'], primaryColor: '#00d2be' },
            { displayName: 'Ferrari', points: 284, wins: 4, podiums: 8, drivers: ['Driver 2', 'Driver 7'], primaryColor: '#dc0000' },
            { displayName: 'Red Bull', points: 256, wins: 3, podiums: 6, drivers: ['Driver 3', 'Driver 8'], primaryColor: '#0600ef' },
            { displayName: 'McLaren', points: 213, wins: 1, podiums: 3, drivers: ['Driver 4', 'Driver 5'], primaryColor: '#ff8000' },
            { displayName: 'Alpine', points: 196, wins: 1, podiums: 2, drivers: ['Driver 9', 'Driver 10'], primaryColor: '#0090ff' }
        ];
        
        // Initialize filtered data
        this.filteredDriversData = [...this.driversData];
        this.filteredConstructorsData = [...this.constructorsData];
        
        this.totalRaces = 10;
        this.completedRaces = 3;
        
        // Generate mock round points
        this.generateMockRoundPoints();
        
        this.updateChampionshipStats();
        this.updateAllStandings();
        this.updateProgressionViews();
        
        // Start countdown for fallback data
        this.updateCountdown('2024-12-31');
        
        // Initialize tabs and views
        this.initializeTabsAndViews();
    }

    /**
     * Generate mock round points for fallback data
     */
    generateMockRoundPoints() {
        // Initialize data structures
        this.driverRoundPoints = {};
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        
        // Initialize driver round points
        this.driversData.forEach(driver => {
            if (!driver || !driver.name) return;
            
            this.driverRoundPoints[driver.name] = {};
            this.driverRoundFastestLaps[driver.name] = {};
            
            for (let i = 1; i <= this.totalRaces; i++) {
                let points = 0;
                let hasFastestLap = false;
                
                if (i <= this.completedRaces) {
                    // For testing the color system with fastest laps
                    if (i === 1) { 
                        points = 25; // Gold - 1st place
                        hasFastestLap = Math.random() > 0.5;
                    } else if (i === 2) { 
                        points = 18; // Silver - 2nd place
                        hasFastestLap = Math.random() > 0.5;
                    } else if (i === 3) { 
                        points = 15; // Bronze - 3rd place
                        hasFastestLap = Math.random() > 0.5;
                    } else {
                        points = Math.floor(Math.random() * 14) + 1;
                    }
                    
                    // Add fastest lap point if applicable
                    if (hasFastestLap) {
                        points += 1;
                    }
                }
                this.driverRoundPoints[driver.name][`Round ${i}`] = points;
                this.driverRoundFastestLaps[driver.name][`Round ${i}`] = hasFastestLap;
            }
        });
        
        // Initialize constructor round points by summing driver points
        this.constructorsData.forEach(constructor => {
            if (!constructor || !constructor.displayName) return;
            
            this.constructorRoundPoints[constructor.displayName] = {};
            
            // Initialize all rounds to 0
            for (let i = 1; i <= this.totalRaces; i++) {
                this.constructorRoundPoints[constructor.displayName][`Round ${i}`] = 0;
            }
            
            // Sum points from all drivers in this team
            constructor.drivers.forEach(driverName => {
                const driverPoints = this.driverRoundPoints[driverName] || {};
                for (let i = 1; i <= this.totalRaces; i++) {
                    const roundKey = `Round ${i}`;
                    const points = driverPoints[roundKey] || 0;
                    if (i <= this.completedRaces) {
                        this.constructorRoundPoints[constructor.displayName][roundKey] += points;
                    }
                }
            });
        });
        
        console.log('Mock constructor round points:', this.constructorRoundPoints);
    }

    /**
     * Refresh data
     */
    async refreshData() {
        console.log('Refreshing championship data...');
        this.isInitialized = false;
        await this.initialize();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const championshipManager = new ChampionshipManager();
    
    // Add a small delay to ensure everything is loaded
    setTimeout(() => {
        championshipManager.initialize();
    }, 100);
});