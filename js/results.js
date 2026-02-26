/**
 * Results Page Script
 * UPDATED: Uses driver movement system and team colors from TeamMaster (like championship.js)
 */

class ResultsManager {
    constructor() {
        this.dataLoader = efcDataLoader;
        this.isInitialized = false;
        this.countdownInterval = null;
        
        // DOM Elements
        this.elements = {
            // Stats
            currentRound: document.getElementById('current-round'),
            nextRaceInfo: document.getElementById('next-race-info'),
            seasonStatus: document.getElementById('season-status'),
            timerDisplay: document.getElementById('timer-display'),
            
            // Tables
            raceResultsBody: document.getElementById('race-results-body'),
            qualiResultsBody: document.getElementById('quali-results-body'),
            sprintResultsBody: document.getElementById('sprint-results-body'),
            
            // Search elements
            searchInput: document.getElementById('search-input'),
            clearSearchBtn: document.getElementById('clear-search'),
            filterDriversBtn: document.getElementById('filter-drivers'),
            sortAzBtn: document.getElementById('sort-az'),
            shownCount: document.getElementById('shown-count'),
            totalCount: document.getElementById('total-count'),
            noResultsMessage: document.getElementById('no-results-message'),
            resultsCount: document.getElementById('results-count')
        };
        
        // Data storage
        this.driversData = [];
        this.raceResults = {};
        this.qualiResults = {};
        this.sprintResults = {};
        this.teamMasterMap = {};
        this.driverMovementData = null;
        this.totalRaces = 0;
        this.totalSprints = 0;
        this.completedRaces = 0;
        this.completedSprints = 0;
        
        // Current round for determining active team
        this.currentRound = 1;
        
        // Team colors from TeamMaster - map of team name to primary color (Column D)
        this.teamColors = {};
        
        // Driver movement data - this is our source of truth
        this.roundTeams = {}; // round -> { driver: team }
        
        // Search state
        this.searchQuery = '';
        this.currentSort = 'championship'; // Only championship sorting
        this.filteredResults = {
            race: [],
            quali: [],
            sprint: []
        };
        
        // Store championship positions for sorting (from race results only)
        this.championshipPositions = {};
    }

    /**
     * Initialize results page
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing results page...');
        
        try {
            // Load data
            await this.dataLoader.loadHomepageData();
            
            // Build team master map
            this.buildTeamMasterMap();
            
            // Get driver movement data
            this.driverMovementData = this.dataLoader.dataCache.driverMovement || { driverMovements: {}, roundTeams: {} };
            
            // Get the driver movement data - this is our source of truth
            this.roundTeams = this.dataLoader.dataCache.driverMovement?.roundTeams || {};
            
            // Load team colors from TeamMaster (like championship.js)
            this.loadTeamColors();
            
            console.log('ROUND TEAMS LOADED:', this.roundTeams);
            console.log('TEAM COLORS LOADED:', this.teamColors);
            
            // Determine current round based on completed races
            this.completedRaces = this.dataLoader.getCompletedRacesCount();
            this.currentRound = Math.max(1, this.completedRaces + 1);
            
            // Process data
            this.processResultsData();
            
            // Calculate championship positions (race only)
            this.calculateChampionshipPositions();
            
            // Update UI - set default sort button state
            this.updateSortButtonState();
            this.updateSeasonStats();
            this.updateAllResults();
            
            // Start countdown timer
            this.startCountdownTimer();
            
            // Add event listeners
            this.addEventListeners();
            
            this.isInitialized = true;
            console.log('Results page initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize results page:', error);
            this.updateWithFallbackData();
        }
    }

    /**
     * Build team master map for quick lookup
     */
    buildTeamMasterMap() {
        const teamMaster = this.dataLoader.dataCache.teamMaster || [];
        this.teamMasterMap = {};
        
        teamMaster.forEach(team => {
            if (team.id) {
                this.teamMasterMap[team.id] = team;
            }
        });
    }

    /**
     * Load team colors from TeamMaster sheet (like championship.js)
     * Team Name is in Column A, Primary Color is in Column D (index 3)
     */
    loadTeamColors() {
        const teamMaster = this.dataLoader.dataCache.teamMaster || [];
        
        teamMaster.forEach(team => {
            // Team name is in column A (name property)
            // Primary color is in column D (primaryColor property)
            if (team && team.name && team.primaryColor) {
                this.teamColors[team.name] = team.primaryColor;
                console.log(`Loaded color for ${team.name}: ${team.primaryColor}`);
            }
        });
        
        // Also add some common variations
        this.teamColors['Mclaren'] = this.teamColors['McLaren'] || '#ff8000';
        this.teamColors['Red Bull'] = this.teamColors['Red Bull Racing'] || '#0600ef';
        this.teamColors['Racing Bulls'] = this.teamColors['Visa Cash App RB'] || '#6699ff';
        this.teamColors['Alpine'] = this.teamColors['Alpine'] || '#0090ff';
        this.teamColors['Aston Martin'] = this.teamColors['Aston Martin Aramco'] || '#006f62';
        this.teamColors['Haas'] = this.teamColors['Haas F1 Team'] || '#b6babd';
        this.teamColors['Williams'] = this.teamColors['Williams'] || '#005aff';
        this.teamColors['Ferrari'] = this.teamColors['Scuderia Ferrari'] || '#dc0000';
        this.teamColors['Mercedes'] = this.teamColors['Mercedes-AMG Petronas'] || '#00d2be';
        this.teamColors['BMW'] = this.teamColors['BMW'] || '#1c69d4';
        this.teamColors['Porsche'] = this.teamColors['Porsche'] || '#d5001c';
        this.teamColors['Sauber'] = this.teamColors['Sauber'] || '#00e701';
        this.teamColors['Audi'] = this.teamColors['Audi'] || '#000000';
    }

    /**
     * Get team color for a team name (like championship.js)
     */
    getTeamColor(teamName) {
        return this.teamColors[teamName] || '#00f7ff'; // Default cyan if not found
    }

    /**
     * NEW: Get driver's current team based on driver movement (like championship.js)
     */
    getDriverCurrentTeam(driverUsername) {
        if (!this.roundTeams || Object.keys(this.roundTeams).length === 0) {
            // Fall back to teamCode from driver master if no movement data
            const driver = this.dataLoader.dataCache.driverMaster?.find(d => d.username === driverUsername);
            return driver?.teamCode || null;
        }
        
        // Find the most recent round <= current round that has a team for this driver
        for (let round = this.currentRound; round >= 1; round--) {
            const roundKey = `Round ${round}`;
            const team = this.roundTeams[roundKey]?.[driverUsername];
            if (team && team.trim() !== '') {
                return team;
            }
        }
        
        // No movement data found, fall back to teamCode from driver master
        const driver = this.dataLoader.dataCache.driverMaster?.find(d => d.username === driverUsername);
        return driver?.teamCode || null;
    }

    /**
     * Get team info including colors from team name
     */
    getTeamInfo(teamName) {
        if (!teamName) {
            return {
                name: 'Unknown Team',
                primaryColor: '#666666',
                secondaryColor: '#999999'
            };
        }
        
        const primaryColor = this.getTeamColor(teamName);
        
        return {
            name: teamName,
            primaryColor: primaryColor,
            secondaryColor: this.lightenColor(primaryColor, 30) // Generate secondary color from primary
        };
    }

    /**
     * Lighten a color for secondary color
     */
    lightenColor(color, percent) {
        if (!color.startsWith('#')) return '#ffffff';
        
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        
        return '#' + (0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1);
    }

    /**
     * Calculate championship positions from race results only
     * This mimics the logic from the championship page
     */
    calculateChampionshipPositions() {
        const raceResults = this.raceResults.results || [];
        
        // Clear existing positions
        this.championshipPositions = {};
        
        // Calculate points for each driver from RACES ONLY
        const driverPoints = {};
        
        raceResults.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverRounds = driverResult.results || {};
            
            let totalPoints = 0;
            
            // Calculate points from each completed race
            for (let i = 1; i <= this.completedRaces; i++) {
                const roundKey = `Round ${i}`;
                const result = driverRounds[roundKey] || '';
                
                if (result.trim() !== '') {
                    const positionMatch = result.match(/P(\d+)/i);
                    
                    if (positionMatch) {
                        const position = parseInt(positionMatch[1]);
                        const points = this.calculateRacePointsFromPosition(position);
                        totalPoints += points;
                        
                        // Add point for fastest lap if present
                        if (result.includes('Fastest Lap') || result.includes('FL')) {
                            totalPoints += 1;
                        }
                    }
                }
            }
            
            driverPoints[driverName] = totalPoints;
        });
        
        // Sort drivers by points (highest first)
        const sortedDrivers = Object.entries(driverPoints)
            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA);
        
        // Assign championship positions (handle ties by giving same position)
        let currentPosition = 1;
        let previousPoints = null;
        let positionIncrement = 1;
        
        for (let i = 0; i < sortedDrivers.length; i++) {
            const [driverName, points] = sortedDrivers[i];
            
            if (previousPoints !== null && points === previousPoints) {
                // Tie - same position
                this.championshipPositions[driverName] = currentPosition;
                positionIncrement++;
            } else {
                // New position
                currentPosition = positionIncrement;
                this.championshipPositions[driverName] = currentPosition;
                previousPoints = points;
                positionIncrement++;
            }
        }
        
        console.log('Calculated championship positions:', this.championshipPositions);
    }

    /**
     * Calculate race points from finishing position
     */
    calculateRacePointsFromPosition(position) {
        const pointsSystem = {
            'P1': 25, 'P2': 18, 'P3': 15, 'P4': 12, 'P5': 10,
            'P6': 8, 'P7': 6, 'P8': 4, 'P9': 2, 'P10': 1
        };
        
        const positionKey = `P${position}`;
        return pointsSystem[positionKey] || 0;
    }

    /**
     * Calculate sprint points from finishing position (HALF POINTS)
     */
    calculateSprintPointsFromPosition(position) {
        const racePoints = this.calculateRacePointsFromPosition(position);
        // SPRINTS ARE HALF POINTS - rounding down
        return Math.floor(racePoints / 2);
    }

    /**
     * Update sort button display state
     */
    updateSortButtonState() {
        if (!this.elements.sortAzBtn) return;
        
        // Always show championship sort (only option)
        this.elements.sortAzBtn.innerHTML = '<i class="fas fa-trophy"></i> CHAMP';
        this.elements.sortAzBtn.setAttribute('data-sort', 'championship');
        
        // Always keep the sort button active
        this.elements.sortAzBtn.classList.add('active');
    }

    /**
     * Process results data
     */
    processResultsData() {
        const dataCache = this.dataLoader.dataCache;
        
        // Get race calendar
        const calendar = dataCache.raceCalendar || [];
        this.totalRaces = calendar.length;
        
        // Get sprint calendar
        const sprintCalendar = dataCache.sprintCalendar || [];
        this.totalSprints = sprintCalendar.length;
        
        // Get completed races and sprints
        this.completedRaces = this.dataLoader.getCompletedRacesCount();
        this.completedSprints = dataCache.sprintResults?.completedSprints?.length || 0;
        
        // Get driver master
        const driverMaster = dataCache.driverMaster || [];
        
        // Get results
        this.raceResults = dataCache.raceResults || {};
        this.qualiResults = dataCache.qualifyingResults || {};
        this.sprintResults = dataCache.sprintResults || {};
        
        // Process drivers data using driver movement
        this.driversData = driverMaster.map(driver => {
            // Get current team from movement data
            const currentTeamName = this.getDriverCurrentTeam(driver.username) || driver.teamCode || 'Unknown';
            const teamColor = this.getTeamColor(currentTeamName);
            
            // Get championship position (from race results only)
            const championshipPosition = this.championshipPositions[driver.username] || 999;
            
            return {
                name: driver.username,
                teamCode: currentTeamName,
                teamDisplayName: currentTeamName,
                number: driver.number || '',
                nationality: driver.nationality || '',
                photo: driver.photo || '',
                teamColor: teamColor,
                championshipPosition: championshipPosition
            };
        });
        
        // Initialize filtered results with all data
        this.filteredResults.race = this.raceResults.results || [];
        this.filteredResults.quali = this.qualiResults.results || [];
        this.filteredResults.sprint = this.sprintResults.results || [];
    }

    /**
     * Update season stats
     */
    updateSeasonStats() {
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        
        if (this.elements.currentRound) {
            this.elements.currentRound.textContent = `ROUND ${this.completedRaces}/${this.totalRaces} | SPRINTS ${this.completedSprints}/${this.totalSprints}`;
        }
        
        // Update next race info
        if (this.elements.nextRaceInfo) {
            if (this.completedRaces === 0) {
                this.elements.nextRaceInfo.textContent = 'SEASON STARTING SOON';
            } else if (this.completedRaces >= this.totalRaces) {
                this.elements.nextRaceInfo.textContent = 'SEASON COMPLETED';
            } else {
                const nextRaceIndex = this.completedRaces;
                const nextRaceInfo = calendar[nextRaceIndex] || {};
                this.elements.nextRaceInfo.textContent = `${nextRaceInfo.name || 'TBD'} - ${nextRaceInfo.date || 'TBD'}`;
            }
        }
        
        // Update season status
        if (this.elements.seasonStatus) {
            let statusText = '';
            if (this.completedRaces === 0) {
                statusText = 'Season has not started yet. First race: ';
            } else if (this.completedRaces < this.totalRaces) {
                statusText = 'Season in progress. Next race: ';
            } else {
                statusText = 'Season completed. ';
            }
            
            const statusSpan = this.elements.seasonStatus.querySelector('span');
            if (statusSpan) {
                statusSpan.textContent = this.elements.nextRaceInfo.textContent;
            }
        }
    }

    /**
     * Update all results (applies search and sort)
     */
    updateAllResults() {
        this.applySearchFilter();
        this.updateResultsCount();
        this.updateRaceResults();
        this.updateQualiResults();
        this.updateSprintResults();
    }

    /**
     * Apply search filter to results
     */
    applySearchFilter() {
        const searchQuery = this.searchQuery.toLowerCase().trim();
        
        if (searchQuery === '') {
            // No search, show all results
            this.filteredResults.race = this.raceResults.results || [];
            this.filteredResults.quali = this.qualiResults.results || [];
            this.filteredResults.sprint = this.sprintResults.results || [];
        } else {
            // Filter results based on search query
            this.filteredResults.race = (this.raceResults.results || []).filter(result => {
                const driverInfo = this.driversData.find(d => d.name === result.driver) || {};
                const driverName = result.driver.toLowerCase();
                const teamName = driverInfo.teamDisplayName.toLowerCase();
                
                return driverName.includes(searchQuery) || teamName.includes(searchQuery);
            });
            
            this.filteredResults.quali = (this.qualiResults.results || []).filter(result => {
                const driverInfo = this.driversData.find(d => d.name === result.driver) || {};
                const driverName = result.driver.toLowerCase();
                const teamName = driverInfo.teamDisplayName.toLowerCase();
                
                return driverName.includes(searchQuery) || teamName.includes(searchQuery);
            });
            
            this.filteredResults.sprint = (this.sprintResults.results || []).filter(result => {
                const driverInfo = this.driversData.find(d => d.name === result.driver) || {};
                const driverName = result.driver.toLowerCase();
                const teamName = driverInfo.teamDisplayName.toLowerCase();
                
                return driverName.includes(searchQuery) || teamName.includes(searchQuery);
            });
        }
        
        // Apply sorting (always championship sort)
        this.applySorting();
    }

    /**
     * Apply sorting to filtered results - ALWAYS CHAMPIONSHIP SORT
     */
    applySorting() {
        // Always sort by championship position (race results only)
        const sortFunction = (a, b) => {
            const driverA = this.driversData.find(d => d.name === a.driver) || {};
            const driverB = this.driversData.find(d => d.name === b.driver) || {};
            
            // Championship position (lower number = better position)
            const posA = driverA.championshipPosition || 999;
            const posB = driverB.championshipPosition || 999;
            return posA - posB;
        };
        
        this.filteredResults.race.sort(sortFunction);
        this.filteredResults.quali.sort(sortFunction);
        this.filteredResults.sprint.sort(sortFunction);
    }

    /**
     * Update results count display
     */
    updateResultsCount() {
        const activeTab = document.querySelector('.tab-button.active');
        const tabId = activeTab ? activeTab.getAttribute('data-tab') : 'race';
        
        const filteredData = this.filteredResults[tabId];
        let totalData = 0;
        
        switch(tabId) {
            case 'race':
                totalData = (this.raceResults.results || []).length;
                break;
            case 'quali':
                totalData = (this.qualiResults.results || []).length;
                break;
            case 'sprint':
                totalData = (this.sprintResults.results || []).length;
                break;
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
     * Update race results
     */
    updateRaceResults() {
        if (!this.elements.raceResultsBody) return;
        
        const results = this.filteredResults.race;
        const completedRaces = this.completedRaces;
        
        // Clear previous content
        this.elements.raceResultsBody.innerHTML = '';
        
        if (results.length === 0) {
            return; // Let no results message handle this
        }
        
        // Create header row
        let headerHTML = `<div class="results-header-row">`;
        headerHTML += `<div class="results-name-header">DRIVER</div>`;
        headerHTML += `<div class="results-total-header">TEAM</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="round-header-cell">R${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.raceResultsBody.innerHTML = headerHTML;
        
        // Create results rows
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverInfo = this.driversData.find(d => d.name === driverName) || {};
            const driverRounds = driverResult.results || {};
            
            // Check if this row should be highlighted (matches search)
            const shouldHighlight = this.searchQuery !== '' && 
                (driverName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 driverInfo.teamDisplayName.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            let rowHTML = `<div class="results-data-row ${shouldHighlight ? 'highlight' : ''}">`;
            
            // Driver name column
            rowHTML += `
                <div class="results-driver-cell">
                    <div class="results-driver-number">${driverInfo.number || ''}</div>
                    <div class="results-driver-name" style="color: ${driverInfo.teamColor}">
                        ${driverName}
                    </div>
                </div>
            `;
            
            // Team column
            rowHTML += `<div class="results-team-cell">
                <div class="team-color-small" style="background: ${driverInfo.teamColor}; box-shadow: 0 0 5px ${driverInfo.teamColor};"></div>
                <div style="color: ${driverInfo.teamColor};">${driverInfo.teamDisplayName}</div>
            </div>`;
            
            // Round columns
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const result = driverRounds[roundKey] || '';
                
                if (i <= completedRaces && result.trim() !== '') {
                    // Parse position and fastest lap
                    const hasFastestLap = result.includes('Fastest Lap') || result.includes('FL');
                    const positionMatch = result.match(/P(\d+)/i);
                    
                    let positionClass = 'position-regular';
                    let displayText = result;
                    
                    // Determine position class
                    if (positionMatch) {
                        const position = parseInt(positionMatch[1]);
                        if (position === 1) positionClass = 'position-gold';
                        else if (position === 2) positionClass = 'position-silver';
                        else if (position === 3) positionClass = 'position-bronze';
                        
                        // Extract just the position for display - NO "FL" TEXT
                        displayText = `P${position}`;
                    } else if (result.includes('DNF')) {
                        positionClass = 'result-dnf';
                        displayText = 'DNF';
                    } else if (result.includes('DNS')) {
                        positionClass = 'result-dns';
                        displayText = 'DNS';
                    } else if (result.includes('DSQ')) {
                        positionClass = 'result-dsq';
                        displayText = 'DSQ';
                    }
                    
                    // Add fastest lap glow class (purple glow only, no text)
                    const fastestLapClass = hasFastestLap ? 'fastest-lap-glow' : '';
                    
                    rowHTML += `<div class="results-round-cell ${fastestLapClass}">
                        <div class="${positionClass}">
                            ${displayText}
                        </div>
                    </div>`;
                } else {
                    rowHTML += `<div class="results-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            this.elements.raceResultsBody.innerHTML += rowHTML;
        });
    }

    /**
     * Update qualifying results
     */
    updateQualiResults() {
        if (!this.elements.qualiResultsBody) return;
        
        const results = this.filteredResults.quali;
        const completedRaces = this.completedRaces;
        
        // Clear previous content
        this.elements.qualiResultsBody.innerHTML = '';
        
        if (results.length === 0) {
            return; // Let no results message handle this
        }
        
        // Create header row
        let headerHTML = `<div class="results-header-row">`;
        headerHTML += `<div class="results-name-header">DRIVER</div>`;
        headerHTML += `<div class="results-total-header">TEAM</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="round-header-cell">R${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.qualiResultsBody.innerHTML = headerHTML;
        
        // Create results rows
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverInfo = this.driversData.find(d => d.name === driverName) || {};
            const driverRounds = driverResult.results || {};
            
            // Check if this row should be highlighted (matches search)
            const shouldHighlight = this.searchQuery !== '' && 
                (driverName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 driverInfo.teamDisplayName.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            let rowHTML = `<div class="results-data-row ${shouldHighlight ? 'highlight' : ''}">`;
            
            // Driver name column
            rowHTML += `
                <div class="results-driver-cell">
                    <div class="results-driver-number">${driverInfo.number || ''}</div>
                    <div class="results-driver-name" style="color: ${driverInfo.teamColor}">
                        ${driverName}
                    </div>
                </div>
            `;
            
            // Team column
            rowHTML += `<div class="results-team-cell">
                <div class="team-color-small" style="background: ${driverInfo.teamColor}; box-shadow: 0 0 5px ${driverInfo.teamColor};"></div>
                <div style="color: ${driverInfo.teamColor};">${driverInfo.teamDisplayName}</div>
            </div>`;
            
            // Round columns
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const result = driverRounds[roundKey] || '';
                
                if (i <= completedRaces && result.trim() !== '') {
                    const positionMatch = result.match(/P(\d+)/i);
                    
                    let positionClass = 'position-regular';
                    let displayText = result;
                    
                    // Determine position class
                    if (positionMatch) {
                        const position = parseInt(positionMatch[1]);
                        if (position === 1) positionClass = 'position-gold';
                        else if (position === 2) positionClass = 'position-silver';
                        else if (position === 3) positionClass = 'position-bronze';
                    } else if (result.includes('DNF') || result.includes('DNS') || result.includes('DSQ')) {
                        positionClass = 'result-dnf';
                        if (result.includes('DNF')) displayText = 'DNF';
                        else if (result.includes('DNS')) displayText = 'DNS';
                        else if (result.includes('DSQ')) displayText = 'DSQ';
                    }
                    
                    rowHTML += `<div class="results-round-cell">
                        <div class="${positionClass}">
                            ${displayText}
                        </div>
                    </div>`;
                } else {
                    rowHTML += `<div class="results-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            this.elements.qualiResultsBody.innerHTML += rowHTML;
        });
    }

    /**
     * Update sprint results
     */
    updateSprintResults() {
        if (!this.elements.sprintResultsBody) return;
        
        const results = this.filteredResults.sprint;
        const completedSprints = this.completedSprints;
        
        // Clear previous content
        this.elements.sprintResultsBody.innerHTML = '';
        
        if (results.length === 0) {
            return; // Let no results message handle this
        }
        
        // Create header row
        let headerHTML = `<div class="results-header-row">`;
        headerHTML += `<div class="results-name-header">DRIVER</div>`;
        headerHTML += `<div class="results-total-header">TEAM</div>`;
        
        for (let i = 1; i <= this.totalSprints; i++) {
            headerHTML += `<div class="round-header-cell">S${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.sprintResultsBody.innerHTML = headerHTML;
        
        // Create results rows
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverInfo = this.driversData.find(d => d.name === driverName) || {};
            const driverRounds = driverResult.results || {};
            
            // Check if this row should be highlighted (matches search)
            const shouldHighlight = this.searchQuery !== '' && 
                (driverName.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 driverInfo.teamDisplayName.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            let rowHTML = `<div class="results-data-row ${shouldHighlight ? 'highlight' : ''}">`;
            
            // Driver name column
            rowHTML += `
                <div class="results-driver-cell">
                    <div class="results-driver-number">${driverInfo.number || ''}</div>
                    <div class="results-driver-name" style="color: ${driverInfo.teamColor}">
                        ${driverName}
                    </div>
                </div>
            `;
            
            // Team column
            rowHTML += `<div class="results-team-cell">
                <div class="team-color-small" style="background: ${driverInfo.teamColor}; box-shadow: 0 0 5px ${driverInfo.teamColor};"></div>
                <div style="color: ${driverInfo.teamColor};">${driverInfo.teamDisplayName}</div>
            </div>`;
            
            // Sprint columns (note: sprint results use "Sprint X" keys, not "Round X")
            for (let i = 1; i <= this.totalSprints; i++) {
                const sprintKey = `Sprint ${i}`;
                const result = driverRounds[sprintKey] || '';
                
                if (i <= completedSprints && result.trim() !== '') {
                    // Parse position
                    const positionMatch = result.match(/P(\d+)/i);
                    
                    let positionClass = 'position-regular';
                    let displayText = result;
                    
                    // Determine position class
                    if (positionMatch) {
                        const position = parseInt(positionMatch[1]);
                        if (position === 1) positionClass = 'position-gold';
                        else if (position === 2) positionClass = 'position-silver';
                        else if (position === 3) positionClass = 'position-bronze';
                        
                        displayText = `P${position}`;
                    } else if (result.includes('DNF')) {
                        positionClass = 'result-dnf';
                        displayText = 'DNF';
                    } else if (result.includes('DNS')) {
                        positionClass = 'result-dns';
                        displayText = 'DNS';
                    } else if (result.includes('DSQ')) {
                        positionClass = 'result-dsq';
                        displayText = 'DSQ';
                    }
                    
                    // NO FASTEST LAP IN SPRINTS (sprints don't have fastest lap points)
                    rowHTML += `<div class="results-round-cell">
                        <div class="${positionClass}">
                            ${displayText}
                        </div>
                    </div>`;
                } else {
                    rowHTML += `<div class="results-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            this.elements.sprintResultsBody.innerHTML += rowHTML;
        });
    }

    /**
     * Start countdown timer for next race
     */
    startCountdownTimer() {
        const calendar = this.dataLoader.dataCache.raceCalendar || [];
        const completedRaces = this.completedRaces;
        
        if (completedRaces === 0 && calendar.length > 0) {
            const firstRace = calendar[0];
            this.updateCountdown(firstRace.date);
        } else if (completedRaces < calendar.length && calendar.length > 0) {
            const nextRace = calendar[completedRaces];
            this.updateCountdown(nextRace.date);
        } else {
            this.updateCompletedSeasonDisplay();
        }
    }

    /**
     * Update countdown display
     */
    updateCountdown(dateStr) {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }
        
        let targetDate;
        
        try {
            const formattedDateStr = this.dataLoader.formatDate(dateStr);
            
            if (formattedDateStr === 'TBD' || formattedDateStr === 'Coming Soon') {
                this.setStaticTexts('DATE TBD', 'DATE TBD');
                return;
            }
            
            targetDate = new Date(formattedDateStr);
            
            if (isNaN(targetDate.getTime())) {
                throw new Error('Invalid date');
            }
            
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
            
            const formattedHours = hours.toString().padStart(2, '0');
            const formattedMinutes = minutes.toString().padStart(2, '0');
            const formattedSeconds = seconds.toString().padStart(2, '0');
            
            const countdownStr = `${days}d ${formattedHours}h ${formattedMinutes}m ${formattedSeconds}s`;
            
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = countdownStr;
            }
            if (this.elements.nextRaceInfo) {
                this.elements.nextRaceInfo.textContent = countdownStr;
            }
            
            const statusSpan = this.elements.seasonStatus?.querySelector('span');
            if (statusSpan) {
                statusSpan.textContent = countdownStr;
            }
        };
        
        updateCountdownDisplay();
        this.countdownInterval = setInterval(updateCountdownDisplay, 1000);
    }

    /**
     * Helper: Set static text
     */
    setStaticTexts(headerText, raceInfoText) {
        if (this.elements.timerDisplay) {
            this.elements.timerDisplay.textContent = headerText;
        }
        if (this.elements.nextRaceInfo) {
            this.elements.nextRaceInfo.textContent = raceInfoText;
        }
        
        const statusSpan = this.elements.seasonStatus?.querySelector('span');
        if (statusSpan) {
            statusSpan.textContent = raceInfoText;
        }
    }

    /**
     * Update display for completed season
     */
    updateCompletedSeasonDisplay() {
        this.setStaticTexts('SEASON COMPLETED', 'SEASON COMPLETED');
        
        if (this.elements.seasonStatus) {
            this.elements.seasonStatus.textContent = 'Season completed.';
        }
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        // Tab switching
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
        
        // Search input
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.updateClearButton();
                this.updateAllResults();
            });
            
            // Add debouncing for better performance
            let searchTimeout;
            this.elements.searchInput.addEventListener('keyup', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchQuery = e.target.value;
                    this.updateAllResults();
                }, 300);
            });
        }
        
        // Clear search button
        if (this.elements.clearSearchBtn) {
            this.elements.clearSearchBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.elements.searchInput.value = '';
                this.updateClearButton();
                this.updateAllResults();
                this.elements.searchInput.focus();
            });
        }
        
        // Sort button - Static, always championship sort
        if (this.elements.sortAzBtn) {
            // Make the button non-clickable (or you can remove the event listener)
            // For now, just show it as always active championship sort
            this.elements.sortAzBtn.style.cursor = 'default';
            this.elements.sortAzBtn.title = 'Sorted by championship position';
            
            // Optional: Remove click handler if you don't want it to do anything
            this.elements.sortAzBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Just refresh the sort to ensure it's correct
                this.calculateChampionshipPositions();
                this.updateAllResults();
            });
        }
        
        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = '🔄';
        refreshBtn.className = 'refresh-btn';
        refreshBtn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:1000;background:var(--primary);color:white;border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;';
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
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
        
        tabContents.forEach(content => {
            if (content.id === `${tabId}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // Update results count for the active tab
        this.updateResultsCount();
    }

    /**
     * Update with fallback data
     */
    updateWithFallbackData() {
        console.log('Using fallback data for results');
        
        // Load team colors for fallback
        this.loadTeamColors();
        
        // Mock championship positions for fallback data
        this.championshipPositions = {
            'Driver 1': 1,
            'Driver 2': 2,
            'Driver 3': 3,
            'Driver 4': 4,
            'Driver 5': 5
        };
        
        // Mock data with team colors
        this.driversData = [
            { name: 'Driver 1', teamDisplayName: 'Mercedes', number: '44', teamColor: this.getTeamColor('Mercedes'), championshipPosition: 1 },
            { name: 'Driver 2', teamDisplayName: 'Ferrari', number: '63', teamColor: this.getTeamColor('Ferrari'), championshipPosition: 2 },
            { name: 'Driver 3', teamDisplayName: 'Red Bull', number: '16', teamColor: this.getTeamColor('Red Bull'), championshipPosition: 3 },
            { name: 'Driver 4', teamDisplayName: 'McLaren', number: '33', teamColor: this.getTeamColor('McLaren'), championshipPosition: 4 },
            { name: 'Driver 5', teamDisplayName: 'Alpine', number: '31', teamColor: this.getTeamColor('Alpine'), championshipPosition: 5 }
        ];
        
        this.totalRaces = 10;
        this.totalSprints = 5;
        this.completedRaces = 5;
        this.completedSprints = 3;
        
        // Generate mock results
        this.generateMockResults();
        
        // Set default sort button state
        this.updateSortButtonState();
        
        this.updateSeasonStats();
        this.updateAllResults();
        
        // Start countdown for fallback data
        this.updateCountdown('2024-12-31');
    }

    /**
     * Generate mock results for fallback data
     */
    generateMockResults() {
        // Mock race results - NO "FL" text, just purple glow
        this.raceResults = {
            results: [
                { driver: 'Driver 1', results: { 
                    'Round 1': 'P1 (Fastest Lap)', 
                    'Round 2': 'P2', 
                    'Round 3': 'P3', 
                    'Round 4': 'P5', 
                    'Round 5': 'DNF' 
                }},
                { driver: 'Driver 2', results: { 
                    'Round 1': 'P2', 
                    'Round 2': 'P1 (Fastest Lap)', 
                    'Round 3': 'P4', 
                    'Round 4': 'P3', 
                    'Round 5': 'P2' 
                }},
                { driver: 'Driver 3', results: { 
                    'Round 1': 'P3', 
                    'Round 2': 'P3', 
                    'Round 3': 'P1', 
                    'Round 4': 'P4 (Fastest Lap)', 
                    'Round 5': 'P1' 
                }},
                { driver: 'Driver 4', results: { 
                    'Round 1': 'P4', 
                    'Round 2': 'P5', 
                    'Round 3': 'P2 (Fastest Lap)', 
                    'Round 4': 'P6', 
                    'Round 5': 'P3' 
                }},
                { driver: 'Driver 5', results: { 
                    'Round 1': 'P5 (Fastest Lap)', 
                    'Round 2': 'P4', 
                    'Round 3': 'P5', 
                    'Round 4': 'P2', 
                    'Round 5': 'P4' 
                }}
            ]
        };
        
        // Mock qualifying results
        this.qualiResults = {
            results: [
                { driver: 'Driver 1', results: { 
                    'Round 1': 'P1', 
                    'Round 2': 'P2', 
                    'Round 3': 'P3', 
                    'Round 4': 'P1', 
                    'Round 5': 'P2' 
                }},
                { driver: 'Driver 2', results: { 
                    'Round 1': 'P2', 
                    'Round 2': 'P1', 
                    'Round 3': 'P4', 
                    'Round 4': 'P3', 
                    'Round 5': 'P1' 
                }},
                { driver: 'Driver 3', results: { 
                    'Round 1': 'P3', 
                    'Round 2': 'P3', 
                    'Round 3': 'P1', 
                    'Round 4': 'P2', 
                    'Round 5': 'P3' 
                }},
                { driver: 'Driver 4', results: { 
                    'Round 1': 'P4', 
                    'Round 2': 'P5', 
                    'Round 3': 'P2', 
                    'Round 4': 'P4', 
                    'Round 5': 'P4' 
                }},
                { driver: 'Driver 5', results: { 
                    'Round 1': 'P5', 
                    'Round 2': 'P4', 
                    'Round 3': 'P5', 
                    'Round 4': 'P5', 
                    'Round 5': 'P5' 
                }}
            ]
        };
        
        // Mock sprint results (NO fastest lap in sprints)
        this.sprintResults = {
            results: [
                { driver: 'Driver 1', results: { 
                    'Sprint 1': 'P1', 
                    'Sprint 2': 'P2', 
                    'Sprint 3': 'P3'
                }},
                { driver: 'Driver 2', results: { 
                    'Sprint 1': 'P2', 
                    'Sprint 2': 'P1', 
                    'Sprint 3': 'DNF'
                }},
                { driver: 'Driver 3', results: { 
                    'Sprint 1': 'P3', 
                    'Sprint 2': 'P3', 
                    'Sprint 3': 'P1'
                }},
                { driver: 'Driver 4', results: { 
                    'Sprint 1': 'P4', 
                    'Sprint 2': 'P5', 
                    'Sprint 3': 'P2'
                }},
                { driver: 'Driver 5', results: { 
                    'Sprint 1': 'P5', 
                    'Sprint 2': 'P4', 
                    'Sprint 3': 'P4'
                }}
            ]
        };
        
        // Initialize filtered results
        this.filteredResults.race = this.raceResults.results;
        this.filteredResults.quali = this.qualiResults.results;
        this.filteredResults.sprint = this.sprintResults.results;
    }

    /**
     * Refresh data
     */
    async refreshData() {
        console.log('Refreshing results data...');
        this.dataLoader.dataCache = {};
        await this.initialize();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const resultsManager = new ResultsManager();
    resultsManager.initialize();
});