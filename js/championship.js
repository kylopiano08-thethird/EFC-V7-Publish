/**
 * Championship Page Script
 * COMPLETELY REWRITTEN - Uses team names directly from Driver Movement sheet
 * ADDED: Team colors from TeamMaster sheet
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
        this.completedRaces = 0;
        this.totalRaces = 0;
        
        // Team colors from TeamMaster - map of team name to primary color (Column E)
        this.teamColors = {};
        
        // Driver movement data - this is our source of truth
        this.roundTeams = {}; // round -> { driver: team }
        
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
                hiddenData: new Set(),
                showAll: true
            },
            constructors: {
                type: 'line',
                hiddenData: new Set(),
                showAll: true
            }
        };
        
        // Color palette for graphs (fallback if team color not found)
        this.colorPalette = [
            '#00f7ff', '#9b30ff', '#ff0080', '#ff8000', '#00ff80',
            '#ffff00', '#0080ff', '#ff4000', '#00ccff', '#cc00ff',
            '#ffcc00', '#00ffcc', '#ccff00', '#ff00cc', '#00cc80',
            '#ff8040', '#4080ff', '#ff4080', '#80ff00', '#0080cc'
        ];
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
            
            // Load team colors from TeamMaster
            this.loadTeamColors();
            
            // Get the driver movement data - this is our source of truth
            const driverMovement = this.dataLoader.dataCache.driverMovement || {};
            this.roundTeams = driverMovement.roundTeams || {};
            
            console.log('ROUND TEAMS LOADED:', this.roundTeams);
            console.log('TEAM COLORS LOADED:', this.teamColors);
            
            // Log specifically for notunbeatable08
            Object.entries(this.roundTeams).forEach(([round, assignments]) => {
                if (assignments['notunbeatable08']) {
                    console.log(`FOUND notunbeatable08 in ${round} with team: ${assignments['notunbeatable08']}`);
                }
            });
            
            // Process championship data using roundTeams as source of truth
            this.processChampionshipData();
            
            // Parse race and sprint results for points
            this.parseRaceResultsImproved();
            
            // Calculate cumulative points
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
     * Load team colors from TeamMaster sheet
     * Team Name is in Column A, Primary Color is in Column E (index 4)
     */
    loadTeamColors() {
        const teamMaster = this.dataLoader.dataCache.teamMaster || [];
        
        teamMaster.forEach(team => {
            // Team name is in column A (name property)
            // Primary color is in column E (primaryColor property)
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
     * Initialize tabs and views UI
     */
    initializeTabsAndViews() {
        this.switchTab('drivers');
        this.switchView('current');
    }

    /**
     * Get team color for a team name
     */
    getTeamColor(teamName) {
        return this.teamColors[teamName] || '#00f7ff'; // Default cyan if not found
    }

    /**
     * Process championship data - USING ROUND TEAMS AS SOURCE OF TRUTH
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
        
        console.log('Processing championship data with roundTeams:', this.roundTeams);
        
        // Get ALL drivers that appear in roundTeams
        const allDrivers = new Set();
        Object.values(this.roundTeams).forEach(roundAssignments => {
            Object.keys(roundAssignments).forEach(driverName => {
                allDrivers.add(driverName);
            });
        });
        
        console.log('All drivers from movement data:', Array.from(allDrivers));
        
        // Create a map of driver stats
        const driverStatsMap = {};
        driverStats.forEach(stat => {
            driverStatsMap[stat.driver] = stat;
        });
        
        // Process drivers data - include ALL drivers from movement data
        this.driversData = [];
        
        allDrivers.forEach(driverName => {
            const stat = driverStatsMap[driverName] || { points: 0, wins: 0, podiums: 0, poles: 0, fastestLaps: 0, dnfs: 0, racesAttended: 0 };
            const driverInfo = driverMaster.find(d => d.username === driverName) || {};
            
            // Find the most recent team for this driver
            let mostRecentTeam = null;
            let mostRecentRound = 0;
            
            for (let round = this.completedRaces; round >= 1; round--) {
                const roundKey = `Round ${round}`;
                const team = this.roundTeams[roundKey]?.[driverName];
                if (team && team.trim() !== '') {
                    mostRecentTeam = team;
                    mostRecentRound = round;
                    break;
                }
            }
            
            console.log(`Driver ${driverName} most recent team: ${mostRecentTeam} (Round ${mostRecentRound})`);
            
            this.driversData.push({
                name: driverName,
                team: mostRecentTeam || 'Unknown Team',
                teamColor: this.getTeamColor(mostRecentTeam || ''),
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
            });
        });
        
        // Sort drivers by points descending
        this.driversData.sort((a, b) => b.points - a.points);
        
        console.log('Drivers data processed:', this.driversData);
        console.log('notunbeatable08 team:', this.driversData.find(d => d.name === 'notunbeatable08')?.team);
        console.log('notunbeatable08 color:', this.driversData.find(d => d.name === 'notunbeatable08')?.teamColor);
        
        // Initialize filtered drivers data
        this.filteredDriversData = [...this.driversData];
        
        // Calculate constructor standings using team names directly
        this.calculateConstructorStandings();
    }

    /**
     * Calculate constructor standings using team names directly from movement data
     */
    calculateConstructorStandings() {
        console.log('Calculating constructor standings...');
        
        // Use team names as they appear in the movement data
        const constructorPoints = {}; // teamName -> total points
        const constructorWins = {}; // teamName -> total wins
        const constructorPodiums = {}; // teamName -> total podiums
        const constructorDrivers = {}; // teamName -> Set of drivers
        
        // Initialize with empty objects - we'll add teams as we find them
        const teamNames = new Set();
        
        // Collect all team names from roundTeams
        Object.values(this.roundTeams).forEach(roundAssignments => {
            Object.values(roundAssignments).forEach(team => {
                if (team && team.trim() !== '') {
                    teamNames.add(team);
                }
            });
        });
        
        console.log('All team names found:', Array.from(teamNames));
        
        // Initialize data structures for each team
        teamNames.forEach(team => {
            constructorPoints[team] = 0;
            constructorWins[team] = 0;
            constructorPodiums[team] = 0;
            constructorDrivers[team] = new Set();
        });
        
        // For each completed race, add points to the team the driver was in
        for (let round = 1; round <= this.completedRaces; round++) {
            const roundKey = `Round ${round}`;
            const roundAssignments = this.roundTeams[roundKey] || {};
            
            console.log(`Round ${round} assignments:`, roundAssignments);
            
            // Get points for each driver in this round
            Object.entries(this.driverRoundPoints).forEach(([driverName, roundPoints]) => {
                const pointsForRound = roundPoints[roundKey] || 0;
                if (pointsForRound === 0) return;
                
                // Get the team for this driver in this round
                const teamForRound = roundAssignments[driverName];
                
                if (teamForRound && teamForRound.trim() !== '') {
                    // Add points to this team
                    constructorPoints[teamForRound] = (constructorPoints[teamForRound] || 0) + pointsForRound;
                    constructorDrivers[teamForRound].add(driverName);
                    
                    // Track wins and podiums
                    if (pointsForRound >= 25) {
                        constructorWins[teamForRound] = (constructorWins[teamForRound] || 0) + 1;
                    }
                    if (pointsForRound >= 15) {
                        constructorPodiums[teamForRound] = (constructorPodiums[teamForRound] || 0) + 1;
                    }
                    
                    console.log(`Added ${pointsForRound} points to ${teamForRound} for ${driverName} in ${roundKey}`);
                } else {
                    console.log(`${driverName} not assigned to any team in ${roundKey}, points (${pointsForRound}) not counted`);
                }
            });
        }
        
        // Convert to array and sort
        this.constructorsData = Object.entries(constructorPoints)
            .map(([teamName, points]) => ({
                displayName: teamName,
                teamColor: this.getTeamColor(teamName),
                points: points,
                wins: constructorWins[teamName] || 0,
                podiums: constructorPodiums[teamName] || 0,
                drivers: Array.from(constructorDrivers[teamName] || [])
            }))
            .sort((a, b) => b.points - a.points);
        
        this.filteredConstructorsData = [...this.constructorsData];
        
        console.log('Constructor standings:', this.constructorsData);
    }

    /**
     * Parse race results to get round-by-round points
     */
    parseRaceResultsImproved() {
        const dataCache = this.dataLoader.dataCache;
        const raceResults = dataCache.raceResults || {};
        const results = raceResults.results || [];
        
        // Get sprint results
        const sprintResultsData = dataCache.sprintResults || {};
        const sprintResults = sprintResultsData.results || [];
        
        console.log('Parsing race and sprint results for progression');
        
        // Initialize data structures
        this.driverRoundPoints = {};
        
        // First parse race results
        results.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverRounds = driverResult.results || {};
            
            if (!this.driverRoundPoints[driverName]) {
                this.driverRoundPoints[driverName] = {};
            }
            
            Object.entries(driverRounds).forEach(([roundKey, roundResult]) => {
                if (!roundResult || roundResult.trim() === '' || roundResult === 'DNS' || roundResult === 'DNF') {
                    return;
                }
                
                const roundMatch = roundKey.match(/Round\s*(\d+)/i);
                if (!roundMatch) return;
                
                const roundNum = parseInt(roundMatch[1]);
                if (roundNum > this.totalRaces) return;
                
                let racePoints = 0;
                let hasFastestLap = false;
                
                if (roundResult.includes('Fastest Lap') || roundResult.includes('FL')) {
                    hasFastestLap = true;
                }
                
                const positionMatch = roundResult.match(/P(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    racePoints = this.calculatePointsFromPosition(position);
                    
                    if (hasFastestLap && racePoints > 0) {
                        racePoints += 1;
                    }
                }
                
                if (roundResult.includes('DNF') && positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    racePoints = this.calculatePointsFromPosition(position);
                }
                
                this.driverRoundPoints[driverName][roundKey] = racePoints;
            });
        });
        
        // Add sprint points to the corresponding round
        sprintResults.forEach(driverResult => {
            const driverName = driverResult.driver;
            const driverSprints = driverResult.results || {};
            
            Object.entries(driverSprints).forEach(([sprintKey, sprintResult]) => {
                if (!sprintResult || sprintResult.trim() === '' || sprintResult === 'DNS' || sprintResult === 'DNF') {
                    return;
                }
                
                const sprintMatch = sprintKey.match(/Sprint\s*(\d+)/i);
                if (!sprintMatch) return;
                
                const sprintNum = parseInt(sprintMatch[1]);
                
                let sprintPoints = 0;
                
                const positionMatch = sprintResult.match(/P(\d+)/i);
                if (positionMatch) {
                    const position = parseInt(positionMatch[1]);
                    sprintPoints = this.calculateSprintPointsFromPosition(position);
                    
                    if (sprintResult.includes('Fastest Lap') || sprintResult.includes('FL')) {
                        sprintPoints += 1;
                    }
                }
                
                const roundKey = `Round ${sprintNum}`;
                
                if (this.driverRoundPoints[driverName] && this.driverRoundPoints[driverName][roundKey] !== undefined) {
                    this.driverRoundPoints[driverName][roundKey] += sprintPoints;
                } else if (sprintNum <= this.totalRaces) {
                    if (!this.driverRoundPoints[driverName]) {
                        this.driverRoundPoints[driverName] = {};
                    }
                    this.driverRoundPoints[driverName][roundKey] = sprintPoints;
                }
            });
        });
        
        console.log('Driver round points:', this.driverRoundPoints);
        
        // Recalculate constructor standings with the points we now have
        this.calculateConstructorStandings();
    }

    /**
     * Calculate points from finishing position
     */
    calculatePointsFromPosition(position) {
        const defaultPoints = {
            1: 25, 2: 18, 3: 15, 4: 12, 5: 10,
            6: 8, 7: 6, 8: 4, 9: 2, 10: 1
        };
        return defaultPoints[position] || 0;
    }

    /**
     * Calculate sprint points from finishing position
     */
    calculateSprintPointsFromPosition(position) {
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
        
        this.driverCumulativePoints = {};
        this.constructorCumulativePoints = {};
        
        // Driver cumulative points
        this.driversData.forEach(driver => {
            const driverName = driver.name;
            this.driverCumulativePoints[driverName] = {};
            
            let cumulative = 0;
            this.driverCumulativePoints[driverName][0] = 0;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                const roundPoints = this.driverRoundPoints[driverName]?.[roundKey] || 0;
                
                if (i <= this.completedRaces) {
                    cumulative += roundPoints;
                }
                
                this.driverCumulativePoints[driverName][i] = i <= this.completedRaces ? cumulative : null;
            }
        });
        
        // Constructor cumulative points
        this.constructorsData.forEach(constructor => {
            const teamName = constructor.displayName;
            this.constructorCumulativePoints[teamName] = {};
            
            let cumulative = 0;
            this.constructorCumulativePoints[teamName][0] = 0;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const roundKey = `Round ${i}`;
                let roundPoints = 0;
                
                if (i <= this.completedRaces) {
                    const roundAssignments = this.roundTeams[roundKey] || {};
                    
                    // Sum points for all drivers in this team for this round
                    Object.entries(roundAssignments).forEach(([driverName, teamForRound]) => {
                        if (teamForRound === teamName) {
                            roundPoints += this.driverRoundPoints[driverName]?.[roundKey] || 0;
                        }
                    });
                    
                    cumulative += roundPoints;
                }
                
                this.constructorCumulativePoints[teamName][i] = i <= this.completedRaces ? cumulative : null;
            }
        });
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
            this.filteredDriversData = [...this.driversData];
            this.filteredConstructorsData = [...this.constructorsData];
        } else {
            this.filteredDriversData = this.driversData.filter(driver => {
                const driverName = driver.name.toLowerCase();
                const teamName = driver.team.toLowerCase();
                return driverName.includes(searchQuery) || teamName.includes(searchQuery);
            });
            
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
        
        if (this.elements.noResultsMessage) {
            this.elements.noResultsMessage.style.display = 
                filteredData.length === 0 && this.searchQuery !== '' ? 'block' : 'none';
        }
        
        if (this.elements.resultsCount) {
            this.elements.resultsCount.style.display = 
                this.searchQuery !== '' ? 'flex' : 'none';
        }
    }

    /**
     * Update championship stats
     */
    updateChampionshipStats() {
        const calendar = this.dataLoader?.dataCache?.raceCalendar || [];
        const nextRace = this.dataLoader?.getNextRace() || {};
        
        if (this.elements.currentRound) {
            this.elements.currentRound.textContent = `ROUND ${this.completedRaces}/${this.totalRaces}`;
        }
        
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
        
        if (this.elements.timerDisplay) {
            if (this.completedRaces === 0) {
                this.elements.timerDisplay.textContent = 'SEASON STARTING SOON';
            } else if (this.completedRaces >= this.totalRaces) {
                this.elements.timerDisplay.textContent = 'SEASON COMPLETED';
            }
        }
    }

    /**
     * Update drivers standings
     */
    updateDriversStandings() {
        if (!this.elements.driversStandingsBody) return;
        
        if (this.filteredDriversData.length === 0) {
            this.elements.driversStandingsBody.innerHTML = '<div class="standing-row">No drivers found</div>';
            return;
        }
        
        const standingsWithGaps = this.calculateGaps(this.filteredDriversData);
        
        const standingsHTML = standingsWithGaps.map((driver, index) => {
            const position = index + 1;
            const gap = driver.gap > 0 ? `+${driver.gap}` : 'Leader';
            const teamColor = driver.teamColor;
            
            const shouldHighlight = this.searchQuery !== '' && 
                (driver.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
                 driver.team.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            return `
                <div class="standing-row position-${position} ${shouldHighlight ? 'highlight' : ''}">
                    <div class="pos-cell">${position}</div>
                    <div class="driver-cell">
                        <div class="driver-number">${driver.number || position}</div>
                        <div class="driver-name" style="color: ${teamColor}">${driver.name}</div>
                    </div>
                    <div class="team-cell">
                        <div class="team-color" style="background: ${teamColor}"></div>
                        <div>${driver.team}</div>
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
        if (!this.elements.constructorsStandingsBody) return;
        
        if (this.filteredConstructorsData.length === 0) {
            this.elements.constructorsStandingsBody.innerHTML = '<div class="constructors-row">No constructors found</div>';
            return;
        }
        
        const standingsWithGaps = this.calculateGaps(this.filteredConstructorsData);
        
        const standingsHTML = standingsWithGaps.map((constructor, index) => {
            const position = index + 1;
            const gap = constructor.gap > 0 ? `+${constructor.gap}` : 'Leader';
            const teamColor = constructor.teamColor;
            
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
                        <div class="team-color" style="background: ${teamColor}"></div>
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
     * Update progression views
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
        if (!this.elements.driversProgressionBody) return;
        
        this.elements.driversProgressionBody.innerHTML = '';
        const drivers = this.filteredDriversData;
        
        if (drivers.length === 0) {
            this.elements.driversProgressionBody.innerHTML = '<div class="progression-row">No Data Available</div>';
            return;
        }
        
        let headerHTML = `<div class="progression-header-row">`;
        headerHTML += `<div class="progression-name-header">DRIVER</div>`;
        headerHTML += `<div class="progression-total-header">TOTAL</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="progression-round-header">R${i}</div>`;
        }
        headerHTML += `</div>`;
        
        this.elements.driversProgressionBody.innerHTML = headerHTML;
        
        drivers.forEach(driver => {
            const driverName = driver.name;
            const teamColor = driver.teamColor;
            const cumulativePoints = this.driverCumulativePoints[driverName] || {};
            
            let rowHTML = `<div class="progression-data-row">`;
            rowHTML += `<div class="progression-driver-cell">
                <div class="progression-driver-name" style="color: ${teamColor}">${driver.name}</div>
            </div>`;
            rowHTML += `<div class="progression-total-cell">${driver.points}</div>`;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                
                if (i <= this.completedRaces && cumulative !== undefined && cumulative !== null) {
                    rowHTML += `<div class="progression-round-cell">${cumulative}</div>`;
                } else {
                    rowHTML += `<div class="progression-round-cell">-</div>`;
                }
            }
            
            rowHTML += `</div>`;
            this.elements.driversProgressionBody.innerHTML += rowHTML;
        });
    }

    /**
     * Update constructors progression view
     */
    updateConstructorsProgression() {
        if (!this.elements.constructorsProgressionBody) return;
        
        this.elements.constructorsProgressionBody.innerHTML = '';
        const constructors = this.filteredConstructorsData;
        
        if (constructors.length === 0) {
            this.elements.constructorsProgressionBody.innerHTML = '<div class="progression-row">No Data Available</div>';
            return;
        }
        
        let headerHTML = `<div class="progression-header-row">`;
        headerHTML += `<div class="progression-name-header">TEAM</div>`;
        headerHTML += `<div class="progression-total-header">TOTAL</div>`;
        
        for (let i = 1; i <= this.totalRaces; i++) {
            headerHTML += `<div class="progression-round-header">R${i}</div>`;
        }
        headerHTML += `</div>`;
        
        this.elements.constructorsProgressionBody.innerHTML = headerHTML;
        
        constructors.forEach(constructor => {
            const teamName = constructor.displayName;
            const teamColor = constructor.teamColor;
            const cumulativePoints = this.constructorCumulativePoints[teamName] || {};
            
            let rowHTML = `<div class="progression-data-row">`;
            rowHTML += `<div class="progression-team-cell">
                <div class="progression-driver-name" style="color: ${teamColor}">${teamName}</div>
            </div>`;
            rowHTML += `<div class="progression-total-cell">${constructor.points}</div>`;
            
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                
                if (i <= this.completedRaces && cumulative !== undefined && cumulative !== null) {
                    rowHTML += `<div class="progression-round-cell">${cumulative}</div>`;
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
        if (this.elements.graphTypeSelect) {
            this.elements.graphTypeSelect.innerHTML = '<option value="line">Line Chart</option>';
        }
        
        // Driver colors are already set from team colors in processChampionshipData
        // But we need to ensure all drivers have colors
        this.driversData.forEach(driver => {
            if (!driver.teamColor) {
                driver.teamColor = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
            }
        });
        
        // Constructor colors are already set from team colors in calculateConstructorStandings
        this.constructorsData.forEach(constructor => {
            if (!constructor.teamColor) {
                constructor.teamColor = this.colorPalette[Math.floor(Math.random() * this.colorPalette.length)];
            }
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
     * Update drivers graph
     */
    updateDriversGraph() {
        if (!this.elements.driversChartCanvas) return;
        
        const driversWithPoints = this.filteredDriversData.filter(driver => driver.points > 0);
        if (driversWithPoints.length === 0) {
            this.showNoGraphData('drivers');
            return;
        }
        
        const labels = ['Start'];
        for (let i = 1; i <= this.totalRaces; i++) {
            labels.push(`R${i}`);
        }
        
        const displayRounds = Math.max(this.completedRaces, 1);
        const displayLabels = labels.slice(0, displayRounds + 1);
        
        const datasets = [];
        const hiddenSet = this.graphSettings.drivers.hiddenData;
        const sortedDrivers = [...driversWithPoints].sort((a, b) => b.points - a.points);
        
        sortedDrivers.forEach(driver => {
            const driverName = driver.name;
            const graphColor = driver.teamColor;
            const cumulativePoints = this.driverCumulativePoints[driverName] || {};
            
            const dataPoints = [0];
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                dataPoints.push(cumulative !== null ? cumulative : null);
            }
            
            datasets.push({
                label: driverName,
                data: dataPoints.slice(0, displayRounds + 1),
                borderColor: graphColor,
                backgroundColor: graphColor + '40',
                borderWidth: 2,
                fill: false,
                tension: 0.3,
                hidden: hiddenSet.has(driverName)
            });
        });
        
        if (this.driversChart) {
            this.driversChart.data.labels = displayLabels;
            this.driversChart.data.datasets = datasets;
            this.driversChart.update();
        } else {
            const ctx = this.elements.driversChartCanvas.getContext('2d');
            this.driversChart = new Chart(ctx, {
                type: 'line',
                data: { labels: displayLabels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${context.parsed.y} points`
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        this.updateDriversLegend(sortedDrivers);
    }

    /**
     * Update constructors graph
     */
    updateConstructorsGraph() {
        if (!this.elements.constructorsChartCanvas) return;
        
        const constructorsWithPoints = this.filteredConstructorsData.filter(c => c.points > 0);
        if (constructorsWithPoints.length === 0) {
            this.showNoGraphData('constructors');
            return;
        }
        
        const labels = ['Start'];
        for (let i = 1; i <= this.totalRaces; i++) {
            labels.push(`R${i}`);
        }
        
        const displayRounds = Math.max(this.completedRaces, 1);
        const displayLabels = labels.slice(0, displayRounds + 1);
        
        const datasets = [];
        const hiddenSet = this.graphSettings.constructors.hiddenData;
        const sortedConstructors = [...constructorsWithPoints].sort((a, b) => b.points - a.points);
        
        sortedConstructors.forEach(constructor => {
            const teamName = constructor.displayName;
            const graphColor = constructor.teamColor;
            const cumulativePoints = this.constructorCumulativePoints[teamName] || {};
            
            const dataPoints = [0];
            for (let i = 1; i <= this.totalRaces; i++) {
                const cumulative = cumulativePoints[i];
                dataPoints.push(cumulative !== null ? cumulative : null);
            }
            
            datasets.push({
                label: teamName,
                data: dataPoints.slice(0, displayRounds + 1),
                borderColor: graphColor,
                backgroundColor: graphColor + '40',
                borderWidth: 3,
                fill: false,
                tension: 0.3,
                hidden: hiddenSet.has(teamName)
            });
        });
        
        if (this.constructorsChart) {
            this.constructorsChart.data.labels = displayLabels;
            this.constructorsChart.data.datasets = datasets;
            this.constructorsChart.update();
        } else {
            const ctx = this.elements.constructorsChartCanvas.getContext('2d');
            this.constructorsChart = new Chart(ctx, {
                type: 'line',
                data: { labels: displayLabels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.dataset.label}: ${context.parsed.y} points`
                            }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
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
            const teamName = driver.team;
            const color = driver.teamColor;
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
        
        this.elements.driversLegend.querySelectorAll('.legend-toggle, .legend-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const driverName = el.closest('.legend-item')?.getAttribute('data-driver');
                if (driverName) this.toggleDriverVisibility(driverName);
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
            const color = constructor.teamColor;
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
        
        this.elements.constructorsLegend.querySelectorAll('.legend-toggle, .legend-item').forEach(el => {
            el.addEventListener('click', (e) => {
                const teamName = el.closest('.legend-item')?.getAttribute('data-team');
                if (teamName) this.toggleConstructorVisibility(teamName);
            });
        });
    }

    /**
     * Toggle driver visibility in graph
     */
    toggleDriverVisibility(driverName) {
        const hiddenSet = this.graphSettings.drivers.hiddenData;
        hiddenSet.has(driverName) ? hiddenSet.delete(driverName) : hiddenSet.add(driverName);
        
        if (this.driversChart) {
            const dataset = this.driversChart.data.datasets.find(ds => ds.label === driverName);
            if (dataset) dataset.hidden = hiddenSet.has(driverName);
            this.driversChart.update();
        }
        
        this.updateDriversLegend(this.filteredDriversData.filter(d => d.points > 0));
    }

    /**
     * Toggle constructor visibility in graph
     */
    toggleConstructorVisibility(teamName) {
        const hiddenSet = this.graphSettings.constructors.hiddenData;
        hiddenSet.has(teamName) ? hiddenSet.delete(teamName) : hiddenSet.add(teamName);
        
        if (this.constructorsChart) {
            const dataset = this.constructorsChart.data.datasets.find(ds => ds.label === teamName);
            if (dataset) dataset.hidden = hiddenSet.has(teamName);
            this.constructorsChart.update();
        }
        
        this.updateConstructorsLegend(this.filteredConstructorsData.filter(c => c.points > 0));
    }

    /**
     * Show no data for graph
     */
    showNoGraphData(type) {
        const chartElement = type === 'drivers' ? this.elements.driversChartCanvas : this.elements.constructorsChartCanvas;
        if (chartElement?.parentElement) {
            chartElement.parentElement.innerHTML = `
                <div class="no-results-content">
                    <i class="fas fa-chart-line"></i>
                    <h3>No Data Available for Graph</h3>
                </div>
            `;
        }
    }

    /**
     * Calculate gaps between positions
     */
    calculateGaps(standings) {
        if (standings.length === 0) return [];
        const leaderPoints = standings[0].points;
        return standings.map((entry, index) => ({
            ...entry,
            gap: index === 0 ? 0 : leaderPoints - entry.points
        }));
    }

    /**
     * Add event listeners
     */
    addEventListeners() {
        this.elements.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.getAttribute('data-tab')));
        });
        
        this.elements.viewOptions.forEach(opt => {
            opt.addEventListener('click', () => this.switchView(opt.getAttribute('data-view')));
        });
        
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.updateClearButton();
                this.updateAllStandings();
            });
        }
        
        if (this.elements.clearSearchBtn) {
            this.elements.clearSearchBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.elements.searchInput.value = '';
                this.updateClearButton();
                this.updateAllStandings();
                this.elements.searchInput.focus();
            });
        }
        
        if (this.elements.toggleAllDriversBtn) {
            this.elements.toggleAllDriversBtn.addEventListener('click', () => this.toggleAllVisibility());
        }
        
        if (this.elements.resetGraphBtn) {
            this.elements.resetGraphBtn.addEventListener('click', () => this.resetGraph());
        }
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
            const drivers = this.filteredDriversData.filter(d => d.points > 0);
            
            if (this.graphSettings.drivers.showAll) {
                drivers.forEach((d, i) => { if (i >= 3) hiddenSet.add(d.name); });
                this.graphSettings.drivers.showAll = false;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Show All';
            } else {
                hiddenSet.clear();
                this.graphSettings.drivers.showAll = true;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            }
            
            if (this.driversChart) {
                this.driversChart.data.datasets.forEach(ds => ds.hidden = hiddenSet.has(ds.label));
                this.driversChart.update();
            }
            this.updateDriversLegend(drivers);
        } else {
            const hiddenSet = this.graphSettings.constructors.hiddenData;
            const constructors = this.filteredConstructorsData.filter(c => c.points > 0);
            
            if (this.graphSettings.constructors.showAll) {
                constructors.forEach((c, i) => { if (i >= 3) hiddenSet.add(c.displayName); });
                this.graphSettings.constructors.showAll = false;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Show All';
            } else {
                hiddenSet.clear();
                this.graphSettings.constructors.showAll = true;
                this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            }
            
            if (this.constructorsChart) {
                this.constructorsChart.data.datasets.forEach(ds => ds.hidden = hiddenSet.has(ds.label));
                this.constructorsChart.update();
            }
            this.updateConstructorsLegend(constructors);
        }
    }

    /**
     * Reset graph to default state
     */
    resetGraph() {
        if (this.activeTab === 'drivers') {
            this.graphSettings.drivers.hiddenData.clear();
            this.graphSettings.drivers.showAll = true;
            if (this.driversChart) {
                this.driversChart.data.datasets.forEach(ds => ds.hidden = false);
                this.driversChart.update();
            }
            this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            this.updateDriversLegend(this.filteredDriversData.filter(d => d.points > 0));
        } else {
            this.graphSettings.constructors.hiddenData.clear();
            this.graphSettings.constructors.showAll = true;
            if (this.constructorsChart) {
                this.constructorsChart.data.datasets.forEach(ds => ds.hidden = false);
                this.constructorsChart.update();
            }
            this.elements.toggleAllDriversBtn.innerHTML = '<i class="fas fa-eye"></i> Show Top 3';
            this.updateConstructorsLegend(this.filteredConstructorsData.filter(c => c.points > 0));
        }
    }

    /**
     * Switch between tabs
     */
    switchTab(tabId) {
        this.elements.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        
        this.elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabId}-tab`);
        });
        
        this.activeTab = tabId;
        this.switchView(this.activeView);
        this.updateResultsCount();
    }

    /**
     * Switch between views
     */
    switchView(viewType) {
        this.elements.viewOptions.forEach(opt => {
            opt.classList.toggle('active', opt.getAttribute('data-view') === viewType);
        });
        
        this.activeView = viewType;
        
        if (this.elements.graphControls) {
            this.elements.graphControls.style.display = viewType === 'graph' ? 'flex' : 'none';
        }
        
        document.querySelectorAll(`#${this.activeTab}-tab .view-content`).forEach(c => c.classList.remove('active'));
        const activeView = document.querySelector(`#${this.activeTab}-${viewType}`);
        if (activeView) activeView.classList.add('active');
        
        if (viewType === 'progression') this.updateProgressionViews();
        else if (viewType === 'graph') this.updateGraphs();
    }

    /**
     * Start countdown timer for next race
     */
    startCountdownTimer() {
        const calendar = this.dataLoader?.dataCache?.raceCalendar || [];
        
        if (this.completedRaces === 0 && calendar.length > 0) {
            this.updateCountdown(calendar[0].date);
        } else if (this.completedRaces < this.totalRaces && calendar.length > 0) {
            this.updateCountdown(calendar[this.completedRaces].date);
        }
    }

    /**
     * Update countdown display
     */
    updateCountdown(dateStr) {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        
        const targetDate = new Date(dateStr);
        if (isNaN(targetDate.getTime())) return;
        
        const updateDisplay = () => {
            const diff = targetDate - new Date();
            if (diff <= 0) {
                this.setStaticTexts('RACE DAY!', 'RACE DAY!');
                clearInterval(this.countdownInterval);
                return;
            }
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            const countdownStr = `${days}d ${hours.toString().padStart(2,'0')}h ${minutes.toString().padStart(2,'0')}m ${seconds.toString().padStart(2,'0')}s`;
            
            if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = countdownStr;
            if (this.elements.nextRaceInfo) this.elements.nextRaceInfo.textContent = countdownStr;
        };
        
        updateDisplay();
        this.countdownInterval = setInterval(updateDisplay, 1000);
    }

    /**
     * Helper: Set static text for timer displays
     */
    setStaticTexts(headerText, raceInfoText) {
        if (this.elements.timerDisplay) this.elements.timerDisplay.textContent = headerText;
        if (this.elements.nextRaceInfo) this.elements.nextRaceInfo.textContent = raceInfoText;
    }

    /**
     * Update with fallback data
     */
    updateWithFallbackData() {
        console.log('Using fallback data');
        // Simplified fallback - would normally have mock data here
    }

    /**
     * Refresh data
     */
    async refreshData() {
        this.isInitialized = false;
        await this.initialize();
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => new ChampionshipManager().initialize(), 100);
});

