/**
 * EFC Data Loader - Loads and processes CSV data from Google Sheets
 * Updated with exact sheet structure from documentation and calendar functionality
 */

class EFCDataLoader {
    constructor() {
        this.baseSheetUrl = 'https://docs.google.com/spreadsheets/d/1q5C96pUBR5SUsW3lTyF8LFbzkSlPYVa8w-hrW564Rxo';
        this.dataCache = {};
        this.isLoading = false;
        
        // Sheet names from documentation
        this.sheetNames = {
            driverMaster: 'DriverMaster',
            teamMaster: 'TeamMaster',
            ownersEngineers: 'Owners and Engineers',
            raceCalendar: 'RaceCalendar',
            circuitMaster: 'CircuitMaster',
            raceResults: 'RaceResults',
            qualifyingResults: 'QualifyingResults',
            driverStats: 'DriverStats',
            teamStats: 'TeamStats',
            pointsTable: 'PointsTable',
            hof: 'HOF',
            media: 'Media'
        };
        
        // Team abbreviations mapping
        this.teamAbbreviations = {
            'MCL': 'McLaren',
            'MER': 'Mercedes',
            'FER': 'Ferrari',
            'RBR': 'Red Bull',
            'ALP': 'Alpine',
            'AST': 'Aston Martin',
            'HAA': 'Haas',
            'ALF': 'Alfa Romeo',
            'WIL': 'Williams',
            'RBU': 'Racing Bulls',
            'Default': 'Unknown Team'
        };
        
        // Points system (P1 = 25, P2 = 18, etc.)
        this.pointsSystem = {
            'P1': 25, 'P2': 18, 'P3': 15, 'P4': 12, 'P5': 10,
            'P6': 8, 'P7': 6, 'P8': 4, 'P9': 2, 'P10': 1,
            'P11': 0, 'P12': 0, 'P13': 0, 'P14': 0, 'P15': 0,
            'P16': 0, 'P17': 0, 'P18': 0, 'P19': 0, 'P20': 0
        };
    }

    /**
     * Fetch all data for homepage
     */
    async loadHomepageData() {
        if (this.isLoading) return this.dataCache;
        this.isLoading = true;
        
        console.log('Loading homepage data...');

        try {
            // Load all required sheets in parallel
            const [
                driverMasterData,
                teamMasterData,
                raceCalendarData,
                driverStatsData,
                raceResultsData,
                qualifyingResultsData,
                circuitMasterData,
                mediaData
            ] = await Promise.all([
                this.fetchCSV(this.sheetNames.driverMaster),
                this.fetchCSV(this.sheetNames.teamMaster),
                this.fetchCSV(this.sheetNames.raceCalendar),
                this.fetchCSV(this.sheetNames.driverStats),
                this.fetchCSV(this.sheetNames.raceResults),
                this.fetchCSV(this.sheetNames.qualifyingResults),
                this.fetchCSV(this.sheetNames.circuitMaster),
                this.fetchCSV(this.sheetNames.media)
            ]);

            // Process each sheet with its specific structure
            this.dataCache = {
                driverMaster: this.processDriverMaster(driverMasterData),
                teamMaster: this.processTeamMaster(teamMasterData),
                raceCalendar: this.processRaceCalendar(raceCalendarData),
                driverStats: this.processDriverStats(driverStatsData),
                raceResults: this.processRaceResults(raceResultsData),
                qualifyingResults: this.processQualifyingResults(qualifyingResultsData),
                circuitMaster: this.processCircuitMaster(circuitMasterData),
                media: this.processMedia(mediaData)
            };

            console.log('Data loaded successfully:', {
                drivers: this.dataCache.driverMaster.length,
                teams: this.dataCache.teamMaster.length,
                races: this.dataCache.raceCalendar.length,
                driverStats: this.dataCache.driverStats.length,
                completedRaces: this.getCompletedRacesCount()
            });
            
            return this.dataCache;

        } catch (error) {
            console.error('Error loading homepage data:', error);
            // Return empty structure to prevent crashes
            return {
                driverMaster: [],
                teamMaster: [],
                raceCalendar: [],
                driverStats: [],
                raceResults: { headers: [], results: [], completedRaces: [] },
                qualifyingResults: { headers: [], results: [] },
                circuitMaster: [],
                media: {}
            };
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Load and process data specifically for the calendar page
     */
    async loadCalendarData() {
        if (this.dataCache.calendarData) {
            return this.dataCache.calendarData;
        }

        try {
            console.log('Loading calendar data...');
            
            // Load required sheets for calendar
            const [raceCalendarData, circuitMasterData, raceResultsData] = await Promise.all([
                this.fetchCSV(this.sheetNames.raceCalendar),
                this.fetchCSV(this.sheetNames.circuitMaster),
                this.fetchCSV(this.sheetNames.raceResults)
            ]);

            // Process the data
            const races = this.processRaceCalendarForCalendar(raceCalendarData, circuitMasterData, raceResultsData);
            const circuits = this.processCircuitMaster(circuitMasterData);
            const nextRace = this.findNextRaceForCalendar(races);
            const stats = this.calculateCalendarStats(races);
            
            this.dataCache.calendarData = {
                races,
                circuits,
                nextRace,
                stats
            };

            console.log('Calendar data loaded:', {
                races: races.length,
                circuits: circuits.length,
                nextRace: nextRace?.name
            });
            
            return this.dataCache.calendarData;

        } catch (error) {
            console.error('Error loading calendar data:', error);
            return this.getMockCalendarData();
        }
    }

    /**
     * Get processed calendar data
     */
    getCalendarData() {
        if (!this.dataCache.calendarData) {
            console.warn('Calendar data not loaded yet');
            return this.getMockCalendarData();
        }
        return this.dataCache.calendarData;
    }

    /**
     * Process RaceCalendar specifically for calendar page
     */
    processRaceCalendarForCalendar(csvText, circuitMasterData, raceResultsData) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 3) return [];
        
        const races = [];
        
        // Parse the RaceCalendar data
        const raceNames = this.parseCSVLine(lines[0]);
        const dates = this.parseCSVLine(lines[1]);
        const roundLabels = this.parseCSVLine(lines[2]);
        
        // Parse race results to get winners
        const raceResults = this.parseRaceResultsForWinners(raceResultsData);
        const completedRaces = this.getCompletedRacesFromRaceResults(raceResultsData);
        
        // Determine current date for status calculation
        const currentDate = new Date();
        
        // Start from Column B (index 1)
        for (let i = 1; i < raceNames.length; i++) {
            if (!raceNames[i] || raceNames[i].trim() === '') continue;
            
            const raceName = raceNames[i].trim();
            const roundLabel = (roundLabels[i] || `Round ${i}`).trim();
            const dateStr = (dates[i] || '').trim();
            
            // Determine status
            let status = 'upcoming';
            const raceIndex = i - 1; // 0-based index
            
            if (completedRaces.includes(raceIndex)) {
                status = 'completed';
            } else if (raceIndex === completedRaces.length) {
                status = 'next';
            }
            
            // Find circuit info
            const circuitInfo = this.getCircuitInfoForRace(raceName, circuitMasterData);
            
            // Find winner if race is completed
            let winner = null;
            if (status === 'completed' && raceResults[raceIndex]) {
                winner = raceResults[raceIndex];
            }
            
            // Format date
            const formattedDate = this.formatDateForCalendar(dateStr);
            
            races.push({
                round: roundLabel,
                name: raceName,
                date: formattedDate,
                rawDate: dateStr, // Keep original for countdown
                circuit: circuitInfo.circuitName || raceName.replace('Grand Prix', '').trim() + ' Circuit',
                location: circuitInfo.location || 'TBA',
                status: status,
                winner: winner,
                circuitId: circuitInfo.id || `CIRC${i}`,
                laps: circuitInfo.laps || Math.floor(Math.random() * 20) + 50, // Mock laps if not available
                length: circuitInfo.length || 'TBA',
                record: circuitInfo.record || 'TBA'
            });
        }
        
        return races;
    }

    /**
     * Parse race results to extract winners
     */
    parseRaceResultsForWinners(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 4) return [];
        
        const winners = [];
        
        // Skip first 3 header rows
        for (let i = 3; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 2) continue;
            
            const driver = values[0];
            
            // Check each race column (columns B-K = Rounds 1-10)
            for (let round = 1; round <= Math.min(10, values.length - 1); round++) {
                const result = values[round] || '';
                if (result.includes('P1')) {
                    if (!winners[round - 1]) {
                        winners[round - 1] = driver;
                    }
                }
            }
        }
        
        return winners;
    }

    /**
     * Get completed races from race results
     */
    getCompletedRacesFromRaceResults(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 1) return [];
        
        // Row 1: "x" markers for completed races
        const completionLine = this.parseCSVLine(lines[0]);
        const completedRaces = [];
        
        // Check each race column (starting from column B)
        for (let i = 1; i < completionLine.length; i++) {
            if (completionLine[i] && completionLine[i].trim().toLowerCase() === 'x') {
                completedRaces.push(i - 1); // Store index (0-based for Round 1)
            }
        }
        
        return completedRaces;
    }

    /**
     * Get circuit info for a specific race
     */
    getCircuitInfoForRace(raceName, circuitMasterData) {
        if (!raceName || !circuitMasterData) {
            return { location: '', circuitName: '', id: '', length: '', record: '' };
        }
        
        // Process circuit master if needed
        let circuits = circuitMasterData;
        if (typeof circuitMasterData === 'string') {
            circuits = this.processCircuitMaster(circuitMasterData);
        }
        
        if (!Array.isArray(circuits) || circuits.length === 0) {
            return { location: '', circuitName: '', id: '', length: '', record: '' };
        }
        
        // Try to find exact match first
        const raceNameLower = raceName.toLowerCase();
        let circuit = circuits.find(c => 
            c.raceName && c.raceName.toLowerCase() === raceNameLower
        );
        
        // If not found, try partial match
        if (!circuit) {
            circuit = circuits.find(c => 
                c.raceName && raceNameLower.includes(c.raceName.toLowerCase().split(' ')[0])
            );
        }
        
        // If still not found, try matching by common patterns
        if (!circuit) {
            circuit = circuits.find(c => {
                if (!c.raceName) return false;
                const circuitNameLower = c.raceName.toLowerCase();
                
                // Check for common country/circuit patterns
                return raceNameLower.includes('germany') && circuitNameLower.includes('germany') ||
                       raceNameLower.includes('australia') && circuitNameLower.includes('australia') ||
                       raceNameLower.includes('japan') && circuitNameLower.includes('japan') ||
                       raceNameLower.includes('brazil') && circuitNameLower.includes('brazil') ||
                       raceNameLower.includes('usa') && circuitNameLower.includes('usa') ||
                       raceNameLower.includes('britain') && circuitNameLower.includes('britain') ||
                       raceNameLower.includes('italy') && circuitNameLower.includes('italy') ||
                       raceNameLower.includes('monaco') && circuitNameLower.includes('monaco') ||
                       raceNameLower.includes('spain') && circuitNameLower.includes('spain');
            });
        }
        
        return circuit || { 
            location: 'TBA', 
            circuitName: raceName.replace('Grand Prix', '').trim() + ' Circuit',
            id: '',
            length: '',
            record: ''
        };
    }

    /**
     * Format date specifically for calendar display
     */
    formatDateForCalendar(dateStr) {
        if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'tbd') {
            return 'TBD';
        }
        
        dateStr = dateStr.trim();
        
        try {
            // Check if it's already in a readable format (contains month name)
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                              'july', 'august', 'september', 'october', 'november', 'december'];
            
            const dateLower = dateStr.toLowerCase();
            const hasMonthName = monthNames.some(month => dateLower.includes(month));
            
            if (hasMonthName) {
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                }
                return dateStr;
            }
            
            // Handle numeric formats
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/').map(part => parseInt(part, 10));
                
                if (parts.length === 3 && !parts.some(isNaN)) {
                    // Try both M/D/YYYY and D/M/YYYY
                    const [first, second, year] = parts;
                    let month, day;
                    
                    if (first <= 12 && second <= 31) {
                        month = first;
                        day = second;
                    } else if (first > 12 && second <= 12) {
                        day = first;
                        month = second;
                    } else if (second > 12 && first <= 12) {
                        month = first;
                        day = second;
                    } else {
                        month = first;
                        day = second;
                    }
                    
                    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000) {
                        return dateStr;
                    }
                    
                    const date = new Date(year, month - 1, day);
                    
                    if (isNaN(date.getTime())) {
                        return dateStr;
                    }
                    
                    return date.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                }
            }
            
            // Try to parse as-is
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            }
            
            return dateStr;
            
        } catch (error) {
            console.error('Error formatting calendar date:', dateStr, error);
            return dateStr;
        }
    }

    /**
     * Find next race for calendar
     */
    findNextRaceForCalendar(races) {
        if (!races || races.length === 0) return null;
        
        // Find next upcoming race
        const nextRace = races.find(race => race.status === 'next');
        if (nextRace) return nextRace;
        
        // If no "next" status, find first upcoming race
        const upcomingRace = races.find(race => race.status === 'upcoming');
        if (upcomingRace) return upcomingRace;
        
        // If all races completed, return last race
        return races[races.length - 1];
    }

    /**
     * Calculate calendar stats
     */
    calculateCalendarStats(races) {
        if (!races || races.length === 0) {
            return {
                completed: 0,
                upcoming: 0,
                total: 0,
                progress: 0
            };
        }
        
        const completed = races.filter(race => race.status === 'completed').length;
        const upcoming = races.filter(race => race.status === 'upcoming').length;
        const total = races.length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        return {
            completed,
            upcoming,
            total,
            progress
        };
    }

    /**
     * Fetch CSV from Google Sheets
     */
    async fetchCSV(sheetName) {
        try {
            const encodedSheetName = encodeURIComponent(sheetName);
            const csvUrl = `https://docs.google.com/spreadsheets/d/1q5C96pUBR5SUsW3lTyF8LFbzkSlPYVa8w-hrW564Rxo/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
            
            console.log(`Fetching: ${sheetName}`);
            const response = await fetch(csvUrl);
            
            if (!response.ok) {
                console.warn(`Failed to fetch ${sheetName}, status: ${response.status}`);
                return '';
            }
            
            return await response.text();
            
        } catch (error) {
            console.error(`Error fetching ${sheetName}:`, error);
            return '';
        }
    }

    /**
     * Process DriverMaster data
     * Structure: 13 columns (including value), 20 drivers
     */
    processDriverMaster(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const drivers = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 6) continue;
            
            const driver = {
                username: values[0] || '',
                id: values[1] || '',
                shortened: values[2] || '',
                discord: values[3] || '',
                nationality: values[4] || '',
                teamCode: values[5] || '',
                position: values[6] || '',
                active: values[7] || '',
                photo: values[8] || '',
                number: values[9] || '',
                socials: values[10] || '',
                description: values[11] || '',
                value: values[12] || '', // Column M - Driver Value
                teamName: this.getTeamNameFromCode(values[5] || '')
            };
            
            // Only add if we have a username
            if (driver.username) {
                drivers.push(driver);
            }
        }
        
        return drivers;
    }

    /**
     * Process TeamMaster data
     * Structure: 16 columns, 14 teams
     */
    processTeamMaster(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const teams = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 3) continue;
            
            const team = {
                name: values[0] || '',
                sponsor: values[1] || '',
                id: values[2] || '',
                primaryColor: values[3] || '#00f7ff',
                secondaryColor: values[4] || '#ffffff',
                logoUrl: values[5] || '',
                carImageUrl: values[6] || '',
                driver1: values[7] || '',
                driver2: values[8] || '',
                reserve1: values[9] || '',
                reserve2: values[10] || '',
                teamOwner: values[11] || '',
                teamPrincipal: values[12] || '',
                engineer: values[13] || '',
                description: values[14] || '',
                active: values[15] || 'y',
                fullName: this.getFullTeamName(values[0] || '')
            };
            
            // Only add if we have a team ID
            if (team.id) {
                teams.push(team);
            }
        }
        
        return teams;
    }

    /**
     * Process RaceCalendar data - SIMPLE FIX
     */
    processRaceCalendar(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 3) return [];
        
        const races = [];
        
        // Row 1: Race names
        // Row 2: Dates (not round labels)
        // Row 3: Round labels (not dates)
        const raceNames = this.parseCSVLine(lines[0]);
        const dates = this.parseCSVLine(lines[1]);      // This has dates
        const roundLabels = this.parseCSVLine(lines[2]); // This has round labels
        
        // Start from Column B (index 1)
        for (let i = 1; i < raceNames.length; i++) {
            if (!raceNames[i] || raceNames[i].trim() === '') continue;
            
            const race = {
                name: raceNames[i].trim(),
                round: (roundLabels[i] || `Round ${i}`).trim(),  // Get round from row 3
                date: (dates[i] || '').trim(),                   // Get date from row 2
                time: '',
                laps: ''
            };
            
            races.push(race);
        }
        
        return races;
    }

    /**
     * Process DriverStats data
     * Structure: 18 columns, 20 drivers
     */
    processDriverStats(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const stats = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 2) continue;
            
            const stat = {
                driver: values[0] || '',
                racesAttended: this.parseNumber(values[1]),
                points: this.parseNumber(values[2]),
                ptsPerRace: this.parseNumber(values[3]),
                avgFinish: this.parseNumber(values[4]),
                avgQuali: this.parseNumber(values[5]),
                wins: this.parseNumber(values[6]),
                podiums: this.parseNumber(values[7]),
                poles: this.parseNumber(values[8]),
                driverRating: this.parseNumber(values[9]),
                consistencyScore: this.parseNumber(values[10]),
                performanceScore: this.parseNumber(values[11]),
                fastestLaps: this.parseNumber(values[12]),
                highestFinish: values[13] || '',
                avgPosGainLoss: this.parseNumber(values[14]),
                podiumRate: this.parseNumber(values[15]),
                dnfs: this.parseNumber(values[16]),
                championships: this.parseNumber(values[17])
            };
            
            // Only add if we have a driver name
            if (stat.driver) {
                stats.push(stat);
            }
        }
        
        return stats;
    }

    /**
     * Process RaceResults data
     * Special structure with 3 header rows
     * Row 1 has "x" in each race column if completed
     */
    processRaceResults(csvText) {
        if (!csvText) return { 
            headers: [], 
            results: [], 
            completedRaces: [],
            raceWinners: {} 
        };
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 4) return { 
            headers: [], 
            results: [], 
            completedRaces: [],
            raceWinners: {} 
        };
        
        // Row 1: "x" markers for completed races
        const completionLine = this.parseCSVLine(lines[0]);
        const completedRaces = [];
        
        // Check each race column (starting from column B)
        for (let i = 1; i < completionLine.length; i++) {
            if (completionLine[i] && completionLine[i].trim().toLowerCase() === 'x') {
                completedRaces.push(i - 1); // Store index (0-based for Round 1)
            }
        }
        
        // Row 2: Race names (Row 1 is filler "x" cells)
        const raceNamesLine = this.parseCSVLine(lines[1]);
        const raceNames = raceNamesLine.slice(1);
        
        // Row 3: Round labels
        const roundLabelsLine = this.parseCSVLine(lines[2]);
        const roundLabels = roundLabelsLine.slice(1);
        
        // Process driver results (Rows 4-23)
        const results = [];
        const raceWinners = {};
        
        for (let i = 3; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 1) continue;
            
            const driverResult = {
                driver: values[0] || '',
                results: {}
            };
            
            // Map each round result (columns B-K = Rounds 1-10)
            for (let round = 1; round <= Math.min(10, values.length - 1); round++) {
                const result = values[round] || '';
                driverResult.results[`Round ${round}`] = result;
                
                // Check if this is a winner (P1) for completed races
                if (completedRaces.includes(round - 1) && result.includes('P1')) {
                    if (!raceWinners[`Round ${round}`]) {
                        raceWinners[`Round ${round}`] = {
                            driver: values[0],
                            hasFastestLap: result.includes('Fastest Lap')
                        };
                    }
                }
            }
            
            if (driverResult.driver) {
                results.push(driverResult);
            }
        }
        
        return {
            headers: {
                raceNames: raceNames,
                roundLabels: roundLabels
            },
            results: results,
            completedRaces: completedRaces,
            raceWinners: raceWinners
        };
    }

    /**
     * Process QualifyingResults data
     * Special structure with 2 header rows
     */
    processQualifyingResults(csvText) {
        if (!csvText) return { headers: [], results: [] };
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 3) return { headers: [], results: [] };
        
        // Row 1: Race names
        const raceNamesLine = this.parseCSVLine(lines[0]);
        const raceNames = raceNamesLine.slice(1);
        
        // Row 2: Round labels
        const roundLabelsLine = this.parseCSVLine(lines[1]);
        const roundLabels = roundLabelsLine.slice(1);
        
        // Process driver results (Rows 3-22)
        const results = [];
        
        for (let i = 2; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 1) continue;
            
            const driverResult = {
                driver: values[0] || '',
                results: {}
            };
            
            // Map each round result (columns B-L = Rounds 1-11)
            for (let round = 1; round <= Math.min(11, values.length - 1); round++) {
                const result = values[round] || '';
                driverResult.results[`Round ${round}`] = result;
            }
            
            if (driverResult.driver) {
                results.push(driverResult);
            }
        }
        
        return {
            headers: {
                raceNames: raceNames,
                roundLabels: roundLabels
            },
            results: results
        };
    }

    /**
     * Process CircuitMaster data with track layout images
     */
    processCircuitMaster(csvText) {
        if (!csvText) return [];
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return [];
        
        const headers = this.parseCSVLine(lines[0]);
        const circuits = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length < 3) continue;
            
            const circuit = {
                raceName: values[0] || '',
                id: values[1] || '',
                location: values[2] || '',
                length: values[3] || '',
                record: values[4] || '',
                description: values[5] || '',
                circuitName: values[6] || '',
                trackLayoutImage: values[7] || ''  // Column H - Track layout pictures
            };
        
            if (circuit.raceName) {
                circuits.push(circuit);
            }
        }
        
        return circuits;
    }

    /**
     * Process Media data
     * Column A row 2 = Driver of the Day
     */
    processMedia(csvText) {
        if (!csvText) return { dotd: '', articleLink: '', youtubeLink: '' };
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return { dotd: '', articleLink: '', youtubeLink: '' };
        
        const headers = this.parseCSVLine(lines[0]);
        const values = this.parseCSVLine(lines[1]);
        
        return {
            dotd: values[0] || '',
            articleLink: values[1] || '',
            youtubeLink: values[2] || ''
        };
    }

    /**
     * Parse CSV line with proper quote handling
     */
    parseCSVLine(line) {
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
                i++; // Skip next quote
            } else if (char === '"' && inQuotes) {
                inQuotes = false;
            } else if (char === ',' && !inQuotes) {
                result.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        
        result.push(currentValue);
        return result;
    }

    /**
     * Parse string to number, handling empty values
     */
    parseNumber(value) {
        if (!value || value.trim() === '') return 0;
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Get team name from team code
     */
    getTeamNameFromCode(code) {
        return this.teamAbbreviations[code] || code || 'Unknown Team';
    }

    /**
     * Get full team name (with sponsor if available)
     */
    getFullTeamName(teamName) {
        if (!teamName) return 'Unknown Team';
        
        // Common team mappings
        const teamMappings = {
            'MCL': 'McLaren',
            'MER': 'Mercedes-AMG Petronas',
            'FER': 'Scuderia Ferrari',
            'RBR': 'Red Bull Racing',
            'ALP': 'Alpine',
            'AST': 'Aston Martin Aramco',
            'HAA': 'Haas F1 Team',
            'ALF': 'Alfa Romeo',
            'WIL': 'Williams',
            'RBU': 'Visa Cash App RB'
        };
        
        // Check if teamName is a code
        if (teamMappings[teamName]) {
            return teamMappings[teamName];
        }
        
        // Check if teamName contains known team names
        for (const [code, fullName] of Object.entries(teamMappings)) {
            if (fullName.toLowerCase().includes(teamName.toLowerCase()) || 
                teamName.toLowerCase().includes(fullName.toLowerCase())) {
                return fullName;
            }
        }
        
        return teamName;
    }

    /**
     * Get number of completed races
     */
    getCompletedRacesCount() {
        const raceResults = this.dataCache.raceResults || {};
        return raceResults.completedRaces ? raceResults.completedRaces.length : 0;
    }

    /**
     * Get processed data for homepage widgets
     */
    getHomepageWidgetData() {
        if (!this.dataCache.driverMaster || this.dataCache.driverMaster.length === 0) {
            console.warn('No data loaded yet');
            return this.getMockData();
        }

        return {
            // Hero stats
            heroStats: this.getHeroStats(),
            
            // Top drivers by points
            topDrivers: this.getTopDrivers(5),
            
            // Top constructors by points (calculated from driver points)
            topConstructors: this.getTopConstructors(5),
            
            // Top rated drivers
            topRatedDrivers: this.getTopRatedDrivers(5),
            
            // Next race info
            nextRace: this.getNextRace(),
            
            // Previous race info (from completed races)
            previousRace: this.getPreviousRace(),
            
            // Upcoming calendar
            upcomingRaces: this.getUpcomingRaces(5),
            
            // Driver of the day (from Media sheet)
            driverOfTheDay: this.getDriverOfTheDay(),
            
            // Latest article info (from Media sheet if available)
            latestArticle: this.getLatestArticle()
        };
    }

    /**
     * Get hero stats for the homepage
     */
    getHeroStats() {
        const drivers = this.dataCache.driverMaster || [];
        const teams = this.dataCache.teamMaster || [];
        const calendar = this.dataCache.raceCalendar || [];
        const completedRaces = this.getCompletedRacesCount();
        
        return {
            totalRaces: calendar.length,
            totalDrivers: drivers.length,
            totalTeams: teams.length,
            completedRaces: completedRaces
        };
    }

    /**
     * Get top drivers by points
     */
    getTopDrivers(limit = 5) {
        const driverStats = this.dataCache.driverStats || [];
        const driverMaster = this.dataCache.driverMaster || [];
        
        if (driverStats.length === 0) {
            // Fallback to mock data
            return this.getMockTopDrivers(limit);
        }
        
        // Sort by points (descending)
        const sortedStats = [...driverStats].sort((a, b) => b.points - a.points);
        
        return sortedStats.slice(0, limit).map((stat, index) => {
            // Find driver info
            const driverInfo = driverMaster.find(d => d.username === stat.driver) || {};
            
            return {
                position: index + 1,
                name: stat.driver,
                points: stat.points || 0,
                wins: stat.wins || 0,
                team: driverInfo.teamName || this.getTeamNameFromCode(driverInfo.teamCode || '')
            };
        });
    }

    /**
     * Get top constructors by points (calculated from driver points)
     */
    getTopConstructors(limit = 5) {
        const driverStats = this.dataCache.driverStats || [];
        const driverMaster = this.dataCache.driverMaster || [];
        const teamMaster = this.dataCache.teamMaster || [];
        
        if (driverStats.length === 0) {
            return this.getMockTopConstructors(limit);
        }
        
        // Group points by team
        const teamPoints = {};
        const teamWins = {};
        
        driverStats.forEach(stat => {
            const driverInfo = driverMaster.find(d => d.username === stat.driver);
            if (driverInfo && driverInfo.teamCode) {
                const teamCode = driverInfo.teamCode;
                if (!teamPoints[teamCode]) {
                    teamPoints[teamCode] = 0;
                    teamWins[teamCode] = 0;
                }
                teamPoints[teamCode] += stat.points || 0;
                teamWins[teamCode] += stat.wins || 0;
            }
        });
        
        // Convert to array and sort
        const constructors = Object.entries(teamPoints)
            .map(([teamCode, points]) => {
                // Find team info
                const teamInfo = teamMaster.find(t => t.id === teamCode) || {};
                
                // Get drivers for this team
                const teamDrivers = driverMaster
                    .filter(d => d.teamCode === teamCode)
                    .map(d => d.username);
                
                return {
                    teamCode: teamCode,
                    name: teamInfo.name || this.getTeamNameFromCode(teamCode),
                    points: points,
                    wins: teamWins[teamCode] || 0,
                    drivers: teamDrivers
                };
            })
            .sort((a, b) => b.points - a.points);
        
        return constructors.slice(0, limit);
    }

    /**
     * Get top rated drivers
     */
    getTopRatedDrivers(limit = 5) {
        const driverStats = this.dataCache.driverStats || [];
        
        if (driverStats.length === 0) {
            return this.getMockTopRatedDrivers(limit);
        }
        
        // Sort by driver rating (descending)
        const sortedStats = [...driverStats].sort((a, b) => b.driverRating - a.driverRating);
        
        return sortedStats.slice(0, limit).map((stat, index) => ({
            position: index + 1,
            name: stat.driver,
            rating: stat.driverRating || 0
        }));
    }

    /**
     * Get next race info - FIXED VERSION
     */
    getNextRace() {
        const calendar = this.dataCache.raceCalendar || [];
        const circuitMaster = this.dataCache.circuitMaster || [];
        const completedRaces = this.getCompletedRacesCount();
        
        if (calendar.length === 0) {
            return {
                name: 'SEASON NOT STARTED',
                round: 'TBD',
                date: 'Coming Soon',
                circuit: 'TBA',
                status: 'not_started'
            };
        }

        // If no races completed yet, next race is Round 1
        if (completedRaces === 0) {
            const firstRace = calendar[0];
            
            // Find circuit info for this race
            let circuitInfo = this.getCircuitInfo(firstRace.name, circuitMaster);
            
            return {
                name: firstRace.name,
                round: firstRace.round || `Round ${completedRaces + 1}`,
                date: this.formatDate(firstRace.date),
                circuit: circuitInfo.location || 'TBA',
                circuitName: circuitInfo.circuitName || '',
                status: 'upcoming'
            };
        }
        
        // Otherwise, next race is after last completed race
        if (completedRaces < calendar.length) {
            const nextRace = calendar[completedRaces]; // 0-based index
            
            // Find circuit info for this race
            let circuitInfo = this.getCircuitInfo(nextRace.name, circuitMaster);
            
            return {
                name: nextRace.name,
                round: nextRace.round || `Round ${completedRaces + 1}`,
                date: this.formatDate(nextRace.date),
                circuit: circuitInfo.location || 'TBA',
                circuitName: circuitInfo.circuitName || '',
                status: 'upcoming'
            };
        }

        // All races completed
        return {
            name: 'SEASON COMPLETED',
            round: '-',
            date: '-',
            circuit: '-',
            status: 'completed'
        };
    }

    /**
     * Helper: Get circuit info from CircuitMaster
     */
    getCircuitInfo(raceName, circuitMaster) {
        if (!raceName || !circuitMaster || circuitMaster.length === 0) {
            return { location: '', circuitName: '' };
        }
        
        // Try to find exact match first
        let circuit = circuitMaster.find(c => 
            c.raceName && raceName && 
            c.raceName.toLowerCase() === raceName.toLowerCase()
        );
        
        // If not found, try partial match
        if (!circuit) {
            circuit = circuitMaster.find(c => 
                c.raceName && raceName && 
                raceName.toLowerCase().includes(c.raceName.toLowerCase().split(' ')[0])
            );
        }
        
        // If still not found, try matching by common patterns
        if (!circuit) {
            const raceNameLower = raceName.toLowerCase();
            circuit = circuitMaster.find(c => {
                if (!c.raceName) return false;
                const circuitNameLower = c.raceName.toLowerCase();
                
                // Check for common patterns
                return raceNameLower.includes('germany') && circuitNameLower.includes('germany') ||
                       raceNameLower.includes('australia') && circuitNameLower.includes('australia') ||
                       raceNameLower.includes('japan') && circuitNameLower.includes('japan') ||
                       raceNameLower.includes('brazil') && circuitNameLower.includes('brazil') ||
                       raceNameLower.includes('usa') && circuitNameLower.includes('usa') ||
                       raceNameLower.includes('britain') && circuitNameLower.includes('britain') ||
                       raceNameLower.includes('italy') && circuitNameLower.includes('italy');
            });
        }
        
        return circuit || { location: '', circuitName: '' };
    }

    /**
     * Format date from M/D/YYYY to more readable format
     * Sheet uses M/D/YYYY format (e.g., "3/14/2026" for March 14, 2026)
     */
    formatDate(dateStr) {
        console.log('formatDate() called with:', dateStr);
        
        if (!dateStr || dateStr.trim() === '' || dateStr.toLowerCase() === 'tbd') {
            return 'TBD';
        }
        
        // Clean the date string
        dateStr = dateStr.trim();
        
        try {
            // Handle DD/MM/YYYY format (like "14/03/2026" from Google Sheets)
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/').map(part => parseInt(part, 10));
                
                if (parts.length === 3 && !parts.some(isNaN)) {
                    // Assume DD/MM/YYYY format from Google Sheets CSV export
                    const [day, month, year] = parts;
                    
                    // Validate ranges
                    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) {
                        return dateStr; // Return original if invalid
                    }
                    
                    const date = new Date(year, month - 1, day);
                    
                    if (isNaN(date.getTime())) {
                        return dateStr;
                    }
                    
                    // Format as "Month Day, Year"
                    return date.toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                    });
                }
            }
            
            // If not in slash format, try parsing as-is
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            }
            
            // Return original if all parsing fails
            return dateStr;
            
        } catch (error) {
            console.error('Error formatting date:', dateStr, error);
            return dateStr;
        }
    }

    /**
     * Get previous race info
     */
    getPreviousRace() {
        const raceResults = this.dataCache.raceResults || {};
        const calendar = this.dataCache.raceCalendar || [];
        const completedRaces = this.getCompletedRacesCount();
        
        if (completedRaces === 0) {
            return {
                name: 'SEASON NOT STARTED',
                winner: 'Awaiting Start',
                fastestLap: 'N/A',
                date: 'TBD',
                status: 'not_started'
            };
        }

        // Get last completed race
        const lastCompletedIndex = completedRaces - 1; // 0-based
        const lastRace = calendar[lastCompletedIndex];
        
        if (!lastRace) {
            return {
                name: 'NO RACE INFO',
                winner: 'N/A',
                fastestLap: 'N/A',
                date: 'N/A',
                status: 'none'
            };
        }
        
        // Try to get winner from race results
        let winner = 'Unknown';
        let fastestLap = 'N/A';
        
        if (raceResults.raceWinners && raceResults.raceWinners[`Round ${lastCompletedIndex + 1}`]) {
            const raceWinner = raceResults.raceWinners[`Round ${lastCompletedIndex + 1}`];
            winner = raceWinner.driver || 'Unknown';
            
            // For fastest lap, we need to parse race results
            // This is simplified - would need to check all results for "(Fastest Lap)"
            fastestLap = raceWinner.hasFastestLap ? winner : 'Unknown';
        } else {
            // Fallback: get top driver from stats
            const topDrivers = this.getTopDrivers(1);
            if (topDrivers.length > 0) {
                winner = topDrivers[0].name;
                fastestLap = topDrivers[0].name; // Simplified
            }
        }
        
        return {
            name: lastRace.name,
            winner: winner,
            fastestLap: fastestLap,
            date: this.formatDate(lastRace.date),
            status: 'completed'
        };
    }

    /**
     * Get upcoming races
     */
    getUpcomingRaces(limit = 5) {
        const calendar = this.dataCache.raceCalendar || [];
        const completedRaces = this.getCompletedRacesCount();
        
        if (calendar.length === 0) return [];
        
        // Get races starting from the next one
        const upcoming = calendar.slice(completedRaces);
        
        return upcoming.slice(0, limit).map(race => ({
            name: race.name,
            round: race.round,
            date: this.formatDate(race.date),
            location: 'TBA'
        }));
    }

    /**
     * Get driver of the day (from Media sheet)
     */
    getDriverOfTheDay() {
        const media = this.dataCache.media || {};
        const driverMaster = this.dataCache.driverMaster || [];
        const driverStats = this.dataCache.driverStats || [];
        
        let dotdDriver = media.dotd || '';
        
        // If no DOTD in media sheet, use top rated driver
        if (!dotdDriver) {
            const topRated = this.getTopRatedDrivers(1)[0];
            dotdDriver = topRated?.name || '';
        }
        
        // Find driver info
        const driverInfo = driverMaster.find(d => d.username === dotdDriver);
        const driverStat = driverStats.find(d => d.driver === dotdDriver);
        
        return {
            name: dotdDriver || 'No DOTD Selected',
            rating: driverStat ? driverStat.driverRating : 0,
            team: driverInfo ? driverInfo.teamName : 'Unknown Team',
            teamCode: driverInfo ? driverInfo.teamCode : '',
            points: driverStat ? driverStat.points : 0,
            wins: driverStat ? driverStat.wins : 0,
            photo: driverInfo ? driverInfo.photo : '',
            nationality: driverInfo ? driverInfo.nationality : '',
            number: driverInfo ? driverInfo.number : ''
        };
    }

    /**
     * Get latest article info
     */
    getLatestArticle() {
        const media = this.dataCache.media || {};
        
        return {
            title: 'EFC Season 2: Latest Updates',
            excerpt: 'Stay tuned for the latest news and developments in the EFC Racing League.',
            date: '2024-03-15',
            link: media.articleLink || '#'
        };
    }

    /**
     * Mock data for when real data isn't available
     */
    getMockData() {
        console.log('Using mock data');
        
        return {
            heroStats: {
                totalRaces: 11,
                totalDrivers: 20,
                totalTeams: 10,
                completedRaces: 0
            },
            topDrivers: this.getMockTopDrivers(5),
            topConstructors: this.getMockTopConstructors(5),
            topRatedDrivers: this.getMockTopRatedDrivers(5),
            nextRace: {
                name: 'GERMANY GRAND PRIX',
                round: 'ROUND 1',
                date: 'March 30, 2024',
                location: 'Nürburg, Germany',
                status: 'upcoming'
            },
            previousRace: {
                name: 'SEASON NOT STARTED',
                winner: 'Awaiting Start',
                fastestLap: 'N/A',
                date: 'TBD',
                status: 'not_started'
            },
            upcomingRaces: this.getMockUpcomingRaces(5),
            driverOfTheDay: this.getMockDriverOfTheDay(),
            latestArticle: {
                title: 'EFC Season 2 Launch Announcement',
                excerpt: 'The new season brings exciting changes and new competitors to the grid.',
                date: '2024-03-10',
                link: '#'
            }
        };
    }

    /**
     * Mock calendar data
     */
    getMockCalendarData() {
        console.log('Using mock calendar data');
        
        const races = [];
        const circuits = [];
        
        // Mock circuits
        const circuitNames = [
            'Silverstone Circuit', 'Monza', 'Spa-Francorchamps', 
            'Circuit de Monaco', 'Red Bull Ring', 'Hungaroring',
            'Circuit de Barcelona-Catalunya', 'Zandvoort', 'Autodromo Nazionale Monza',
            'Circuit Paul Ricard', 'Sochi Autodrom', 'Marina Bay Street Circuit'
        ];
        
        const locations = [
            'Silverstone, UK', 'Monza, Italy', 'Spa, Belgium',
            'Monte Carlo, Monaco', 'Spielberg, Austria', 'Budapest, Hungary',
            'Barcelona, Spain', 'Zandvoort, Netherlands', 'Monza, Italy',
            'Le Castellet, France', 'Sochi, Russia', 'Singapore'
        ];
        
        // Generate mock circuits
        for (let i = 0; i < circuitNames.length; i++) {
            circuits.push({
                id: `CIRC${i + 1}`,
                name: circuitNames[i],
                location: locations[i],
                length: `${(4 + Math.random() * 3).toFixed(3)} km`,
                laps: Math.floor(50 + Math.random() * 20),
                record: `${Math.floor(1 + Math.random() * 2)}:${Math.floor(10 + Math.random() * 49)}.${Math.floor(100 + Math.random() * 899)}`,
                description: `The ${circuitNames[i]} is one of the most challenging circuits on the calendar, featuring a mix of high-speed straights and technical corners.`
            });
        }
        
        // Generate mock races
        const currentDate = new Date();
        for (let i = 1; i <= 12; i++) {
            const raceDate = new Date(currentDate);
            raceDate.setDate(currentDate.getDate() + (i - 4) * 14); // Every 2 weeks
            
            const circuitIndex = (i - 1) % circuits.length;
            const status = i < 5 ? 'completed' : i === 5 ? 'next' : 'upcoming';
            
            races.push({
                round: `Round ${i}`,
                name: `${circuitNames[circuitIndex].split(' ')[0]} Grand Prix`,
                date: raceDate.toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                }),
                rawDate: raceDate.toISOString().split('T')[0],
                circuit: circuits[circuitIndex].name,
                location: circuits[circuitIndex].location,
                status: status,
                winner: status === 'completed' ? `Driver ${Math.floor(Math.random() * 20) + 1}` : null,
                circuitId: circuits[circuitIndex].id,
                laps: circuits[circuitIndex].laps,
                length: circuits[circuitIndex].length,
                record: circuits[circuitIndex].record
            });
        }
        
        const nextRace = races.find(r => r.status === 'next') || races[0];
        const stats = {
            completed: races.filter(r => r.status === 'completed').length,
            upcoming: races.filter(r => r.status === 'upcoming').length,
            total: races.length,
            progress: Math.round((races.filter(r => r.status === 'completed').length / races.length) * 100)
        };
        
        return {
            races,
            circuits,
            nextRace,
            stats
        };
    }

    getMockTopDrivers(limit) {
        const mockDrivers = [
            { name: 'Driver1', points: 156, wins: 3, team: 'McLaren' },
            { name: 'Driver2', points: 142, wins: 2, team: 'Mercedes' },
            { name: 'Driver3', points: 128, wins: 1, team: 'Ferrari' },
            { name: 'Driver4', points: 115, wins: 1, team: 'Red Bull' },
            { name: 'Driver5', points: 98, wins: 0, team: 'Alpine' }
        ];
        
        return mockDrivers.slice(0, limit).map((driver, index) => ({
            position: index + 1,
            ...driver
        }));
    }

    getMockTopConstructors(limit) {
        const mockConstructors = [
            { name: 'McLaren', points: 298, wins: 5 },
            { name: 'Mercedes', points: 284, wins: 4 },
            { name: 'Ferrari', points: 256, wins: 3 },
            { name: 'Red Bull', points: 230, wins: 2 },
            { name: 'Alpine', points: 196, wins: 1 }
        ];
        
        return mockConstructors.slice(0, limit).map((team, index) => ({
            position: index + 1,
            ...team
        }));
    }

    getMockTopRatedDrivers(limit) {
        const mockRatings = [
            { name: 'Driver1', rating: 9.8 },
            { name: 'Driver2', rating: 9.5 },
            { name: 'Driver3', rating: 9.3 },
            { name: 'Driver4', rating: 9.1 },
            { name: 'Driver5', rating: 8.9 }
        ];
        
        return mockRatings.slice(0, limit).map((driver, index) => ({
            position: index + 1,
            ...driver
        }));
    }

    getMockUpcomingRaces(limit) {
        const mockRaces = [
            { name: 'Germany GP', round: 'Round 1', date: 'March 30, 2024', location: 'Nürburg' },
            { name: 'Australia GP', round: 'Round 2', date: 'April 13, 2024', location: 'Melbourne' },
            { name: 'Japan GP', round: 'Round 3', date: 'April 27, 2024', location: 'Suzuka' },
            { name: 'Brazil GP', round: 'Round 4', date: 'May 11, 2024', location: 'Interlagos' },
            { name: 'USA GP', round: 'Round 5', date: 'May 25, 2024', location: 'Austin' }
        ];
        
        return mockRaces.slice(0, limit);
    }

    getMockDriverOfTheDay() {
        return {
            name: 'Driver1',
            rating: 9.8,
            team: 'McLaren',
            points: 156,
            wins: 3
        };
    }
}

// Create and export global instance
window.efcDataLoader = new EFCDataLoader();