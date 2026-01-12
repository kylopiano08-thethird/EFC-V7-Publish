
/**
 * Championship Page Script
 * FIXED VERSION - Properly references global data loader
 * ADDED GRAPH VIEW FUNCTIONALITY
 * FIXED: Points progression calculation
 * FIXED: Sprint points integration (just add to race points)
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
            
            // Graph controls
            graphControls: document.getElementById('graph-controls'),
            graphTypeSelect: document.getElementById('graph-type-select'),
            toggleAllDriversBtn: document.getElementById('toggle-all-drivers'),
            resetGraphBtn: document.getElementById('reset-graph'),
            
            // Tables
            driversStandingsBody: document.getElementById('drivers-standings-body'),
            constructorsStandingsBody: document.getElementById('constructors-standings-body'),
            driversProgressionBody: document.getElementById('drivers-progression-body'),
            constructorsProgressionBody: document.getElementById('constructors-progression-body'),
            driversRoundsHeader: document.getElementById('drivers-rounds-header'),
            constructorsRoundsHeader: document.getElementById('constructors-rounds-header'),
            
            // Graph containers
            driversChartCanvas: document.getElementById('drivers-chart'),
            constructorsChartCanvas: document.getElementById('constructors-chart'),
            driversLegend: document.getElementById('drivers-legend'),
            constructorsLegend: document.getElementById('constructors-legend'),
            
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
        this.sprintResults = {};
        this.driverRoundPoints = {}; // Combined race + sprint points per round
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        this.completedRaces = 0;
        this.totalRaces = 0;
        this.teamMasterMap = {};
        
        // Store cumulative points for progression
        this.driverCumulativePoints = {};
        this.constructorCumulativePoints = {};
        
        // Search state
        this.searchQuery = '';
        
        // Current active tab and view
        this.activeTab = 'drivers';
        this.activeView = 'current';
        
        // Chart instances
        this.driversChart = null;
        this.constructorsChart = null;
        
        // Graph settings
        this.graphSettings = {
            drivers: {
                type: 'line',
                hiddenData: new Set(), // Track hidden drivers/teams
                showAll: true
            },
            constructors: {
                type: 'line',
                hiddenData: new Set(),
                showAll: true
            }
        };
        
        // Color palette for graphs (extended for many drivers)
        this.colorPalette = [
            '#00f7ff', '#9b30ff', '#ff0080', '#ff8000', '#00ff80',
            '#ffff00', '#0080ff', '#ff4000', '#00ccff', '#cc00ff',
            '#ffcc00', '#00ffcc', '#ccff00', '#ff00cc', '#00cc80',
            '#ff8040', '#4080ff', '#ff4080', '#80ff00', '#0080cc'
        ];
        
        // Track driver/constructor colors
        this.driverColors = {};
        this.constructorColors = {};
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
            
            // Parse race and sprint results for progression
            this.parseRaceResultsImproved();
            
            // Calculate cumulative points for progression and graphs
            this.calculateCumulativePoints();
            
            // Update UI
            this.updateChampionshipStats();
            this.updateAllStandings();
            this.updateProgressionViews();
            
            // Initialize graphs
            this.initializeGraphs();
            
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
        
        // Get sprint results data (just for reference)
        this.sprintResults = dataCache.sprintResults || {};
        
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
     * Parse race results to get round-by-round points - IMPROVED VERSION with sprint points
     */
    parseRaceResultsImproved() {
        const dataCache = this.dataLoader.dataCache;
        const raceResults = dataCache.raceResults || {};
        const results = raceResults.results || [];
        
        // Get sprint results to add sprint points to race points
        const sprintResultsData = dataCache.sprintResults || {};
        const sprintResults = sprintResultsData.results || [];
        
        console.log('Parsing race and sprint results for progression:', results);
        
        // Initialize data structures
        this.driverRoundPoints = {}; // Will contain race + sprint points per round
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        
        // First, initialize constructor points for all teams
        this.constructorsData.forEach(constructor => {
            if (constructor && constructor.displayName) {
                this.constructorRoundPoints[constructor.displayName] = {};
                // Initialize all rounds to 0
                for (let i = 1; i <= this.totalRaces; i++) {
                    this.constructorRoundPoints[constructor.displayName][`Round ${i}`] = 0;
                }
            }
        });
        
        // Also initialize by team code for fallback
        this.constructorsData.forEach(constructor => {
            if (constructor && constructor.teamCode) {
                if (!this.constructorRoundPoints[constructor.teamCode]) {
                    this.constructorRoundPoints[constructor.teamCode] = {};
                    for (let i = 1; i <= this.totalRaces; i++) {
                        this.constructorRoundPoints[constructor.teamCode][`Round ${i}`] = 0;
                    }
                }
            }
        });
        
        // First parse race results
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverRounds = driverResult.results || {};
            
            // Get driver info to find their team
            const driverInfo = this.driversData.find(d => d.name === driverName);
            if (!driverInfo) {
                console.log(`Driver ${driverName} not found in driversData`);
                return;
            }
            
            const teamDisplayName = driverInfo.teamDisplayName;
            const teamCode = driverInfo.teamCode;
            
            console.log(`Processing driver: ${driverName}, Team: ${teamDisplayName} (${teamCode})`);
            
            // Initialize driver structures
            if (!this.driverRoundPoints[driverName]) {
                this.driverRoundPoints[driverName] = {};
                this.driverRoundFastestLaps[driverName] = {};
            }
            
            // Process each round
            Object.entries(driverRounds).forEach(([roundKey, roundResult]) => {
                if (!roundResult || roundResult.trim() === '' || roundResult === 'DNS' || roundResult === 'DNF') {
                    return;
                }
                
                // Extract round number from key (e.g., "Round 1" -> 1)
                const roundMatch = roundKey.match(/Round\s*(\d+)/i);
                if (!roundMatch) return;
                
                const roundNum = parseInt(roundMatch[1]);
                if (roundNum > this.totalRaces) return;
                
                // Calculate race points for this round
                let racePoints = 0;
                let hasFastestLap = false;
                
                // Check for fastest lap
                if (roundResult.includes('Fastest Lap') || roundResult.includes('FL')) {
                    hasFastestLap = true;
                }
                
                // Extract position
                const positionMatch = roundResult.match(/P(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    racePoints = this.calculatePointsFromPosition(position);
                    
                    // Add fastest lap point
                    if (hasFastestLap && racePoints > 0) {
                        racePoints += 1;
                    }
                }
                
                // Also check for DNF with position (e.g., "P5 DNF")
                if (roundResult.includes('DNF') && positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    // Check if position qualifies for points before DNF
                    racePoints = this.calculatePointsFromPosition(position);
                }
                
                // Store race points (we'll add sprint points below)
                this.driverRoundPoints[driverName][roundKey] = racePoints;
                this.driverRoundFastestLaps[driverName][roundKey] = hasFastestLap;
                
                console.log(`${driverName} - ${roundKey}: ${roundResult} = ${racePoints} race points`);
                
                // Add race points to constructor points
                this.addToConstructorPoints(teamDisplayName, teamCode, roundKey, racePoints);
            });
        });
        
        // Now parse sprint results and add them to the corresponding round
        sprintResults.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverSprints = driverResult.results || {};
            
            // Get driver info to find their team
            const driverInfo = this.driversData.find(d => d.name === driverName);
            if (!driverInfo) {
                console.log(`Driver ${driverName} not found in driversData for sprint results`);
                return;
            }
            
            const teamDisplayName = driverInfo.teamDisplayName;
            const teamCode = driverInfo.teamCode;
            
            console.log(`Processing sprint results for driver: ${driverName}`);
            
            // Process each sprint
            Object.entries(driverSprints).forEach(([sprintKey, sprintResult]) => {
                if (!sprintResult || sprintResult.trim() === '' || sprintResult === 'DNS' || sprintResult === 'DNF') {
                    return;
                }
                
                // Extract sprint number from key (e.g., "Sprint 1" -> 1)
                const sprintMatch = sprintKey.match(/Sprint\s*(\d+)/i);
                if (!sprintMatch) return;
                
                const sprintNum = parseInt(sprintMatch[1]);
                
                // Calculate sprint points
                let sprintPoints = 0;
                let hasFastestLap = false;
                
                // Check for fastest lap
                if (sprintResult.includes('Fastest Lap') || sprintResult.includes('FL')) {
                    hasFastestLap = true;
                }
                
                // Extract position
                const positionMatch = sprintResult.match(/P(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    sprintPoints = this.calculateSprintPointsFromPosition(position);
                    
                    // Add fastest lap point (if applicable for sprints)
                    if (hasFastestLap && sprintPoints > 0) {
                        sprintPoints += 1;
                    }
                }
                
                // Also check for DNF with position
                if (sprintResult.includes('DNF') && positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    sprintPoints = this.calculateSprintPointsFromPosition(position);
                }
                
                // Add sprint points to the corresponding round
                // Sprint 1 points get added to Round 1 total, etc.
                const roundKey = `Round ${sprintNum}`;
                
                if (this.driverRoundPoints[driverName] && this.driverRoundPoints[driverName][roundKey] !== undefined) {
                    this.driverRoundPoints[driverName][roundKey] += sprintPoints;
                    console.log(`${driverName} - ${sprintKey}: ${sprintResult} = ${sprintPoints} sprint points added to ${roundKey}`);
                } else if (sprintNum <= this.totalRaces) {
                    // Initialize if not exists
                    if (!this.driverRoundPoints[driverName]) {
                        this.driverRoundPoints[driverName] = {};
                    }
                    this.driverRoundPoints[driverName][roundKey] = sprintPoints;
                    console.log(`${driverName} - ${sprintKey}: ${sprintResult} = ${sprintPoints} sprint points (new entry for ${roundKey})`);
                }
                
                // Add sprint points to constructor points
                this.addToConstructorPoints(teamDisplayName, teamCode, roundKey, sprintPoints);
            });
        });
        
        // Debug: Log parsed data
        console.log('Parsed driver total points (race + sprint):', this.driverRoundPoints);
        console.log('Parsed constructor total points (race + sprint):', this.constructorRoundPoints);
        
        // Calculate total points from round points for verification
        Object.entries(this.driverRoundPoints).forEach(([driverName, rounds]) => {
            const totalFromRounds = Object.values(rounds).reduce((sum, points) => sum + (points || 0), 0);
            const driverData = this.driversData.find(d => d.name === driverName);
            if (driverData) {
                console.log(`${driverName}: Standings points = ${driverData.points}, Sum of round points = ${totalFromRounds}`);
            }
        });
    }

    /**
     * Add points to constructor points with multiple fallback options
     */
    addToConstructorPoints(teamDisplayName, teamCode, roundKey, points) {
        if (!teamDisplayName || teamDisplayName === 'No Team' || !points) {
            return;
        }
        
        // Try exact match first
        if (this.constructorRoundPoints[teamDisplayName]) {
            this.constructorRoundPoints[teamDisplayName][roundKey] = 
                (this.constructorRoundPoints[teamDisplayName][roundKey] || 0) + points;
        }
        // Try team code
        else if (teamCode && this.constructorRoundPoints[teamCode]) {
            this.constructorRoundPoints[teamCode][roundKey] = 
                (this.constructorRoundPoints[teamCode][roundKey] || 0) + points;
        }
        // Try to find by partial match
        else {
            const matchingKey = Object.keys(this.constructorRoundPoints).find(key => 
                key === teamDisplayName || 
                key.includes(teamDisplayName) || 
                teamDisplayName.includes(key)
            );
            
            if (matchingKey) {
                this.constructorRoundPoints[matchingKey][roundKey] = 
                    (this.constructorRoundPoints[matchingKey][roundKey] || 0) + points;
            }
        }
    }

    /**
     * Calculate sprint points from finishing position
     */
    calculateSprintPointsFromPosition(position) {
        // Sprint points system (typically fewer points than races)
        const sprintPoints = {
            1: 8, 2: 7, 3: 6, 4: 5, 5: 4,
            6: 3, 7: 2, 8: 1
        };
        return sprintPoints[position] || 0;
    }

    /**
     * Calculate cumulative points for progression and graphs
     */
    calculateCumulativePoints() {
        console.log('Calculating cumulative points...');
        
        // Initialize cumulative points structures
        this.driverCumulativePoints = {};
        this.constructorCumulativePoints = {};
        
        // Calculate cumulative points for each driver
        this.driversData.forEach(driver => {
            const driverName = driver.name;
            this.driverCumulativePoints[driverName] = {};
            
            let cumulative = 0;
            
            // Add initial point at round 0
            this.driverCumulativePoints[driverName][0] = 0;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const roundPoints = this.driverRoundPoints[driverName]?.[roundKey] || 0;
                
                if (i <= this.completedRaces) {
                    cumulative += roundPoints;
                }
                
                // Store cumulative points up to this round
                this.driverCumulativePoints[driverName][i] = i <= this.completedRaces ? cumulative : null;
            }
            
            console.log(`${driverName} cumulative:`, this.driverCumulativePoints[driverName]);
        });
        
        // Calculate cumulative points for each constructor
        this.constructorsData.forEach(constructor => {
            const teamName = constructor.displayName;
            this.constructorCumulativePoints[teamName] = {};
            
            // Try to find the constructor's points data
            let constructorRounds = this.constructorRoundPoints[teamName];
            
            // If not found by display name, try team code
            if (!constructorRounds && constructor.teamCode) {
                constructorRounds = this.constructorRoundPoints[constructor.teamCode];
            }
            
            // If still not found, try to find by partial match
            if (!constructorRounds) {
                const matchingKey = Object.keys(this.constructorRoundPoints).find(key => 
                    key === teamName || 
                    key.includes(teamName) || 
                    teamName.includes(key)
                );
                if (matchingKey) {
                    constructorRounds = this.constructorRoundPoints[matchingKey];
                }
            }
            
            let cumulative = 0;
            
            // Add initial point at round 0
            this.constructorCumulativePoints[teamName][0] = 0;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const roundPoints = constructorRounds?.[roundKey] || 0;
                
                if (i <= this.completedRaces) {
                    cumulative += roundPoints;
                }
                
                // Store cumulative points up to this round
                this.constructorCumulativePoints[teamName][i] = i <= this.completedRaces ? cumulative : null;
            }
            
            console.log(`${teamName} cumulative:`, this.constructorCumulativePoints[teamName]);
        });
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
        
        // Update graphs if active view is graph
        if (this.activeView === 'graph') {
            this.updateGraphs();
        }
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
            
            const statusSpan = this.elements.championshipStatus?.querySelector('span');
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
     * Update drivers progression view - FIXED: Uses cumulative points
     */
    updateDriversProgression() {
        if (!this.elements.driversProgressionBody || !this.elements.driversRoundsHeader) return;
        
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
        
        // Add round headers (R1, R2, etc.)
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
            const cumulativePoints = this.driverCumulativePoints[driverName] || {};
            
            let rowHTML = `<div class="progression-data-row">`;
            
            // Driver name column
            rowHTML += `
                <div class="progression-driver-cell">
                    <div class="progression-driver-number">${driver.number || ''}</div>
                    <div class="progression-driver-name" style="color: ${teamColor}">${driver.name}</div>
                </div>
            `;
            
            // Total points column (show actual total from standings)
            rowHTML += `<div class="progression-total-cell">${driver.points}</div>`;
            
            // Round columns - show cumulative points after each round (race + sprint)
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const points = roundPoints[roundKey] || 0; // Race + sprint points
                const cumulative = cumulativePoints[i];
                const hasFastestLap = fastestLaps[roundKey] || false;
                
                if (i <= this.completedRaces && cumulative !== undefined && cumulative !== null) {
                    // Determine point class based on round points (race + sprint)
                    let pointClass = 'driver-regular';
                    const racePoints = points; // This includes sprint points too
                    
                    // We'll just use regular styling since points now include sprints
                    // But we can still show fastest lap indicator
                    const fastestLapClass = hasFastestLap ? 'has-fastest-lap' : '';
                    
                    rowHTML += `<div class="progression-round-cell ${fastestLapClass}">
                        <div class="round-points ${pointClass} ${fastestLapClass}">
                            ${cumulative}
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
     * Update constructors progression view - FIXED: Uses cumulative points
     */
    updateConstructorsProgression() {
        if (!this.elements.constructorsProgressionBody || !this.elements.constructorsRoundsHeader) return;
        
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
        
        // Add round headers
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="progression-round-header">R${i}</div>`;
        }
        
        headerHTML += `</div>`;
        
        this.elements.constructorsProgressionBody.innerHTML = headerHTML;
        
        // Create data rows for filtered constructors
        constructors.forEach(constructor => {
            const teamName = constructor.displayName;
            const teamColor = constructor.primaryColor;
            const cumulativePoints = this.constructorCumulativePoints[teamName] || {};
            
            let rowHTML = `<div class="progression-data-row">`;
            
            // Team name column
            rowHTML += `<div class="progression-team-cell">
                <div class="progression-driver-name" style="color: ${teamColor}">${teamName}</div>
            </div>`;
            
            // Total points column
            rowHTML += `<div class="progression-total-cell">${constructor.points}</div>`;
            
            // Round columns - show cumulative points after each round
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                
                if (i <= this.completedRaces && cumulative !== undefined && cumulative !== null) {
                    rowHTML += `<div class="progression-round-cell">
                        <div class="round-points constructor-regular">
                            ${cumulative}
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
     * Initialize graphs
     */
    initializeGraphs() {
        // Remove area and bar chart options from select
        if (this.elements.graphTypeSelect) {
            // Keep only line chart option
            this.elements.graphTypeSelect.innerHTML = '<option value="line">Line Chart</option>';
        }
        
        // Assign colors to drivers who have points
        this.driversData.forEach((driver, index) => {
            if (driver.points > 0) { // Only assign colors to drivers with points
                const teamColor = this.getTeamColor(driver.teamCode);
                // Use team color if available, otherwise use palette
                this.driverColors[driver.name] = teamColor !== '#00f7ff' ? teamColor : 
                    this.colorPalette[index % this.colorPalette.length];
            }
        });
        
        // Assign colors to constructors who have points
        this.constructorsData.forEach((constructor, index) => {
            if (constructor.points > 0) { // Only assign colors to constructors with points
                // Use team primary color if available, otherwise use palette
                this.constructorColors[constructor.displayName] = constructor.primaryColor !== '#00f7ff' ? 
                    constructor.primaryColor : this.colorPalette[index % this.colorPalette.length];
            }
        });
        
        console.log('Initialized graph colors:', {
            driverColors: this.driverColors,
            constructorColors: this.constructorColors
        });
    }

    /**
     * Update graphs based on active tab
     */
    updateGraphs() {
        if (this.activeTab === 'drivers') {
            this.updateDriversGraph();
        } else {
            this.updateConstructorsGraph();
        }
    }

    /**
     * Update drivers points graph - FIXED: Starts from round 0, only shows drivers with points
     */
    updateDriversGraph() {
        if (!this.elements.driversChartCanvas) return;
        
        // Filter drivers to only include those with points
        const driversWithPoints = this.filteredDriversData.filter(driver => driver.points > 0);
        if (driversWithPoints.length === 0) {
            this.showNoGraphData('drivers');
            return;
        }
        
        // Prepare labels starting from round 0
        const labels = ['Start'];
        for (let i = 1; i <= this.totalRaces; i++) {
            labels.push(`R${i}`);
        }
        
        // Show all completed rounds + 1 for future rounds
        const displayRounds = Math.max(this.completedRaces, 1); // At least 1 round (Start)
        const displayLabels = labels.slice(0, displayRounds + 1); // +1 for Start at 0
        
        const datasets = [];
        const hiddenSet = this.graphSettings.drivers.hiddenData;
        
        // Sort drivers by total points for better visual hierarchy
        const sortedDrivers = [...driversWithPoints].sort((a, b) => b.points - a.points);
        
        sortedDrivers.forEach(driver => {
            const driverName = driver.name;
            const teamColor = this.getTeamColor(driver.teamCode);
            const graphColor = this.driverColors[driverName] || teamColor;
            const cumulativePoints = this.driverCumulativePoints[driverName] || {};
            
            // Prepare data points from cumulative points starting from round 0
            const dataPoints = [0]; // Start at 0 points
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                dataPoints.push(cumulative !== null ? cumulative : null);
            }
            
            // Limit to completed rounds + 1 for future rounds
            const displayData = dataPoints.slice(0, displayRounds + 1);
            
            datasets.push({
                label: driverName,
                data: displayData,
                borderColor: graphColor,
                backgroundColor: graphColor + '40', // Add transparency
                borderWidth: 2,
                fill: false, // No fill for line chart
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                hidden: hiddenSet.has(driverName)
            });
        });
        
        // Create or update chart
        if (this.driversChart) {
            this.driversChart.data.labels = displayLabels;
            this.driversChart.data.datasets = datasets;
            this.driversChart.update();
        } else {
            const ctx = this.elements.driversChartCanvas.getContext('2d');
            this.driversChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: displayLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // We'll use our custom legend
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y;
                                    return `${label}: ${value} points`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Cumulative Points',
                                color: '#00f7ff',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                stepSize: 25
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Race Round',
                                color: '#00f7ff',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    },
                    animation: {
                        duration: 750,
                        easing: 'easeOutQuart'
                    }
                }
            });
        }
        
        // Update legend
        this.updateDriversLegend(sortedDrivers);
    }

    /**
     * Update constructors points graph - FIXED: Starts from round 0, only shows constructors with points
     */
    updateConstructorsGraph() {
        if (!this.elements.constructorsChartCanvas) return;
        
        // Filter constructors to only include those with points
        const constructorsWithPoints = this.filteredConstructorsData.filter(constructor => constructor.points > 0);
        if (constructorsWithPoints.length === 0) {
            this.showNoGraphData('constructors');
            return;
        }
        
        // Prepare labels starting from round 0
        const labels = ['Start'];
        for (let i = 1; i <= this.totalRaces; i++) {
            labels.push(`R${i}`);
        }
        
        // Show all completed rounds + 1 for future rounds
        const displayRounds = Math.max(this.completedRaces, 1); // At least 1 round (Start)
        const displayLabels = labels.slice(0, displayRounds + 1); // +1 for Start at 0
        
        const datasets = [];
        const hiddenSet = this.graphSettings.constructors.hiddenData;
        
        // Sort constructors by total points for better visual hierarchy
        const sortedConstructors = [...constructorsWithPoints].sort((a, b) => b.points - a.points);
        
        sortedConstructors.forEach(constructor => {
            const teamName = constructor.displayName;
            const graphColor = this.constructorColors[teamName] || constructor.primaryColor;
            const cumulativePoints = this.constructorCumulativePoints[teamName] || {};
            
            // Prepare data points from cumulative points starting from round 0
            const dataPoints = [0]; // Start at 0 points
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                dataPoints.push(cumulative !== null ? cumulative : null);
            }
            
            // Limit to completed rounds + 1 for future rounds
            const displayData = dataPoints.slice(0, displayRounds + 1);
            
            datasets.push({
                label: teamName,
                data: displayData,
                borderColor: graphColor,
                backgroundColor: graphColor + '40', // Add transparency
                borderWidth: 3, // Thicker lines for constructors
                fill: false, // No fill for line chart
                tension: 0.3,
                pointRadius: 5,
                pointHoverRadius: 7,
                hidden: hiddenSet.has(teamName)
            });
        });
        
        // Create or update chart
        if (this.constructorsChart) {
            this.constructorsChart.data.labels = displayLabels;
            this.constructorsChart.data.datasets = datasets;
            this.constructorsChart.update();
        } else {
            const ctx = this.elements.constructorsChartCanvas.getContext('2d');
            this.constructorsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: displayLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false // We'll use our custom legend
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y;
                                    return `${label}: ${value} points`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Cumulative Points',
                                color: '#00f7ff',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.7)',
                                stepSize: 25
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Race Round',
                                color: '#00f7ff',
                                font: {
                                    weight: 'bold'
                                }
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'rgba(255, 255, 255, 0.7)'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    },
                    animation: {
                        duration: 750,
                        easing: 'easeOutQuart'
                    }
                }
            });
        }
        
        // Update legend
        this.updateConstructorsLegend(sortedConstructors);
    }

    /**
     * Update drivers graph legend
     */
    updateDriversLegend(drivers) {
        if (!this.elements.driversLegend) return;
        
        const hiddenSet = this.graphSettings.drivers.hiddenData;
        
        const legendHTML = drivers.map(driver => {
            const driverName = driver.name;
            const teamName = driver.teamDisplayName;
            const color = this.driverColors[driverName] || this.getTeamColor(driver.teamCode);
            const isHidden = hiddenSet.has(driverName);
            
            return `
                <div class="legend-item ${isHidden ? 'hidden' : ''}" data-driver="${driverName}">
                    <div class="legend-color" style="background: ${color}"></div>
                    <div class="legend-info">
                        <div class="legend-name">${driverName}</div>
                        <div class="legend-team">${teamName}</div>
                    </div>
                    <button class="legend-toggle" data-driver="${driverName}">
                        <i class="fas fa-${isHidden ? 'eye' : 'eye-slash'}"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        this.elements.driversLegend.innerHTML = legendHTML;
        
        // Add click handlers to legend items
        this.elements.driversLegend.querySelectorAll('.legend-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const driverName = button.getAttribute('data-driver');
                this.toggleDriverVisibility(driverName);
            });
        });
        
        // Add click handlers to legend items (toggle on item click)
        this.elements.driversLegend.querySelectorAll('.legend-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('legend-toggle')) {
                    const driverName = item.getAttribute('data-driver');
                    this.toggleDriverVisibility(driverName);
                }
            });
        });
    }

    /**
     * Update constructors graph legend
     */
    updateConstructorsLegend(constructors) {
        if (!this.elements.constructorsLegend) return;
        
        const hiddenSet = this.graphSettings.constructors.hiddenData;
        
        const legendHTML = constructors.map(constructor => {
            const teamName = constructor.displayName;
            const color = this.constructorColors[teamName] || constructor.primaryColor;
            const isHidden = hiddenSet.has(teamName);
            const driversCount = constructor.drivers.length;
            
            return `
                <div class="legend-item ${isHidden ? 'hidden' : ''}" data-team="${teamName}">
                    <div class="legend-color" style="background: ${color}"></div>
                    <div class="legend-info">
                        <div class="legend-name">${teamName}</div>
                        <div class="legend-team">${driversCount} driver${driversCount !== 1 ? 's' : ''}</div>
                    </div>
                    <button class="legend-toggle" data-team="${teamName}">
                        <i class="fas fa-${isHidden ? 'eye' : 'eye-slash'}"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        this.elements.constructorsLegend.innerHTML = legendHTML;
        
        // Add click handlers to legend items
        this.elements.constructorsLegend.querySelectorAll('.legend-toggle').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamName = button.getAttribute('data-team');
                this.toggleConstructorVisibility(teamName);
            });
        });
        
        // Add click handlers to legend items (toggle on item click)
        this.elements.constructorsLegend.querySelectorAll('.legend-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('legend-toggle')) {
                    const teamName = item.getAttribute('data-team');
                    this.toggleConstructorVisibility(teamName);
                }
            });
        });
    }

    /**
     * Toggle driver visibility in graph
     */
    toggleDriverVisibility(driverName) {
        const hiddenSet = this.graphSettings.drivers.hiddenData;
        
        if (hiddenSet.has(driverName)) {
            hiddenSet.delete(driverName);
        } else {
            hiddenSet.add(driverName);
        }
        
        // Update chart
        if (this.driversChart) {
            const datasetIndex = this.driversChart.data.datasets.findIndex(ds => ds.label === driverName);
            if (datasetIndex !== -1) {
                this.driversChart.data.datasets[datasetIndex].hidden = hiddenSet.has(driverName);
                this.driversChart.update();
            }
        }
        
        // Update legend
        this.updateDriversLegend(this.filteredDriversData.filter(d => d.points > 0).sort((a, b) => b.points - a.points));
    }

    /**
     * Toggle constructor visibility in graph
     */
    toggleConstructorVisibility(teamName) {
        const hiddenSet = this.graphSettings.constructors.hiddenData;
        
        if (hiddenSet.has(teamName)) {
            hiddenSet.delete(teamName);
        } else {
            hiddenSet.add(teamName);
        }
        
        // Update chart
        if (this.constructorsChart) {
            const datasetIndex = this.constructorsChart.data.datasets.findIndex(ds => ds.label === teamName);
            if (datasetIndex !== -1) {
                this.constructorsChart.data.datasets[datasetIndex].hidden = hiddenSet.has(teamName);
                this.constructorsChart.update();
            }
        }
        
        // Update legend
        this.updateConstructorsLegend(this.filteredConstructorsData.filter(c => c.points > 0).sort((a, b) => b.points - a.points));
    }

    /**
     * Show no data for graph
     */
    showNoGraphData(type) {
        const chartElement = type === 'drivers' ? this.elements.driversChartCanvas : this.elements.constructorsChartCanvas;
        const legendElement = type === 'drivers' ? this.elements.driversLegend : this.elements.constructorsLegend;
        
        if (chartElement) {
            const parent = chartElement.parentElement;
            if (parent) {
                parent.innerHTML = `
                    <div class="no-results-content">
                        <i class="fas fa-chart-line"></i>
                        <h3>No Data Available for Graph</h3>
                        <p>No ${type} with points available to display in the graph.</p>
                    </div>
                `;
            }
        }
        
        if (legendElement) {
            legendElement.innerHTML = '';
        }
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
        
        // Graph controls - only line chart is available
        if (this.elements.graphTypeSelect) {
            this.elements.graphTypeSelect.addEventListener('change', (e) => {
                const type = e.target.value;
                if (this.activeTab === 'drivers') {
                    this.graphSettings.drivers.type = type;
                    if (this.driversChart) {
                        this.driversChart.config.type = type;
                        this.driversChart.update();
                    }
                } else {
                    this.graphSettings.constructors.type = type;
                    if (this.constructorsChart) {
                        this.constructorsChart.config.type = type;
                        this.constructorsChart.update();
                    }
                }
            });
        }
        
        if (this.elements.toggleAllDriversBtn) {
            this.elements.toggleAllDriversBtn.addEventListener('click', () => {
                this.toggleAllVisibility();
            });
        }
        
        if (this.elements.resetGraphBtn) {
            this.elements.resetGraphBtn.addEventListener('click', () => {
                this.resetGraph();
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
     * Toggle all driver/constructor visibility
     */
    toggleAllVisibility() {
        if (this.activeTab === 'drivers') {
            const hiddenSet = this.graphSettings.drivers.hiddenData;
            const showAll = this.graphSettings.drivers.showAll;
            
            if (showAll) {
                // Hide all except top 3
                const driversWithPoints = this.filteredDriversData.filter(d => d.points > 0);
                driversWithPoints.forEach((driver, index) => {
                    if (index >= 3) {
                        hiddenSet.add(driver.name);
                    }
                });
                this.graphSettings.drivers.showAll = false;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Show All';
            } else {
                // Show all
                hiddenSet.clear();
                this.graphSettings.drivers.showAll = true;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            }
            
            // Update chart
            if (this.driversChart) {
                this.driversChart.data.datasets.forEach(dataset => {
                    dataset.hidden = hiddenSet.has(dataset.label);
                });
                this.driversChart.update();
            }
            
            // Update legend
            this.updateDriversLegend(this.filteredDriversData.filter(d => d.points > 0).sort((a, b) => b.points - a.points));
        } else {
            const hiddenSet = this.graphSettings.constructors.hiddenData;
            const showAll = this.graphSettings.constructors.showAll;
            
            if (showAll) {
                // Hide all except top 3
                const constructorsWithPoints = this.filteredConstructorsData.filter(c => c.points > 0);
                constructorsWithPoints.forEach((constructor, index) => {
                    if (index >= 3) {
                        hiddenSet.add(constructor.displayName);
                    }
                });
                this.graphSettings.constructors.showAll = false;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Show All';
            } else {
                // Show all
                hiddenSet.clear();
                this.graphSettings.constructors.showAll = true;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            }
            
            // Update chart
            if (this.constructorsChart) {
                this.constructorsChart.data.datasets.forEach(dataset => {
                    dataset.hidden = hiddenSet.has(dataset.label);
                });
                this.constructorsChart.update();
            }
            
            // Update legend
            this.updateConstructorsLegend(this.filteredConstructorsData.filter(c => c.points > 0).sort((a, b) => b.points - a.points));
        }
    }

    /**
     * Reset graph to default state
     */
    resetGraph() {
        if (this.activeTab === 'drivers') {
            this.graphSettings.drivers.hiddenData.clear();
            this.graphSettings.drivers.showAll = true;
            this.elements.graphTypeSelect.value = 'line';
            this.graphSettings.drivers.type = 'line';
            
            if (this.driversChart) {
                this.driversChart.data.datasets.forEach(dataset => {
                    dataset.hidden = false;
                });
                this.driversChart.config.type = 'line';
                this.driversChart.update();
            }
            
            this.updateDriversLegend(this.filteredDriversData.filter(d => d.points > 0).sort((a, b) => b.points - a.points));
            this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
        } else {
            this.graphSettings.constructors.hiddenData.clear();
            this.graphSettings.constructors.showAll = true;
            this.elements.graphTypeSelect.value = 'line';
            this.graphSettings.constructors.type = 'line';
            
            if (this.constructorsChart) {
                this.constructorsChart.data.datasets.forEach(dataset => {
                    dataset.hidden = false;
                });
                this.constructorsChart.config.type = 'line';
                this.constructorsChart.update();
            }
            
            this.updateConstructorsLegend(this.filteredConstructorsData.filter(c => c.points > 0).sort((a, b) => b.points - a.points));
            this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
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
        
        // Show/hide graph controls
        if (this.elements.graphControls) {
            if (viewType === 'graph') {
                this.elements.graphControls.style.display = 'flex';
            } else {
                this.elements.graphControls.style.display = 'none';
            }
        }
        
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
        // Update graphs if needed
        else if (viewType === 'graph') {
            this.updateGraphs();
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
        
        // If season hasn't started yet
        if (this.completedRaces === 0 && calendar.length > 0) {
            const firstRace = calendar[0];
            this.updateCountdown(firstRace.date);
        }
        // If season is in progress
        else if (this.completedRaces < this.totalRaces && calendar.length > 0) {
            const nextRace = calendar[this.completedRaces];
            if (nextRace) {
                this.updateCountdown(nextRace.date);
            }
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
        
        // Generate mock round points (including sprint points)
        this.generateMockRoundPoints();
        
        // Calculate cumulative points
        this.calculateCumulativePoints();
        
        // Initialize graphs
        this.initializeGraphs();
        
        this.updateChampionshipStats();
        this.updateAllStandings();
        this.updateProgressionViews();
        
        // Start countdown for fallback data
        this.updateCountdown('2024-12-31');
        
        // Initialize tabs and views
        this.initializeTabsAndViews();
    }

    /**
     * Generate mock round points for fallback data (race + sprint combined)
     */
    generateMockRoundPoints() {
        // Initialize data structures
        this.driverRoundPoints = {};
        this.driverRoundFastestLaps = {};
        this.constructorRoundPoints = {};
        
        // Initialize driver round points (race + sprint combined)
        this.driversData.forEach(driver => {
            if (!driver || !driver.name) return;
            
            this.driverRoundPoints[driver.name] = {};
            this.driverRoundFastestLaps[driver.name] = {};
            
            for (let i = 1; i <= this.totalRaces; i++) {
                let totalPoints = 0;
                let hasFastestLap = false;
                
                if (i <= this.completedRaces) {
                    // Race points
                    let racePoints = 0;
                    if (i === 1) { 
                        racePoints = 25; // 1st place
                        hasFastestLap = Math.random() > 0.5;
                    } else if (i === 2) { 
                        racePoints = 18; // 2nd place
                        hasFastestLap = Math.random() > 0.5;
                    } else if (i === 3) { 
                        racePoints = 15; // 3rd place
                        hasFastestLap = Math.random() > 0.5;
                    } else {
                        racePoints = Math.floor(Math.random() * 14) + 1;
                    }
                    
                    // Add fastest lap point if applicable
                    if (hasFastestLap) {
                        racePoints += 1;
                    }
                    
                    // Sprint points (add to same round)
                    const sprintPoints = Math.floor(Math.random() * 9); // 0-8 points for sprints
                    
                    totalPoints = racePoints + sprintPoints;
                }
                
                this.driverRoundPoints[driver.name][`Round ${i}`] = totalPoints;
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
        
        console.log('Mock constructor round points (race + sprint):', this.constructorRoundPoints);
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
